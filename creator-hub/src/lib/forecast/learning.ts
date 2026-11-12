// Apprentissage : comparer chaque mois la prévision initiale au résultat réel.
import { iso } from "../dates";
import { type Dataset, dealValue, isSigned, issuedInvoices, invoicePaid, invoiceTTC } from "../stats";
import { monthDiff } from "./business";

export interface SnapshotRow { made_on: string; target_month: string; scenario: string; contracts: number | string | null; weighted: number | string | null; collected: number | string | null }
export interface MonthAccuracy {
  month: string; madeOn: string; predictedRevenue: number; actualRevenue: number; errorEur: number; errorPct: number | null; accuracy: number | null;
  predictedContracts: number; actualContracts: number; predictedCash: number; actualCash: number; actualInvoiced: number; factors: string[];
}

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

export function actualsForMonth(ds: Dataset, ym: string) {
  const signed = ds.deals.filter((d) => isSigned(d) && d.collab_type !== "gifting" && iso(d.signed_at ?? d.created_at).slice(0, 7) === ym);
  const inv = issuedInvoices(ds.documents);
  return {
    contracts: signed.length,
    revenue: Math.round(signed.reduce((a, d) => a + dealValue(d), 0) * 100) / 100,
    invoiced: Math.round(inv.filter((d) => iso(d.issue_date).slice(0, 7) === ym).reduce((a, d) => a + invoiceTTC(d), 0) * 100) / 100,
    cash: Math.round(inv.filter((d) => d.paid_at && iso(d.paid_at).slice(0, 7) === ym).reduce((a, d) => a + invoicePaid(d), 0) * 100) / 100,
  };
}

/** Pour chaque mois écoulé : la prévision faite au plus tard le 1er du mois (sinon la première du mois) vs le réel. */
export function forecastAccuracy(ds: Dataset, snapshots: SnapshotRow[], currentYm: string): MonthAccuracy[] {
  const central = snapshots.filter((s) => s.scenario === "central");
  const months = [...new Set(central.map((s) => s.target_month))].filter((m) => monthDiff(m, currentYm) >= 1).sort();
  const out: MonthAccuracy[] = [];
  for (const ym of months) {
    const forMonth = central.filter((s) => s.target_month === ym).sort((a, b) => a.made_on.localeCompare(b.made_on));
    const before = forMonth.filter((s) => s.made_on.slice(0, 7) < ym);
    const pick = before.length ? before[before.length - 1] : forMonth[0];
    if (!pick) continue;
    const a = actualsForMonth(ds, ym);
    const pred = n(pick.weighted);
    const err = a.revenue - pred;
    const factors: string[] = [];
    const pc = n(pick.contracts);
    if (Math.abs(a.contracts - pc) >= 0.5) factors.push(`${a.contracts} contrat(s) signé(s) contre ${pc.toFixed(1)} prévu(s)`);
    if (a.contracts > 0 && pc > 0) {
      const realAvg = a.revenue / a.contracts, predAvg = pred / pc;
      if (Math.abs(realAvg - predAvg) / Math.max(predAvg, 1) > 0.15) factors.push(`panier moyen réel ${Math.round(realAvg)} € contre ${Math.round(predAvg)} € prévu`);
    }
    if (n(pick.collected) > 0 && Math.abs(a.cash - n(pick.collected)) > 1) factors.push(`encaissé ${Math.round(a.cash)} € contre ${Math.round(n(pick.collected))} € prévu (délais de paiement)`);
    out.push({
      month: ym, madeOn: pick.made_on, predictedRevenue: pred, actualRevenue: a.revenue, errorEur: Math.round(err * 100) / 100,
      errorPct: pred > 0 ? err / pred : null, accuracy: Math.max(pred, a.revenue) > 0 ? Math.max(0, 1 - Math.abs(err) / Math.max(pred, a.revenue)) : null,
      predictedContracts: pc, actualContracts: a.contracts, predictedCash: n(pick.collected), actualCash: a.cash, actualInvoiced: a.invoiced, factors,
    });
  }
  return out;
}

/** Facteur d'ajustement appris : médiane réel / prévu, borné à [0,5 ; 1,5], actif à partir de 2 mois comparables. */
export function learnedCalibration(acc: MonthAccuracy[]): { factor: number; months: number } {
  const ratios = acc.filter((a) => a.predictedRevenue > 0).map((a) => a.actualRevenue / a.predictedRevenue).sort((x, y) => x - y);
  if (!ratios.length) return { factor: 1, months: 0 };
  const mid = Math.floor(ratios.length / 2);
  const med = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return { factor: Math.min(1.5, Math.max(0.5, med)), months: ratios.length };
}

/** Périodes de croissance / stagnation / recul, mois par mois, d'après le CA signé réel. */
export function periodStatus(ds: Dataset, months: string[]) {
  const vals = months.map((m) => ({ month: m, ...actualsForMonth(ds, m) }));
  return vals.map((v, i) => {
    if (i === 0) return { ...v, status: "—" as const };
    const p = vals[i - 1].revenue;
    const ch = p > 0 ? (v.revenue - p) / p : v.revenue > 0 ? 1 : 0;
    return { ...v, status: (ch > 0.1 ? "croissance" : ch < -0.1 ? "recul" : "stagnation") as "croissance" | "recul" | "stagnation" };
  });
}
