// Interactions essentielles : réactions, commentaires, signalements, blocages.
import { Router } from 'express';
import { q, one, many } from '../db.js';
import { requireUser, requireActive, isStaff } from '../lib/auth.js';
import { fail, str, oneOf, uuid } from '../lib/http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { checkText, AUTO_HIDE_REPORTS } from '../lib/moderation.js';
import { VISIBLE_POST, listPosts, listFanPosts } from '../lib/content.js';
import { audit } from '../lib/audit.js';

const r = Router();
export default r;

async function assertTarget(type, id) {
  const ok = type === 'post'
    ? await one(`select 1 from posts p where p.id = $1 and ${VISIBLE_POST}`, [id])
    : await one(`select 1 from fan_posts where id = $1 and status = 'approved'`, [id]);
  if (!ok) fail(404, 'Contenu introuvable');
}

r.post('/react', requireActive, rateLimit({ key: 'react', max: 120, windowMs: 60e3 }), async (req, res) => {
  const type = oneOf(req.body?.target_type, ['post', 'fan_post'], 'type');
  const id = uuid(req.body?.target_id);
  const kind = oneOf(req.body?.kind, ['like', 'save'], 'réaction');
  await assertTarget(type, id);
  const on = req.body?.on !== false;
  if (on) await q('insert into reactions (user_id, target_type, target_id, kind) values ($1,$2,$3,$4) on conflict do nothing', [req.user.id, type, id, kind]);
  else await q('delete from reactions where user_id=$1 and target_type=$2 and target_id=$3 and kind=$4', [req.user.id, type, id, kind]);
  const { n } = await one('select count(*)::int n from reactions where target_type=$1 and target_id=$2 and kind=$3', [type, id, kind]);
  res.json({ on, count: n });
});

r.get('/me/saved', requireUser, async (req, res) => {
  const posts = await listPosts(req.user, { where: `p.id in (select target_id from reactions where user_id = $1 and target_type='post' and kind='save')`, params: [req.user.id], limit: 50 });
  const fans = await listFanPosts(req.user, { where: `f.id in (select target_id from reactions where user_id = $1 and target_type='fan_post' and kind='save')`, params: [req.user.id], limit: 50 });
  res.json({ posts, fan_posts: fans });
});

r.get('/comments', async (req, res) => {
  const type = oneOf(req.query.target_type, ['post', 'fan_post'], 'type');
  const id = uuid(req.query.target_id);
  const params = [type, id];
  let blockClause = '';
  if (req.user) { params.push(req.user.id); blockClause = `and c.author_id not in (select blocked_id from blocks where blocker_id = $3)`; }
  const rows = await many(`
    select c.id, c.body, c.created_at, u.id as author_id, u.handle, u.display_name, u.avatar_style, u.is_official, u.role
    from comments c join users u on u.id = c.author_id
    where c.target_type = $1 and c.target_id = $2 and c.status = 'visible' and u.status = 'active' ${blockClause}
    order by u.is_official desc, c.created_at asc limit 200`, params);
  res.json(rows.map((c) => ({
    id: c.id, body: c.body, created_at: c.created_at,
    author: { id: c.author_id, handle: c.handle, name: c.display_name, avatar_style: c.avatar_style, official: c.is_official, staff: c.role !== 'fan' },
    mine: req.user?.id === c.author_id,
  })));
});

r.post('/comments', requireActive, rateLimit({ key: 'comment', max: 10, windowMs: 60e3 }), async (req, res) => {
  const type = oneOf(req.body?.target_type, ['post', 'fan_post'], 'type');
  const id = uuid(req.body?.target_id);
  const body = str(req.body?.body, { min: 1, max: 500, field: 'Commentaire' });
  await assertTarget(type, id);
  const check = checkText(body);
  if (!check.ok) fail(422, check.reason, 'filtered');
  const c = await one('insert into comments (target_type, target_id, author_id, body) values ($1,$2,$3,$4) returning id, body, created_at', [type, id, req.user.id, body]);
  res.status(201).json({ ...c, author: { id: req.user.id, handle: req.user.handle, name: req.user.display_name, avatar_style: req.user.avatar_style, official: req.user.is_official }, mine: true });
});

r.delete('/comments/:id', requireUser, async (req, res) => {
  const c = await one('select author_id from comments where id = $1', [uuid(req.params.id)]);
  if (!c) fail(404, 'Commentaire introuvable');
  if (c.author_id !== req.user.id && !isStaff(req.user)) fail(403, 'Action non autorisée');
  await q(`update comments set status = 'removed' where id = $1`, [req.params.id]);
  if (c.author_id !== req.user.id) await audit(req.user, 'comment.removed', 'comment', req.params.id);
  res.json({ ok: true });
});

const REASONS = ['harassment', 'hate', 'sexual', 'violence', 'spam', 'personal_info', 'copyright', 'minor_safety', 'other'];
r.post('/reports', requireUser, rateLimit({ key: 'report', max: 20, windowMs: 3600e3 }), async (req, res) => {
  const type = oneOf(req.body?.target_type, ['post', 'fan_post', 'comment', 'user'], 'type');
  const id = uuid(req.body?.target_id);
  const reason = oneOf(req.body?.reason, REASONS, 'motif');
  const details = str(req.body?.details, { max: 1000, optional: true, field: 'Détails' });
  await q(`insert into reports (reporter_id, target_type, target_id, reason, details) values ($1,$2,$3,$4,$5)
           on conflict (reporter_id, target_type, target_id) do nothing`, [req.user.id, type, id, reason, details]);
  // garde-fou automatique : masquage préventif d'un commentaire signalé plusieurs fois
  if (type === 'comment') {
    const { n } = await one(`select count(*)::int n from reports where target_type='comment' and target_id=$1 and status='open'`, [id]);
    if (n >= AUTO_HIDE_REPORTS) await q(`update comments set status = 'hidden' where id = $1 and status = 'visible'`, [id]);
  }
  res.status(201).json({ ok: true, message: 'Merci. L\'équipe de modération va regarder.' });
});

r.get('/blocks', requireUser, async (req, res) => {
  res.json(await many('select u.id, u.handle, b.created_at from blocks b join users u on u.id = b.blocked_id where b.blocker_id = $1 order by b.created_at desc', [req.user.id]));
});
r.post('/blocks', requireUser, async (req, res) => {
  const id = uuid(req.body?.user_id);
  if (id === req.user.id) fail(400, 'Tu ne peux pas te bloquer toi-même');
  const target = await one('select is_official from users where id = $1', [id]);
  if (!target) fail(404, 'Compte introuvable');
  if (target.is_official) fail(400, 'Les comptes officiels ne peuvent pas être bloqués');
  await q('insert into blocks (blocker_id, blocked_id) values ($1,$2) on conflict do nothing', [req.user.id, id]);
  res.status(201).json({ ok: true });
});
r.delete('/blocks/:id', requireUser, async (req, res) => {
  await q('delete from blocks where blocker_id = $1 and blocked_id = $2', [req.user.id, uuid(req.params.id)]);
  res.json({ ok: true });
});
