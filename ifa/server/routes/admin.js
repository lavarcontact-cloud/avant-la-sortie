// Espace équipe. Rôles :
//   moderator : modération (créations, commentaires, signalements), suspension de fans
//   editor    : publication (actus, stories, sorties, événements, Labo, défis, signaux), mise en avant, stats
//   admin     : tout, plus les rôles, le profil officiel et les intégrations
import { Router } from 'express';
import multer from 'multer';
import { q, one, many } from '../db.js';
import { requireRole, requireAnyRole, ROLE_RANK } from '../lib/auth.js';
import { fail, str, oneOf, date, url, uuid, bool } from '../lib/http.js';
import { saveBuffer, LIMITS } from '../lib/storage.js';
import { scheduleBroadcast } from '../lib/notify.js';
import { notifyUser } from '../lib/notify.js';
import { award } from '../lib/badges.js';
import { audit } from '../lib/audit.js';
import { mediaRef } from '../lib/content.js';
import { pushConfigured, mailConfigured, config } from '../config.js';
import { syncYouTube, syncInstagram, integrationStatus } from '../lib/integrations.js';

const r = Router();
export default r;
const staff = requireRole('moderator');
const editor = requireAnyRole('editor');
const modo = requireAnyRole('moderator');
const admin = requireRole('admin');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.staff.video, files: 1 } });

// ------------------------------------------------ tableau de bord
r.get('/admin/overview', staff, async (req, res) => {
  const n = async (sql, p) => (await one(sql, p)).n;
  const [users, active7, active1, pendingParents, pendingFan, openReports, scheduled, newUsers7] = await Promise.all([
    n(`select count(*)::int n from users where status <> 'deleted'`),
    n(`select count(distinct user_id)::int n from daily_activity where day > current_date - 7`),
    n(`select count(distinct user_id)::int n from daily_activity where day = current_date`),
    n(`select count(*)::int n from users where status = 'pending_parent'`),
    n(`select count(*)::int n from fan_posts where status = 'pending'`),
    n(`select count(*)::int n from reports where status = 'open'`),
    n(`select count(*)::int n from broadcasts where status = 'scheduled'`),
    n(`select count(*)::int n from users where created_at > now() - interval '7 days'`),
  ]);
  const pushSubs = await n('select count(distinct user_id)::int n from push_subscriptions');
  res.json({
    me: { role: req.user.role, handle: req.user.handle },
    counts: { users, active7, active1, pendingParents, pendingFan, openReports, scheduled, newUsers7, pushSubs },
    services: { push: pushConfigured(), mail: mailConfigured(), ...integrationStatus() },
  });
});

r.get('/admin/stats', editor, async (_req, res) => {
  const [daily, signups, top, topFan, byKind, broadcasts, votes] = await Promise.all([
    many(`select d::date as day, (select count(*)::int from daily_activity a where a.day = d::date) as active
          from generate_series(current_date - 29, current_date, '1 day') d order by d`),
    many(`select d::date as day, (select count(*)::int from users u where u.created_at::date = d::date) as n
          from generate_series(current_date - 29, current_date, '1 day') d order by d`),
    many(`select p.id, p.title, p.kind, coalesce(sum(v.views),0)::int as views,
            (select count(*)::int from reactions r where r.target_type='post' and r.target_id=p.id and r.kind='like') as likes,
            (select count(*)::int from reactions r where r.target_type='post' and r.target_id=p.id and r.kind='save') as saves,
            (select count(*)::int from comments c where c.target_type='post' and c.target_id=p.id and c.status='visible') as comments
          from posts p left join content_views v on v.target_type='post' and v.target_id=p.id and v.day > current_date - 30
          where p.status='published' group by p.id order by views desc, likes desc limit 10`),
    many(`select f.id, u.handle, f.caption, (select count(*)::int from reactions r where r.target_type='fan_post' and r.target_id=f.id and r.kind='like') as likes
          from fan_posts f join users u on u.id=f.author_id where f.status='approved' order by likes desc limit 5`),
    many(`select p.kind, count(distinct p.id)::int as posts, coalesce(sum(v.views),0)::int as views
          from posts p left join content_views v on v.target_type='post' and v.target_id=p.id
          where p.status='published' group by p.kind order by views desc`),
    many(`select id, title, category, sent_at, stats from broadcasts where status='sent' order by sent_at desc limit 10`),
    many(`select d.title, count(v.*)::int as votes from drops d left join drop_votes v on v.drop_id = d.id where d.kind='vote' group by d.id order by d.opens_at desc limit 5`),
  ]);
  const ages = await many(`select case when extract(year from age(make_date(birth_year, birth_month, 1))) < 15 then '12-14'
      when extract(year from age(make_date(birth_year, birth_month, 1))) < 18 then '15-17' else '18+' end as band, count(*)::int n
    from users where status = 'active' group by 1 order by 1`);
  res.json({ daily, signups, top, topFan, byKind, broadcasts, votes, ages });
});

// ------------------------------------------------ médias
r.post('/admin/media', editor, upload.single('file'), async (req, res) => {
  if (!req.file) fail(400, 'Aucun fichier');
  const visibility = oneOf(req.body.visibility || 'public', ['public', 'protected'], 'visibilité');
  const saved = saveBuffer(req.file.buffer, { limits: LIMITS.staff });
  const m = await one('insert into media (owner_id, kind, mime, size_bytes, storage_key, visibility) values ($1,$2,$3,$4,$5,$6) returning id, kind, mime',
    [req.user.id, saved.kind, saved.mime, saved.size, saved.key, visibility]);
  await audit(req.user, 'media.upload', 'media', m.id, { visibility, kind: m.kind });
  res.status(201).json(mediaRef(m.id, m.kind, m.mime));
});

// ------------------------------------------------ publications (QG)
const POST_KINDS = ['news', 'announcement', 'release', 'clip', 'freestyle', 'video', 'backstage', 'story', 'event'];
const PLATFORMS = ['instagram', 'tiktok', 'snapchat', 'youtube', 'spotify', 'deezer', 'apple_music', 'press', 'other'];

function postInput(b) {
  const kind = oneOf(b.kind, POST_KINDS, 'type');
  const sourceType = oneOf(b.source_type || 'app', ['app', 'manual'], 'provenance');
  const out = {
    kind, title: str(b.title, { max: 140, field: 'Titre' }), body: str(b.body, { max: 5000, optional: true, field: 'Texte' }),
    media_id: uuid(b.media_id, 'média', { optional: true }),
    source_type: sourceType,
    source_platform: oneOf(b.source_platform, PLATFORMS, 'plateforme', { optional: true }),
    source_url: url(b.source_url, 'Lien source'),
    is_pinned: bool(b.is_pinned), is_featured: bool(b.is_featured), notify: bool(b.notify),
    publish_at: date(b.publish_at, 'Date de publication', { optional: true }),
    expires_at: date(b.expires_at, 'Expiration', { optional: true }),
  };
  // Règle éditoriale : un contenu repris d'une autre plateforme cite sa source.
  if (sourceType === 'manual' && (!out.source_platform || !out.source_url)) fail(400, 'Un contenu repris d\'une autre plateforme doit indiquer la plateforme et le lien d\'origine');
  if (kind === 'story' && !out.expires_at) out.expires_at = new Date((out.publish_at || new Date()).getTime() + 24 * 3600e3);
  if (out.expires_at && out.expires_at <= (out.publish_at || new Date())) fail(400, 'L\'expiration doit être après la publication');
  const action = oneOf(b.action || 'publish', ['draft', 'publish', 'schedule'], 'action');
  out.status = action === 'draft' ? 'draft' : (action === 'schedule' || (out.publish_at && out.publish_at > new Date())) ? 'scheduled' : 'published';
  if (out.status === 'scheduled' && !out.publish_at) fail(400, 'Indique la date de publication programmée');
  if (out.status === 'published' && !out.publish_at) out.publish_at = new Date();
  return out;
}

r.get('/admin/posts', editor, async (req, res) => {
  const status = oneOf(req.query.status, ['draft', 'scheduled', 'published', 'archived'], 'statut', { optional: true });
  res.json(await many(`select p.*, m.kind as media_kind, m.mime as media_mime,
      (select coalesce(sum(views),0)::int from content_views v where v.target_type='post' and v.target_id=p.id) as views,
      (select count(*)::int from reactions r where r.target_type='post' and r.target_id=p.id and r.kind='like') as likes
    from posts p left join media m on m.id = p.media_id ${status ? 'where p.status = $1' : ''}
    order by coalesce(p.publish_at, p.created_at) desc limit 200`, status ? [status] : []));
});

r.post('/admin/posts', editor, async (req, res) => {
  const p = postInput(req.body || {});
  const row = await one(`insert into posts (author_id, kind, title, body, media_id, source_type, source_platform, source_url, status, publish_at, expires_at, is_pinned, is_featured, notify)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
  [req.user.id, p.kind, p.title, p.body, p.media_id, p.source_type, p.source_platform, p.source_url, p.status, p.publish_at, p.expires_at, p.is_pinned, p.is_featured, p.notify]);
  await audit(req.user, `post.${p.status}`, 'post', row.id, { kind: p.kind });
  res.status(201).json(row);
});

r.patch('/admin/posts/:id', editor, async (req, res) => {
  const id = uuid(req.params.id);
  const cur = await one('select * from posts where id = $1', [id]);
  if (!cur) fail(404, 'Publication introuvable');
  const b = req.body || {};
  // actions rapides
  if (b.op === 'archive' || b.op === 'unarchive' || b.op === 'pin' || b.op === 'unpin' || b.op === 'feature' || b.op === 'unfeature') {
    const set = { archive: `status='archived'`, unarchive: `status='published'`, pin: 'is_pinned=true', unpin: 'is_pinned=false', feature: 'is_featured=true', unfeature: 'is_featured=false' }[b.op];
    const row = await one(`update posts set ${set}, updated_at = now() where id = $1 returning *`, [id]);
    await audit(req.user, `post.${b.op}`, 'post', id);
    return res.json(row);
  }
  const p = postInput({ ...cur, source_platform: cur.source_platform || undefined, ...b });
  if (cur.source_type === 'integration') p.source_type = 'integration';
  const row = await one(`update posts set kind=$2, title=$3, body=$4, media_id=$5, source_type=$6, source_platform=$7, source_url=$8,
      status=$9, publish_at=$10, expires_at=$11, is_pinned=$12, is_featured=$13, notify=$14, updated_at=now() where id=$1 returning *`,
  [id, p.kind, p.title, p.body, p.media_id, p.source_type, p.source_platform, p.source_url, p.status, p.publish_at, p.expires_at, p.is_pinned, p.is_featured, p.notify]);
  await audit(req.user, 'post.update', 'post', id);
  res.json(row);
});

r.delete('/admin/posts/:id', editor, async (req, res) => {
  await q('delete from posts where id = $1', [uuid(req.params.id)]);
  await audit(req.user, 'post.delete', 'post', req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------ discographie
function releaseInput(b) {
  const links = {};
  for (const k of ['spotify', 'apple_music', 'deezer', 'youtube', 'soundcloud', 'tidal', 'amazon_music']) {
    const v = url(b.links?.[k], `Lien ${k}`); if (v) links[k] = v;
  }
  return {
    title: str(b.title, { max: 140, field: 'Titre' }), kind: oneOf(b.kind, ['single', 'ep', 'album', 'mixtape', 'clip', 'freestyle'], 'type'),
    release_date: b.release_date ? str(b.release_date, { max: 10, field: 'Date' }) : null,
    cover_media_id: uuid(b.cover_media_id, 'pochette', { optional: true }),
    description: str(b.description, { max: 2000, optional: true, field: 'Description' }), links,
    is_published: b.is_published === undefined ? true : bool(b.is_published),
  };
}
r.get('/admin/releases', editor, async (_req, res) => res.json(await many('select * from releases order by release_date desc nulls first')));
r.post('/admin/releases', editor, async (req, res) => {
  const x = releaseInput(req.body || {});
  const row = await one(`insert into releases (title, kind, release_date, cover_media_id, description, links, is_published) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [x.title, x.kind, x.release_date, x.cover_media_id, x.description, x.links, x.is_published]);
  await audit(req.user, 'release.create', 'release', row.id);
  res.status(201).json(row);
});
r.patch('/admin/releases/:id', editor, async (req, res) => {
  const x = releaseInput(req.body || {});
  const row = await one(`update releases set title=$2, kind=$3, release_date=$4, cover_media_id=$5, description=$6, links=$7, is_published=$8 where id=$1 returning *`,
    [uuid(req.params.id), x.title, x.kind, x.release_date, x.cover_media_id, x.description, x.links, x.is_published]);
  if (!row) fail(404, 'Sortie introuvable');
  await audit(req.user, 'release.update', 'release', row.id);
  res.json(row);
});
r.delete('/admin/releases/:id', editor, async (req, res) => {
  await q('delete from releases where id=$1', [uuid(req.params.id)]);
  await audit(req.user, 'release.delete', 'release', req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------ événements
function eventInput(b) {
  const starts = date(b.starts_at, 'Début');
  const ends = date(b.ends_at, 'Fin', { optional: true });
  if (ends && ends <= starts) fail(400, 'La fin doit être après le début');
  return {
    title: str(b.title, { max: 140, field: 'Titre' }),
    kind: oneOf(b.kind, ['concert', 'showcase', 'release_party', 'appearance', 'live', 'qa', 'meetup'], 'type'),
    venue: str(b.venue, { max: 140, optional: true, field: 'Lieu' }), city: str(b.city, { max: 80, optional: true, field: 'Ville' }),
    starts_at: starts, ends_at: ends, ticket_url: url(b.ticket_url, 'Billetterie'),
    status: oneOf(b.status || 'confirmed', ['draft', 'confirmed', 'postponed', 'cancelled'], 'statut'),
    age_policy: str(b.age_policy, { max: 120, optional: true, field: 'Âge' }),
    description: str(b.description, { max: 2000, optional: true, field: 'Description' }),
  };
}
r.get('/admin/events', editor, async (_req, res) => res.json(await many('select * from events order by starts_at desc')));
r.post('/admin/events', editor, async (req, res) => {
  const x = eventInput(req.body || {});
  const row = await one(`insert into events (title, kind, venue, city, starts_at, ends_at, ticket_url, status, age_policy, description)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`, [x.title, x.kind, x.venue, x.city, x.starts_at, x.ends_at, x.ticket_url, x.status, x.age_policy, x.description]);
  await audit(req.user, 'event.create', 'event', row.id);
  if (bool(req.body?.notify) && x.status === 'confirmed') {
    await scheduleBroadcast({ category: 'event', title: `Date confirmée : ${x.title}`, body: [x.venue, x.city].filter(Boolean).join(', '), url: '/ifa#agenda', origin: `event:${row.id}`, createdBy: req.user.id });
  }
  res.status(201).json(row);
});
r.patch('/admin/events/:id', editor, async (req, res) => {
  const x = eventInput(req.body || {});
  const row = await one(`update events set title=$2, kind=$3, venue=$4, city=$5, starts_at=$6, ends_at=$7, ticket_url=$8, status=$9, age_policy=$10, description=$11 where id=$1 returning *`,
    [uuid(req.params.id), x.title, x.kind, x.venue, x.city, x.starts_at, x.ends_at, x.ticket_url, x.status, x.age_policy, x.description]);
  if (!row) fail(404, 'Événement introuvable');
  await audit(req.user, 'event.update', 'event', row.id);
  res.json(row);
});
r.delete('/admin/events/:id', editor, async (req, res) => {
  await q('delete from events where id=$1', [uuid(req.params.id)]);
  await audit(req.user, 'event.delete', 'event', req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------ Labo
async function dropInput(b) {
  const opens = date(b.opens_at, 'Ouverture');
  const closes = date(b.closes_at, 'Fermeture', { optional: true });
  if (closes && closes <= opens) fail(400, 'La fermeture doit être après l\'ouverture');
  const access = oneOf(b.access || 'members', ['members', 'badge', 'circle'], 'accès');
  const mediaId = uuid(b.media_id, 'fichier', { optional: true });
  if (mediaId) {
    const m = await one('select visibility from media where id=$1', [mediaId]);
    if (!m) fail(400, 'Fichier introuvable');
    // un fichier confidentiel doit être téléversé en visibilité "protected"
    if (m.visibility !== 'protected') fail(400, 'Le fichier d\'une avant-première doit être téléversé comme confidentiel');
  }
  const x = {
    title: str(b.title, { max: 140, field: 'Titre' }), teaser: str(b.teaser, { max: 300, optional: true, field: 'Teaser' }),
    body: str(b.body, { max: 5000, optional: true, field: 'Texte' }), kind: oneOf(b.kind, ['preview', 'vote', 'process', 'experience'], 'type'),
    cover_media_id: uuid(b.cover_media_id, 'visuel', { optional: true }), media_id: mediaId,
    opens_at: opens, closes_at: closes, access,
    required_badge: access === 'badge' ? str(b.required_badge, { field: 'Badge requis' }) : null,
    required_circle_id: access === 'circle' ? uuid(b.required_circle_id, 'cercle requis') : null,
    rights_note: str(b.rights_note, { max: 300, optional: true, field: 'Droits' }),
    is_published: bool(b.is_published), notify_on_open: b.notify_on_open === undefined ? true : bool(b.notify_on_open),
    options: Array.isArray(b.options) ? b.options.map((o, i) => ({ label: str(o.label, { max: 80, field: 'Option' }), media_id: uuid(o.media_id, 'média option', { optional: true }), position: i })) : [],
  };
  if (x.kind === 'vote' && x.options.length < 2) fail(400, 'Un vote demande au moins 2 options');
  if (x.kind === 'preview' && x.is_published && !x.rights_note) fail(400, 'Indique l\'autorisation de diffusion (droits) avant de publier une avant-première');
  return x;
}
r.get('/admin/drops', editor, async (_req, res) => {
  res.json(await many(`select d.*, (select count(*)::int from drop_votes v where v.drop_id=d.id) as votes,
      (select json_agg(o order by o.position) from drop_options o where o.drop_id=d.id) as options
    from drops d order by d.opens_at desc`));
});
async function saveOptions(dropId, options) {
  await q('delete from drop_options where drop_id = $1 and id not in (select option_id from drop_votes where drop_id = $1)', [dropId]);
  const left = await one('select count(*)::int n from drop_options where drop_id=$1', [dropId]);
  if (left.n) return; // votes déjà exprimés : on ne réécrit pas les options
  for (const o of options) await q('insert into drop_options (drop_id, label, media_id, position) values ($1,$2,$3,$4)', [dropId, o.label, o.media_id, o.position]);
}
r.post('/admin/drops', editor, async (req, res) => {
  const x = await dropInput(req.body || {});
  const row = await one(`insert into drops (title, teaser, body, kind, cover_media_id, media_id, opens_at, closes_at, access, required_badge, required_circle_id, rights_note, is_published, notify_on_open, created_by)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
  [x.title, x.teaser, x.body, x.kind, x.cover_media_id, x.media_id, x.opens_at, x.closes_at, x.access, x.required_badge, x.required_circle_id, x.rights_note, x.is_published, x.notify_on_open, req.user.id]);
  await saveOptions(row.id, x.options);
  await audit(req.user, 'drop.create', 'drop', row.id, { published: x.is_published });
  res.status(201).json(row);
});
r.patch('/admin/drops/:id', editor, async (req, res) => {
  const x = await dropInput(req.body || {});
  const row = await one(`update drops set title=$2, teaser=$3, body=$4, kind=$5, cover_media_id=$6, media_id=$7, opens_at=$8, closes_at=$9, access=$10,
      required_badge=$11, required_circle_id=$12, rights_note=$13, is_published=$14, notify_on_open=$15 where id=$1 returning *`,
  [uuid(req.params.id), x.title, x.teaser, x.body, x.kind, x.cover_media_id, x.media_id, x.opens_at, x.closes_at, x.access, x.required_badge, x.required_circle_id, x.rights_note, x.is_published, x.notify_on_open]);
  if (!row) fail(404, 'Drop introuvable');
  await saveOptions(row.id, x.options);
  await audit(req.user, 'drop.update', 'drop', row.id);
  res.json(row);
});
r.delete('/admin/drops/:id', editor, async (req, res) => {
  await q('delete from drops where id=$1', [uuid(req.params.id)]);
  await audit(req.user, 'drop.delete', 'drop', req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------ défis & cercles
r.get('/admin/challenges', editor, async (_req, res) => res.json(await many(`select c.*, (select count(*)::int from fan_posts f where f.challenge_id=c.id) as entries from challenges c order by starts_at desc`)));
r.post('/admin/challenges', editor, async (req, res) => {
  const b = req.body || {};
  const starts = date(b.starts_at, 'Début'); const ends = date(b.ends_at, 'Fin', { optional: true });
  if (ends && ends <= starts) fail(400, 'La fin doit être après le début');
  const row = await one(`insert into challenges (title, brief, rules, cover_media_id, starts_at, ends_at, reward_badge, is_published) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [str(b.title, { max: 140, field: 'Titre' }), str(b.brief, { max: 1000, field: 'Consigne' }), str(b.rules, { max: 2000, optional: true, field: 'Règles' }),
      uuid(b.cover_media_id, 'visuel', { optional: true }), starts, ends, b.reward_badge || 'defi', b.is_published === undefined ? true : bool(b.is_published)]);
  await audit(req.user, 'challenge.create', 'challenge', row.id);
  res.status(201).json(row);
});
r.delete('/admin/challenges/:id', editor, async (req, res) => {
  await q('update challenges set is_published = false where id=$1', [uuid(req.params.id)]);
  await audit(req.user, 'challenge.unpublish', 'challenge', req.params.id);
  res.json({ ok: true });
});
r.get('/admin/circles', editor, async (_req, res) => res.json(await many(`select c.*, (select count(*)::int from circle_members m where m.circle_id=c.id) as members from circles c order by created_at`)));
r.post('/admin/circles', editor, async (req, res) => {
  const b = req.body || {};
  const row = await one(`insert into circles (slug, name, description, kind, ends_at) values ($1,$2,$3,$4,$5) returning *`,
    [str(b.slug, { max: 40, field: 'Identifiant' }).toLowerCase(), str(b.name, { max: 60, field: 'Nom' }), str(b.description, { max: 300, optional: true, field: 'Description' }),
      oneOf(b.kind || 'permanent', ['permanent', 'release_room'], 'type'), date(b.ends_at, 'Fin', { optional: true })]);
  await audit(req.user, 'circle.create', 'circle', row.id);
  res.status(201).json(row);
});
r.patch('/admin/circles/:id', editor, async (req, res) => {
  const row = await one('update circles set is_open = $2 where id = $1 returning *', [uuid(req.params.id), bool(req.body?.is_open)]);
  await audit(req.user, 'circle.update', 'circle', req.params.id);
  res.json(row);
});

// ------------------------------------------------ signaux (notifications)
r.get('/admin/broadcasts', editor, async (_req, res) => {
  res.json({ push_configured: pushConfigured(), items: await many('select * from broadcasts order by send_at desc limit 100') });
});
r.post('/admin/broadcasts', editor, async (req, res) => {
  const b = req.body || {};
  const sendAt = date(b.send_at, 'Envoi', { optional: true }) || new Date();
  if (b.url && !String(b.url).startsWith('/')) fail(400, 'Le lien doit pointer vers une page de l\'app (commence par /)');
  const row = await scheduleBroadcast({
    category: oneOf(b.category, ['news', 'drop', 'release', 'event', 'challenge', 'exclusive', 'announcement'], 'catégorie'),
    importance: oneOf(b.importance || 'normal', ['normal', 'important'], 'importance'),
    title: str(b.title, { max: 80, field: 'Titre' }), body: str(b.body, { max: 200, optional: true, field: 'Texte' }),
    url: b.url ? str(b.url, { max: 300, field: 'Lien' }) : null, sendAt, createdBy: req.user.id,
  });
  await audit(req.user, 'broadcast.schedule', 'broadcast', row.id, { send_at: sendAt });
  res.status(201).json(row);
});
r.post('/admin/broadcasts/:id/cancel', editor, async (req, res) => {
  const row = await one(`update broadcasts set status='cancelled' where id=$1 and status='scheduled' returning *`, [uuid(req.params.id)]);
  if (!row) fail(409, 'Ce signal n\'est plus annulable');
  await audit(req.user, 'broadcast.cancel', 'broadcast', row.id);
  res.json(row);
});

// ------------------------------------------------ modération
r.get('/admin/moderation', modo, async (_req, res) => {
  const [pending, reports, hidden] = await Promise.all([
    many(`select f.id, f.caption, f.created_at, f.circle_id, f.challenge_id, m.id as media_id, m.kind as media_kind, m.mime as media_mime,
            u.id as author_id, u.handle, u.created_at as author_since,
            (select count(*)::int from fan_posts x where x.author_id = u.id and x.status='rejected') as author_rejections,
            c.title as challenge_title, ci.name as circle_name
          from fan_posts f join media m on m.id=f.media_id join users u on u.id=f.author_id
          left join challenges c on c.id = f.challenge_id left join circles ci on ci.id = f.circle_id
          where f.status='pending' order by f.created_at asc limit 100`),
    many(`select r.target_type, r.target_id, count(*)::int as count, array_agg(distinct r.reason) as reasons,
            max(r.created_at) as last_at, array_remove(array_agg(r.details), null) as details
          from reports r where r.status='open' group by r.target_type, r.target_id order by count(*) desc, max(r.created_at) desc limit 100`),
    many(`select c.id, c.body, c.target_type, c.target_id, u.handle from comments c join users u on u.id=c.author_id where c.status='hidden' order by c.created_at desc limit 50`),
  ]);
  // aperçu de chaque cible signalée
  for (const rep of reports) {
    if (rep.target_type === 'comment') rep.preview = await one(`select c.body, c.status, u.handle, u.id as user_id from comments c join users u on u.id=c.author_id where c.id=$1`, [rep.target_id]);
    else if (rep.target_type === 'fan_post') rep.preview = await one(`select f.caption as body, f.status, u.handle, u.id as user_id, f.media_id, m.kind as media_kind from fan_posts f join users u on u.id=f.author_id join media m on m.id=f.media_id where f.id=$1`, [rep.target_id]);
    else if (rep.target_type === 'user') rep.preview = await one(`select handle, status, id as user_id, bio as body from users where id=$1`, [rep.target_id]);
    else rep.preview = await one(`select title as body, status from posts where id=$1`, [rep.target_id]);
  }
  res.json({ pending: pending.map((p) => ({ ...p, media: mediaRef(p.media_id, p.media_kind, p.media_mime) })), reports, hidden });
});

r.post('/admin/fan-posts/:id/decision', modo, async (req, res) => {
  const decision = oneOf(req.body?.decision, ['approve', 'reject'], 'décision');
  const note = str(req.body?.note, { max: 300, optional: true, field: 'Motif' });
  if (decision === 'reject' && !note) fail(400, 'Indique un motif : il sera montré à l\'auteur pour qu\'il comprenne');
  const p = await one(`update fan_posts set status=$2, moderation_note=$3, moderated_by=$4, moderated_at=now() where id=$1 and status in ('pending','approved') returning *`,
    [uuid(req.params.id), decision === 'approve' ? 'approved' : 'rejected', note, req.user.id]);
  if (!p) fail(404, 'Création introuvable');
  if (decision === 'approve') {
    await award(p.author_id, 'createur');
    if (p.challenge_id) await award(p.author_id, (await one('select reward_badge from challenges where id=$1', [p.challenge_id]))?.reward_badge || 'defi');
    await notifyUser(p.author_id, { category: 'moderation', title: 'Ta création est en ligne', url: `/cercles/creation/${p.id}` });
  } else {
    await notifyUser(p.author_id, { category: 'moderation', title: 'Ta création n\'a pas été publiée', body: note, url: '/moi' });
  }
  await audit(req.user, `fan_post.${decision}`, 'fan_post', p.id, { note });
  res.json(p);
});

r.post('/admin/fan-posts/:id/feature', editor, async (req, res) => {
  const on = req.body?.on !== false;
  const p = await one(`update fan_posts set is_featured=$2 where id=$1 and status='approved' returning *`, [uuid(req.params.id), on]);
  if (!p) fail(404, 'Création introuvable (ou pas encore validée)');
  if (on) {
    await award(p.author_id, 'selection');
    await notifyUser(p.author_id, { category: 'moderation', title: 'L\'équipe d\'Ifa a mis ta création en avant', url: `/cercles/creation/${p.id}` });
  }
  await audit(req.user, on ? 'fan_post.feature' : 'fan_post.unfeature', 'fan_post', p.id);
  res.json(p);
});

r.post('/admin/reports/resolve', modo, async (req, res) => {
  const type = oneOf(req.body?.target_type, ['post', 'fan_post', 'comment', 'user'], 'type');
  const id = uuid(req.body?.target_id);
  const action = oneOf(req.body?.action, ['dismiss', 'remove', 'restore', 'suspend'], 'action');
  if (action === 'remove') {
    if (type === 'comment') await q(`update comments set status='removed' where id=$1`, [id]);
    if (type === 'fan_post') await q(`update fan_posts set status='removed', moderated_by=$2, moderated_at=now() where id=$1`, [id, req.user.id]);
    if (type === 'post') fail(400, 'Les publications officielles se gèrent dans Publications');
  }
  if (action === 'restore' && type === 'comment') await q(`update comments set status='visible' where id=$1`, [id]);
  if (action === 'suspend') {
    const uid = type === 'user' ? id
      : type === 'comment' ? (await one('select author_id from comments where id=$1', [id]))?.author_id
        : type === 'fan_post' ? (await one('select author_id from fan_posts where id=$1', [id]))?.author_id : null;
    if (!uid) fail(400, 'Impossible de suspendre ce compte');
    const target = await one('select role, is_official from users where id=$1', [uid]);
    if (target.role !== 'fan' || target.is_official) fail(403, 'Seul un administrateur peut agir sur un compte de l\'équipe');
    await q(`update users set status='suspended' where id=$1`, [uid]);
    await q('delete from sessions where user_id=$1', [uid]);
    if (type === 'comment') await q(`update comments set status='removed' where id=$1`, [id]);
    if (type === 'fan_post') await q(`update fan_posts set status='removed' where id=$1`, [id]);
  }
  await q(`update reports set status=$3, resolved_by=$4, resolved_at=now() where target_type=$1 and target_id=$2 and status='open'`,
    [type, id, action === 'dismiss' || action === 'restore' ? 'dismissed' : 'resolved', req.user.id]);
  await audit(req.user, `report.${action}`, type, id);
  res.json({ ok: true });
});

// ------------------------------------------------ comptes
r.get('/admin/users', modo, async (req, res) => {
  const s = req.query.q ? `%${String(req.query.q).slice(0, 60)}%` : null;
  const role = oneOf(req.query.role, ['fan', 'moderator', 'editor', 'admin'], 'rôle', { optional: true });
  const status = oneOf(req.query.status, ['active', 'pending_parent', 'suspended'], 'statut', { optional: true });
  const params = []; const where = [`status <> 'deleted'`];
  if (s) { params.push(s); where.push(`(handle ilike $${params.length} or email ilike $${params.length})`); }
  if (role) { params.push(role); where.push(`role = $${params.length}`); }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  const rows = await many(`select id, handle, email, role, status, is_official, created_at, last_seen_at, birth_year, birth_month,
      (select count(*)::int from reports r where r.target_type='user' and r.target_id=users.id and r.status='open') as open_reports,
      (select count(*)::int from fan_posts f where f.author_id=users.id and f.status='approved') as creations
    from users where ${where.join(' and ')} order by created_at desc limit 100`, params);
  const isAdmin = req.user.role === 'admin';
  res.json(rows.map((u) => {
    const age = new Date().getUTCFullYear() - u.birth_year - ((new Date().getUTCMonth() + 1) < u.birth_month ? 1 : 0);
    // l'e-mail n'est visible que des administrateurs (minimisation)
    return { ...u, email: isAdmin ? u.email : undefined, birth_year: undefined, birth_month: undefined, age_band: age < 15 ? '12-14' : age < 18 ? '15-17' : '18+' };
  }));
});

r.patch('/admin/users/:id', modo, async (req, res) => {
  const id = uuid(req.params.id);
  const target = await one('select id, role, status, is_official from users where id=$1', [id]);
  if (!target) fail(404, 'Compte introuvable');
  const b = req.body || {};
  if (id === req.user.id) fail(400, 'Tu ne peux pas modifier ton propre compte ici');
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && (target.role !== 'fan' || b.role !== undefined || b.is_official !== undefined)) fail(403, 'Réservé aux administrateurs');
  if (b.status !== undefined) {
    const st = oneOf(b.status, ['active', 'suspended'], 'statut');
    if (target.status === 'pending_parent' && st === 'active') fail(400, 'Ce compte attend le consentement parental : il ne peut pas être activé manuellement');
    await q('update users set status=$2 where id=$1', [id, st]);
    if (st === 'suspended') await q('delete from sessions where user_id=$1', [id]);
  }
  if (b.role !== undefined) await q('update users set role=$2 where id=$1', [id, oneOf(b.role, ['fan', 'moderator', 'editor', 'admin'], 'rôle')]);
  if (b.is_official !== undefined) await q('update users set is_official=$2 where id=$1', [id, bool(b.is_official)]);
  await audit(req.user, 'user.update', 'user', id, b);
  res.json(await one('select id, handle, role, status, is_official from users where id=$1', [id]));
});

// ------------------------------------------------ profil officiel & intégrations
r.put('/admin/artist', admin, async (req, res) => {
  const b = req.body || {};
  const links = {};
  for (const k of ['instagram', 'tiktok', 'snapchat', 'youtube', 'spotify', 'apple_music', 'deezer', 'soundcloud', 'x', 'website', 'booking']) {
    const v = url(b.links?.[k], `Lien ${k}`); if (v) links[k] = v;
  }
  const row = await one(`update artist_profile set name=$1, tagline=$2, bio=$3, avatar_media_id=$4, banner_media_id=$5, links=$6, updated_at=now() where id=1 returning *`,
    [str(b.name, { max: 60, field: 'Nom' }), str(b.tagline, { max: 120, optional: true, field: 'Accroche' }), str(b.bio, { max: 3000, optional: true, field: 'Bio' }),
      uuid(b.avatar_media_id, 'photo', { optional: true }), uuid(b.banner_media_id, 'bannière', { optional: true }), links]);
  await audit(req.user, 'artist.update', 'artist', 1);
  res.json(row);
});

r.get('/admin/integrations', editor, (_req, res) => res.json({ ...integrationStatus(), push: pushConfigured(), mail: mailConfigured(), public_url: config.publicUrl }));
r.post('/admin/integrations/:name/sync', admin, async (req, res) => {
  const name = oneOf(req.params.name, ['youtube', 'instagram'], 'intégration');
  const out = name === 'youtube' ? await syncYouTube(req.user) : await syncInstagram(req.user);
  await audit(req.user, `integration.${name}.sync`, null, null, out);
  res.json(out);
});

r.get('/admin/audit', admin, async (_req, res) => {
  res.json(await many(`select a.*, u.handle from audit_log a left join users u on u.id=a.actor_id order by a.id desc limit 200`));
});

export { ROLE_RANK };
