// Audience Value — valeur commerciale de l'audience, séparée du potentiel de prospection.
// Règles :
//  - aucune statistique inventée : sans donnée, la valeur n'est pas calculée (« donnée manquante ») ;
//  - la valeur d'une prestation = production (temps, droits) + diffusion (vues réelles × CPM),
//    jamais le seul nombre d'abonnés ;
//  - pas de croissance automatique : sans historique, la trajectoire centrale est la stagnation ;
//  - les entités (personnel, La Var Media…) ne sont jamais additionnées.
import type { ForecastSettings, Scenario } from "./business";

export const PLATFORMS = { instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", youtube: "YouTube", linkedin: "LinkedIn", other: "Autre" } as const;
export type Platform = keyof typeof PLATFORMS;
export const OWNERS: Record<string, string> = { personal: "Personnel (Sébastien)", lavar_media: "La Var Media" };

export interface Snapshot {
  captured_on: string; followers: number | null; views_30d: number | null; views_90d: number | null; reach_30d: number | null;
  impressions_30d: number | null; engagements_30d: number | null; posts_30d: number | null; avg_story_views: number | null; source: string;
}
export interface Account { id: number; owner: string; platform: string; handle: string; snapshots: Snapshot[] }

export interface AccountMetrics {
  account: Account; latest: Snapshot | null; freshnessDays: number | null;
  engagementRate: number | null; engagementFormula: string | null;
  viewsPerPost: number | null; followerGrowth: number | null; viewsGrowth: number | null; growthBasis: string;
  missing: string[];
}

const DAY = 86400000;
const r0 = (x: number) => Math.round(x);

/** Taux de croissance mensuel composé entre deux relevés espacés d'au moins 25 jours. */
export function monthlyGrowth(a: number | null, b: number | null, days: number): number | null {
  if (a == null || b == null || a <= 0 || days < 25) return null;
  return Math.pow(b / a, 30 / days) - 1;
}

export function accountMetrics(acc: Account, today: string): AccountMetrics {
  const snaps = [...acc.snapshots].sort((x, y) => x.captured_on.localeCompare(y.captured_on));
  const latest = snaps[snaps.length - 1] ?? null;
  const missing: string[] = [];
  if (!latest) return { account: acc, latest: null, freshnessDays: null, engagementRate: null, engagementFormula: null, viewsPerPost: null, followerGrowth: null, viewsGrowth: null, growthBasis: "aucun relevé", missing: ["aucun relevé de statistiques"] };
  const freshnessDays = Math.round((Date.parse(today) - Date.parse(latest.captured_on)) / DAY);
  let engagementRate: number | null = null, engagementFormula: string | null = null;
  if (latest.engagements_30d != null && latest.reach_30d) { engagementRate = latest.engagements_30d / latest.reach_30d; engagementFormula = "interactions 30 j ÷ portée 30 j"; }
  else if (latest.engagements_30d != null && latest.views_30d) { engagementRate = latest.engagements_30d / latest.views_30d; engagementFormula = "interactions 30 j ÷ vues 30 j"; }
  else if (latest.engagements_30d != null && latest.followers) { engagementRate = latest.engagements_30d / latest.followers; engagementFormula = "interactions 30 j ÷ abonnés (faute de portée)"; }
  else missing.push("interactions sur 30 jours");
  const viewsPerPost = latest.views_30d != null && latest.posts_30d ? latest.views_30d / latest.posts_30d : null;
  if (latest.views_30d == null) missing.push("vues sur 30 jours");
  if (!latest.posts_30d) missing.push("nombre de publications sur 30 jours");
  if (latest.followers == null) missing.push("abonnés");
  // Croissance : relevé le plus ancien d'au moins 25 jours avant le dernier.
  const ref = [...snaps].reverse().find((s) => Date.parse(latest.captured_on) - Date.parse(s.captured_on) >= 25 * DAY);
  let followerGrowth: number | null = null, viewsGrowth: number | null = null, growthBasis = "un seul relevé : croissance inconnue";
  if (ref) {
    const days = (Date.parse(latest.captured_on) - Date.parse(ref.captured_on)) / DAY;
    followerGrowth = monthlyGrowth(ref.followers, latest.followers, days);
    viewsGrowth = monthlyGrowth(ref.views_30d, latest.views_30d, days);
    growthBasis = `relevés du ${ref.captured_on} au ${latest.captured_on} (${Math.round(days)} jours)`;
  } else if (latest.views_90d != null && latest.views_30d != null) {
    // Les vues 90 j donnent une tendance de vues sans second relevé.
    const prev60avg = (latest.views_90d - latest.views_30d) / 2;
    if (prev60avg > 0) { viewsGrowth = latest.views_30d / prev60avg - 1; growthBasis = "vues 30 j comparées à la moyenne des 60 jours précédents (abonnés : croissance inconnue)"; }
  }
  return { account: acc, latest, freshnessDays, engagementRate, engagementFormula, viewsPerPost, followerGrowth, viewsGrowth, growthBasis, missing };
}

// ------------------------------------------------------------------ Tarifs

export const DELIVERABLES = {
  ugc_no_post: "UGC sans publication",
  ugc_with_post: "UGC avec publication",
  story_ig: "Story Instagram",
  reel_ig: "Reel Instagram",
  tiktok: "TikTok sponsorisé",
  snapchat: "Vidéo Snapchat",
  multi_pack: "Pack multi-plateformes",
  product_integration: "Intégration produit",
  gear_test: "Test matériel",
  ambassador: "Ambassadeur (mensuel)",
  monthly_pack: "Pack de contenus mensuel",
} as const;
export type Deliverable = keyof typeof DELIVERABLES;

export interface PriceEstimate {
  key: Deliverable; label: string; available: boolean; low: number; mid: number; high: number;
  production: { low: number; mid: number; high: number }; publication: { low: number; mid: number; high: number } | null;
  justification: string[]; conditions: string[]; confidence: "élevée" | "moyenne" | "faible"; missing: string[]; realData: string | null;
}

export interface DealHistory { category: string; values: number[] }

const RIGHTS = "Droits d'usage publicitaires (paid ads) : +30 à +60 % selon durée (3–12 mois) ; exclusivité sectorielle : +25 % ; livrables supplémentaires facturés à part.";

export function priceCard(metrics: AccountMetrics[], s: ForecastSettings, history: DealHistory[], today: string): PriceEstimate[] {
  const byPlatform = (p: string) => metrics.find((m) => m.account.platform === p && m.latest);
  const hr = s.hourly_rate;
  const prod = (hours: number) => ({ low: hours * hr.low, mid: hours * hr.mid, high: hours * hr.high });
  const pub = (m: AccountMetrics | undefined, viewsOverride?: number | null) => {
    const v = viewsOverride ?? m?.viewsPerPost ?? null;
    if (v == null) return null;
    return { low: (v / 1000) * s.cpm.low, mid: (v / 1000) * s.cpm.mid, high: (v / 1000) * s.cpm.high };
  };
  const real = (cat: string) => { const h = history.find((x) => x.category === cat); return h && h.values.length >= 2 ? h : null; };
  const conf = (m: AccountMetrics | undefined, hasReal: boolean): PriceEstimate["confidence"] =>
    hasReal && m && (m.freshnessDays ?? 999) <= 45 ? "élevée" : hasReal || (m && (m.freshnessDays ?? 999) <= 45) ? "moyenne" : "faible";

  const out: PriceEstimate[] = [];
  const push = (key: Deliverable, production: PriceEstimate["production"], publication: PriceEstimate["publication"], o: { needs?: AccountMetrics | undefined; needsPublication?: boolean; factor?: number; justification: string[]; conditions?: string[]; realCat?: string; missing?: string[] }) => {
    const f = o.factor ?? 1;
    const missing = [...(o.missing ?? [])];
    let available = true;
    if (o.needsPublication && !publication) { available = false; missing.push(...(o.needs ? o.needs.missing.filter((x) => /vues|publications|story/.test(x)) : ["compte et statistiques de la plateforme"])); }
    let low = (production.low + (publication?.low ?? 0)) * f, mid = (production.mid + (publication?.mid ?? 0)) * f, high = (production.high + (publication?.high ?? 0)) * f;
    const rd = o.realCat ? real(o.realCat) : null;
    let realData: string | null = null;
    if (rd) {
      const avg = rd.values.reduce((a, b) => a + b, 0) / rd.values.length;
      realData = `${rd.values.length} contrat(s) signé(s) en « ${rd.category} » : moyenne ${r0(avg)} € (min ${r0(Math.min(...rd.values))} €, max ${r0(Math.max(...rd.values))} €)`;
      mid = (mid + avg) / 2; low = Math.min(low, Math.min(...rd.values)); high = Math.max(high, Math.max(...rd.values));
    }
    out.push({ key, label: DELIVERABLES[key], available, low: r0(low), mid: r0(mid), high: r0(high), production: { low: r0(production.low * f), mid: r0(production.mid * f), high: r0(production.high * f) },
      publication: publication ? { low: r0(publication.low * f), mid: r0(publication.mid * f), high: r0(publication.high * f) } : null,
      justification: o.justification, conditions: o.conditions ?? [RIGHTS], confidence: available ? conf(o.needs, Boolean(rd)) : "faible", missing, realData });
  };

  const ig = byPlatform("instagram"), tk = byPlatform("tiktok"), sn = byPlatform("snapchat");
  const ugc = prod(s.ugc_hours);
  push("ugc_no_post", ugc, null, { justification: [`Production : ${s.ugc_hours} h × ${hr.low}–${hr.high} €/h (hypothèse de taux horaire)`, "Indépendant de l'audience : la marque achète le contenu, pas la diffusion"], realCat: "UGC vidéo" });
  const igPub = pub(ig);
  push("ugc_with_post", ugc, igPub, { needs: ig, needsPublication: true, justification: [`Production UGC + diffusion sur Instagram`, igPub ? `Diffusion : ${r0(ig!.viewsPerPost!)} vues/publication × CPM ${s.cpm.low}–${s.cpm.high} €` : "Diffusion non chiffrable sans vues par publication"] });
  const storyPub = ig?.latest?.avg_story_views ? pub(ig, ig.latest.avg_story_views) : null;
  push("story_ig", prod(1), storyPub, { needs: ig, needsPublication: true, missing: ig?.latest?.avg_story_views ? [] : ["vues moyennes par story"], justification: [`1 h de production`, storyPub ? `${ig!.latest!.avg_story_views} vues/story × CPM` : "Vues par story non renseignées"] });
  push("reel_ig", ugc, igPub, { needs: ig, needsPublication: true, realCat: "Influence / publication", justification: ["Production + diffusion Reel", igPub ? `${r0(ig!.viewsPerPost!)} vues/publication (relevé ${ig!.latest!.captured_on}, source : ${ig!.latest!.source})` : "Statistiques Instagram manquantes"] });
  const tkPub = pub(tk);
  push("tiktok", ugc, tkPub, { needs: tk, needsPublication: true, justification: ["Production + diffusion TikTok", tkPub ? `${r0(tk!.viewsPerPost!)} vues/publication` : "Statistiques TikTok manquantes"] });
  const snPub = pub(sn);
  push("snapchat", prod(s.ugc_hours * 0.75), snPub, { needs: sn, needsPublication: true, justification: ["Production + diffusion Snapchat", snPub ? `${r0(sn!.viewsPerPost!)} vues/publication` : "Statistiques Snapchat manquantes"] });
  const avail = [igPub, tkPub, snPub].filter(Boolean) as NonNullable<typeof igPub>[];
  push("multi_pack", { low: ugc.low * 1.5, mid: ugc.mid * 1.5, high: ugc.high * 1.5 },
    avail.length >= 2 ? { low: avail.reduce((a, x) => a + x.low, 0), mid: avail.reduce((a, x) => a + x.mid, 0), high: avail.reduce((a, x) => a + x.high, 0) } : null,
    { needsPublication: true, factor: 0.9, missing: avail.length >= 2 ? [] : ["statistiques d'au moins 2 plateformes"], justification: ["Une production déclinée (1,5 × le temps) + diffusion sur chaque plateforme disposant de statistiques", "Remise de 10 % pour le pack (hypothèse)"] });
  push("product_integration", prod(s.ugc_hours * 0.5), igPub ?? tkPub, { needs: ig ?? tk, needsPublication: true, justification: ["Intégration dans un contenu existant : demi-production + diffusion"] });
  push("gear_test", prod(s.ugc_hours * 1.5), null, { justification: [`Test en conditions réelles : ${s.ugc_hours * 1.5} h`, "Souvent proposé en gifting : le produit n'est jamais compté en revenu"], conditions: ["Retour honnête, produit offert mentionné", RIGHTS] });
  const amb = igPub ? { low: igPub.low * 2, mid: igPub.mid * 2, high: igPub.high * 2 } : null;
  push("ambassador", prod(s.ugc_hours * 2 + 4), amb, { needs: ig, needsPublication: true, factor: 0.85, justification: ["Base mensuelle : 2 Reels + 4 stories", "Remise récurrence 15 % (hypothèse)"], realCat: "Ambassadeur de marque" });
  push("monthly_pack", prod(s.ugc_hours * 4), null, { factor: 0.85, justification: ["4 contenus UGC par mois, remise récurrence 15 % (hypothèse)"], realCat: "Pack UGC" });
  void today;
  return out;
}

// ------------------------------------------------------------------ Potentiel mensuel actuel

export interface MonthlyPotential {
  theoretical: number; accessible: Record<Scenario, number>; realized: number;
  byType: { label: string; value: number; note: string }[];
  scenarios: Record<Scenario, { collabs: number; avgPrice: number; revenue: number; hours: number; conversion: string }>;
}

export function monthlyPotential(prices: PriceEstimate[], s: ForecastSettings, expectedContractsPerMonth: Record<Scenario, number>, conversionText: Record<Scenario, string>, realizedLast30: number, giftValuePerMonth: number): MonthlyPotential {
  const sellable = prices.filter((p) => p.available && !["gear_test", "ambassador", "monthly_pack"].includes(p.key));
  const avg = (k: "low" | "mid" | "high") => (sellable.length ? sellable.reduce((a, p) => a + p[k], 0) / sellable.length : 0);
  const theoretical = r0(s.capacity_per_month * avg("mid"));
  const map: Record<Scenario, "low" | "mid" | "high"> = { prudent: "low", central: "mid", ambitious: "high" };
  const scenarios = {} as MonthlyPotential["scenarios"];
  const accessible = {} as Record<Scenario, number>;
  for (const sc of ["prudent", "central", "ambitious"] as Scenario[]) {
    const collabs = Math.min(s.capacity_per_month, expectedContractsPerMonth[sc]);
    const price = avg(map[sc]);
    scenarios[sc] = { collabs: Math.round(collabs * 10) / 10, avgPrice: r0(price), revenue: r0(collabs * price), hours: r0(collabs * s.ugc_hours), conversion: conversionText[sc] };
    accessible[sc] = r0(collabs * price);
  }
  const get = (k: Deliverable) => prices.find((p) => p.key === k);
  const byType = [
    { label: "UGC (production)", value: get("ugc_no_post")?.mid ?? 0, note: "par contenu" },
    { label: "Influence (Reel)", value: get("reel_ig")?.available ? get("reel_ig")!.mid : 0, note: get("reel_ig")?.available ? "par publication" : "statistiques manquantes" },
    { label: "Partenariat récurrent", value: get("ambassador")?.available ? get("ambassador")!.mid : 0, note: get("ambassador")?.available ? "par mois" : "statistiques manquantes" },
    { label: "Pack multi-plateformes", value: get("multi_pack")?.available ? get("multi_pack")!.mid : 0, note: get("multi_pack")?.available ? "par pack" : "2 plateformes minimum" },
    { label: "Gifting (hors revenus)", value: r0(giftValuePerMonth), note: "valeur produits / mois observée" },
  ];
  return { theoretical, accessible, realized: r0(realizedLast30), byType, scenarios };
}

// ------------------------------------------------------------------ Projection 6 mois

export interface AudienceProjectionRow {
  month: number; followers: Record<Scenario, Record<string, number | null>>; views: Record<Scenario, number | null>;
  collabs: Record<Scenario, number>; avgRate: Record<Scenario, number>; revenue: Record<Scenario, number>; weighted: Record<Scenario, number>;
  recurring: Record<Scenario, number>; confidence: "moyen" | "faible" | "provisoire";
}

export function growthRates(m: AccountMetrics, s: ForecastSettings) {
  const g = m.followerGrowth, v = m.viewsGrowth;
  const sc = (x: number | null) => ({
    prudent: x == null ? 0 : x > 0 ? x * 0.5 : x,
    central: x == null ? 0 : x,
    ambitious: (x == null ? 0 : Math.max(x, 0)) + s.ambitious_growth_bonus,
  });
  return { followers: sc(g), views: sc(v), provisional: g == null };
}

export function audienceProjection(metrics: AccountMetrics[], prices: PriceEstimate[], s: ForecastSettings,
  business: { contracts: Record<Scenario, number>[]; weighted: Record<Scenario, number>[] }): { rows: AudienceProjectionRow[]; provisional: boolean; notes: string[] } {
  const withData = metrics.filter((m) => m.latest);
  const rates = new Map(withData.map((m) => [m.account.id, growthRates(m, s)]));
  const provisional = withData.length === 0 || withData.some((m) => rates.get(m.account.id)!.provisional);
  const notes: string[] = [];
  if (!withData.length) notes.push("Aucune statistique d'audience : renseignez ou importez vos relevés pour activer la projection.");
  for (const m of withData) {
    const r = rates.get(m.account.id)!;
    notes.push(`${PLATFORMS[m.account.platform as Platform] ?? m.account.platform} @${m.account.handle} : ${r.provisional ? "croissance inconnue (un seul relevé) → stagnation en central" : `croissance observée ${(r.followers.central * 100).toFixed(1)} %/mois`} · ${m.growthBasis}`);
  }
  notes.push(`Trajectoire ambitieuse : +${Math.round(s.ambitious_growth_bonus * 100)} pt/mois, conditionnée à une publication régulière et à des formats qui performent (hypothèse).`);
  const sellable = prices.filter((p) => p.available && !["gear_test", "ambassador", "monthly_pack"].includes(p.key));
  const pubShare = (k: "low" | "mid" | "high") => sellable.length ? sellable.reduce((a, p) => a + (p.publication?.[k] ?? 0), 0) / sellable.length : 0;
  const prodShare = (k: "low" | "mid" | "high") => sellable.length ? sellable.reduce((a, p) => a + p.production[k], 0) / sellable.length : 0;
  const totalViews0 = withData.reduce((a, m) => a + (m.latest!.views_30d ?? 0), 0);
  const kmap: Record<Scenario, "low" | "mid" | "high"> = { prudent: "low", central: "mid", ambitious: "high" };
  const ambassador = prices.find((p) => p.key === "ambassador");
  const rows: AudienceProjectionRow[] = [];
  for (let mo = 0; mo <= 6; mo++) {
    const row = { month: mo, followers: {}, views: {}, collabs: {}, avgRate: {}, revenue: {}, weighted: {}, recurring: {}, confidence: provisional ? "provisoire" : mo <= 2 ? "moyen" : "faible" } as AudienceProjectionRow;
    for (const sc of ["prudent", "central", "ambitious"] as Scenario[]) {
      const f: Record<string, number | null> = {};
      let views = 0, hasViews = false;
      for (const m of withData) {
        const r = rates.get(m.account.id)!;
        const key = `${m.account.platform}:${m.account.handle}`;
        f[key] = m.latest!.followers == null ? null : Math.round(m.latest!.followers * Math.pow(1 + r.followers[sc], mo));
        if (m.latest!.views_30d != null) { views += m.latest!.views_30d * Math.pow(1 + r.views[sc], mo); hasViews = true; }
      }
      row.followers[sc] = f;
      row.views[sc] = hasViews ? Math.round(views) : null;
      const viewFactor = hasViews && totalViews0 > 0 ? views / totalViews0 : 1;
      const rate = prodShare(kmap[sc]) + pubShare(kmap[sc]) * viewFactor;
      const collabs = Math.min(s.capacity_per_month, business.contracts[mo]?.[sc] ?? 0);
      row.collabs[sc] = Math.round(collabs * 10) / 10;
      row.avgRate[sc] = r0(rate);
      row.revenue[sc] = r0(s.capacity_per_month * rate); // potentiel si la capacité était entièrement vendue
      row.weighted[sc] = r0(business.weighted[mo]?.[sc] ?? 0);
      row.recurring[sc] = ambassador?.available ? Math.floor(collabs / 4) : 0;
    }
    rows.push(row);
  }
  return { rows, provisional, notes };
}
