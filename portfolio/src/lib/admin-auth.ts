import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "./env";

/**
 * Espace privé à utilisateur unique (Sébastien). Pas de service tiers :
 * - mot de passe vérifié contre une empreinte scrypt (ADMIN_PASSWORD_HASH,
 *   générée par `npm run admin:hash`), comparaison à temps constant ;
 * - session = jeton signé HMAC-SHA256 (SESSION_SECRET), cookie HttpOnly,
 *   Secure, SameSite=Strict, durée 8 h ;
 * - chaque page ET chaque action serveur revérifie la session.
 */

export const ADMIN_COOKIE = "sfp_admin";
const SESSION_TTL_S = 8 * 3600;

export function hashPassword(password: string, salt = crypto.randomBytes(16)): string {
  const N = 16384, r = 8, p = 1;
  const key = crypto.scryptSync(password, salt, 32, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [algo, N, r, p, salt, key] = stored.split(":");
  if (algo !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(expected, actual);
}

function secret(): string {
  const s = serverEnv().sessionSecret;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: Math.floor(now / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(tok: string | undefined, now = Date.now()): boolean {
  if (!tok) return false;
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) return false;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.sub === "admin" && typeof data.exp === "number" && data.exp * 1000 > now;
  } catch {
    return false;
  }
}

/** Lecture depuis un en-tête Cookie brut (routes API). */
export async function readAdminSession(cookieHeader: string): Promise<boolean> {
  const tok = cookieHeader.split(/;\s*/).find((c) => c.startsWith(ADMIN_COOKIE + "="))?.slice(ADMIN_COOKIE.length + 1);
  return verifySessionToken(tok);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
}

/** À appeler en tête de chaque page et action serveur de l'admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function setSessionCookie() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}
