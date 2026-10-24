// Import unique des photos officielles livrées avec le code (assets/photos) :
// elles sont enregistrées dans le stockage comme n'importe quel média, puis
// deviennent la bannière et la galerie du profil Ifa. Une fois importées,
// l'équipe les gère dans la régie ; on ne les réimporte jamais.
import fs from 'node:fs';
import { one, q, pool } from '../db.js';
import { saveBuffer, LIMITS } from './storage.js';

const DIR = new URL('../../assets/photos/', import.meta.url).pathname;

export async function importOfficialPhotos() {
  const manifestPath = `${DIR}photos.json`;
  if (!fs.existsSync(manifestPath)) return false;
  const state = await one('select photos_imported_at from artist_profile where id = 1');
  if (!state || state.photos_imported_at) return false;
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query('select pg_try_advisory_xact_lock(19019002) as ok');
    const again = await one('select photos_imported_at from artist_profile where id = 1');
    if (!rows[0].ok || again.photos_imported_at) { await client.query('rollback'); return false; }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const ids = {};
    for (const name of manifest.gallery) {
      const s = await saveBuffer(fs.readFileSync(DIR + name), { allowed: ['image'], limits: LIMITS.staff });
      ids[name] = (await one(`insert into media (kind, mime, size_bytes, storage_key, visibility) values ($1,$2,$3,$4,'public') returning id`,
        [s.kind, s.mime, s.size, s.key])).id;
    }
    await q(`update artist_profile set gallery = $1, banner_media_id = coalesce(banner_media_id, $2), photos_imported_at = now(), updated_at = now() where id = 1`,
      [manifest.gallery.map((n) => ids[n]), ids[manifest.banner] || null]);
    await client.query('commit');
    return true;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Contenus officiels (sorties, annonces, signaux programmés) livrés dans
// assets/official/content.json. Un fichier média absent n'est pas bloquant :
// l'élément est créé sans visuel et l'équipe l'ajoute dans la régie.
const OFFICIAL = new URL('../../assets/official/', import.meta.url).pathname;

async function officialMedia(name) {
  if (!name || !fs.existsSync(OFFICIAL + name)) return null;
  const s = await saveBuffer(fs.readFileSync(OFFICIAL + name), { allowed: ['image', 'video'], limits: LIMITS.staff });
  return (await one(`insert into media (kind, mime, size_bytes, storage_key, visibility) values ($1,$2,$3,$4,'public') returning id`,
    [s.kind, s.mime, s.size, s.key])).id;
}

export async function importOfficialContent() {
  const path = `${OFFICIAL}content.json`;
  if (!fs.existsSync(path)) return 0;
  const { items } = JSON.parse(fs.readFileSync(path, 'utf8'));
  const done = new Set((await pool.query('select key from official_imports')).rows.map((r) => r.key));
  const todo = items.filter((it) => !done.has(it.key));
  if (!todo.length) return 0;
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query('begin');
    const { rows } = await client.query('select pg_try_advisory_xact_lock(19019003) as ok');
    if (!rows[0].ok) { await client.query('rollback'); return 0; }
    const author = await one(`select id from users where role = 'admin' and email not like '%@demo.frequence.local' order by created_at limit 1`);
    const mediaCache = {};
    const media = async (name) => (name in mediaCache ? mediaCache[name] : (mediaCache[name] = await officialMedia(name)));
    for (const it of todo) {
      const claimed = await q('insert into official_imports (key) values ($1) on conflict do nothing', [it.key]);
      if (!claimed.rowCount) continue;
      if (it.type === 'release') {
        await q(`insert into releases (title, kind, release_date, release_at, cover_media_id, description, links) values ($1,$2,($3::timestamptz at time zone 'Europe/Paris')::date,$3,$4,$5,$6)`,
          [it.title, it.kind, it.release_at, await media(it.cover), it.description || null, it.links || {}]);
      } else if (it.type === 'post') {
        await q(`insert into posts (author_id, kind, title, body, media_id, source_type, status, publish_at, is_pinned, notify) values ($1,$2,$3,$4,$5,'app','published',coalesce($6::timestamptz, now()),$7,$8)`,
          [author?.id || null, it.kind, it.title, it.body || null, await media(it.media), it.publish_at || null, Boolean(it.pinned), Boolean(it.notify)]);
      } else if (it.type === 'drop') {
        // jamais de fichier confidentiel dans le dépôt : le drop est créé vide, l'équipe ajoute le fichier
        await q(`insert into drops (title, teaser, body, kind, opens_at, closes_at, rights_note, is_published, notify_on_open, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
          [it.title, it.teaser || null, it.body || null, it.kind, it.opens_at, it.closes_at || null, it.rights_note || null, Boolean(it.published), author?.id || null]);
      } else if (it.type === 'broadcast') {
        if (new Date(it.send_at) > new Date()) {
          await q(`insert into broadcasts (category, importance, title, body, url, send_at, origin, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [it.category, it.importance || 'normal', it.title, it.body || null, it.url || null, it.send_at, `official:${it.key}`, author?.id || null]);
        }
      }
      n++;
    }
    await client.query('commit');
    return n;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
