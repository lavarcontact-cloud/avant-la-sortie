import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { query } from "@/lib/db";
import { ingestBatch, isBot, validateEvent } from "@/lib/analytics/events";
import { ipKey, json, rateLimit, sameOrigin } from "@/lib/server-utils";
import { readAdminSession } from "@/lib/admin-auth";

/**
 * Ingestion des événements d'audience. Garde-fous :
 * - consentement vérifié CÔTÉ SERVEUR (cookie) : sans accord, rien n'est écrit ;
 * - robots déclarés ignorés ; trafic interne (admin connecté, ?internal=1) marqué ;
 * - noms et paramètres validés contre le plan de marquage ;
 * - doublons ignorés grâce à l'identifiant d'événement ;
 * - pas d'adresse IP stockée ; référent réduit au nom de domaine.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "origin" }, 403);
  const cookie = req.headers.get("cookie") ?? "";
  const raw = cookie.split(/;\s*/).find((c) => c.startsWith(CONSENT_COOKIE + "="))?.slice(CONSENT_COOKIE.length + 1);
  if (!parseConsent(raw)?.choices.audience) return json({ stored: 0, reason: "no-consent" }, 202);
  const ua = req.headers.get("user-agent");
  if (isBot(ua)) return json({ stored: 0, reason: "bot" }, 202);
  if (!(await rateLimit(`ev:${ipKey(req)}`, 240, 600))) return json({ stored: 0, reason: "rate" }, 429);

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "json" }, 400);
  }
  const parsed = ingestBatch.safeParse(body);
  if (!parsed.success) return json({ error: "schema" }, 400);
  const { sid, vid, utm, events } = parsed.data;
  const internal = !!parsed.data.internal || !!(await readAdminSession(cookie));
  const device = /Mobi|Android|iPhone|iPad/i.test(ua ?? "") ? "mobile" : "desktop";
  const country = req.headers.get("x-vercel-ip-country")?.slice(0, 2) ?? null;
  const now = Date.now();

  let stored = 0;
  for (const e of events) {
    const props = validateEvent(e.name, e.props);
    if (!props) continue;
    // Horodatage client borné : ±1 h autour de l'heure serveur.
    const ts = Math.abs(e.ts - now) < 3600_000 ? e.ts : now;
    let referrerDomain: string | null = null;
    let path: string | null = typeof props.path === "string" ? props.path.split("?")[0] : null;
    if (e.name === "page_view" && typeof props.referrer === "string") {
      try {
        referrerDomain = new URL(props.referrer).hostname.replace(/^www\./, "");
      } catch {}
      delete props.referrer;
    }
    if (path && path.startsWith("/admin")) continue;
    if (e.name === "outbound_click" && typeof props.url === "string") {
      try { props.url = new URL(props.url).hostname; } catch {}
    }
    const rows = await query(
      `INSERT INTO events (id, name, ts, sid, vid, path, props, utm_source, utm_medium, utm_campaign, referrer_domain, device, country, internal)
       VALUES ($1,$2,to_timestamp($3/1000.0),$4,$5,$6,$7::text::jsonb,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [e.id, e.name, ts, sid, vid ?? null, path, JSON.stringify(props), utm?.source ?? null, utm?.medium ?? null, utm?.campaign ?? null, referrerDomain, device, country, internal],
    );
    stored += rows.length;
  }
  return json({ stored });
}
