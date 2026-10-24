import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { q, one } from '../db.js';
import { config } from '../config.js';
import { fail } from './http.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'frq_session';

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  const [algo, saltB64, keyB64] = String(stored).split('$');
  if (algo !== 'scrypt') return false;
  const key = Buffer.from(keyB64, 'base64');
  const test = await scrypt(pw, Buffer.from(saltB64, 'base64'), key.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(key, test);
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export async function createSession(res, userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + config.sessionDays * 864e5);
  await q('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)', [sha256(token), userId, expires]);
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, expires, path: '/',
  });
}
export async function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) await q('delete from sessions where token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

export function ageOf(birthYear, birthMonth, now = new Date()) {
  // Âge au mois près, arrondi vers le bas (on ne connaît pas le jour).
  let age = now.getUTCFullYear() - birthYear;
  if (now.getUTCMonth() + 1 < birthMonth) age -= 1;
  return age;
}
export const isMinor = (u) => ageOf(u.birth_year, u.birth_month) < 18;

const USER_COLS = `u.id, u.email, u.handle, u.display_name, u.bio, u.avatar_media_id, u.avatar_style, u.role, u.is_official,
  u.birth_year, u.birth_month, u.status, u.created_at`;

// Middleware : attache req.user (ou null). Ne bloque jamais.
export async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    const u = await one(
      `select ${USER_COLS} from sessions s join users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now() and u.status <> 'deleted'`, [sha256(token)]);
    if (u) {
      req.user = u;
      // activité quotidienne agrégée (statistiques), au plus une écriture par jour
      q(`insert into daily_activity (user_id, day) values ($1, current_date) on conflict do nothing`, [u.id]).catch(() => {});
    }
  }
  next();
}

export const ROLE_RANK = { fan: 0, moderator: 1, editor: 2, admin: 3 };

export const requireUser = (req, _res, next) => {
  if (!req.user) fail(401, 'Connexion requise', 'auth_required');
  if (req.user.status === 'suspended') fail(403, 'Compte suspendu', 'suspended');
  next();
};
// Participation (publier, commenter, réagir, voter) : compte actif uniquement.
// Un compte de moins de 15 ans attend le consentement parental.
export const requireActive = (req, res, next) => requireUser(req, res, () => {
  if (req.user.status === 'pending_parent') fail(403, 'En attente de l\'accord d\'un parent', 'pending_parent');
  next();
});
// Les rôles staff sont cumulatifs : admin ⊃ editor ⊃ moderator.
// Exception volontaire : le modérateur n'a pas accès à la publication éditoriale.
export const requireRole = (min) => (req, res, next) => requireUser(req, res, () => {
  if (ROLE_RANK[req.user.role] < ROLE_RANK[min]) fail(403, 'Accès réservé à l\'équipe', 'forbidden');
  next();
});
export const requireAnyRole = (...roles) => (req, res, next) => requireUser(req, res, () => {
  if (req.user.role !== 'admin' && !roles.includes(req.user.role)) fail(403, 'Accès réservé à l\'équipe', 'forbidden');
  next();
});
export const isStaff = (u) => u && ROLE_RANK[u.role] >= 1;

export function publicUser(u, { self = false } = {}) {
  if (!u) return null;
  const out = {
    id: u.id, handle: u.handle, display_name: u.display_name, bio: u.bio,
    avatar_media_id: u.avatar_media_id, avatar_style: u.avatar_style, is_official: u.is_official, role: u.role,
  };
  if (self) {
    out.email = u.email;
    out.status = u.status;
    out.is_minor = isMinor(u);
    out.age = ageOf(u.birth_year, u.birth_month);
    out.created_at = u.created_at;
  }
  return out;
}
