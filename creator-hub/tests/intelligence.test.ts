// Données de test fictives (marques « Test… », domaines example.*) — jamais mélangées aux données réelles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, rootDomain, parseProfileResult, detectSignals, scoreOpportunity, contactQuality, planBrandQueries, isNonBrandDomain, nameFromDomain } from "../src/lib/watch/core";
import { parseManualResults, firecrawlProvider } from "../src/lib/watch/providers";
import { smoothedProbability, stageProbabilities, businessForecast, activityTrend, DEFAULT_FORECAST, type StageRow } from "../src/lib/forecast/business";
import { accountMetrics, priceCard, audienceProjection, monthlyGrowth } from "../src/lib/forecast/audience";
import { forecastAccuracy, learnedCalibration } from "../src/lib/forecast/learning";
import type { Dataset } from "../src/lib/stats";

test("veille : normalisation et dédoublonnage par domaine racine", () => {
  assert.equal(normalizeDomain("https://www.Shop.Example.fr/path?x=1"), "shop.example.fr");
  assert.equal(rootDomain("shop.example.fr"), "example.fr");
  assert.equal(rootDomain("news.bbc.co.uk"), "bbc.co.uk");
  assert.equal(nameFromDomain("test-camera.fr"), "Test Camera");
  assert.ok(isNonBrandDomain("fr.linkedin.com") && !isNonBrandDomain("example.fr"));
});

test("veille : lecture d'un résultat LinkedIn public sans visiter LinkedIn", () => {
  const p = parseProfileResult({ url: "https://fr.linkedin.com/in/jane-test-123?trk=x", title: "Jane Test - Influence Manager - Example Cameras | LinkedIn", snippet: "" });
  assert.equal(p?.person_name, "Jane Test"); assert.equal(p?.person_role, "Influence Manager"); assert.equal(p?.company, "Example Cameras");
  assert.equal(p?.profileUrl, "https://fr.linkedin.com/in/jane-test-123");
  assert.equal(contactQuality(p!.person_role, true), "excellent");
  assert.equal(contactQuality("Comptable", true), "générique");
  const p2 = parseProfileResult({ url: "https://www.linkedin.com/in/x", title: "Paul Test | LinkedIn", snippet: "Responsable communication chez Test Food. Paris" });
  assert.equal(p2?.person_role, "Responsable communication"); assert.equal(p2?.company, "Test Food");
});

test("veille : signaux et score expliqué (pas une probabilité)", () => {
  const sig = detectSignals("Example lance sa nouvelle collection et son programme ambassadeur. Contact presse : press@example.fr");
  assert.ok(sig.includes("new_collection") && sig.includes("ambassador_program") && sig.includes("press_contact") && sig.includes("product_launch"));
  const s = scoreOpportunity({ sectorMatched: true, keywordHits: 2, signals: sig, isProductBrand: true, bestContactQuality: "excellent" });
  assert.equal(s.lines.length, 8);
  assert.equal(s.lines.reduce((a, l) => a + l.max, 0), 100);
  assert.ok(s.score >= 60 && s.score <= 100);
  const empty = scoreOpportunity({ sectorMatched: false, keywordHits: 0, signals: [] });
  assert.equal(empty.score, 0);
  assert.ok(empty.lines.every((l) => l.reason.length > 0));
});

test("veille : rotation des requêtes selon le jour", () => {
  const sectors = [{ id: 1, keywords: ["caméra", "micro"] }, { id: 2, keywords: ["sneakers"] }];
  const a = planBrandQueries(sectors, 1, 4), b = planBrandQueries(sectors, 2, 4);
  assert.equal(a.length, 4); assert.notDeepEqual(a.map((x) => x.query), b.map((x) => x.query));
  assert.deepEqual(new Set(a.map((x) => x.sectorId)), new Set([1, 2]));
});

test("veille : import manuel et fournisseur Firecrawl (réponse simulée par un faux fetch)", async () => {
  const r = parseManualResults("https://example.fr/presse ; Example — Espace presse ; Nouvelle gamme\nnot-a-url\nhttps://example.com");
  assert.equal(r.length, 2); assert.equal(r[0].title, "Example — Espace presse");
  process.env.FIRECRAWL_API_KEY = "test-key";
  let sent: any = null;
  const fake = (async (_u: string, init: any) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ success: true, data: { web: [{ url: "https://example.fr", title: "Ex", description: "desc" }] } })); }) as unknown as typeof fetch;
  const res = await firecrawlProvider(fake).search("caméra ugc", { limit: 5, recentDays: 30 });
  assert.equal(res[0].snippet, "desc"); assert.equal(sent.tbs, "qdr:m");
  delete process.env.FIRECRAWL_API_KEY;
  assert.equal(firecrawlProvider().configured, false);
});

// ---------------------------------------------------------------- Prévisions
const STAGES: StageRow[] = [
  ["to_study", 1, "open"], ["qualified", 2, "open"], ["contact_found", 3, "open"], ["to_contact", 4, "open"], ["contacted", 5, "open"], ["replied", 6, "open"],
  ["interested", 7, "open"], ["negotiation", 8, "open"], ["proposal_sent", 9, "open"], ["confirmed", 10, "won"], ["refused", 15, "lost"], ["do_not_contact", 17, "dnc"],
].map(([key, position, kind], i) => ({ id: i + 1, key: key as string, label: key as string, position: position as number, kind: kind as string }));

const empty = (): Dataset => ({ sectors: [{ id: 1, name: "Tech", color: "#00f" }], brands: [], contacts: [], outreach: [], responses: [], interactions: [], deals: [], documents: [], expenses: [] });

test("prévision : probabilité lissée — l'hypothèse domine sans données, les données dominent ensuite", () => {
  const none = smoothedProbability(0, 0, 0.3, 5);
  assert.equal(none.p, 0.3); assert.ok(none.low < 0.1 && none.high > 0.5);
  const many = smoothedProbability(40, 100, 0.3, 5);
  assert.ok(Math.abs(many.p - 0.395) < 0.01 && many.high - many.low < 0.15);
});

test("prévision : taux de transformation par étape à partir de l'historique", () => {
  const ds = empty();
  ds.brands = [
    { id: 1, name: "Test A", sector_id: 1, stage_kind: "won", stage_key: "confirmed", created_at: "2026-09-01" },
    { id: 2, name: "Test B", sector_id: 1, stage_kind: "lost", stage_key: "refused", created_at: "2026-09-01" },
    { id: 3, name: "Test C", sector_id: 1, stage_kind: "open", stage_key: "interested", created_at: "2026-09-01" },
  ];
  const hist = [{ brand_id: 2, stage_key: "replied", changed_at: "2026-09-05" }, { brand_id: 2, stage_key: "refused", changed_at: "2026-09-10" }];
  const probs = stageProbabilities(ds, STAGES, hist, DEFAULT_FORECAST);
  const replied = probs.find((p) => p.key === "replied")!;
  assert.equal(replied.won, 1); assert.equal(replied.closed, 2); assert.equal(replied.reached, 3);
  const nego = probs.find((p) => p.key === "negotiation")!;
  assert.equal(nego.closed, 1); // seule la marque gagnée a dépassé la négociation
});

test("prévision : pipeline vide → aucun contrat inventé ; une réponse positive n'est jamais un contrat signé", () => {
  const f0 = businessForecast(empty(), STAGES, [], DEFAULT_FORECAST, "2026-11-12");
  assert.equal(f0.totals.potentialCount, 0);
  assert.equal(f0.scenarios.central.weighted6m, 0);
  assert.equal(f0.confidence, "faible");
  const ds = empty();
  ds.brands = [{ id: 1, name: "Test Positive", sector_id: 1, stage_kind: "open", stage_key: "interested", created_at: "2026-11-01" }];
  ds.outreach = [{ id: 1, brand_id: 1, contact_id: null, channel: "email", kind: "initial", sent_at: "2026-11-02T09:00:00Z", follow_up_at: null, follow_up_done: true }];
  ds.responses = [{ id: 1, brand_id: 1, contact_id: null, outreach_id: 1, received_at: "2026-11-03T09:00:00Z", classification: "positive", intents: [] }];
  const f = businessForecast(ds, STAGES, [], DEFAULT_FORECAST, "2026-11-12");
  assert.equal(f.totals.signedCount, 0);
  assert.equal(f.totals.potentialCount, 1);
  assert.equal(f.opportunities[0].value, 500); assert.match(f.opportunities[0].valueSource, /hypothèse/);
  assert.ok(f.totals.weighted.central > 0 && f.totals.weighted.central < 500);
  assert.ok(f.totals.weighted.prudent < f.totals.weighted.central && f.totals.weighted.central < f.totals.weighted.ambitious);
  assert.ok(f.assumptions.some((a) => a.source === "hypothèse"));
});

test("prévision : capacité de production plafonne les contrats", () => {
  const ds = empty();
  ds.brands = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Test ${i}`, sector_id: 1, stage_kind: "open", stage_key: "proposal_sent", created_at: "2026-11-01" }));
  ds.outreach = ds.brands.map((b) => ({ id: b.id, brand_id: b.id, contact_id: null, channel: "email", kind: "initial", sent_at: "2026-10-20T09:00:00Z", follow_up_at: null, follow_up_done: true }));
  const f = businessForecast(ds, STAGES, [], { ...DEFAULT_FORECAST, capacity_per_month: 3 }, "2026-11-12");
  assert.ok(f.months.every((m) => m.contracts.ambitious <= 3));
  assert.ok(f.months.some((m) => m.capped.ambitious));
});

test("tendance : insuffisant sans activité, progression quand l'argent augmente", () => {
  assert.equal(activityTrend(empty(), "2026-11-12").status, "insuffisant");
  const ds = empty();
  ds.outreach = Array.from({ length: 6 }, (_, i) => ({ id: i, brand_id: 1, contact_id: null, channel: "email", kind: "initial", sent_at: `2026-11-0${i + 1}T09:00:00Z`, follow_up_at: null, follow_up_done: true }));
  ds.deals = [{ id: 1, brand_id: 1, collab_type: "ugc_paid", service_category: "UGC vidéo", status: "signed", planned_price: 800, negotiated_price: null, gift_value: null, signed_at: "2026-11-05", created_at: "2026-11-05", production_hours: null, estimated_costs: null }];
  assert.equal(activityTrend(ds, "2026-11-12").status, "progresse");
});

// ---------------------------------------------------------------- Audience
const acc = (snaps: any[], platform = "instagram") => ({ id: 1, owner: "personal", platform, handle: "test", snapshots: snaps });
const snap = (d: string, followers: number, views30: number | null, posts: number | null, extra: any = {}) =>
  ({ captured_on: d, followers, views_30d: views30, views_90d: null, reach_30d: null, impressions_30d: null, engagements_30d: null, posts_30d: posts, avg_story_views: null, source: "Test (Instagram Insights)", ...extra });

test("audience : croissance mensuelle uniquement avec 2 relevés espacés", () => {
  assert.equal(monthlyGrowth(1000, 1100, 10), null);
  assert.ok(Math.abs(monthlyGrowth(1000, 1100, 30)! - 0.1) < 1e-9);
  const one = accountMetrics(acc([snap("2026-11-01", 10000, 50000, 10)]), "2026-11-12");
  assert.equal(one.followerGrowth, null); assert.equal(one.viewsPerPost, 5000);
  assert.ok(one.missing.includes("interactions sur 30 jours"));
  const two = accountMetrics(acc([snap("2026-09-30", 9000, 40000, 10), snap("2026-11-01", 10000, 50000, 10, { engagements_30d: 2000, reach_30d: 40000 })]), "2026-11-12");
  assert.ok(two.followerGrowth! > 0.09 && two.followerGrowth! < 0.12);
  assert.equal(two.engagementRate, 0.05); assert.equal(two.engagementFormula, "interactions 30 j ÷ portée 30 j");
});

test("audience : tarifs = production + diffusion ; UGC indépendant des abonnés ; données manquantes non inventées", () => {
  const m = [accountMetrics(acc([snap("2026-11-01", 10000, 50000, 10)]), "2026-11-12")];
  const p = priceCard(m, DEFAULT_FORECAST, [], "2026-11-12");
  const ugc = p.find((x) => x.key === "ugc_no_post")!;
  assert.equal(ugc.mid, 4 * 55); assert.equal(ugc.publication, null);
  const big = priceCard([accountMetrics(acc([snap("2026-11-01", 900000, 50000, 10)]), "2026-11-12")], DEFAULT_FORECAST, [], "2026-11-12");
  assert.equal(big.find((x) => x.key === "reel_ig")!.mid, p.find((x) => x.key === "reel_ig")!.mid, "même vues → même prix, quel que soit le nombre d'abonnés");
  const reel = p.find((x) => x.key === "reel_ig")!;
  assert.equal(reel.publication!.mid, 75); // 5000 vues × 15 €/1000
  const tiktok = p.find((x) => x.key === "tiktok")!;
  assert.equal(tiktok.available, false); assert.ok(tiktok.missing.length > 0);
  const story = p.find((x) => x.key === "story_ig")!;
  assert.equal(story.available, false); assert.ok(story.missing.includes("vues moyennes par story"));
  const withHist = priceCard(m, DEFAULT_FORECAST, [{ category: "UGC vidéo", values: [300, 500] }], "2026-11-12").find((x) => x.key === "ugc_no_post")!;
  assert.match(withHist.realData!, /2 contrat/);
});

test("audience : projection sans historique = stagnation provisoire en central", () => {
  const m = [accountMetrics(acc([snap("2026-11-01", 10000, 50000, 10)]), "2026-11-12")];
  const prices = priceCard(m, DEFAULT_FORECAST, [], "2026-11-12");
  const zero = { prudent: 0, central: 0, ambitious: 0 };
  const proj = audienceProjection(m, prices, DEFAULT_FORECAST, { contracts: Array(7).fill(zero), weighted: Array(7).fill(zero) });
  assert.equal(proj.provisional, true);
  assert.equal(proj.rows[6].followers.central["instagram:test"], 10000);
  assert.ok(proj.rows[6].followers.ambitious["instagram:test"]! > 10000);
  assert.equal(proj.rows[0].confidence, "provisoire");
  const none = audienceProjection([], [], DEFAULT_FORECAST, { contracts: Array(7).fill(zero), weighted: Array(7).fill(zero) });
  assert.ok(none.notes[0].includes("Aucune statistique"));
});

test("apprentissage : écart prévision / réel et facteur d'ajustement", () => {
  const ds = empty();
  ds.deals = [
    { id: 1, brand_id: 1, collab_type: "ugc_paid", service_category: "UGC vidéo", status: "signed", planned_price: 620, negotiated_price: null, gift_value: null, signed_at: "2026-09-10", created_at: "2026-09-10", production_hours: null, estimated_costs: null },
    { id: 2, brand_id: 1, collab_type: "ugc_paid", service_category: "UGC vidéo", status: "signed", planned_price: 400, negotiated_price: null, gift_value: null, signed_at: "2026-10-10", created_at: "2026-10-10", production_hours: null, estimated_costs: null },
  ];
  const snaps = [
    { made_on: "2026-08-31", target_month: "2026-09", scenario: "central", contracts: 1, weighted: 900, collected: 0 },
    { made_on: "2026-09-15", target_month: "2026-09", scenario: "central", contracts: 1, weighted: 2000, collected: 0 },
    { made_on: "2026-09-30", target_month: "2026-10", scenario: "central", contracts: 1, weighted: 500, collected: 0 },
    { made_on: "2026-11-01", target_month: "2026-11", scenario: "central", contracts: 1, weighted: 500, collected: 0 },
  ];
  const acc2 = forecastAccuracy(ds, snaps, "2026-11");
  assert.equal(acc2.length, 2); // le mois en cours n'est pas encore jugé
  assert.equal(acc2[0].predictedRevenue, 900); // prévision faite AVANT le mois
  assert.equal(acc2[0].actualRevenue, 620);
  assert.equal(Math.round(acc2[0].errorPct! * 100), -31);
  const cal = learnedCalibration(acc2);
  assert.equal(cal.months, 2); assert.ok(cal.factor < 1 && cal.factor >= 0.5);
});

test("dates : un created_at renvoyé comme objet Date est bien rattaché à son mois", () => {
  const ds = empty();
  ds.deals = [{ id: 1, brand_id: 1, collab_type: "ugc_paid", service_category: "UGC vidéo", status: "signed", planned_price: 300, negotiated_price: null, gift_value: null, signed_at: null, created_at: new Date("2026-11-05T10:00:00Z"), production_hours: null, estimated_costs: null }];
  const f = businessForecast(ds, STAGES, [], DEFAULT_FORECAST, "2026-11-12");
  assert.equal(f.totals.signedCount, 1); assert.equal(f.totals.signedValue, 300);
});
