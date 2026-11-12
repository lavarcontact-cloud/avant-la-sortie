// Business Forecast — prévisions de contrats et de chiffre d'affaires.
// Principes :
//  - une réponse positive n'est pas une signature, une proposition n'est pas un revenu,
//    un contrat signé n'est pas un encaissement : chaque niveau est séparé ;
//  - les probabilités viennent de VOTRE historique (taux de transformation par étape),
//    lissées par une hypothèse a priori explicite tant que l'échantillon est faible ;
//  - les scénarios prudent / ambitieux sont des intervalles statistiques, pas des pourcentages arbitraires.
import { iso } from "../dates";
import { type Dataset, dealValue, isSigned, issuedInvoices, invoiceTTC, invoicePaid } from "../stats";
import { addDays } from "../dates";

export type Scenario = "prudent" | "central" | "ambitious";
export const SCENARIOS: Scenario[] = ["prudent", "central", "ambitious"];
export const SCENARIO_LABEL: Record<Scenario, string> = { prudent: "Prudent", central: "Central", ambitious: "Ambitieux" };

export interface ForecastSettings {
  capacity_per_month: number;
  avg_deal_hypothesis: number;
  cycle_days_hypothesis: number;
  payment_days_hypothesis: number;
  prior_weight: number;
  prior: Record<string, number>;
  ambitious_outreach_boost: number;
  hourly_rate: { low: number; mid: number; high: number };
  ugc_hours: number;
  cpm: { low: number; mid: number; high: number };
  ambitious_growth_bonus: number;
}

/** Hypothèses par défaut — toujours affichées comme hypothèses, modifiables dans Paramètres. */
export const DEFAULT_FORECAST: ForecastSettings = {
  capacity_per_month: 6,
  avg_deal_hypothesis: 500,
  cycle_days_hypothesis: 30,
  payment_days_hypothesis: 30,
  prior_weight: 5,
  prior: { to_study: 0.02, qualified: 0.03, contact_found: 0.04, to_contact: 0.04, contacted: 0.05, no_answer: 0.02, replied: 0.15, interested: 0.3, negotiation: 0.5, proposal_sent: 0.6 },
  ambitious_outreach_boost: 0.5,
  hourly_rate: { low: 35, mid: 55, high: 85 },
  ugc_hours: 4,
  cpm: { low: 8, mid: 15, high: 25 },
  ambitious_growth_bonus: 0.03,
};

export interface StageRow { id: number; key: string; label: string; position: number; kind: string }
export interface StageHistoryRow { brand_id: number; stage_key: string | null; changed_at: string | Date }

export interface Assumption { label: string; value: string; source: "données" | "hypothèse" | "mixte"; detail?: string }
export interface StageProb { key: string; label: string; reached: number; won: number; closed: number; prior: number; p: number; low: number; high: number; source: "données" | "hypothèse" | "mixte" }
export interface Opportunity { brand_id: number; name: string; sector_id: number | null; stage_key: string; stage_label: string; value: number; valueSource: string; p: Record<Scenario, number>; expectedMonth: number }
export interface MonthRow {
  month: number; label: string; ym: string;
  pipelineContracts: Record<Scenario, number>; newContracts: Record<Scenario, number>; contracts: Record<Scenario, number>;
  weighted: Record<Scenario, number>; cash: Record<Scenario, number>; capped: Record<Scenario, boolean>; confidence: "élevé" | "moyen" | "faible";
}
export interface SectorForecast { sector_id: number; name: string; color: string; shortTerm: number; contracts6m: number; weighted6m: number; pipelineCount: number; note: string }

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const t = (v: string | Date | null | undefined) => (v ? new Date(typeof v === "string" && v.length === 10 ? v + "T12:00:00Z" : v).getTime() : NaN);
const r2 = (x: number) => Math.round(x * 100) / 100;
const z = 1.28; // intervalle ~80 %

function ymOf(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}
export function addMonthsYm(ym: string, k: number) {
  const [y, m] = ym.split("-").map(Number);
  return ymOf(new Date(Date.UTC(y, m - 1 + k, 15)));
}

/** Probabilité lissée (bêta-binomiale) et intervalle ~80 %. */
export function smoothedProbability(won: number, closed: number, prior: number, k: number) {
  const p = (won + prior * k) / (closed + k);
  const sd = Math.sqrt((p * (1 - p)) / (closed + k));
  return { p, low: Math.max(0, p - z * sd), high: Math.min(1, p + z * sd) };
}

/** Taux de transformation empiriques par étape : parmi les marques ayant atteint l'étape (ou au-delà) et dont l'issue est connue. */
export function stageProbabilities(ds: Dataset, stages: StageRow[], history: StageHistoryRow[], s: ForecastSettings): StageProb[] {
  const open = stages.filter((x) => x.kind === "open").sort((a, b) => a.position - b.position);
  const pos = new Map(stages.map((x) => [x.key, x.position]));
  const kindOf = new Map(stages.map((x) => [x.key, x.kind]));
  const won = new Set<number>(), lost = new Set<number>();
  const maxPos = new Map<number, number>();
  for (const b of ds.brands) {
    if (b.stage_kind === "won") won.add(b.id);
    if (b.stage_kind === "lost" || b.stage_kind === "dnc") lost.add(b.id);
    if (b.stage_key && kindOf.get(b.stage_key) === "open") maxPos.set(b.id, Math.max(maxPos.get(b.id) ?? 0, pos.get(b.stage_key) ?? 0));
  }
  for (const d of ds.deals) if (isSigned(d)) { won.add(d.brand_id); lost.delete(d.brand_id); }
  for (const h of history) {
    if (!h.stage_key) continue;
    const k = kindOf.get(h.stage_key);
    if (k === "won") won.add(h.brand_id);
    if (k === "open") maxPos.set(h.brand_id, Math.max(maxPos.get(h.brand_id) ?? 0, pos.get(h.stage_key) ?? 0));
  }
  for (const id of won) lost.delete(id);
  // Une marque gagnée a forcément franchi toutes les étapes ouvertes.
  for (const id of won) maxPos.set(id, Infinity);
  return open.map((st) => {
    const reachedIds = [...maxPos.entries()].filter(([, p]) => p >= st.position).map(([id]) => id);
    const w = reachedIds.filter((id) => won.has(id)).length;
    const l = reachedIds.filter((id) => lost.has(id)).length;
    const closed = w + l;
    const prior = s.prior[st.key] ?? 0.05;
    const sp = smoothedProbability(w, closed, prior, s.prior_weight);
    return { key: st.key, label: st.label, reached: reachedIds.length, won: w, closed, prior, ...sp,
      source: closed === 0 ? "hypothèse" : closed >= 20 ? "données" : "mixte" };
  });
}

function avgSignedValue(ds: Dataset, filter: (brandId: number) => boolean) {
  const vals = ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting" && filter(d.brand_id)).map(dealValue).filter((v) => v > 0);
  return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : { avg: 0, n: 0 };
}

export function cycleDays(ds: Dataset) {
  const first = new Map<number, number>();
  for (const o of ds.outreach) { const x = t(o.sent_at); if (!first.has(o.brand_id) || x < first.get(o.brand_id)!) first.set(o.brand_id, x); }
  const d = ds.deals.filter((x) => isSigned(x) && first.has(x.brand_id)).map((x) => (t(x.signed_at ?? x.created_at) - first.get(x.brand_id)!) / 86400000).filter((x) => x >= 0);
  return { days: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, n: d.length };
}
export function paymentDays(ds: Dataset) {
  const d = issuedInvoices(ds.documents).filter((x) => x.paid_at && x.issue_date).map((x) => (t(x.paid_at) - t(x.issue_date)) / 86400000).filter((x) => x >= 0);
  return { days: d.length ? d.reduce((a, b) => a + b, 0) / d.length : null, n: d.length };
}

export interface BusinessForecast {
  today: string; stageProbs: StageProb[]; opportunities: Opportunity[]; months: MonthRow[]; sectors: SectorForecast[];
  totals: { potentialCount: number; potentialValue: number; probable: Record<Scenario, number>; weighted: Record<Scenario, number>;
    signedCount: number; signedValue: number; invoiced: number; collected: number; receivables: number; contractsInProgress: number };
  scenarios: Record<Scenario, { contracts6m: number; revenue6m: number; weighted6m: number; cash6m: number; confidence: string; risks: string[] }>;
  assumptions: Assumption[]; confidence: "élevé" | "moyen" | "faible"; outcomes: number; calibration: { factor: number; months: number } | null;
}

export function businessForecast(ds: Dataset, stages: StageRow[], history: StageHistoryRow[], s: ForecastSettings, today: string,
  calibration: { factor: number; months: number } | null = null): BusinessForecast {
  const stageProbs = stageProbabilities(ds, stages, history, s);
  const probBy = new Map(stageProbs.map((x) => [x.key, x]));
  const brandSector = new Map(ds.brands.map((b) => [b.id, b.sector_id]));
  const global = avgSignedValue(ds, () => true);
  const cycle = cycleDays(ds), pay = paymentDays(ds);
  const cycleD = cycle.n >= 2 ? cycle.days! : s.cycle_days_hypothesis;
  const payD = pay.n >= 2 ? pay.days! : s.payment_days_hypothesis;
  const now = t(today);
  const curYm = today.slice(0, 7);
  const cal = calibration && calibration.months >= 2 ? calibration.factor : 1;

  // --- Opportunités ouvertes (dès le premier contact envoyé)
  const contactedPos = stages.find((x) => x.key === "contacted")?.position ?? 5;
  const firstOut = new Map<number, number>();
  for (const o of ds.outreach) { const x = t(o.sent_at); if (!firstOut.has(o.brand_id) || x < firstOut.get(o.brand_id)!) firstOut.set(o.brand_id, x); }
  const stageByKey = new Map(stages.map((x) => [x.key, x]));
  const opportunities: Opportunity[] = [];
  for (const b of ds.brands) {
    const st = b.stage_key ? stageByKey.get(b.stage_key) : null;
    if (!st || st.kind !== "open" || st.position < contactedPos || b.do_not_contact) continue;
    const pr = probBy.get(st.key);
    if (!pr) continue;
    const proposed = ds.deals.filter((d) => d.brand_id === b.id && d.status === "proposed" && d.collab_type !== "gifting").map(dealValue).filter((v) => v > 0);
    const sec = avgSignedValue(ds, (id) => brandSector.get(id) === b.sector_id && b.sector_id != null);
    let value: number, valueSource: string;
    if (proposed.length) { value = proposed.reduce((a, c) => a + c, 0); valueSource = "montant proposé"; }
    else if (sec.n >= 2) { value = sec.avg; valueSource = `panier moyen du secteur (${sec.n} contrats)`; }
    else if (global.n >= 2) { value = global.avg; valueSource = `panier moyen global (${global.n} contrats)`; }
    else { value = s.avg_deal_hypothesis; valueSource = "hypothèse de panier moyen"; }
    const age = firstOut.has(b.id) ? (now - firstOut.get(b.id)!) / 86400000 : 0;
    const remaining = Math.max(7, cycleD - age) + (st.key === "proposal_sent" || st.key === "negotiation" ? -Math.min(14, cycleD / 3) : 0);
    const expectedMonth = Math.min(6, Math.max(0, monthDiff(curYm, ymOf(new Date(now + Math.max(0, remaining) * 86400000)))));
    opportunities.push({ brand_id: b.id, name: b.name, sector_id: b.sector_id, stage_key: st.key, stage_label: st.label, value: r2(value), valueSource,
      p: { prudent: pr.low * cal, central: Math.min(1, pr.p * cal), ambitious: Math.min(1, pr.high * cal) }, expectedMonth });
  }

  // --- Flux de nouvelles affaires issues de la prospection future
  const last30 = ds.outreach.filter((o) => now - t(o.sent_at) <= 30 * 86400000 && now >= t(o.sent_at));
  const brandsContacted30 = new Set(last30.map((o) => o.brand_id)).size;
  const conv = probBy.get("contacted") ?? { p: s.prior.contacted, low: s.prior.contacted, high: s.prior.contacted, closed: 0 } as StageProb;
  const avgNew = global.n >= 2 ? global.avg : s.avg_deal_hypothesis;
  const newPerMonth: Record<Scenario, number> = {
    prudent: brandsContacted30 * conv.low * cal,
    central: brandsContacted30 * conv.p * cal,
    ambitious: brandsContacted30 * (1 + s.ambitious_outreach_boost) * conv.high * cal,
  };
  const lagMonths = Math.max(1, Math.round(cycleD / 30));
  const payLag = Math.round(payD / 30);

  // --- Créances : factures émises non soldées
  const receivablesByMonth = new Array(7).fill(0);
  let receivables = 0;
  for (const d of issuedInvoices(ds.documents)) {
    const rest = invoiceTTC(d) - invoicePaid(d);
    if (rest <= 0.009) continue;
    receivables += rest;
    const due = d.due_date ? iso(d.due_date).slice(0, 7) : curYm;
    receivablesByMonth[Math.min(6, Math.max(0, monthDiff(curYm, due)))] += rest;
  }
  // Contrats signés non encore facturés : encaissement attendu après le délai de paiement.
  const invoicedDeals = new Set(issuedInvoices(ds.documents).map((d) => d.deal_id).filter(Boolean));
  const signedUninvoiced = ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting" && !invoicedDeals.has(d.id)).reduce((a, d) => a + dealValue(d), 0);

  const months: MonthRow[] = [];
  const zero = (): Record<Scenario, number> => ({ prudent: 0, central: 0, ambitious: 0 });
  const outcomes = stageProbs.find((x) => x.key === "contacted")?.closed ?? 0;
  const baseConf: "élevé" | "moyen" | "faible" = outcomes >= 20 ? "élevé" : outcomes >= 5 ? "moyen" : "faible";
  for (let m = 0; m <= 6; m++) {
    const row: MonthRow = { month: m, ym: addMonthsYm(curYm, m), label: m === 0 ? "Ce mois" : `M+${m}`, pipelineContracts: zero(), newContracts: zero(), contracts: zero(), weighted: zero(), cash: zero(), capped: { prudent: false, central: false, ambitious: false }, confidence: baseConf };
    if (m >= 3 && baseConf === "élevé") row.confidence = "moyen";
    if (m >= 2 && baseConf === "moyen") row.confidence = "faible";
    for (const sc of SCENARIOS) {
      let pc = 0, pw = 0;
      for (const o of opportunities) if (o.expectedMonth === m) { pc += o.p[sc]; pw += o.p[sc] * o.value; }
      const nc = m >= lagMonths ? newPerMonth[sc] : 0;
      let total = pc + nc, weighted = pw + nc * avgNew;
      if (total > s.capacity_per_month) { weighted *= s.capacity_per_month / total; total = s.capacity_per_month; row.capped[sc] = true; }
      row.pipelineContracts[sc] = r2(pc); row.newContracts[sc] = r2(nc); row.contracts[sc] = r2(total); row.weighted[sc] = r2(weighted);
    }
    months.push(row);
  }
  for (const sc of SCENARIOS) for (let m = 0; m <= 6; m++) {
    const src = m - payLag;
    const fromSales = src >= 0 ? months[src].weighted[sc] : 0;
    const signedCash = m === Math.min(6, payLag) ? signedUninvoiced : 0;
    months[m].cash[sc] = r2(receivablesByMonth[m] + fromSales + signedCash);
  }

  // --- Totaux
  const potential = opportunities;
  const sum = (f: (o: Opportunity) => number) => r2(potential.reduce((a, o) => a + f(o), 0));
  const inv = issuedInvoices(ds.documents);
  const thisMonthSigned = ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting" && iso(d.signed_at ?? d.created_at).slice(0, 7) === curYm);
  const totals = {
    potentialCount: potential.length,
    potentialValue: sum((o) => o.value),
    probable: { prudent: sum((o) => o.p.prudent), central: sum((o) => o.p.central), ambitious: sum((o) => o.p.ambitious) },
    weighted: { prudent: sum((o) => o.p.prudent * o.value), central: sum((o) => o.p.central * o.value), ambitious: sum((o) => o.p.ambitious * o.value) },
    signedCount: thisMonthSigned.length,
    signedValue: r2(thisMonthSigned.reduce((a, d) => a + dealValue(d), 0)),
    invoiced: r2(inv.reduce((a, d) => a + invoiceTTC(d), 0)),
    collected: r2(inv.reduce((a, d) => a + invoicePaid(d), 0)),
    receivables: r2(receivables),
    contractsInProgress: ds.deals.filter((d) => d.status === "signed" || d.status === "in_progress").length,
  };

  // --- Secteurs
  const sectors: SectorForecast[] = ds.sectors.map((sec) => {
    const ops = opportunities.filter((o) => o.sector_id === sec.id);
    const contactedShare = brandsContacted30 ? new Set(last30.filter((o) => brandSector.get(o.brand_id) === sec.id).map((o) => o.brand_id)).size / brandsContacted30 : 0;
    const newC = newPerMonth.central * contactedShare * Math.max(0, 7 - lagMonths);
    const shortTerm = r2(ops.filter((o) => o.expectedMonth <= 2).reduce((a, o) => a + o.p.central * o.value, 0));
    const weighted6m = r2(ops.reduce((a, o) => a + o.p.central * o.value, 0) + newC * avgNew);
    return { sector_id: sec.id, name: sec.name, color: sec.color, shortTerm, pipelineCount: ops.length,
      contracts6m: r2(ops.reduce((a, o) => a + o.p.central, 0) + newC), weighted6m,
      note: ops.length === 0 && contactedShare === 0 ? "Aucune démarche en cours : pas de prévision possible" : shortTerm > 0 ? "Potentiel à court terme (pipeline avancé)" : "Potentiel à plus long terme (prospection en cours)" };
  }).sort((a, b) => b.weighted6m - a.weighted6m);

  // --- Scénarios
  const top = [...opportunities].sort((a, b) => b.p.central * b.value - a.p.central * a.value)[0];
  const scenarios = {} as BusinessForecast["scenarios"];
  for (const sc of SCENARIOS) {
    const risks: string[] = [];
    if (baseConf === "faible") risks.push(`Historique insuffisant (${outcomes} issue(s) connue(s)) : les probabilités reposent surtout sur des hypothèses.`);
    if (top && totals.weighted.central > 0 && (top.p.central * top.value) / totals.weighted.central > 0.4) risks.push(`Dépendance à une seule opportunité : ${top.name} représente plus de 40 % du CA pondéré.`);
    if (brandsContacted30 === 0) risks.push("Aucune démarche sur 30 jours : aucun nouveau contrat attendu au-delà du pipeline actuel.");
    if (months.some((m) => m.capped[sc])) risks.push(`Capacité de production atteinte (${s.capacity_per_month} contrats/mois) sur au moins un mois.`);
    if (sc === "ambitious") risks.push(`Suppose ${Math.round(s.ambitious_outreach_boost * 100)} % de démarches en plus et un taux de transformation dans le haut de l'intervalle.`);
    const overdue = issuedInvoices(ds.documents).filter((d) => d.due_date && iso(d.due_date) < today && invoiceTTC(d) - invoicePaid(d) > 0.009).length;
    if (overdue) risks.push(`${overdue} facture(s) en retard : encaissements incertains.`);
    scenarios[sc] = {
      contracts6m: r2(months.slice(0, 7).reduce((a, m) => a + m.contracts[sc], 0)),
      revenue6m: r2(totals.potentialValue + months.reduce((a, m) => a + m.newContracts[sc], 0) * avgNew),
      weighted6m: r2(months.reduce((a, m) => a + m.weighted[sc], 0)),
      cash6m: r2(months.reduce((a, m) => a + m.cash[sc], 0)),
      confidence: sc === "central" ? baseConf : "faible",
      risks,
    };
  }

  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const assumptions: Assumption[] = [
    { label: "Taux de transformation après premier contact", value: `${pct(conv.p)} (intervalle ${pct(conv.low)} – ${pct(conv.high)})`, source: conv.closed === 0 ? "hypothèse" : conv.closed >= 20 ? "données" : "mixte", detail: `${conv.closed} issue(s) connue(s), hypothèse a priori ${pct(s.prior.contacted)} pondérée comme ${s.prior_weight} observations` },
    { label: "Panier moyen", value: `${Math.round(global.n >= 2 ? global.avg : s.avg_deal_hypothesis)} € HT`, source: global.n >= 2 ? "données" : "hypothèse", detail: global.n >= 2 ? `${global.n} contrats signés` : "Aucun historique suffisant (< 2 contrats)" },
    { label: "Délai premier contact → signature", value: `${Math.round(cycleD)} jours`, source: cycle.n >= 2 ? "données" : "hypothèse", detail: cycle.n >= 2 ? `${cycle.n} contrats` : "Historique insuffisant" },
    { label: "Délai facture → paiement", value: `${Math.round(payD)} jours`, source: pay.n >= 2 ? "données" : "hypothèse", detail: pay.n >= 2 ? `${pay.n} factures payées` : "Historique insuffisant" },
    { label: "Rythme de prospection", value: `${brandsContacted30} marque(s) contactée(s) sur 30 jours`, source: "données" },
    { label: "Capacité de production", value: `${s.capacity_per_month} contrats / mois`, source: "hypothèse", detail: "À ajuster selon votre charge réelle" },
  ];
  if (calibration) assumptions.push({ label: "Ajustement appris des écarts passés", value: calibration.months >= 2 ? `× ${calibration.factor.toFixed(2)}` : "non appliqué", source: "données", detail: `${calibration.months} mois comparés${calibration.months < 2 ? " (minimum 2)" : ""}` });

  return { today, stageProbs, opportunities, months, sectors, totals, scenarios, assumptions, confidence: baseConf, outcomes, calibration };
}

export function monthDiff(fromYm: string, toYm: string) {
  const [y1, m1] = fromYm.split("-").map(Number), [y2, m2] = toYm.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

// ------------------------------------------------------------------ Tendances

export interface Trend { status: "progresse" | "stagne" | "recule" | "insuffisant"; metrics: { label: string; current: number; previous: number; change: number | null }[]; explanations: string[] }

export function activityTrend(ds: Dataset, today: string, days = 30): Trend {
  const end = t(addDays(today, 1)), mid = end - days * 86400000, start = mid - days * 86400000;
  const inR = (v: string | Date | null | undefined, a: number, b: number) => { const x = t(v); return x >= a && x < b; };
  const m = (label: string, f: (a: number, b: number) => number) => {
    const current = f(mid, end), previous = f(start, mid);
    return { label, current, previous, change: previous > 0 ? (current - previous) / previous : current > 0 ? null : 0 };
  };
  const metrics = [
    m("Démarches", (a, b) => ds.outreach.filter((o) => inR(o.sent_at, a, b)).length),
    m("Réponses positives", (a, b) => ds.responses.filter((r) => r.classification === "positive" && inR(r.received_at, a, b)).length),
    m("Contrats signés", (a, b) => ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting" && inR(d.signed_at ?? d.created_at, a, b)).length),
    m("CA signé (€)", (a, b) => r2(ds.deals.filter((d) => isSigned(d) && inR(d.signed_at ?? d.created_at, a, b)).reduce((s, d) => s + dealValue(d), 0))),
    m("Encaissé (€)", (a, b) => r2(issuedInvoices(ds.documents).filter((d) => inR(d.paid_at, a, b)).reduce((s, d) => s + invoicePaid(d), 0))),
  ];
  const volume = metrics.reduce((s, x) => s + x.current + x.previous, 0);
  if (volume < 3) return { status: "insuffisant", metrics, explanations: [`Pas assez d'activité sur les ${days * 2} derniers jours pour qualifier la tendance.`] };
  // Pondération : l'argent pèse plus que le volume de démarches.
  const w = [1, 2, 3, 3, 3];
  const score = metrics.reduce((s, x, i) => s + w[i] * Math.sign(x.current - x.previous) * (x.current + x.previous > 0 ? 1 : 0), 0);
  const status = score >= 3 ? "progresse" : score <= -3 ? "recule" : "stagne";
  const explanations = metrics.filter((x) => x.current !== x.previous).map((x) =>
    `${x.label} : ${x.current} contre ${x.previous} sur les ${days} jours précédents${x.change !== null ? ` (${x.change > 0 ? "+" : ""}${Math.round(x.change * 100)} %)` : ""}.`);
  return { status, metrics, explanations };
}

/** Explique l'évolution du potentiel d'un secteur entre deux prévisions (aujourd'hui vs il y a 7 jours). */
export function explainSectorChange(name: string, now: { weighted: number; pipeline: number; positive: number; avgDeal: number | null }, before: { weighted: number; pipeline: number; positive: number; avgDeal: number | null }) {
  const delta = now.weighted - before.weighted;
  if (Math.abs(delta) < 1) return null;
  const reasons: string[] = [];
  if (now.pipeline !== before.pipeline) reasons.push(`${now.pipeline > before.pipeline ? "davantage" : "moins"} d'opportunités en cours (${before.pipeline} → ${now.pipeline})`);
  if (now.positive !== before.positive) reasons.push(`${now.positive - before.positive > 0 ? "+" : ""}${now.positive - before.positive} réponse(s) positive(s)`);
  if (now.avgDeal !== null && before.avgDeal !== null && Math.abs(now.avgDeal - before.avgDeal) > 1) reasons.push(`panier moyen ${now.avgDeal > before.avgDeal ? "en hausse" : "en baisse"} (${Math.round(before.avgDeal)} → ${Math.round(now.avgDeal)} €)`);
  return `Le potentiel commercial du secteur ${name} ${delta > 0 ? "augmente" : "diminue"} (${delta > 0 ? "+" : ""}${Math.round(delta)} € pondérés)${reasons.length ? " : " + reasons.join(", ") : ""}.`;
}
