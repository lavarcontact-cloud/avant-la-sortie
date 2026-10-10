import { z } from "zod";
import { dbConfigured, query } from "@/lib/db";
import { ipKey, json, rateLimit, sameOrigin } from "@/lib/server-utils";

const body = z.object({
  id: z.uuid(),
  version: z.string().max(40),
  choices: z.object({ audience: z.boolean() }),
  action: z.enum(["accept_all", "reject_all", "custom"]),
});

/** Journal de preuve des choix de consentement (sans IP, sans identité). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "origin" }, 403);
  // Aperçu sans base : le choix reste mémorisé dans le navigateur, la preuve n'est pas journalisée.
  if (!dbConfigured()) return json({ ok: false, reason: "no-db" }, 202);
  if (!(await rateLimit(`consent:${ipKey(req)}`, 30, 3600))) return json({ error: "rate" }, 429);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "schema" }, 400);
  const ua = req.headers.get("user-agent") ?? "";
  const family = /Firefox/.test(ua) ? "firefox" : /Edg\//.test(ua) ? "edge" : /Chrome/.test(ua) ? "chrome" : /Safari/.test(ua) ? "safari" : "autre";
  const d = parsed.data;
  await query(`INSERT INTO consents (consent_id, version, choices, action, ua_family) VALUES ($1,$2,$3::text::jsonb,$4,$5)`, [d.id, d.version, JSON.stringify(d.choices), d.action, family]);
  return json({ ok: true });
}
