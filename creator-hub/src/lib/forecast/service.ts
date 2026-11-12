import { pctFr } from "../money";
import { iso } from "../dates";
import { q, one } from "../db";
import { loadDataset } from "../data";
import { getSetting } from "../settings";
import { todayParis, addDays } from "../dates";
import { sectorPerformance, revenueByService, isSigned, dealValue, issuedInvoices, invoicePaid, type Dataset } from "../stats";
import { businessForecast, activityTrend, explainSectorChange, DEFAULT_FORECAST, SCENARIOS, type ForecastSettings, type StageRow, type StageHistoryRow, type Scenario, type BusinessForecast } from "./business";
import { accountMetrics, priceCard, monthlyPotential, audienceProjection, type Account, type Snapshot } from "./audience";
import { forecastAccuracy, learnedCalibration, type SnapshotRow } from "./learning";

export async function getForecastSettings(): Promise<ForecastSettings> {
  const s = await getSetting<ForecastSettings>("forecast", DEFAULT_FORECAST);
  return { ...DEFAULT_FORECAST, ...s, prior: { ...DEFAULT_FORECAST.prior, ...(s.prior ?? {}) }, hourly_rate: { ...DEFAULT_FORECAST.hourly_rate, ...(s.hourly_rate ?? {}) }, cpm: { ...DEFAULT_FORECAST.cpm, ...(s.cpm ?? {}) } };
}

export async function loadAccounts(owner?: string): Promise<Account[]> {
  const accs = await q<any>(`select id, owner, platform, handle from social_accounts where active=true ${owner ? "and owner=$1" : ""} order by owner, platform`, owner ? [owner] : []);
  const snaps = await q<any>(`select account_id, captured_on::text as captured_on, followers, views_30d, views_90d, reach_30d, impressions_30d, engagements_30d, posts_30d, avg_story_views, source, derived, insights
    from social_snapshots order by captured_on`);
  const contents = await q<any>(`select account_id, kind, views, reach, likes, comments, shares, reposts, saves, replies from social_content`);
  const num = (v: any) => (v == null ? null : Number(v));
  return accs.map((a) => ({ ...a, snapshots: snaps.filter((s) => s.account_id === a.id).map((s): Snapshot => ({
    captured_on: s.captured_on, followers: num(s.followers), views_30d: num(s.views_30d), views_90d: num(s.views_90d), reach_30d: num(s.reach_30d),
    impressions_30d: num(s.impressions_30d), engagements_30d: num(s.engagements_30d), posts_30d: num(s.posts_30d), avg_story_views: num(s.avg_story_views), source: s.source,
    derived: Boolean(s.derived), insights: s.insights ?? null })),
    contents: contents.filter((c) => c.account_id === a.id).map((c) => ({ kind: c.kind, views: num(c.views), reach: num(c.reach), likes: num(c.likes), comments: num(c.comments), shares: num(c.shares), reposts: num(c.reposts), saves: num(c.saves), replies: num(c.replies) })) }));
}

export async function computeAll(opts: { owner?: string } = {}) {
  const today = todayParis();
  const [ds, stages, history, settings, snaps] = await Promise.all([
    loadDataset(),
    q<StageRow>(`select id, key, label, position, kind from pipeline_stages order by position`),
    q<StageHistoryRow>(`select brand_id, stage_key, changed_at from brand_stage_history`),
    getForecastSettings(),
    q<SnapshotRow>(`select made_on::text as made_on, target_month, scenario, contracts, weighted, collected from forecast_snapshots where kind='business'`),
  ]);
  const accuracy = forecastAccuracy(ds, snaps, today.slice(0, 7));
  const calibration = learnedCalibration(accuracy);
  const bf = businessForecast(ds, stages, history, settings, today, calibration);
  const trend = activityTrend(ds, today);

  const owner = opts.owner ?? "personal";
  const accounts = await loadAccounts(owner);
  const metrics = accounts.map((a) => accountMetrics(a, today));
  const services = revenueByService(ds);
  const history2 = ds.deals.reduce((m, d) => {
    if (!isSigned(d) || d.collab_type === "gifting" || dealValue(d) <= 0) return m;
    (m[d.service_category] ??= []).push(dealValue(d)); return m;
  }, {} as Record<string, number[]>);
  const prices = priceCard(metrics, settings, Object.entries(history2).map(([category, values]) => ({ category, values })), today);
  const expected = { prudent: avgMonths(bf, "prudent"), central: avgMonths(bf, "central"), ambitious: avgMonths(bf, "ambitious") };
  const conv = bf.stageProbs.find((p) => p.key === "contacted");
  const convText = { prudent: `${pct(conv?.low)} après contact`, central: `${pct(conv?.p)} après contact`, ambitious: `${pct(conv?.high)} après contact, +${Math.round(settings.ambitious_outreach_boost * 100)} % de démarches` };
  const since = Date.parse(addDays(today, -30));
  const realized = issuedInvoices(ds.documents).filter((d) => d.paid_at && Date.parse(iso(d.paid_at)) >= since).reduce((a, d) => a + invoicePaid(d), 0);
  const giftDeals = ds.deals.filter((d) => d.collab_type === "gifting");
  const giftMonths = Math.max(1, monthsSpan(giftDeals.map((d) => iso(d.created_at).slice(0, 10)), today));
  const giftPerMonth = giftDeals.reduce((a, d) => a + Number(d.gift_value ?? 0), 0) / giftMonths;
  const potential = monthlyPotential(prices, settings, expected, convText, realized, giftPerMonth);
  const projection = audienceProjection(metrics, prices, settings, { contracts: bf.months.map((m) => m.contracts), weighted: bf.months.map((m) => m.weighted) });

  return { today, ds, bf, trend, accuracy, calibration, settings, accounts, metrics, prices, potential, projection, services, owner };
}

const pct = (x?: number) => (x == null ? "—" : `${Math.round(x * 100)} %`);
function avgMonths(bf: BusinessForecast, sc: Scenario) { const ms = bf.months.slice(1, 4); return ms.reduce((a, m) => a + m.contracts[sc], 0) / ms.length; }
function monthsSpan(dates: string[], today: string) { if (!dates.length) return 1; const min = dates.sort()[0]; return Math.max(1, Math.round((Date.parse(today) - Date.parse(min)) / (30 * 86400000))); }

/** Enregistre la prévision du jour (une fois par jour). Sert à mesurer la précision dans le temps. */
export async function snapshotForecasts(force = false) {
  const today = todayParis();
  if (!force && (await one(`select 1 from forecast_snapshots where made_on=$1 limit 1`, [today]))) return { status: "already" as const };
  const all = await computeAll();
  for (const m of all.bf.months) for (const sc of SCENARIOS) {
    await q(`insert into forecast_snapshots (kind, made_on, target_month, scenario, contracts, revenue, weighted, collected, confidence, assumptions)
      values ('business',$1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (kind, made_on, target_month, scenario) do update set contracts=excluded.contracts, revenue=excluded.revenue, weighted=excluded.weighted, collected=excluded.collected, confidence=excluded.confidence, assumptions=excluded.assumptions`,
      [today, m.ym, sc, m.contracts[sc], m.weighted[sc], m.weighted[sc], m.cash[sc], m.confidence, JSON.stringify(m.month === 0 ? all.bf.assumptions : [])]);
  }
  for (const r of all.projection.rows) for (const sc of SCENARIOS) {
    const f = Object.values(r.followers[sc]).reduce<number>((a, x) => a + (x ?? 0), 0);
    await q(`insert into forecast_snapshots (kind, made_on, target_month, scenario, followers, revenue, weighted, confidence)
      values ('audience',$1,$2,$3,$4,$5,$6,$7) on conflict (kind, made_on, target_month, scenario) do update set followers=excluded.followers, revenue=excluded.revenue, weighted=excluded.weighted, confidence=excluded.confidence`,
      [today, all.bf.months[r.month].ym, sc, f, r.revenue[sc], r.weighted[sc], r.confidence]);
  }
  // Sectoriel (pour expliquer les variations d'une semaine à l'autre).
  await q(`insert into settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [`sector_forecast:${today}`, JSON.stringify(sectorState(all.ds, all.bf))]);
  return { status: "saved" as const };
}

function sectorState(ds: Dataset, bf: BusinessForecast) {
  const perf = sectorPerformance(ds);
  return Object.fromEntries(bf.sectors.map((s) => {
    const p = perf.find((x) => x.sector.id === s.sector_id);
    return [s.sector_id, { weighted: s.weighted6m, pipeline: s.pipelineCount, positive: p?.positive ?? 0, avgDeal: p?.avgDeal ?? null }];
  }));
}

/** Explications des variations sectorielles par rapport à la prévision d'il y a 7 jours (si elle existe). */
export async function sectorChanges(all: Awaited<ReturnType<typeof computeAll>>) {
  const ref = await one<{ value: Record<string, any> }>(`select value from settings where key like 'sector_forecast:%' and key <= $1 order by key desc limit 1`, [`sector_forecast:${addDays(all.today, -7)}`]);
  if (!ref) return [];
  const now = sectorState(all.ds, all.bf);
  return all.bf.sectors.map((s) => ref.value[s.sector_id] ? explainSectorChange(s.name, now[s.sector_id], ref.value[s.sector_id]) : null).filter((x): x is string => Boolean(x));
}

// ------------------------------------------------------------------ Recommandations

export function recommendations(all: Awaited<ReturnType<typeof computeAll>>): { text: string; why: string }[] {
  const out: { text: string; why: string }[] = [];
  const perf = sectorPerformance(all.ds);
  const enough = perf.filter((p) => p.outreach >= 5);
  const best = [...enough].sort((a, b) => (b.responseRate ?? 0) - (a.responseRate ?? 0))[0];
  if (best && (best.responseRate ?? 0) > 0) out.push({ text: `Augmenter les démarches dans ${best.sector.name}.`, why: `Meilleur taux de réponse mesuré : ${pct(best.responseRate ?? 0)} sur ${best.outreach} démarches.` });
  for (const p of perf.filter((p) => p.outreach >= 8 && p.responded === 0)) out.push({ text: `Réduire l'effort ou changer d'approche dans ${p.sector.name}.`, why: `${p.outreach} démarches sans aucune réponse.` });
  const reel = all.prices.find((x) => x.key === "ugc_no_post");
  for (const svc of all.services.filter((s) => s.signedCount >= 2 && s.avg !== null && /UGC/.test(s.category))) {
    if (reel && svc.avg! < reel.low * 0.9) out.push({ text: `Revoir les tarifs « ${svc.category} ».`, why: `Prix moyen signé ${Math.round(svc.avg!)} €, sous la fourchette basse estimée (${reel.low} €) pour le temps de production.` });
  }
  const eng = all.metrics.filter((m) => m.engagementRate != null).sort((a, b) => b.engagementRate! - a.engagementRate!);
  if (eng.length >= 2) out.push({ text: `Développer ${eng[0].account.platform} (@${eng[0].account.handle}).`, why: `Taux d'engagement le plus élevé : ${pctFr(eng[0].engagementRate!, 1)} % (${eng[0].engagementFormula}).` });
  const positives = all.ds.responses.filter((r) => r.classification === "positive").length;
  const signed = all.ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting").length;
  if (positives >= 5 && signed / positives < 0.2) out.push({ text: "Améliorer la transformation des réponses positives.", why: `${positives} réponses positives pour ${signed} contrat(s) signé(s) : proposez systématiquement un devis chiffré après un intérêt.` });
  const clients = new Set(all.ds.deals.filter(isSigned).map((d) => d.brand_id)).size;
  const recurring = all.ds.deals.filter((d) => isSigned(d) && d.collab_type === "ambassador").length;
  if (clients >= 3 && recurring === 0) out.push({ text: "Proposer des partenariats récurrents à vos clients existants.", why: `${clients} clients signés, aucun partenariat récurrent.` });
  const due = all.bf.totals.potentialCount;
  if (due === 0 && all.ds.brands.length > 0) out.push({ text: "Relancer la prospection : aucune opportunité ouverte dans le pipeline.", why: "Sans démarche en cours, la prévision des prochains mois est nulle." });
  out.push(...audienceRecommendations(all.metrics));
  if (all.metrics.length === 0) out.push({ text: "Renseigner vos statistiques Instagram, TikTok, Snapchat et YouTube.", why: "Sans relevé, la valeur d'audience et la projection à 6 mois ne peuvent pas être calculées." });
  return out;
}

/** Recommandations tirées des relevés d'audience (compte de l'entité affichée uniquement). */
export function audienceRecommendations(metrics: Awaited<ReturnType<typeof computeAll>>["metrics"]): { text: string; why: string }[] {
  const out: { text: string; why: string }[] = [];
  for (const m of metrics) {
    const l = m.latest; if (!l) continue;
    const ins = (l.insights ?? {}) as Record<string, any>;
    const name = `${m.account.platform} @${m.account.handle}`;
    if (ins.profile_visits_30d > 0 && ins.link_in_bio_taps_30d === 0)
      out.push({ text: `Ajouter un lien en bio vers votre Media Kit / formulaire de collaboration (${name}).`, why: `${ins.profile_visits_30d} visites du profil sur 30 jours et 0 appui sur le lien en bio (relevé du ${l.captured_on}).` });
    if (m.engagementRate != null && m.engagementRate >= 0.05)
      out.push({ text: `Mettre en avant votre taux d'engagement dans vos propositions (${name}).`, why: `${pctFr(m.engagementRate, 1)} % (${m.engagementFormula}) sur le relevé du ${l.captured_on}.` });
    if (typeof ins.most_active === "string")
      out.push({ text: "Programmer les publications sponsorisées sur les créneaux où votre audience est la plus active.", why: ins.most_active });
    const vt = ins.views_by_type;
    if (vt && vt.publications && vt.reels) {
      const tot = (vt.publications ?? 0) + (vt.stories ?? 0) + (vt.reels ?? 0);
      out.push({ text: vt.publications > vt.reels ? "Vendre en priorité des publications (photo / carrousel) plutôt que des Reels seuls." : "Vendre en priorité des Reels.",
        why: `Vues 30 j : publications ${Math.round((vt.publications / tot) * 100)} %, stories ${Math.round(((vt.stories ?? 0) / tot) * 100)} %, Reels ${Math.round((vt.reels / tot) * 100)} %.` });
    }
    const g = ins.gender_pct, a = ins.age_pct, c = ins.countries_pct;
    if (g && a && c) {
      const young = (a["18-24"] ?? 0) + (a["25-34"] ?? 0);
      const top = Object.entries(c as Record<string, number>).sort((x, y) => y[1] - x[1])[0];
      out.push({ text: "Cibler en priorité les marques qui visent cette audience (déduction à valider : streetwear, sport, tech créateurs, musique).",
        why: `Audience ${Math.round(young)} % 18–34 ans, ${g.hommes ?? "?"} % d'hommes, ${top[0]} ${top[1]} % (relevé du ${l.captured_on}).` });
    }
    if (m.viewsGrowthObserved != null && m.viewsGrowth !== m.viewsGrowthObserved)
      out.push({ text: "Refaire un relevé de statistiques chaque mois.", why: `Une seule variation des vues (${pctFr(m.viewsGrowthObserved, 0)} %) ne suffit pas à établir une tendance : 3 relevés sont nécessaires.` });
  }
  return out;
}
