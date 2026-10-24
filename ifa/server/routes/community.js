// Les Cercles : profils, créations des fans, défis, cercles thématiques.
import { Router } from 'express';
import multer from 'multer';
import { q, one, many } from '../db.js';
import { requireUser, requireActive } from '../lib/auth.js';
import { fail, str, uuid, bool } from '../lib/http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { checkText } from '../lib/moderation.js';
import { saveBuffer, LIMITS } from '../lib/storage.js';
import { listFanPosts, mediaRef } from '../lib/content.js';
import { award } from '../lib/badges.js';

const r = Router();
export default r;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.fan.video, files: 1 } });

r.get('/circles', async (req, res) => {
  const rows = await many(`
    select c.*, (select count(*)::int from circle_members m where m.circle_id = c.id) as members,
           ${req.user ? `exists(select 1 from circle_members m where m.circle_id = c.id and m.user_id = $1)` : 'false'} as joined
    from circles c where c.is_open and (c.ends_at is null or c.ends_at > now())
    order by c.kind desc, c.created_at`, req.user ? [req.user.id] : []);
  res.json(rows);
});

r.get('/circles/:slug', async (req, res) => {
  const c = await one(`select c.*, (select count(*)::int from circle_members m where m.circle_id = c.id) as members from circles c where slug = $1`, [req.params.slug]);
  if (!c) fail(404, 'Cercle introuvable');
  c.joined = req.user ? Boolean(await one('select 1 from circle_members where circle_id=$1 and user_id=$2', [c.id, req.user.id])) : false;
  c.ended = Boolean(c.ends_at && new Date(c.ends_at) < new Date());
  const posts = await listFanPosts(req.user, { where: 'f.circle_id = $1', params: [c.id] });
  res.json({ circle: c, posts });
});

r.post('/circles/:slug/join', requireActive, async (req, res) => {
  const c = await one(`select id from circles where slug = $1 and is_open and (ends_at is null or ends_at > now())`, [req.params.slug]);
  if (!c) fail(404, 'Cercle fermé ou introuvable');
  await q('insert into circle_members (circle_id, user_id) values ($1,$2) on conflict do nothing', [c.id, req.user.id]);
  await award(req.user.id, 'cercle');
  res.json({ joined: true });
});
r.delete('/circles/:slug/join', requireUser, async (req, res) => {
  await q('delete from circle_members where user_id = $1 and circle_id = (select id from circles where slug = $2)', [req.user.id, req.params.slug]);
  res.json({ joined: false });
});

r.get('/challenges', async (_req, res) => {
  const rows = await many(`select ch.*, (select count(*)::int from fan_posts f where f.challenge_id = ch.id and f.status='approved') as entries
    from challenges ch where is_published order by (ends_at is null or ends_at > now()) desc, starts_at desc limit 30`);
  res.json(rows.map((c) => ({ ...c, cover: mediaRef(c.cover_media_id, 'image'),
    state: new Date(c.starts_at) > new Date() ? 'upcoming' : (c.ends_at && new Date(c.ends_at) < new Date() ? 'closed' : 'open') })));
});
r.get('/challenges/:id', async (req, res) => {
  const c = await one('select * from challenges where id = $1 and is_published', [uuid(req.params.id)]);
  if (!c) fail(404, 'Défi introuvable');
  const entries = await listFanPosts(req.user, { where: 'f.challenge_id = $1', params: [c.id], order: 'f.is_featured desc, f.created_at desc' });
  res.json({ challenge: { ...c, cover: mediaRef(c.cover_media_id, 'image'),
    state: new Date(c.starts_at) > new Date() ? 'upcoming' : (c.ends_at && new Date(c.ends_at) < new Date() ? 'closed' : 'open') }, entries });
});

r.get('/fan-posts', async (req, res) => {
  res.json(await listFanPosts(req.user, { limit: 40, order: 'f.is_featured desc, f.created_at desc' }));
});
r.get('/fan-posts/mine', requireUser, async (req, res) => {
  res.json(await many(`select f.id, f.caption, f.status, f.moderation_note, f.is_featured, f.created_at, m.id as media_id, m.kind as media_kind
    from fan_posts f join media m on m.id = f.media_id where f.author_id = $1 order by f.created_at desc`, [req.user.id]));
});
r.get('/fan-posts/:id', async (req, res) => {
  const [p] = await listFanPosts(req.user, { where: 'f.id = $1', params: [uuid(req.params.id)], limit: 1 });
  if (!p) fail(404, 'Création introuvable');
  res.json(p);
});

// Publication d'une création : toujours en pré-modération.
r.post('/fan-posts', requireActive, rateLimit({ key: 'fanpost', max: 6, windowMs: 3600e3 }), upload.single('file'), async (req, res) => {
  if (!req.file) fail(400, 'Ajoute une photo ou une vidéo');
  if (!bool(req.body.rights)) fail(400, 'Il faut confirmer que tu as les droits sur ce contenu');
  const caption = str(req.body.caption, { max: 500, optional: true, field: 'Légende' });
  if (caption) { const c = checkText(caption); if (!c.ok) fail(422, c.reason, 'filtered'); }
  const circleId = uuid(req.body.circle_id, 'cercle', { optional: true });
  const challengeId = uuid(req.body.challenge_id, 'défi', { optional: true });
  if (circleId && !(await one('select 1 from circle_members where circle_id=$1 and user_id=$2', [circleId, req.user.id]))) fail(403, 'Rejoins le cercle pour y publier');
  if (challengeId && !(await one(`select 1 from challenges where id=$1 and is_published and starts_at <= now() and (ends_at is null or ends_at > now())`, [challengeId]))) fail(400, 'Ce défi n\'est pas ouvert');
  const saved = saveBuffer(req.file.buffer, { allowed: ['image', 'video'], limits: LIMITS.fan });
  const m = await one('insert into media (owner_id, kind, mime, size_bytes, storage_key, visibility) values ($1,$2,$3,$4,$5,$6) returning id',
    [req.user.id, saved.kind, saved.mime, saved.size, saved.key, 'public']);
  const p = await one(`insert into fan_posts (author_id, circle_id, challenge_id, caption, media_id, rights_accepted_at)
    values ($1,$2,$3,$4,$5,now()) returning id, status, created_at`, [req.user.id, circleId, challengeId, caption, m.id]);
  res.status(201).json({ ...p, message: 'Reçu ! Ta création sera visible dès qu\'un modérateur l\'aura validée.' });
});

r.delete('/fan-posts/:id', requireUser, async (req, res) => {
  const p = await one('select author_id from fan_posts where id = $1', [uuid(req.params.id)]);
  if (!p || p.author_id !== req.user.id) fail(404, 'Création introuvable');
  await q(`update fan_posts set status = 'removed' where id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// Profil public : pseudo, avatar, badges, créations validées. Jamais l'âge, jamais l'e-mail.
r.get('/u/:handle', async (req, res) => {
  const u = await one(`select id, handle, display_name, bio, avatar_style, is_official, role, created_at from users where handle = $1 and status = 'active'`, [req.params.handle]);
  if (!u) fail(404, 'Profil introuvable');
  const [badges, posts] = await Promise.all([
    many('select b.code, b.name, b.glyph, b.description from user_badges ub join badges b on b.code = ub.badge_code where ub.user_id = $1 order by ub.awarded_at', [u.id]),
    listFanPosts(req.user, { where: 'f.author_id = $1', params: [u.id] }),
  ]);
  const blocked = req.user ? Boolean(await one('select 1 from blocks where blocker_id=$1 and blocked_id=$2', [req.user.id, u.id])) : false;
  res.json({ user: { ...u, staff: u.role !== 'fan', role: undefined }, badges, posts: blocked ? [] : posts, blocked });
});
