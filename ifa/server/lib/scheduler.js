// Tâches planifiées : publications programmées, signaux programmés, ouverture
// des drops du Labo, lancement des défis. Un verrou consultatif Postgres
// garantit qu'une seule instance exécute un tour (pas de double envoi).
import { pool, q, many } from '../db.js';
import { config } from '../config.js';
import { dispatchBroadcast, scheduleBroadcast } from './notify.js';

const LOCK_KEY = 19_190_019;

const POST_CATEGORY = { release: 'release', clip: 'release', freestyle: 'release', event: 'event', announcement: 'announcement' };

export async function tick() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('select pg_try_advisory_lock($1) as ok', [LOCK_KEY]);
    if (!rows[0].ok) return { skipped: true };
    try {
      const out = { published: 0, broadcasts: 0, drops: 0, challenges: 0 };

      // 1. publications programmées
      const due = await many(`update posts set status = 'published', updated_at = now()
        where status = 'scheduled' and publish_at <= now() returning id`);
      out.published = due.length;

      // 2. publications marquées "prévenir les fans", une seule fois
      for (const p of await many(`update posts set notified_at = now()
          where status = 'published' and notify and notified_at is null and coalesce(publish_at, created_at) <= now()
          returning id, kind, title`)) {
        await scheduleBroadcast({
          category: POST_CATEGORY[p.kind] || 'news', importance: p.kind === 'announcement' ? 'important' : 'normal',
          title: p.title, url: `/qg/${p.id}`, origin: `post:${p.id}`,
        });
      }

      // 3. ouverture des drops du Labo
      for (const d of await many(`update drops set notified_at = now()
          where is_published and notify_on_open and notified_at is null and opens_at <= now()
            and (closes_at is null or closes_at > now())
          returning id, title, kind`)) {
        out.drops++;
        await scheduleBroadcast({
          category: d.kind === 'preview' ? 'drop' : 'exclusive', importance: 'important',
          title: d.kind === 'vote' ? `Vote ouvert : ${d.title}` : `Le Labo s'ouvre : ${d.title}`,
          url: `/labo/${d.id}`, origin: `drop:${d.id}`,
        });
      }

      // 4. lancement des défis
      for (const c of await many(`update challenges set notified_at = now()
          where is_published and notified_at is null and starts_at <= now() and (ends_at is null or ends_at > now())
          returning id, title`)) {
        out.challenges++;
        await scheduleBroadcast({ category: 'challenge', title: `Défi lancé : ${c.title}`, url: `/cercles/defi/${c.id}`, origin: `challenge:${c.id}` });
      }

      // 5. envoi des signaux arrivés à échéance
      for (const b of await many(`update broadcasts set status = 'sending'
          where id in (select id from broadcasts where status = 'scheduled' and send_at <= now() order by send_at limit 20)
          returning *`)) {
        try {
          const stats = await dispatchBroadcast(b);
          await q(`update broadcasts set status = 'sent', sent_at = now(), stats = $2 where id = $1`, [b.id, stats]);
        } catch (e) {
          console.error('[scheduler] envoi échoué', b.id, e.message);
          await q(`update broadcasts set status = 'failed', stats = $2 where id = $1`, [b.id, { error: e.message }]);
        }
        out.broadcasts++;
      }

      // 6. hygiène : sessions expirées ; comptes sans accord parental au bout de 30 jours
      await q('delete from sessions where expires_at < now()');
      await q(`delete from users where status = 'pending_parent' and created_at < now() - interval '30 days'`);
      return out;
    } finally {
      await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

export function startScheduler() {
  if (config.disableScheduler) return null;
  const run = () => tick().catch((e) => console.error('[scheduler]', e.message));
  run();
  return setInterval(run, config.schedulerIntervalMs);
}
