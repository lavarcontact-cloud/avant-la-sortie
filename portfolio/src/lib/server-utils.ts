import "server-only";
import crypto from "node:crypto";
import { one, query } from "./db";
import { serverEnv } from "./env";

/** Référence lisible : préfixe + année + 5 caractères sans ambiguïté (pas de 0/O, 1/I). */
export function makeRef(prefix: "D" | "C" | "R"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(5);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}-${new Date().getFullYear()}-${code}`;
}

export function token(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Empreinte de l'IP (jamais stockée en clair), pour la limitation de débit uniquement. */
export function ipKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return crypto.createHmac("sha256", serverEnv().ipHashSalt).update(ip).digest("base64url").slice(0, 22);
}

/**
 * Limitation de débit à fenêtre fixe, stockée en base (fonctionne même si
 * plusieurs instances serverless tournent en parallèle).
 * Retourne true si la requête est autorisée.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const row = await one<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSec],
  );
  return (row?.count ?? 1) <= limit;
}

/**
 * Protection CSRF des routes API publiques : la requête doit venir de notre
 * propre origine (les navigateurs envoient toujours Origin sur un POST).
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Notification e-mail via l'API Resend si configurée ; sinon, rien (la donnée reste en base). */
export async function notify(subject: string, text: string): Promise<"sent" | "skipped" | "failed"> {
  const { resendApiKey, notifyEmail } = serverEnv();
  if (!resendApiKey || !notifyEmail) return "skipped";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM ?? "Portfolio <onboarding@resend.dev>", to: [notifyEmail], subject, text }),
    });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function recordServerEvent(name: string, props: Record<string, unknown>) {
  await query(
    `INSERT INTO events (id, name, ts, props, server_side) VALUES ($1, $2, now(), $3::text::jsonb, true)`,
    [crypto.randomUUID(), name, JSON.stringify(props)],
  );
}
