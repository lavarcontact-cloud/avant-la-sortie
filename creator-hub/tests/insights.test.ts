// Intégration des statistiques Instagram personnelles réelles (relevé du 12/11/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { InsightsSchema } from "../src/lib/insights-import";
import { accountMetrics, priceCard, audienceProjection, type Account } from "../src/lib/forecast/audience";
import { DEFAULT_FORECAST } from "../src/lib/forecast/business";

const FILE = path.join(__dirname, "../data/imports/instagram-personnel-2026-11-12.json");
const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

function toAccount(p = InsightsSchema.parse(raw)): Account {
  return {
    id: 1, owner: p.account.owner, platform: p.account.platform, handle: p.account.handle,
    snapshots: p.snapshots.map((s) => ({ captured_on: s.captured_on, followers: s.followers ?? null, views_30d: s.views_30d ?? null, views_90d: s.views_90d ?? null, reach_30d: s.reach_30d ?? null,
      impressions_30d: null, engagements_30d: s.engagements_30d ?? null, posts_30d: s.posts_30d ?? null, avg_story_views: s.avg_story_views ?? null, source: p.source, derived: s.derived, insights: (s.insights as any) ?? null })),
    contents: p.contents.map((c) => ({ kind: c.kind, views: c.views ?? null, reach: c.reach ?? null, likes: c.likes ?? null, comments: c.comments ?? null, shares: c.shares ?? null, reposts: c.reposts ?? null, saves: c.saves ?? null, replies: c.replies ?? null })),
  };
}

test("relevé réel : fichier valide, entité personnelle, source et valeurs dérivées signalées", () => {
  const p = InsightsSchema.parse(raw);
  assert.equal(p.account.owner, "personal");
  const cur = p.snapshots.find((s) => s.captured_on === "2026-11-12")!;
  assert.equal(cur.followers, 2386); assert.equal(cur.views_30d, 61458); assert.equal(cur.reach_30d, 15381); assert.equal(cur.engagements_30d, 1200 + 251 + 137);
  const prev = p.snapshots.find((s) => s.derived)!;
  assert.equal(prev.followers, 2386 - 96);
  assert.equal(prev.views_30d, Math.round(61458 / 1.323));
  assert.equal(prev.reach_30d, Math.round(15381 / 1.38));
  assert.match(prev.source_detail!, /DÉRIVÉ/);
  assert.ok(!JSON.stringify(raw).includes("@zz0") && !JSON.stringify(raw).includes("takumei") && !JSON.stringify(raw).includes("ifa_pursang"), "aucun identifiant de tiers conservé");
  const age = (cur.insights as any).age_pct; assert.ok(Math.abs(Object.values(age as Record<string, number>).reduce((a, b) => a + b, 0) - 100) < 0.2);
});

test("indicateurs calculés sur les données réelles", () => {
  const m = accountMetrics(toAccount(), "2026-11-12");
  assert.equal(m.latest!.captured_on, "2026-11-12");
  assert.equal(m.engagementFormula, "interactions 30 j ÷ portée 30 j");
  assert.equal(Math.round(m.engagementRate! * 1000) / 10, 10.3);         // 1 588 / 15 381
  assert.equal(Math.round(m.followerGrowth! * 1000) / 10, 4.2);          // (2 386 / 2 290) sur 30 jours
  assert.equal(m.viewsPerPost, 4800);                                     // médiane de 14k, 7,5k, 4,8k, 4,1k, 4k
  assert.match(m.viewsPerPostBasis!, /médiane de 5 publications/);
  assert.equal(m.storyViews, 313);                                        // médiane de 9 stories
  assert.ok(m.missing.some((x) => x.startsWith("nombre de publications")));
});

test("pas d'extrapolation d'un pic de vues : +32 % observés, projetés au rythme des abonnés", () => {
  const m = accountMetrics(toAccount(), "2026-11-12");
  assert.ok(m.viewsGrowthObserved! > 0.3);
  assert.equal(m.viewsGrowth, m.followerGrowth);
  const prices = priceCard([m], DEFAULT_FORECAST, [], "2026-11-12");
  const zero = { prudent: 0, central: 0, ambitious: 0 };
  const proj = audienceProjection([m], prices, DEFAULT_FORECAST, { contracts: Array(7).fill(zero), weighted: Array(7).fill(zero) });
  assert.equal(proj.provisional, false);
  const f6 = proj.rows[6].followers.central["instagram:personnel"]!;
  assert.ok(f6 > 3000 && f6 < 3150, `abonnés à 6 mois (central) : ${f6}`);  // 2 386 × 1,042^6 ≈ 3 060
  assert.ok(proj.rows[6].views.central! < 61458 * 1.3);                   // pas ×5 comme avec +32 %/mois
});

test("tarifs : UGC (production) et influence (diffusion) séparés, calcul vérifiable", () => {
  const m = accountMetrics(toAccount(), "2026-11-12");
  const p = Object.fromEntries(priceCard([m], DEFAULT_FORECAST, [], "2026-11-12").map((x) => [x.key, x]));
  assert.equal(p.ugc_no_post.mid, 220); assert.equal(p.ugc_no_post.publication, null);        // 4 h × 55 €
  assert.equal(p.reel_ig.publication!.mid, 72);                                               // 4 800 vues × 15 € / 1000
  assert.equal(p.reel_ig.mid, 292);
  assert.equal(p.diffusion_only.mid, 100);                                                    // 0,5 h × 55 + 72
  assert.equal(p.story_ig.mid, 60);                                                           // 55 + 313 × 15 / 1000
  assert.equal(p.reel_ig.confidence, "moyenne");                                              // échantillon → jamais « élevée »
  assert.equal(p.tiktok.available, false);
});

test("import en base : idempotent, n'écrase rien, n'affecte pas La Var Media", async () => {
  process.env.PGLITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "insights-"));
  const { q } = await import("../src/lib/db");
  const { importInsights } = await import("../src/lib/insights-import");
  // Données existantes : un compte La Var Media et un relevé personnel saisi à la main le 12/11.
  const lv = (await q<{ id: number }>(`insert into social_accounts (owner, platform, handle) values ('lavar_media','instagram','test_lavar') returning id`))[0].id;
  await q(`insert into social_snapshots (account_id, captured_on, followers, source) values ($1,'2026-11-01',50000,'TEST La Var')`, [lv]);
  const me = (await q<{ id: number }>(`insert into social_accounts (owner, platform, handle) values ('personal','instagram','test_moi') returning id`))[0].id;
  await q(`insert into social_snapshots (account_id, captured_on, followers, source) values ($1,'2026-11-12',9999,'saisie manuelle')`, [me]);

  const r1 = await importInsights(raw);
  assert.equal(r1.accountId, me, "rattaché au compte personnel existant, pas de doublon");
  assert.deepEqual(r1.snapshotsAdded, ["2026-10-13"]);
  assert.deepEqual(r1.snapshotsSkipped, ["2026-11-12"]);
  assert.equal((await q<any>(`select followers from social_snapshots where account_id=$1 and captured_on='2026-11-12'`, [me]))[0].followers, 9999, "relevé existant non écrasé");
  assert.equal(r1.contentsAdded, 14);
  const r2 = await importInsights(raw);
  assert.equal(r2.snapshotsAdded.length, 0); assert.equal(r2.contentsAdded, 0); assert.equal(r2.contentsSkipped, 14);
  const lav = await q<any>(`select count(*)::int n, max(followers) f from social_snapshots where account_id=$1`, [lv]);
  assert.equal(lav[0].n, 1); assert.equal(lav[0].f, 50000);
  assert.equal((await q<any>(`select count(*)::int n from social_content where account_id=$1`, [lv]))[0].n, 0);
});
