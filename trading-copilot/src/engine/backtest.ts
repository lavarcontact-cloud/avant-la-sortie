// Backtest long-only, une position à la fois.
// Protocole anti look-ahead : le signal est calculé sur la clôture de la séance i
// et exécuté à l'OUVERTURE de la séance i+1. Les coûts (frais, demi-spread,
// glissement) sont appliqués à chaque transaction.

import type { Candle, ExecutionModel } from './types';
import { DAYS_PER_YEAR, donchian, sma, stdev, mean } from './indicators';
import { drawdown } from './risk';

export type StrategyId = 'buy_hold' | 'sma_cross' | 'donchian';

export interface StrategyDef {
  id: StrategyId;
  name: string;
  description: string;
  params: Record<string, number>;
}

export const STRATEGIES: Record<StrategyId, { name: string; description: string; grid: Record<string, number>[] }> = {
  buy_hold: {
    name: 'Achat-conservation (référence)',
    description: 'Achète à la première ouverture et conserve. Sert de point de comparaison : une stratégie active doit faire mieux après frais pour justifier sa complexité.',
    grid: [{}],
  },
  sma_cross: {
    name: 'Croisement de moyennes',
    description: 'Investi quand la moyenne courte est au-dessus de la longue, sinon en liquidités. Suiveur de tendance : perd dans les marchés sans direction.',
    grid: [5, 10, 20].flatMap((fast) => [30, 50, 100].map((slow) => ({ fast, slow }))),
  },
  donchian: {
    name: 'Cassure de canal',
    description: 'Entre quand la clôture dépasse le plus haut des N jours précédents, sort sous le plus bas des M jours. Peu de transactions, beaucoup de fausses cassures.',
    grid: [10, 20, 30].flatMap((entry) => [5, 10, 20].map((exit) => ({ entry, exit }))),
  },
};

/** Exposition cible (0 ou 1) décidée à la CLÔTURE de chaque séance. */
export function signals(id: StrategyId, c: Candle[], p: Record<string, number>): number[] {
  const closes = c.map((x) => x.c);
  if (id === 'buy_hold') return c.map(() => 1);
  if (id === 'sma_cross') {
    const f = sma(closes, p.fast), s = sma(closes, p.slow);
    return c.map((_, i) => (Number.isFinite(s[i]) && f[i] > s[i] ? 1 : 0));
  }
  const up = donchian(c, p.entry).upper, lo = donchian(c, p.exit).lower;
  const out: number[] = [];
  let pos = 0;
  for (let i = 0; i < c.length; i++) {
    if (pos === 0 && Number.isFinite(up[i]) && closes[i] > up[i]) pos = 1;
    else if (pos === 1 && Number.isFinite(lo[i]) && closes[i] < lo[i]) pos = 0;
    out.push(pos);
  }
  return out;
}

export interface Trade { entryT: number; exitT: number; entry: number; exit: number; ret: number; open: boolean }

export interface BacktestResult {
  equity: number[];
  times: number[];
  trades: Trade[];
  metrics: Metrics;
}

export interface Metrics {
  totalReturn: number;
  cagr: number;
  volAnn: number;
  sharpe: number; // taux sans risque = 0 (hypothèse simplificatrice)
  maxDrawdown: number;
  trades: number;
  winRate: number;
  payoff: number; // gain moyen / perte moyenne
  exposure: number; // part du temps investi
  costs: number; // coûts cumulés en part du capital initial
  days: number;
}

export function run(c: Candle[], target: number[], ex: ExecutionModel, capital = 10_000, maxParticipation = 0.01): BacktestResult {
  const costRate = ex.feeRate + ex.spreadBps / 2 / 1e4 + ex.slippageBps / 1e4;
  let cash = capital, qty = 0, costs = 0, invested = 0;
  const equity: number[] = [], times: number[] = [], trades: Trade[] = [];
  let open: Trade | null = null;
  for (let i = 0; i < c.length; i++) {
    // Exécution à l'ouverture de i selon le signal de clôture i-1.
    const want = i === 0 ? 0 : target[i - 1];
    const bar = c[i];
    if (want === 1 && qty === 0) {
      const px = bar.o * (1 + ex.spreadBps / 2 / 1e4 + ex.slippageBps / 1e4);
      const spend = cash / (1 + ex.feeRate);
      // contrainte de liquidité : pas plus de maxParticipation du volume de la séance
      const maxQty = bar.v * maxParticipation;
      qty = Math.min(spend / px, maxQty);
      const fee = qty * px * ex.feeRate;
      cash -= qty * px + fee;
      costs += qty * bar.o * costRate;
      open = { entryT: bar.t, exitT: bar.t, entry: px * (1 + ex.feeRate), exit: NaN, ret: NaN, open: true };
    } else if (want === 0 && qty > 0) {
      const px = bar.o * (1 - ex.spreadBps / 2 / 1e4 - ex.slippageBps / 1e4);
      const fee = qty * px * ex.feeRate;
      cash += qty * px - fee;
      costs += qty * bar.o * costRate;
      qty = 0;
      if (open) { open.exitT = bar.t; open.exit = px * (1 - ex.feeRate); open.ret = open.exit / open.entry - 1; open.open = false; trades.push(open); open = null; }
    }
    if (qty > 0) invested++;
    equity.push(cash + qty * bar.c);
    times.push(bar.t);
  }
  if (open) {
    const last = c[c.length - 1];
    open.exitT = last.t; open.exit = last.c; open.ret = last.c / open.entry - 1; trades.push(open); // position encore ouverte, valorisée sans frais de sortie
  }
  return { equity, times, trades, metrics: metrics(equity, trades, invested, costs / capital) };
}

export function metrics(equity: number[], trades: Trade[], investedDays: number, costs: number): Metrics {
  const days = equity.length;
  const rets = equity.slice(1).map((v, i) => v / equity[i] - 1);
  const total = equity[days - 1] / equity[0] - 1;
  const years = days / DAYS_PER_YEAR;
  const vol = stdev(rets) * Math.sqrt(DAYS_PER_YEAR);
  const closed = trades.filter((t) => !t.open);
  const wins = closed.filter((t) => t.ret > 0), losses = closed.filter((t) => t.ret <= 0);
  return {
    totalReturn: total,
    cagr: years > 0 ? (1 + total) ** (1 / years) - 1 : NaN,
    volAnn: vol,
    sharpe: vol > 0 ? (mean(rets) * DAYS_PER_YEAR) / vol : NaN,
    maxDrawdown: drawdown(equity).maxDrawdown,
    trades: closed.length,
    winRate: closed.length ? wins.length / closed.length : NaN,
    payoff: wins.length && losses.length ? mean(wins.map((t) => t.ret)) / Math.abs(mean(losses.map((t) => t.ret))) : NaN,
    exposure: days ? investedDays / days : 0,
    costs,
    days,
  };
}

/** Découpage chronologique train / validation / test (aucun mélange). */
export function chronoSplit<T>(xs: T[], train = 0.6, valid = 0.2) {
  const a = Math.floor(xs.length * train), b = Math.floor(xs.length * (train + valid));
  return { train: [0, a] as const, valid: [a, b] as const, test: [b, xs.length] as const };
}

export interface ProtocolResult {
  strategy: StrategyId;
  configsTested: number;
  grid: { params: Record<string, number>; trainSharpe: number; trainReturn: number }[];
  chosen: Record<string, number>;
  segments: { name: 'train' | 'validation' | 'test'; from: number; to: number; strategy: Metrics; benchmark: Metrics }[];
  warnings: string[];
}

/**
 * Protocole : (1) chaque configuration est évaluée sur la période d'entraînement ;
 * (2) la meilleure (Sharpe) est retenue ; (3) elle est évaluée UNE fois sur
 * validation et test. Les indicateurs sont calculés sur l'historique complet
 * précédant chaque date (pas de réinitialisation qui fausserait les moyennes),
 * mais l'exécution et la mesure se limitent à chaque segment.
 */
export function protocol(c: Candle[], id: StrategyId, ex: ExecutionModel): ProtocolResult {
  const sp = chronoSplit(c);
  const evalSeg = (sig: number[], [a, b]: readonly [number, number]) => {
    // le signal de la veille du segment est remis à 0 : on démarre en liquidités
    const seg = c.slice(a, b);
    const tg = sig.slice(a, b);
    return run(seg, tg, ex).metrics;
  };
  const bh = signals('buy_hold', c, {});
  const grid = STRATEGIES[id].grid.map((params) => {
    const m = evalSeg(signals(id, c, params), sp.train);
    return { params, trainSharpe: m.sharpe, trainReturn: m.totalReturn };
  });
  const best = [...grid].sort((a, b) => (Number.isFinite(b.trainSharpe) ? b.trainSharpe : -99) - (Number.isFinite(a.trainSharpe) ? a.trainSharpe : -99))[0];
  const sig = signals(id, c, best.params);
  const segments = (['train', 'validation', 'test'] as const).map((name) => {
    const r = name === 'train' ? sp.train : name === 'validation' ? sp.valid : sp.test;
    return { name, from: c[r[0]].t, to: c[r[1] - 1].t, strategy: evalSeg(sig, r), benchmark: evalSeg(bh, r) };
  });
  const warnings = [
    `${grid.length} configuration(s) testée(s) : plus on en teste, plus le meilleur résultat d'entraînement est flatteur par hasard (surapprentissage).`,
    `Période de test : ${segments[2].strategy.days} jours seulement. Échantillon trop court pour une conclusion statistique.`,
    'Biais du survivant : BTC et ETH ont été choisis parce qu\'ils existent et sont liquides aujourd\'hui.',
    'Données d\'une seule plateforme (Coinbase), bougies journalières : le glissement intrajournalier réel peut être plus élevé.',
  ];
  if (segments[2].strategy.trades < 5) warnings.push(`Seulement ${segments[2].strategy.trades} opération(s) clôturée(s) sur la période de test : taux de réussite et ratio gains/pertes non significatifs.`);
  return { strategy: id, configsTested: grid.length, grid, chosen: best.params, segments, warnings };
}
