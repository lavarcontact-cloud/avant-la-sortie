// Session signée HMAC-SHA256 (Web Crypto) — utilisable dans proxy.ts et côté serveur.
export const SESSION_COOKIE = "hub_session";
export const SESSION_DAYS = 14;

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Clé de signature des sessions : SESSION_SECRET si défini (32+ caractères), sinon dérivée
 * (SHA-256) de deux secrets serveur déjà présents, ADMIN_PASSWORD et DATABASE_URL.
 * Changer le mot de passe invalide donc toutes les sessions ouvertes.
 */
let derived: string | null = null;
async function secretKey(): Promise<string | null> {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  const pw = process.env.ADMIN_PASSWORD, db = process.env.DATABASE_URL;
  if (!pw || !db) return null;
  if (!derived) derived = toHex(await crypto.subtle.digest("SHA-256", enc.encode(`creator-hub-session-v1\n${pw}\n${db}`)));
  return derived;
}

export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && ((process.env.SESSION_SECRET?.length ?? 0) >= 32 || process.env.DATABASE_URL));
}

export async function createSessionToken(): Promise<string> {
  const secret = (await secretKey())!;
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = `v1.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = await secretKey();
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(parts[2], await hmac(secret, `v1.${exp}`));
}

/** Comparaison à temps constant du mot de passe (via empreintes SHA-256). */
export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const h = async (s: string) => toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return safeEqual(await h(input), await h(expected));
}
