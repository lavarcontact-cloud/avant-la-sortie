import { Router } from 'express';
import { q, one, many } from '../db.js';
import { requireUser, requireActive } from '../lib/auth.js';
import { fail, oneOf, uuid } from '../lib/http.js';
import { CATEGORIES, getPrefs, sendTestPush } from '../lib/notify.js';
import { pushConfigured } from '../config.js';

const r = Router();
export default r;

r.get('/notifications', requireUser, async (req, res) => {
  const items = await many('select id, category, title, body, url, created_at, read_at from notifications where user_id = $1 order by created_at desc limit 100', [req.user.id]);
  res.json({ items, categories: CATEGORIES });
});
r.post('/notifications/read-all', requireUser, async (req, res) => {
  await q('update notifications set read_at = now() where user_id = $1 and read_at is null', [req.user.id]);
  res.json({ ok: true });
});
r.post('/notifications/:id/read', requireUser, async (req, res) => {
  await q('update notifications set read_at = coalesce(read_at, now()) where id = $1 and user_id = $2', [uuid(req.params.id), req.user.id]);
  res.json({ ok: true });
});

r.get('/notifications/prefs', requireUser, async (req, res) => {
  const subs = await one('select count(*)::int n from push_subscriptions where user_id = $1', [req.user.id]);
  res.json({ prefs: await getPrefs(req.user), categories: CATEGORIES, push: { configured: pushConfigured(), devices: subs.n } });
});
r.put('/notifications/prefs', requireActive, async (req, res) => {
  const b = req.body || {};
  const current = await getPrefs(req.user);
  const categories = { ...current.categories };
  for (const k of Object.keys(CATEGORIES)) if (typeof b.categories?.[k] === 'boolean') categories[k] = b.categories[k];
  const frequency = oneOf(b.frequency ?? current.frequency, ['all', 'important', 'off'], 'fréquence');
  const hour = (v, d) => { const n = Number(v ?? d); if (!Number.isInteger(n) || n < 0 || n > 23) fail(400, 'Heure invalide'); return n; };
  const qs = hour(b.quiet_start, current.quiet_start), qe = hour(b.quiet_end, current.quiet_end);
  const personalized = typeof b.personalized === 'boolean' ? b.personalized : current.personalized;
  await q(`insert into notification_prefs (user_id, categories, frequency, quiet_start, quiet_end, personalized, updated_at)
           values ($1,$2,$3,$4,$5,$6,now())
           on conflict (user_id) do update set categories=$2, frequency=$3, quiet_start=$4, quiet_end=$5, personalized=$6, updated_at=now()`,
  [req.user.id, categories, frequency, qs, qe, personalized]);
  res.json({ prefs: await getPrefs(req.user) });
});

r.post('/push/subscribe', requireActive, async (req, res) => {
  if (!pushConfigured()) fail(503, 'Les notifications push ne sont pas encore activées sur ce serveur', 'push_not_configured');
  const s = req.body || {};
  if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) fail(400, 'Abonnement invalide');
  await q(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,$2,$3,$4)
           on conflict (endpoint) do update set user_id = $1, p256dh = $3, auth = $4`, [req.user.id, s.endpoint, s.keys.p256dh, s.keys.auth]);
  res.status(201).json({ ok: true });
});
r.post('/push/unsubscribe', requireUser, async (req, res) => {
  if (req.body?.endpoint) await q('delete from push_subscriptions where endpoint = $1 and user_id = $2', [req.body.endpoint, req.user.id]);
  else await q('delete from push_subscriptions where user_id = $1', [req.user.id]);
  res.json({ ok: true });
});
r.post('/push/test', requireActive, async (req, res) => {
  res.json(await sendTestPush(req.user.id));
});
