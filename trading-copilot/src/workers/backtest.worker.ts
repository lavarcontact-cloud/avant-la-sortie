// Calcul du protocole de backtest hors du fil principal (l'interface reste fluide).
import { protocol, run, signals, chronoSplit, type StrategyId } from '../engine/backtest';
import type { Candle, ExecutionModel } from '../engine/types';

export interface BacktestRequest { id: number; candles: Candle[]; strategy: StrategyId; execution: ExecutionModel }

self.onmessage = (e: MessageEvent<BacktestRequest>) => {
  const { id, candles, strategy, execution } = e.data;
  const t0 = performance.now();
  try {
    const proto = protocol(candles, strategy, execution);
    // Courbes sur la période de test uniquement (paramètres figés sur l'entraînement).
    const sp = chronoSplit(candles);
    const seg = candles.slice(sp.test[0], sp.test[1]);
    const strat = run(seg, signals(strategy, candles, proto.chosen).slice(sp.test[0], sp.test[1]), execution);
    const bench = run(seg, signals('buy_hold', candles, {}).slice(sp.test[0], sp.test[1]), execution);
    self.postMessage({ id, ok: true, proto, curves: { times: strat.times, strategy: strat.equity, benchmark: bench.equity }, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};
