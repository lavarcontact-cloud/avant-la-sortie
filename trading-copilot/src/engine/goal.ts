// Calculateur d'objectif : que faudrait-il pour passer de C à O en H jours ?
// Compare l'exigence aux rendements HISTORIQUES observés sur la même durée.
// Une fréquence historique n'est pas une probabilité future.

import type { Candle } from './types';
import { quantile } from './indicators';

export interface GoalInput {
  capital: number;
  target: number;
  days: number;
  feeRate: number;
  tradesPerMonth: number; // allers simples (achat ou vente)
}

export interface GoalResult {
  requiredMultiple: number;
  requiredReturn: number;
  requiredMonthly: number;
  requiredAnnualized: number;
  feeDragPct: number; // part du capital consommée par les frais sur la période (rotation complète à chaque transaction)
  history: {
    windows: number; // fenêtres glissantes (chevauchantes) observées
    independentWindows: number; // nombre de fenêtres sans chevauchement
    p10: number; p50: number; p90: number; best: number; worst: number;
    shareAtLeastRequired: number; // fréquence historique, PAS une probabilité
    from: number; to: number;
  } | null;
  leverage: {
    needed: number; // levier nécessaire si le marché répète la meilleure fenêtre observée
    liquidationMove: number; // baisse qui efface le capital avec ce levier
    worstAdverseInWindows: number; // pire baisse intra-fenêtre observée (du début au plus bas)
  } | null;
  verdict: 'atteignable_historiquement' | 'exceptionnel' | 'hors_historique' | 'donnees_insuffisantes';
  explanation: string[];
}

export function analyzeGoal(inp: GoalInput, candles: Candle[]): GoalResult {
  const { capital, target, days } = inp;
  const multiple = target / capital;
  const req = multiple - 1;
  const months = days / 30.4375;
  const res: GoalResult = {
    requiredMultiple: multiple,
    requiredReturn: req,
    requiredMonthly: multiple ** (1 / months) - 1,
    requiredAnnualized: multiple ** (365 / days) - 1,
    feeDragPct: 1 - (1 - inp.feeRate) ** (inp.tradesPerMonth * months),
    history: null, leverage: null, verdict: 'donnees_insuffisantes', explanation: [],
  };
  const fmt = (x: number) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
  res.explanation.push(`Passer de ${capital.toLocaleString('fr-FR')} € à ${target.toLocaleString('fr-FR')} € exige un gain de ${fmt(req)} (× ${multiple.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}) en ${days} jours, soit ${fmt(res.requiredMonthly)} par mois composé.`);
  res.explanation.push(`Avec ${inp.tradesPerMonth} transactions par mois à ${fmt(inp.feeRate)} de frais, environ ${fmt(res.feeDragPct)} du capital part en frais sur la période, avant tout gain ou perte.`);

  const n = candles.length;
  if (n < days + 30) {
    res.explanation.push(`Historique disponible : ${n} jours. Il en faut au moins ${days + 30} pour comparer à des fenêtres de ${days} jours. Pas de conclusion historique possible.`);
    return res;
  }
  const rets: number[] = [];
  const adverse: number[] = [];
  for (let i = 0; i + days < n; i++) {
    const start = candles[i].c;
    rets.push(candles[i + days].c / start - 1);
    let lo = Infinity;
    for (let j = i + 1; j <= i + days; j++) lo = Math.min(lo, candles[j].l);
    adverse.push(lo / start - 1);
  }
  const best = Math.max(...rets);
  res.history = {
    windows: rets.length,
    independentWindows: Math.floor(n / days),
    p10: quantile(rets, 0.1), p50: quantile(rets, 0.5), p90: quantile(rets, 0.9),
    best, worst: Math.min(...rets),
    shareAtLeastRequired: rets.filter((r) => r >= req).length / rets.length,
    from: candles[0].t, to: candles[n - 1].t,
  };
  const worstAdverse = Math.min(...adverse);
  if (best > 0) {
    const L = req / best;
    res.leverage = { needed: L, liquidationMove: 1 / L, worstAdverseInWindows: worstAdverse };
  }
  const h = res.history;
  res.explanation.push(`Sur ${h.windows} fenêtres glissantes de ${days} jours (seulement ${h.independentWindows} sans chevauchement), le rendement de l'actif a varié de ${fmt(h.worst)} à ${fmt(h.best)} ; médiane ${fmt(h.p50)}.`);
  if (req <= h.p90 && h.shareAtLeastRequired > 0.1) {
    res.verdict = 'atteignable_historiquement';
    res.explanation.push(`L'objectif a été égalé ou dépassé dans ${fmt(h.shareAtLeastRequired)} des fenêtres observées, sans levier. Cela reste une fréquence passée sur une courte période, pas une probabilité.`);
  } else if (req <= best) {
    res.verdict = 'exceptionnel';
    res.explanation.push(`Seules ${fmt(h.shareAtLeastRequired)} des fenêtres ont atteint ce niveau : il aurait fallu acheter au meilleur moment. Le risque de faire bien pire était plus élevé que la chance de réussir.`);
  } else {
    res.verdict = 'hors_historique';
    res.explanation.push(`Aucune fenêtre observée n'a atteint ce rendement. Même en achetant au meilleur moment, il aurait fallu un levier d'environ ×${res.leverage ? res.leverage.needed.toFixed(0) : '∞'}.`);
    if (res.leverage) res.explanation.push(`Avec un tel levier, une baisse de ${fmt(res.leverage.liquidationMove)} efface tout le capital. La pire baisse observée en cours de fenêtre a été de ${fmt(worstAdverse)}. Ce type d'objectif conduit, dans la plupart des cas, à la perte totale du capital engagé.`);
  }
  return res;
}
