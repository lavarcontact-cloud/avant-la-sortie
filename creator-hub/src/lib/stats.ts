// Calculs du dashboard. Fonctions pures, testées dans tests/stats.test.ts.
// Règle d'or : aucune statistique inventée. Tout vient des lignes passées en entrée.
import { COLLAB_TYPES, SIGNED_STATUSES, type CollabType, type DealStatus } from "./constants";
import { docTotals, type DocLine } from "./money";
import { parisParts, slotOf, TIME_SLOTS, WEEKDAYS } from "./dates";

export interface SBrand { id: number; name: string; sector_id: number | null; stage_kind: string | null; stage_key: string | null; created_at: string | Date; do_not_contact?: boolean }
export interface SContact { id: number; brand_id: number; first_name: string | null; last_name: string | null; role: string | null; role_type: string | null; email: string | null; opted_out: boolean }
export interface SOutreach { id: number; brand_id: number; contact_id: number | null; channel: string; kind: string; sent_at: string | Date; follow_up_at: string | Date | null; follow_up_done: boolean }
export interface SResponse { id: number; brand_id: number; contact_id: number | null; outreach_id: number | null; received_at: string | Date; classification: string; intents: string[] }
export interface SInteraction { brand_id: number; type: string; occurred_at: string | Date }
export interface SDeal { id: number; brand_id: number; collab_type: string; service_category: string; status: string; planned_price: number | string | null; negotiated_price: number | string | null; gift_value: number | string | null; signed_at: string | Date | null; created_at: string | Date; production_hours: number | string | null; estimated_costs: number | string | null }
export interface SDoc { id: number; kind: string; status: string; brand_id: number | null; deal_id: number | null; lines: DocLine[]; deposit: number | string; paid_amount: number | string; issue_date: string | Date | null; due_date: string | Date | null; paid_at: string | Date | null; number: string | null }
export interface SExpense { amount: number | string; spent_at: string | Date }
export interface SSector { id: number; name: string; color: string }

export interface Dataset {
  brands: SBrand[]; contacts: SContact[]; outreach: SOutreach[]; responses: SResponse[];
  interactions: SInteraction[]; deals: SDeal[]; documents: SDoc[]; expenses: SExpense[]; sectors: SSector[];
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const t = (v: string | Date | null | undefined) => (v ? new Date(typeof v === "string" && v.length === 10 ? v + "T12:00:00Z" : v).getTime() : NaN);
const inRange = (v: string | Date | null | undefined, from: number, to: number) => { const x = t(v); return x >= from && x < to; };
export const pct = (a: number, b: number) => (b > 0 ? a / b : null);

/** Factures émises (ni brouillon ni annulée). */
export const issuedInvoices = (docs: SDoc[]) => docs.filter((d) => d.kind === "invoice" && d.status !== "draft" && d.status !== "cancelled");
export const invoiceTTC = (d: SDoc) => docTotals(d.lines || []).ttc;
export const invoicePaid = (d: SDoc) => Math.min(invoiceTTC(d), n(d.deposit) + n(d.paid_amount));

export const dealValue = (d: SDeal) => (d.collab_type === "gifting" ? 0 : n(d.negotiated_price) || n(d.planned_price));
export const isSigned = (d: SDeal) => SIGNED_STATUSES.includes(d.status as DealStatus);

/** Démarches ayant reçu au moins une réponse (via outreach_id). */
export function respondedOutreachIds(responses: SResponse[]) {
  return new Set(responses.map((r) => r.outreach_id).filter((x): x is number => x != null));
}

// ---------------------------------------------------------------- KPIs

export interface Kpis {
  brands: number; qualified: number; contacts: number; outreach: number; responses: number;
  positive: number; negative: number; followUpsDue: number; meetings: number; collaborations: number;
  signed: number; invoiced: number; collected: number; outstanding: number; giftValue: number; expenses: number;
}

export function computeKpis(ds: Dataset, from: number, to: number, today: string): Kpis {
  const signedDeals = ds.deals.filter((d) => isSigned(d) && inRange(d.signed_at ?? d.created_at, from, to));
  const inv = issuedInvoices(ds.documents).filter((d) => inRange(d.issue_date, from, to));
  const paidInPeriod = issuedInvoices(ds.documents).filter((d) => inRange(d.paid_at ?? d.issue_date, from, to));
  const invoiced = inv.reduce((s, d) => s + invoiceTTC(d), 0);
  return {
    brands: ds.brands.filter((b) => inRange(b.created_at, from, to)).length,
    qualified: ds.brands.filter((b) => inRange(b.created_at, from, to) && b.stage_key !== "to_study").length,
    contacts: ds.contacts.length,
    outreach: ds.outreach.filter((o) => inRange(o.sent_at, from, to)).length,
    responses: ds.responses.filter((r) => inRange(r.received_at, from, to) && r.classification !== "automatic").length,
    positive: ds.responses.filter((r) => inRange(r.received_at, from, to) && r.classification === "positive").length,
    negative: ds.responses.filter((r) => inRange(r.received_at, from, to) && r.classification === "negative").length,
    followUpsDue: followUpsDue(ds, today).length,
    meetings: ds.interactions.filter((i) => i.type === "meeting" && inRange(i.occurred_at, from, to)).length,
    collaborations: signedDeals.length,
    signed: round(signedDeals.reduce((s, d) => s + dealValue(d), 0)),
    invoiced: round(invoiced),
    collected: round(paidInPeriod.reduce((s, d) => s + invoicePaid(d), 0)),
    outstanding: round(issuedInvoices(ds.documents).reduce((s, d) => s + (invoiceTTC(d) - invoicePaid(d)), 0)),
    giftValue: round(ds.deals.filter((d) => d.collab_type === "gifting" && inRange(d.signed_at ?? d.created_at, from, to)).reduce((s, d) => s + n(d.gift_value), 0)),
    expenses: round(ds.expenses.filter((e) => inRange(e.spent_at, from, to)).reduce((s, e) => s + n(e.amount), 0)),
  };
}
const round = (x: number) => Math.round(x * 100) / 100;

/** Relances dues : date de relance atteinte, non faite, et marque toujours contactable. */
export function followUpsDue(ds: Pick<Dataset, "outreach" | "brands" | "responses">, today: string) {
  const blocked = new Set(ds.brands.filter((b) => b.do_not_contact || b.stage_kind === "dnc" || b.stage_kind === "lost" || b.stage_kind === "won").map((b) => b.id));
  const answered = respondedOutreachIds(ds.responses);
  return ds.outreach.filter((o) => o.follow_up_at && !o.follow_up_done && String(o.follow_up_at).slice(0, 10) <= today
    && !blocked.has(o.brand_id) && !answered.has(o.id));
}

// ---------------------------------------------------------------- Secteurs

export interface SectorRow {
  sector: SSector; brands: number; contacts: number; outreach: number; responded: number; responseRate: number | null;
  positive: number; conversion: number | null; collaborations: number; signed: number; collected: number;
  avgDeal: number | null; avgDaysToDeal: number | null;
}

export function sectorPerformance(ds: Dataset): SectorRow[] {
  const brandSector = new Map(ds.brands.map((b) => [b.id, b.sector_id]));
  const answered = respondedOutreachIds(ds.responses);
  const firstOutreach = new Map<number, number>();
  for (const o of ds.outreach) {
    const x = t(o.sent_at);
    if (!firstOutreach.has(o.brand_id) || x < firstOutreach.get(o.brand_id)!) firstOutreach.set(o.brand_id, x);
  }
  const invByBrand = issuedInvoices(ds.documents);
  return ds.sectors.map((sector) => {
    const inS = (brandId: number | null) => brandId != null && brandSector.get(brandId) === sector.id;
    const out = ds.outreach.filter((o) => inS(o.brand_id));
    const contacted = new Set(out.map((o) => o.brand_id));
    const responded = out.filter((o) => answered.has(o.id)).length;
    const deals = ds.deals.filter((d) => inS(d.brand_id) && isSigned(d));
    const paidDeals = deals.filter((d) => d.collab_type !== "gifting");
    const signed = paidDeals.reduce((s, d) => s + dealValue(d), 0);
    const days = deals.map((d) => (firstOutreach.has(d.brand_id) ? (t(d.signed_at ?? d.created_at) - firstOutreach.get(d.brand_id)!) / 86400000 : NaN)).filter((x) => x >= 0);
    const dealBrands = new Set(deals.map((d) => d.brand_id));
    return {
      sector,
      brands: ds.brands.filter((b) => b.sector_id === sector.id).length,
      contacts: ds.contacts.filter((c) => inS(c.brand_id)).length,
      outreach: out.length,
      responded,
      responseRate: pct(responded, out.length),
      positive: ds.responses.filter((r) => inS(r.brand_id) && r.classification === "positive").length,
      conversion: pct([...contacted].filter((b) => dealBrands.has(b)).length, contacted.size),
      collaborations: deals.length,
      signed: round(signed),
      collected: round(invByBrand.filter((d) => inS(d.brand_id)).reduce((s, d) => s + invoicePaid(d), 0)),
      avgDeal: paidDeals.length ? round(signed / paidDeals.length) : null,
      avgDaysToDeal: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    };
  });
}

/** Recommandations sectorielles fondées sur les données, avec seuils d'échantillon. */
export function sectorInsights(rows: SectorRow[], minSample = 5): string[] {
  const out: string[] = [];
  const enough = rows.filter((r) => r.outreach >= minSample);
  if (!enough.length) {
    out.push(`Pas encore assez de démarches pour comparer les secteurs (minimum ${minSample} démarches par secteur).`);
  } else {
    const best = [...enough].sort((a, b) => (b.responseRate ?? 0) - (a.responseRate ?? 0))[0];
    out.push(`${best.sector.name} a le meilleur taux de réponse (${Math.round((best.responseRate ?? 0) * 100)} % sur ${best.outreach} démarches).`);
    const conv = enough.filter((r) => r.conversion != null && r.conversion > 0).sort((a, b) => b.conversion! - a.conversion!)[0];
    if (conv) out.push(`${conv.sector.name} transforme le mieux les démarches en collaborations (${Math.round(conv.conversion! * 100)} % des marques contactées).`);
  }
  const rev = rows.filter((r) => r.signed > 0).sort((a, b) => b.signed - a.signed)[0];
  if (rev) out.push(`${rev.sector.name} génère le plus de chiffre d'affaires signé.`);
  const under = rows.filter((r) => r.outreach < minSample && (r.responseRate ?? 0) > 0);
  for (const r of under.slice(0, 2)) out.push(`${r.sector.name} : premiers retours encourageants, à prospecter davantage pour confirmer (${r.outreach} démarche${r.outreach > 1 ? "s" : ""} seulement).`);
  const untouched = rows.filter((r) => r.outreach === 0 && r.brands > 0);
  for (const r of untouched.slice(0, 2)) out.push(`${r.sector.name} : ${r.brands} marque${r.brands > 1 ? "s" : ""} enregistrée${r.brands > 1 ? "s" : ""} mais aucune démarche envoyée.`);
  return out;
}

// ---------------------------------------------------------------- Interlocuteurs

export interface ContactRow {
  contact: SContact; brandName: string; attempts: number; responses: number; positive: number; negative: number;
  avgResponseHours: number | null; firstContact: number | null; lastInteraction: number | null; nextFollowUp: string | null; badge: string;
}

export function contactPerformance(ds: Dataset, now = Date.now()): ContactRow[] {
  const brandName = new Map(ds.brands.map((b) => [b.id, b.name]));
  const outById = new Map(ds.outreach.map((o) => [o.id, o]));
  const wonBrands = new Set(ds.deals.filter(isSigned).map((d) => d.brand_id));
  return ds.contacts.map((c) => {
    const out = ds.outreach.filter((o) => o.contact_id === c.id);
    const res = ds.responses.filter((r) => r.contact_id === c.id && r.classification !== "automatic");
    const delays = res.map((r) => (r.outreach_id && outById.has(r.outreach_id) ? (t(r.received_at) - t(outById.get(r.outreach_id)!.sent_at)) / 3600000 : NaN)).filter((x) => x >= 0);
    const times = [...out.map((o) => t(o.sent_at)), ...res.map((r) => t(r.received_at))];
    const first = out.length ? Math.min(...out.map((o) => t(o.sent_at))) : null;
    const pending = out.filter((o) => o.follow_up_at && !o.follow_up_done).map((o) => String(o.follow_up_at).slice(0, 10)).sort();
    const positive = res.filter((r) => r.classification === "positive").length;
    const negative = res.filter((r) => r.classification === "negative").length;
    const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
    let badge = "Pas encore contacté";
    if (c.opted_out) badge = "Ne plus contacter";
    else if (wonBrands.has(c.brand_id) && positive > 0) badge = "Relation établie";
    else if (positive > 0) badge = "Répond positivement";
    else if (res.length > 0 && avg !== null && avg <= 48) badge = "Répond rapidement";
    else if (res.length > 0) badge = "A déjà répondu";
    else if (out.length >= 3 && first !== null && now - first >= 21 * 86400000) badge = `Sans réponse après ${out.length} tentatives`;
    else if (out.length > 0) badge = "En attente (pas assez de recul)";
    return {
      contact: c, brandName: brandName.get(c.brand_id) ?? "—", attempts: out.length, responses: res.length, positive, negative,
      avgResponseHours: avg === null ? null : Math.round(avg), firstContact: first,
      lastInteraction: times.length ? Math.max(...times) : null, nextFollowUp: pending[0] ?? null, badge,
    };
  }).sort((a, b) => b.positive - a.positive || b.responses - a.responses || b.attempts - a.attempts);
}

// ---------------------------------------------------------------- Meilleurs moments

export interface RateCell { sent: number; responded: number; rate: number | null }
const cell = (): RateCell => ({ sent: 0, responded: 0, rate: null });

export function timingAnalysis(ds: Dataset, minSample = 5) {
  const answered = respondedOutreachIds(ds.responses);
  const grid: RateCell[][] = WEEKDAYS.map(() => TIME_SLOTS.map(cell));
  const byDay = WEEKDAYS.map(cell), bySlot = TIME_SLOTS.map(cell);
  const byChannel = new Map<string, RateCell>(), bySector = new Map<number | null, RateCell>(), byRole = new Map<string, RateCell>();
  const brandSector = new Map(ds.brands.map((b) => [b.id, b.sector_id]));
  const contactRole = new Map(ds.contacts.map((c) => [c.id, c.role_type || "Non renseigné"]));
  const add = (c: RateCell, ok: boolean) => { c.sent++; if (ok) c.responded++; };
  for (const o of ds.outreach) {
    const p = parisParts(new Date(o.sent_at));
    const si = TIME_SLOTS.findIndex((s) => s.key === slotOf(p.hour));
    const ok = answered.has(o.id);
    add(grid[p.weekday][si], ok); add(byDay[p.weekday], ok); add(bySlot[si], ok);
    const get = <K,>(m: Map<K, RateCell>, k: K) => { if (!m.has(k)) m.set(k, cell()); return m.get(k)!; };
    add(get(byChannel, o.channel), ok);
    add(get(bySector, brandSector.get(o.brand_id) ?? null), ok);
    add(get(byRole, o.contact_id ? contactRole.get(o.contact_id) ?? "Non renseigné" : "Sans interlocuteur"), ok);
  }
  const fin = (c: RateCell) => { c.rate = c.sent > 0 ? c.responded / c.sent : null; return c; };
  grid.forEach((r) => r.forEach(fin)); byDay.forEach(fin); bySlot.forEach(fin);
  [byChannel, bySector, byRole].forEach((m) => m.forEach(fin));

  const recs: string[] = [];
  const total = ds.outreach.length;
  if (total < 20) recs.push(`Échantillon limité : ${total} démarche${total > 1 ? "s" : ""} au total. Les tendances deviennent lisibles à partir d'environ 20 démarches, et chaque créneau doit en compter au moins ${minSample}.`);
  const bestOf = (cells: { label: string; c: RateCell }[]) => cells.filter((x) => x.c.sent >= minSample).sort((a, b) => b.c.rate! - a.c.rate!)[0];
  const d = bestOf(byDay.map((c, i) => ({ label: WEEKDAYS[i], c })));
  if (d) recs.push(`Meilleur jour mesuré : ${d.label} (${Math.round(d.c.rate! * 100)} % de réponses sur ${d.c.sent} envois).`);
  const s = bestOf(bySlot.map((c, i) => ({ label: TIME_SLOTS[i].label, c })));
  if (s) recs.push(`Meilleure tranche horaire mesurée : ${s.label} (${Math.round(s.c.rate! * 100)} % sur ${s.c.sent} envois).`);
  const ch = bestOf([...byChannel.entries()].map(([k, c]) => ({ label: k, c })));
  if (ch) recs.push(`Canal le plus efficace : ${ch.label} (${Math.round(ch.c.rate! * 100)} % sur ${ch.c.sent} envois).`);
  return { grid, byDay, bySlot, byChannel, bySector, byRole, recs, minSample };
}

// ---------------------------------------------------------------- Finances

export function financeSummary(ds: Dataset, today: string) {
  const inv = issuedInvoices(ds.documents);
  const invoiced = inv.reduce((s, d) => s + invoiceTTC(d), 0);
  const collected = inv.reduce((s, d) => s + invoicePaid(d), 0);
  const overdue = inv.filter((d) => d.due_date && String(d.due_date).slice(0, 10) < today && invoiceTTC(d) - invoicePaid(d) > 0.009);
  const signedDeals = ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting");
  const expenses = ds.expenses.reduce((s, e) => s + n(e.amount), 0);
  return {
    signed: round(signedDeals.reduce((s, d) => s + dealValue(d), 0)),
    invoiced: round(invoiced), collected: round(collected), outstanding: round(invoiced - collected),
    overdueCount: overdue.length, overdueAmount: round(overdue.reduce((s, d) => s + invoiceTTC(d) - invoicePaid(d), 0)),
    expenses: round(expenses), net: round(collected - expenses),
    giftValue: round(ds.deals.filter((d) => d.collab_type === "gifting").reduce((s, d) => s + n(d.gift_value), 0)),
    giftCount: ds.deals.filter((d) => d.collab_type === "gifting").length,
  };
}

export interface ServiceRow { category: string; count: number; signedCount: number; signed: number; invoiced: number; collected: number; avg: number | null; hours: number; perHour: number | null; margin: number | null; giftValue: number }

export function revenueByService(ds: Dataset): ServiceRow[] {
  const inv = issuedInvoices(ds.documents);
  const map = new Map<string, ServiceRow>();
  for (const d of ds.deals) {
    if (d.status === "cancelled" || d.status === "lost") continue;
    const r = map.get(d.service_category) ?? { category: d.service_category, count: 0, signedCount: 0, signed: 0, invoiced: 0, collected: 0, avg: null, hours: 0, perHour: null, margin: null, giftValue: 0 };
    r.count++;
    if (d.collab_type === "gifting") r.giftValue += n(d.gift_value);
    if (isSigned(d) && d.collab_type !== "gifting") {
      r.signedCount++; r.signed += dealValue(d);
      r.hours += n(d.production_hours);
      r.margin = (r.margin ?? 0) + dealValue(d) - n(d.estimated_costs);
    }
    const di = inv.filter((x) => x.deal_id === d.id);
    r.invoiced += di.reduce((s, x) => s + invoiceTTC(x), 0);
    r.collected += di.reduce((s, x) => s + invoicePaid(x), 0);
    map.set(d.service_category, r);
  }
  return [...map.values()].map((r) => ({
    ...r, signed: round(r.signed), invoiced: round(r.invoiced), collected: round(r.collected),
    avg: r.signedCount ? round(r.signed / r.signedCount) : null,
    perHour: r.hours > 0 ? round(r.signed / r.hours) : null,
    margin: r.margin === null ? null : round(r.margin),
  })).sort((a, b) => b.signed - a.signed || b.count - a.count);
}

export const collabLabel = (k: string) => COLLAB_TYPES[k as CollabType]?.label ?? k;
