// Rappels individuels et pages de détail des sorties et des dates.
import { Router } from 'express';
import { q, one } from '../db.js';
import { requireActive, requireUser } from '../lib/auth.js';
import { fail, oneOf, uuid } from '../lib/http.js';
import { mediaRef } from '../lib/content.js';

const r = Router();
export default r;

// Moment du rappel : à l'heure de la sortie ou de l'ouverture ; 2 h avant un événement.
async function targetTime(type, id) {
  if (type === 'release') {
    const x = await one(`select coalesce(release_at, release_date::timestamptz) as at from releases where id = $1 and is_published`, [id]);
    return x?.at;
  }
  if (type === 'event') {
    const x = await one(`select starts_at - interval '2 hours' as at from events where id = $1 and status = 'confirmed'`, [id]);
    return x?.at;
  }
  const x = await one('select opens_at as at from drops where id = $1 and is_published', [id]);
  return x?.at;
}

async function reminderOf(user, type, id) {
  if (!user) return null;
  return one('select remind_at, sent_at from reminders where user_id = $1 and target_type = $2 and target_id = $3', [user.id, type, id]);
}

r.get('/releases/:id', async (req, res) => {
  const x = await one('select * from releases where id = $1 and is_published', [uuid(req.params.id)]);
  if (!x) fail(404, 'Sortie introuvable');
  const artist = await one('select links, banner_media_id from artist_profile where id = 1');
  res.json({ ...x, cover: mediaRef(x.cover_media_id, 'image'), artist_photo: mediaRef(artist.banner_media_id, 'image'), artist_links: artist.links, reminder: await reminderOf(req.user, 'release', x.id) });
});

r.get('/events/:id', async (req, res) => {
  const x = await one(`select * from events where id = $1 and status <> 'draft'`, [uuid(req.params.id)]);
  if (!x) fail(404, 'Date introuvable');
  res.json({ ...x, reminder: await reminderOf(req.user, 'event', x.id) });
});

r.post('/reminders', requireActive, async (req, res) => {
  const type = oneOf(req.body?.target_type, ['release', 'event', 'drop'], 'type');
  const id = uuid(req.body?.target_id);
  const at = await targetTime(type, id);
  if (!at) fail(404, 'Introuvable');
  if (new Date(at) <= new Date()) fail(409, 'C\'est déjà passé : plus besoin de rappel');
  await q(`insert into reminders (user_id, target_type, target_id, remind_at) values ($1,$2,$3,$4)
           on conflict (user_id, target_type, target_id) do update set remind_at = $4, sent_at = null`, [req.user.id, type, id, at]);
  res.status(201).json({ remind_at: at });
});

r.delete('/reminders/:type/:id', requireUser, async (req, res) => {
  await q('delete from reminders where user_id = $1 and target_type = $2 and target_id = $3',
    [req.user.id, oneOf(req.params.type, ['release', 'event', 'drop'], 'type'), uuid(req.params.id)]);
  res.json({ ok: true });
});
