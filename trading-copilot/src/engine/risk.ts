// Gestion du risque : fonctions déterministes, hypothèses explicites.

import type { AssetId, LedgerState, Limits } from './types';
import { valuate, type Marks, type OrderDraft } from './ledger';
import { quantile } from './indicators';

/**
 * Taille de position telle que la perte au stop, frais d'entrée et de sortie
 * compris, soit égale à `riskPct` du capital.
 * Perte par unité = (entrée - stop) + frais × (entrée + stop).
 * Hypothèse : le stop est exécuté exactement à son prix (aucun gap). En réalité,
 * un gap peut provoquer une perte supérieure : voir `gapRisk`.
 */
export function positionSize(p: { equity: number; riskPct: number; entry: number; stop: number; feeRate: number; maxCash?: number }) {
  const { equity, riskPct, entry, stop, feeRate } = p;
  if (!(entry > 0) || !(stop > 0) || stop >= entry) return { qty: 0, reason: 'Le stop doit être strictement inférieur au prix d\'entrée.' };
  const riskAmount = equity * riskPct;
  const lossPerUnit = entry - stop + feeRate * (entry + stop);
  let qty = riskAmount / lossPerUnit;
  let capped = false;
  if (p.maxCash !== undefined && qty * entry * (1 + feeRate) > p.maxCash) {
    qty = p.maxCash / (entry * (1 + feeRate));
    capped = true;
  }
  qty = Math.floor(qty * 1e8) / 1e8;
  return {
    qty, riskAmount, lossPerUnit, notional: qty * entry, capped,
    stopDistancePct: 1 - stop / entry,
    reason: capped ? 'Taille plafonnée par les liquidités disponibles.' : undefined,
  };
}

/** Perte si le marché ouvre au-delà du stop d'un pourcentage `gapPct` supplémentaire. */
export function gapRisk(qty: number, entry: number, stop: number, gapPct: number, feeRate: number) {
  const exit = stop * (1 - gapPct);
  return qty * (entry - exit) + feeRate * qty * (entry + exit);
}

export interface Exposure {
  equity: number;
  cashWeight: number;
  byAsset: { asset: AssetId; value: number; weight: number }[];
  largestWeight: number;
  hhi: number; // indice de Herfindahl sur les poids (cash inclus) : 1 = tout sur une ligne
}

export function exposure(s: LedgerState, marks: Marks): Exposure {
  const v = valuate(s, marks);
  const eq = v.equity || 1;
  const byAsset = v.lines.map((l) => ({ asset: l.asset, value: l.value, weight: l.value / eq })).sort((a, b) => b.weight - a.weight);
  const cashWeight = v.cash / eq;
  const weights = [cashWeight, ...byAsset.map((b) => b.weight)];
  return {
    equity: v.equity, cashWeight, byAsset,
    largestWeight: byAsset[0]?.weight ?? 0,
    hhi: weights.reduce((a, w) => a + w * w, 0),
  };
}

/** Drawdown d'une série de valeurs (capital, prix). */
export function drawdown(values: number[]) {
  let peak = -Infinity, maxDD = 0, peakIdx = 0, troughIdx = 0, curPeakIdx = 0;
  const series = values.map((v, i) => {
    if (v > peak) { peak = v; curPeakIdx = i; }
    const dd = peak > 0 ? v / peak - 1 : 0;
    if (dd < maxDD) { maxDD = dd; peakIdx = curPeakIdx; troughIdx = i; }
    return dd;
  });
  return { maxDrawdown: maxDD, current: series[series.length - 1] ?? 0, series, peakIdx, troughIdx };
}

/** Stress test : variation instantanée des prix, positions inchangées. */
export function shock(s: LedgerState, marks: Marks, shocks: Partial<Record<AssetId, number>>) {
  const before = valuate(s, marks);
  const shocked: Marks = { ...marks };
  for (const [a, pct] of Object.entries(shocks)) {
    const m = marks[a as AssetId];
    if (m !== undefined && pct !== undefined) shocked[a as AssetId] = m * (1 + pct);
  }
  const after = valuate(s, shocked);
  return {
    equityBefore: before.equity, equityAfter: after.equity,
    delta: after.equity - before.equity,
    deltaPct: before.equity ? after.equity / before.equity - 1 : 0,
    lines: after.lines.map((l) => ({ asset: l.asset, delta: l.value - (before.lines.find((b) => b.asset === l.asset)?.value ?? 0) })),
  };
}

/**
 * VaR historique : quantile empirique des rendements observés. Ce n'est
 * pas une probabilité garantie : elle dépend entièrement de la fenêtre étudiée.
 */
export function historicalVaR(returns: number[], confidence = 0.95) {
  const r = returns.filter(Number.isFinite);
  if (r.length < 30) return { var: NaN, n: r.length, insufficient: true };
  return { var: -quantile(r, 1 - confidence), n: r.length, insufficient: false };
}

export interface LimitCheck {
  rule: keyof Limits;
  severity: 'block' | 'warn';
  message: string;
  value?: number;
  limit?: number;
}

/** Contrôle d'un ordre proposé par rapport aux limites définies par l'utilisateur. */
export function checkLimits(s: LedgerState, d: OrderDraft, price: number, marks: Marks, limits: Limits, peakEquity: number): LimitCheck[] {
  const out: LimitCheck[] = [];
  const v = valuate(s, marks);
  const eq = v.equity;
  if (d.side === 'buy') {
    const cur = v.lines.find((l) => l.asset === d.asset)?.value ?? 0;
    const after = cur + d.qty * price;
    const w = after / eq;
    if (w > limits.maxPositionPct + 1e-9) out.push({ rule: 'maxPositionPct', severity: 'warn', value: w, limit: limits.maxPositionPct, message: `Après cet ordre, ${d.asset} pèserait ${(w * 100).toFixed(1)} % du portefeuille, au-delà de ta limite de ${(limits.maxPositionPct * 100).toFixed(0)} %.` });
    if (d.stopPrice === undefined) {
      if (limits.requireStop) out.push({ rule: 'requireStop', severity: 'warn', message: 'Aucun stop défini : la perte maximale de cette opération n\'est pas bornée par ton plan.' });
    } else {
      const risk = d.qty * (price - d.stopPrice) + s.execution.feeRate * d.qty * (price + d.stopPrice);
      const rp = risk / eq;
      if (rp > limits.maxRiskPerTradePct + 1e-9) out.push({ rule: 'maxRiskPerTradePct', severity: 'warn', value: rp, limit: limits.maxRiskPerTradePct, message: `Perte au stop estimée : ${risk.toFixed(2)} € (${(rp * 100).toFixed(2)} % du capital), au-delà de ta limite de ${(limits.maxRiskPerTradePct * 100).toFixed(2)} % par opération.` });
    }
  }
  const dd = peakEquity > 0 ? eq / peakEquity - 1 : 0;
  if (-dd > limits.maxDrawdownPct && d.side === 'buy') out.push({ rule: 'maxDrawdownPct', severity: 'warn', value: -dd, limit: limits.maxDrawdownPct, message: `Ton capital simulé est ${(-dd * 100).toFixed(1)} % sous son plus haut, au-delà de ta limite de repli de ${(limits.maxDrawdownPct * 100).toFixed(0)} %. Ton plan prévoit une pause.` });
  return out;
}
