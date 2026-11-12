// Import d'un relevé de statistiques complet (format creator-hub/insights@1).
// Règles : validation stricte, source obligatoire, aucun relevé existant n'est écrasé
// (les doublons sont ignorés et signalés), entités jamais mélangées.
import { z } from "zod";
import { q, one } from "./db";
import { PLATFORMS } from "./forecast/audience";

const int = z.number().int().nonnegative().nullable().optional();
const pctMap = z.record(z.string(), z.number().min(0).max(100)).optional();

export const InsightsSchema = z.object({
  format: z.literal("creator-hub/insights@1"),
  account: z.object({
    owner: z.string().regex(/^[a-z_]{2,30}$/),
    platform: z.string().refine((p) => p in PLATFORMS, "Plateforme inconnue"),
    handle: z.string().min(1).max(100),
    note: z.string().optional(),
  }),
  source: z.string().min(5, "Source obligatoire"),
  snapshots: z.array(z.object({
    captured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period: z.string().optional(),
    followers: int, views_30d: int, views_90d: int, reach_30d: int, impressions_30d: int, engagements_30d: int, posts_30d: int, avg_story_views: int,
    source_detail: z.string().optional(),
    derived: z.boolean().optional(),
    insights: z.object({
      gender_pct: pctMap, age_pct: pctMap, countries_pct: pctMap, languages_pct: pctMap,
    }).passthrough().optional(),
  })).min(1),
  contents: z.array(z.object({
    posted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    kind: z.enum(["post", "reel", "story", "video", "live"]),
    title: z.string().min(1).max(200),
    views: int, reach: int, likes: int, comments: int, shares: int, reposts: int, saves: int, replies: int,
  })).optional().default([]),
  sample_note: z.string().optional(),
});
export type InsightsPayload = z.infer<typeof InsightsSchema>;

export interface ImportReport {
  accountId: number; accountCreated: boolean; accountLabel: string;
  snapshotsAdded: string[]; snapshotsSkipped: string[]; contentsAdded: number; contentsSkipped: number;
}

/**
 * Rattache au compte existant de l'entité/plateforme s'il est unique (pour ne pas créer de doublon
 * quand l'identifiant réel a été renseigné entre-temps), sinon crée le compte.
 */
export async function importInsights(raw: unknown): Promise<ImportReport> {
  const p = InsightsSchema.parse(raw);
  const { owner, platform, handle } = p.account;
  const same = await q<{ id: number; handle: string }>(`select id, handle from social_accounts where owner=$1 and platform=$2 and active=true`, [owner, platform]);
  let accountId: number, accountCreated = false, accountLabel: string;
  const exact = same.find((a) => a.handle === handle);
  if (exact) { accountId = exact.id; accountLabel = exact.handle; }
  else if (same.length === 1) { accountId = same[0].id; accountLabel = same[0].handle; }
  else if (same.length > 1) throw new Error(`Plusieurs comptes ${platform} pour l'entité « ${owner} » : précisez l'identifiant exact dans le fichier.`);
  else {
    accountId = (await one<{ id: number }>(`insert into social_accounts (owner, platform, handle) values ($1,$2,$3) returning id`, [owner, platform, handle]))!.id;
    accountCreated = true; accountLabel = handle;
  }
  const report: ImportReport = { accountId, accountCreated, accountLabel, snapshotsAdded: [], snapshotsSkipped: [], contentsAdded: 0, contentsSkipped: 0 };
  for (const s of p.snapshots) {
    const r = await q(`insert into social_snapshots (account_id, captured_on, followers, views_30d, views_90d, reach_30d, impressions_30d, engagements_30d, posts_30d, avg_story_views,
        audience_geo, audience_age, audience_gender, source, source_detail, insights, derived, period)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      on conflict (account_id, captured_on) do nothing returning id`,
      [accountId, s.captured_on, s.followers ?? null, s.views_30d ?? null, s.views_90d ?? null, s.reach_30d ?? null, s.impressions_30d ?? null, s.engagements_30d ?? null,
        s.posts_30d ?? null, s.avg_story_views ?? null,
        fmtPct(s.insights?.countries_pct), fmtPct(s.insights?.age_pct), fmtPct(s.insights?.gender_pct),
        s.derived ? `${p.source} — valeurs dérivées` : p.source, s.source_detail ?? null, s.insights ? JSON.stringify(s.insights) : null, Boolean(s.derived), s.period ?? null]);
    (r.length ? report.snapshotsAdded : report.snapshotsSkipped).push(s.captured_on);
  }
  const capturedOn = p.snapshots.filter((s) => !s.derived).map((s) => s.captured_on).sort().pop() ?? p.snapshots[0].captured_on;
  for (const c of p.contents) {
    const r = await q(`insert into social_content (account_id, posted_on, kind, title, views, reach, likes, comments, shares, reposts, saves, replies, source, captured_on)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict (account_id, posted_on, kind, title) do nothing returning id`,
      [accountId, c.posted_on ?? null, c.kind, c.title, c.views ?? null, c.reach ?? null, c.likes ?? null, c.comments ?? null, c.shares ?? null, c.reposts ?? null, c.saves ?? null, c.replies ?? null, p.source, capturedOn]);
    if (r.length) report.contentsAdded++; else report.contentsSkipped++;
  }
  return report;
}

export function fmtPct(m: Record<string, number> | undefined): string | null {
  if (!m) return null;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${String(v).replace(".", ",")} %`).join(" · ");
}
