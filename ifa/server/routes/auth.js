import { Router } from 'express';
import { q, one, many, tx } from '../db.js';
import { config } from '../config.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, ageOf, publicUser,
  requireUser, sha256, randomToken,
} from '../lib/auth.js';
import { str, fail } from '../lib/http.js';
import { rateLimit } from '../lib/ratelimit.js';
import { sendMail } from '../lib/mail.js';
import { award } from '../lib/badges.js';
import { getPrefs } from '../lib/notify.js';
import { checkText } from '../lib/moderation.js';
import { audit } from '../lib/audit.js';

const r = Router();
export default r;

const AVATAR_COLORS = ['sodium', 'uv', 'canal', 'brique', 'craie'];
const AVATAR_GLYPHS = ['◉', '▲', '◆', '✚', '○', '■', '✦', '≋'];
export const validAvatar = (s) => {
  const [c, g] = String(s || '').split(':');
  return AVATAR_COLORS.includes(c) && AVATAR_GLYPHS.includes(g);
};

r.post('/auth/signup', rateLimit({ key: 'signup', max: 8, windowMs: 3600e3 }), async (req, res) => {
  const b = req.body || {};
  const email = str(b.email, { max: 200, field: 'E-mail' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'E-mail invalide');
  const password = str(b.password, { min: 8, max: 200, field: 'Mot de passe' });
  const handle = str(b.handle, { min: 3, max: 24, field: 'Pseudo' });
  if (!/^[a-zA-Z0-9_.]{3,24}$/.test(handle)) fail(400, 'Pseudo : lettres, chiffres, _ et . uniquement');
  if (!checkText(handle).ok || /ifa|officiel|official|admin|modo/i.test(handle)) fail(400, 'Ce pseudo n\'est pas disponible');
  const by = Number(b.birth_year), bm = Number(b.birth_month);
  const thisYear = new Date().getUTCFullYear();
  if (!Number.isInteger(by) || by < thisYear - 100 || by > thisYear || !Number.isInteger(bm) || bm < 1 || bm > 12) fail(400, 'Date de naissance invalide');
  if (!b.accept_terms) fail(400, 'Il faut accepter les conditions et la charte');

  const age = ageOf(by, bm);
  if (age < config.minAge) fail(403, `Fréquence est ouverte à partir de ${config.minAge} ans.`, 'too_young');

  const needsParent = age < config.parentalConsentAge;
  let parentEmail = null;
  if (needsParent) {
    parentEmail = str(b.parent_email, { max: 200, field: 'E-mail d\'un parent' }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) fail(400, 'E-mail du parent invalide');
    if (parentEmail === email) fail(400, 'L\'e-mail du parent doit être différent du tien');
  }
  const avatar = validAvatar(b.avatar_style) ? b.avatar_style : `${AVATAR_COLORS[Math.floor(Math.random() * 5)]}:◉`;

  if (await one('select 1 from users where email = $1', [email])) fail(409, 'Un compte existe déjà avec cet e-mail');
  if (await one('select 1 from users where handle = $1', [handle])) fail(409, 'Ce pseudo est déjà pris');

  const parentToken = needsParent ? randomToken() : null;
  const user = await one(
    `insert into users (email, password_hash, handle, birth_year, birth_month, status, parent_email, parent_token_hash, terms_version, avatar_style)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [email, await hashPassword(password), handle, by, bm, needsParent ? 'pending_parent' : 'active',
      parentEmail, parentToken ? sha256(parentToken) : null, config.termsVersion, avatar]);

  if (needsParent) {
    const link = `${config.publicUrl}/parent/${parentToken}`;
    await sendMail({
      to: parentEmail,
      subject: `${handle} souhaite rejoindre Fréquence, l'espace officiel d'Ifa`,
      text: `Bonjour,\n\nUn compte "${handle}" a été créé sur Fréquence, l'application officielle de l'artiste Ifa, par une personne de moins de ${config.parentalConsentAge} ans qui a indiqué votre adresse.\n\nLa loi française demande votre accord pour que ce compte puisse participer (publier, commenter, voter, recevoir des notifications). Sans réponse, le compte reste en lecture seule et sera supprimé au bout de 30 jours.\n\nConsulter et répondre : ${link}\n\nCe que nous collectons : un e-mail, un pseudo, le mois et l'année de naissance. Pas de nom, pas d'adresse, pas de géolocalisation, pas de messagerie privée.\n`,
    });
  } else {
    await award(user.id, 'premiere_onde', 'Inscription pendant le lancement');
  }
  await createSession(res, user.id);
  res.status(201).json({ user: publicUser(user, { self: true }) });
});

r.post('/auth/login', rateLimit({ key: 'login', max: 10, windowMs: 15 * 60e3 }), async (req, res) => {
  const email = str(req.body?.email, { max: 200, field: 'E-mail' }).toLowerCase();
  const password = str(req.body?.password, { max: 200, field: 'Mot de passe' });
  const u = await one(`select * from users where email = $1 and status <> 'deleted'`, [email]);
  if (!u || !(await verifyPassword(password, u.password_hash))) fail(401, 'E-mail ou mot de passe incorrect');
  if (u.status === 'suspended') fail(403, 'Ce compte est suspendu. Contacte l\'équipe si tu penses que c\'est une erreur.');
  await q('update users set last_seen_at = now() where id = $1', [u.id]);
  await createSession(res, u.id);
  res.json({ user: publicUser(u, { self: true }) });
});

r.post('/auth/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

r.get('/auth/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const [badges, unread, prefs] = await Promise.all([
    many(`select b.code, b.name, b.description, b.glyph, ub.awarded_at from user_badges ub join badges b on b.code = ub.badge_code where ub.user_id = $1 order by ub.awarded_at`, [req.user.id]),
    one('select count(*)::int as n from notifications where user_id = $1 and read_at is null', [req.user.id]),
    getPrefs(req.user),
  ]);
  res.json({ user: publicUser(req.user, { self: true }), badges, unread: unread.n, prefs });
});

r.patch('/me', requireUser, async (req, res) => {
  const b = req.body || {};
  const display = str(b.display_name, { max: 40, optional: true, field: 'Nom affiché' });
  const bio = str(b.bio, { max: 160, optional: true, field: 'Bio' });
  for (const t of [display, bio]) if (t) { const c = checkText(t); if (!c.ok) fail(400, c.reason); }
  if (b.avatar_style !== undefined && !validAvatar(b.avatar_style)) fail(400, 'Avatar invalide');
  const u = await one(
    `update users set display_name = coalesce($2, display_name), bio = $3, avatar_style = coalesce($4, avatar_style)
     where id = $1 returning *`, [req.user.id, display, bio, b.avatar_style || null]);
  res.json({ user: publicUser(u, { self: true }) });
});

r.put('/me/password', requireUser, rateLimit({ key: 'pw', max: 10, windowMs: 3600e3 }), async (req, res) => {
  const current = str(req.body?.current, { max: 200, field: 'Mot de passe actuel' });
  const next = str(req.body?.next, { min: 10, max: 200, field: 'Nouveau mot de passe (10 caractères minimum)' });
  const u = await one('select password_hash from users where id = $1', [req.user.id]);
  if (!(await verifyPassword(current, u.password_hash))) fail(401, 'Mot de passe actuel incorrect');
  await q('update users set password_hash = $2 where id = $1', [req.user.id, await hashPassword(next)]);
  // déconnecte les autres appareils
  await q('delete from sessions where user_id = $1', [req.user.id]);
  await createSession(res, req.user.id);
  res.json({ ok: true });
});

// Droit à la portabilité (RGPD art. 20)
r.get('/me/export', requireUser, async (req, res) => {
  const id = req.user.id;
  const data = {
    exported_at: new Date().toISOString(),
    account: await one('select email, handle, display_name, bio, avatar_style, birth_year, birth_month, status, created_at, terms_version, terms_accepted_at from users where id = $1', [id]),
    badges: await many('select badge_code, awarded_at from user_badges where user_id = $1', [id]),
    circles: await many('select c.slug, m.joined_at from circle_members m join circles c on c.id = m.circle_id where m.user_id = $1', [id]),
    fan_posts: await many('select id, caption, status, created_at from fan_posts where author_id = $1', [id]),
    comments: await many('select target_type, target_id, body, status, created_at from comments where author_id = $1', [id]),
    reactions: await many('select target_type, target_id, kind, created_at from reactions where user_id = $1', [id]),
    votes: await many('select drop_id, option_id, voted_at from drop_votes where user_id = $1', [id]),
    reports_made: await many('select target_type, reason, created_at from reports where reporter_id = $1', [id]),
    notification_prefs: await getPrefs(req.user),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="frequence-mes-donnees.json"');
  res.json(data);
});

// Droit à l'effacement (RGPD art. 17) : suppression immédiate et définitive.
r.delete('/me', requireUser, async (req, res) => {
  const pw = str(req.body?.password, { max: 200, field: 'Mot de passe' });
  const u = await one('select password_hash, role from users where id = $1', [req.user.id]);
  if (!(await verifyPassword(pw, u.password_hash))) fail(401, 'Mot de passe incorrect');
  if (u.role === 'admin' && (await one(`select count(*)::int n from users where role='admin' and status='active'`)).n <= 1)
    fail(400, 'Impossible de supprimer le dernier compte administrateur');
  const keys = await many('select storage_key from media where owner_id = $1', [req.user.id]);
  await tx(async (c) => {
    await c.query('delete from comments where author_id = $1', [req.user.id]);
    await c.query('delete from media where owner_id = $1 and id not in (select media_id from posts where media_id is not null)', [req.user.id]);
    await c.query('delete from users where id = $1', [req.user.id]);
  });
  const { remove } = await import('../lib/storage.js');
  keys.forEach((k) => remove(k.storage_key));
  await audit(null, 'account.deleted', 'user', req.user.id);
  res.clearCookie('frq_session', { path: '/' });
  res.json({ ok: true });
});

// ------------------------------------------------ consentement parental
r.get('/parent/:token', async (req, res) => {
  const u = await one(`select handle, status, parent_consent_at, created_at from users where parent_token_hash = $1`, [sha256(req.params.token)]);
  if (!u) fail(404, 'Lien invalide ou expiré');
  res.json({ handle: u.handle, status: u.status, created_at: u.created_at });
});
r.post('/parent/:token', rateLimit({ key: 'parent', max: 10, windowMs: 3600e3 }), async (req, res) => {
  const u = await one(`select id, handle, status from users where parent_token_hash = $1`, [sha256(req.params.token)]);
  if (!u) fail(404, 'Lien invalide ou expiré');
  if (req.body?.decision === 'accept') {
    if (u.status !== 'pending_parent') return res.json({ ok: true, status: u.status });
    await q(`update users set status = 'active', parent_consent_at = now() where id = $1`, [u.id]);
    await award(u.id, 'premiere_onde', 'Inscription pendant le lancement');
    await audit(null, 'parent.accepted', 'user', u.id);
    return res.json({ ok: true, status: 'active' });
  }
  if (req.body?.decision === 'refuse') {
    await q('delete from users where id = $1', [u.id]);
    await audit(null, 'parent.refused_account_deleted', 'user', u.id);
    return res.json({ ok: true, status: 'deleted' });
  }
  fail(400, 'Décision invalide');
});
