import { z } from "zod";

/**
 * Plan de marquage : source unique de vérité pour les événements client.
 * Tout événement hors de cette liste est rejeté par l'API d'ingestion.
 * Le dictionnaire documenté se trouve dans docs/07-plan-de-marquage.md.
 */
export const CLIENT_EVENTS = {
  page_view: z.object({ path: z.string().max(300), referrer: z.string().max(300).optional() }),
  video_start: z.object({ project: z.string().max(80), video: z.string().max(80), surface: z.enum(["feed", "project", "home"]) }),
  video_progress: z.object({ project: z.string().max(80), video: z.string().max(80), pct: z.union([z.literal(25), z.literal(50), z.literal(75)]) }),
  video_complete: z.object({ project: z.string().max(80), video: z.string().max(80) }),
  feed_swipe: z.object({ from: z.string().max(80), to: z.string().max(80), index: z.number().int().min(0).max(500) }),
  artist_bubble_click: z.object({ artist: z.string().max(80), surface: z.enum(["home", "constellation", "feed", "project"]) }),
  project_open: z.object({ project: z.string().max(80), surface: z.string().max(40) }),
  photo_open: z.object({ photo: z.string().max(80) }),
  cta_click: z.object({ cta: z.enum(["devis", "contact_email", "contact_phone", "prestation", "paiement"]), surface: z.string().max(40) }),
  outbound_click: z.object({ url: z.string().max(300), label: z.string().max(80).optional() }),
  share: z.object({ project: z.string().max(80), method: z.enum(["native", "copy"]) }),
  quote_step: z.object({ step: z.number().int().min(1).max(5) }),
  web_vital: z.object({ name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]), value: z.number().min(0).max(100000), rating: z.enum(["good", "needs-improvement", "poor"]) }),
  js_error: z.object({ message: z.string().max(300), source: z.string().max(300).optional() }),
} as const;

export type ClientEventName = keyof typeof CLIENT_EVENTS;
export type ClientEventProps<N extends ClientEventName> = z.infer<(typeof CLIENT_EVENTS)[N]>;

/** Événements écrits côté serveur uniquement (non falsifiables par le client). */
export const SERVER_EVENTS = [
  "quote_submitted",
  "checkout_started",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "payment_anomaly",
] as const;
export type ServerEventName = (typeof SERVER_EVENTS)[number];

export const ingestBatch = z.object({
  sid: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  vid: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/).optional(),
  internal: z.boolean().optional(),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(100).optional(),
    })
    .optional(),
  events: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        ts: z.number().int(),
        props: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(30),
});

export function validateEvent(name: string, props: unknown) {
  const schema = (CLIENT_EVENTS as Record<string, z.ZodType>)[name];
  if (!schema) return null;
  const r = schema.safeParse(props);
  return r.success ? (r.data as Record<string, unknown>) : null;
}

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|headless|lighthouse|pagespeed|gtmetrix|python-requests|curl|wget|axios|node-fetch|go-http/i;
export function isBot(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}
