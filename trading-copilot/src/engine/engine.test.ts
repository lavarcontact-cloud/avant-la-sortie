import { describe, expect, it } from 'vitest';
import { applyEvent, emptyState, matchLimitsOnCandle, matchLimitsOnQuote, replay, submitOrder, valuate, availableCash, availableQty } from './ledger';
import type { Candle, LedgerEvent, Quote } from './types';
import { DEFAULT_EXECUTION, DEFAULT_LIMITS } from './types';
import { positionSize, drawdown, shock, checkLimits, historicalVaR, exposure, gapRisk } from './risk';
import { sma, ema, rsi, atr, donchian, correlation, realizedVol } from './indicators';
import { detect, detectInvalidation, rankAlerts, detectSpread } from './radar';
import { run, signals, protocol, chronoSplit } from './backtest';
import { analyzeGoal } from './goal';
import { debrief } from './debrief';
import { SNAPSHOT, fromCoinbase, splitClosed } from '../data/snapshot';

const T0 = Date.UTC(2026, 0, 1);
const ex = { feeRate: 0.01, spreadBps: 0, slippageBps: 0 };
const init = (capital = 10_000, e = ex): LedgerEvent => ({ kind: 'init', at: T0, capital, label: 'test', execution: e });
const q = (last: number, at = T0, extra: Partial<Quote> = {}): Quote => ({ asset: 'BTC', last, at, source: 'test', ...extra });

function apply(evs: LedgerEvent[]) { return replay(evs); }
function submit(events: LedgerEvent[], d: Parameters<typeof submitOrder>[1], quote: Quote, now = T0) {
  const r = submitOrder(replay(events), d, quote, now);
  if (!r.ok) throw new Error(r.errors.join(' | '));
  return [...events, ...r.events];
}

describe('registre de simulation', () => {
  it('achat au marché : liquidités, prix moyen, frais', () => {
    const evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    const s = apply(evs);
    expect(s.cash).toBeCloseTo(10_000 - 5_000 - 50, 6);
    expect(s.positions.BTC.qty).toBe(0.1);
    expect(s.positions.BTC.avgPrice).toBe(50_000);
    expect(s.feesPaid).toBeCloseTo(50, 6);
  });

  it('prix moyen pondéré sur deux achats', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.05 }, q(40_000));
    evs = submit(evs, { asset: 'BTC', side: 'buy', type: 'market', qty: 0.05 }, q(60_000));
    expect(apply(evs).positions.BTC.avgPrice).toBeCloseTo(50_000, 6);
  });

  it('vente partielle : P&L réalisé brut, frais au prorata, P&L net', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    evs = submit(evs, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.04 }, q(60_000));
    const s = apply(evs);
    expect(s.realizedGross).toBeCloseTo(400, 6);
    const tr = s.closedTrades[0];
    expect(tr.fees).toBeCloseTo(50 * 0.4 + 24, 6);
    expect(tr.netPnl).toBeCloseTo(400 - 20 - 24, 6);
    expect(s.positions.BTC.qty).toBeCloseTo(0.06, 10);
  });

  it('identité comptable : capital = initial + réalisé brut + latent - frais', () => {
    let evs = submit([init(10_000, DEFAULT_EXECUTION)], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.07 }, q(51_234.5, T0, { bid: 51_230, ask: 51_240 }));
    evs = submit(evs, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.03 }, q(53_000, T0, { bid: 52_990, ask: 53_010 }));
    const s = apply(evs);
    const v = valuate(s, { BTC: 52_000 });
    expect(v.equity).toBeCloseTo(s.initialCapital + s.realizedGross + v.unrealized - s.feesPaid, 6);
    expect(v.netPnl).toBeCloseTo(v.realizedGross + v.unrealized - v.feesPaid, 6);
  });

  it('spread et glissement sont appliqués et tracés', () => {
    const e = { feeRate: 0, spreadBps: 20, slippageBps: 10 };
    const evs = submit([init(10_000, e)], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    const f = apply(evs).fills[0];
    expect(f.price).toBeCloseTo(50_000 * 1.001 * 1.001, 6);
    expect(f.implicitCost).toBeCloseTo((f.price - 50_000) * 0.1, 4);
  });

  it('refuse : liquidités insuffisantes, vente à découvert, cotation périmée, quantité invalide', () => {
    const s = apply([init(1_000)]);
    const r1 = submitOrder(s, { asset: 'BTC', side: 'buy', type: 'market', qty: 1 }, q(50_000), T0);
    expect(r1.ok).toBe(false);
    const r2 = submitOrder(s, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.01 }, q(50_000), T0);
    expect(r2.ok).toBe(false);
    const r3 = submitOrder(s, { asset: 'BTC', side: 'buy', type: 'market', qty: 0.001 }, q(50_000, T0 - 60_000), T0);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.errors[0]).toMatch(/trop ancienne/);
    for (const bad of [0, -1, NaN, Infinity]) expect(submitOrder(s, { asset: 'BTC', side: 'buy', type: 'market', qty: bad }, q(50_000), T0).ok).toBe(false);
    expect(submitOrder(s, { asset: 'BTC', side: 'buy', type: 'market', qty: 0.001 }, undefined, T0).ok).toBe(false);
  });

  it('ordre limite : réservation, exécution sur bougie suivante, libération', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'limit', qty: 0.1, limitPrice: 45_000 }, q(50_000));
    let s = apply(evs);
    expect(s.reservedCash).toBeCloseTo(0.1 * 45_000 * 1.01, 6);
    expect(availableCash(s)).toBeCloseTo(10_000 - 4_545, 6);
    // bougie qui ne touche pas la limite
    expect(matchLimitsOnCandle(s, 'BTC', { t: T0 + 1, o: 49_000, h: 50_000, l: 46_000, c: 47_000, v: 1 }, 't')).toHaveLength(0);
    // ouverture en gap sous la limite : exécution au prix d'ouverture (meilleur)
    const fills = matchLimitsOnCandle(s, 'BTC', { t: T0 + 2, o: 44_000, h: 46_000, l: 43_000, c: 45_500, v: 1 }, 't');
    expect(fills).toHaveLength(1);
    evs = [...evs, ...fills];
    s = apply(evs);
    expect(s.reservedCash).toBeCloseTo(0, 9);
    expect(s.positions.BTC.avgPrice).toBe(44_000);
    expect(s.openOrders).toHaveLength(0);
  });

  it('ordre limite de vente : quantité bloquée, annulation', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    evs = submit(evs, { asset: 'BTC', side: 'sell', type: 'limit', qty: 0.1, limitPrice: 60_000 }, q(50_000));
    let s = apply(evs);
    expect(availableQty(s, 'BTC')).toBe(0);
    expect(submitOrder(s, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.01 }, q(50_000), T0).ok).toBe(false);
    s = applyEvent(s, { kind: 'cancel', at: T0, orderId: s.openOrders[0].id, reason: 'test' });
    expect(availableQty(s, 'BTC')).toBe(0.1);
  });

  it('ordre limite contre cotation temps réel', () => {
    const evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'limit', qty: 0.1, limitPrice: 45_000 }, q(50_000));
    const s = apply(evs);
    expect(matchLimitsOnQuote(s, q(45_100, T0, { bid: 45_090, ask: 45_100 }))).toHaveLength(0);
    const f = matchLimitsOnQuote(s, q(44_990, T0, { bid: 44_980, ask: 44_990 }));
    expect(f).toHaveLength(1);
    expect(f[0].kind === 'fill' && f[0].fill.price).toBe(44_990);
  });

  it('le rejeu du journal est déterministe', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    evs = submit(evs, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.1 }, q(51_000));
    expect(JSON.stringify(replay(evs))).toBe(JSON.stringify(replay(JSON.parse(JSON.stringify(evs)))));
  });

  it('état vide', () => { expect(emptyState().cash).toBe(0); });
});

describe('risque', () => {
  it('taille de position : la perte au stop, frais inclus, égale le risque choisi', () => {
    const r = positionSize({ equity: 10_000, riskPct: 0.01, entry: 50_000, stop: 47_500, feeRate: 0.006 });
    const loss = r.qty * (50_000 - 47_500) + 0.006 * r.qty * (50_000 + 47_500);
    expect(loss).toBeLessThanOrEqual(100 + 1e-6);
    expect(loss).toBeGreaterThan(99.9);
  });
  it('taille de position plafonnée par les liquidités ; stop invalide refusé', () => {
    const r = positionSize({ equity: 10_000, riskPct: 0.05, entry: 50_000, stop: 49_900, feeRate: 0, maxCash: 1_000 });
    expect(r.capped).toBe(true);
    expect(r.qty * 50_000).toBeLessThanOrEqual(1_000);
    expect(positionSize({ equity: 1, riskPct: 0.01, entry: 10, stop: 11, feeRate: 0 }).qty).toBe(0);
  });
  it('risque de gap supérieur au risque nominal', () => {
    expect(gapRisk(1, 100, 90, 0.05, 0)).toBeCloseTo(100 - 85.5, 6);
  });
  it('drawdown', () => {
    const d = drawdown([100, 120, 90, 130, 117]);
    expect(d.maxDrawdown).toBeCloseTo(-0.25, 9);
    expect(d.current).toBeCloseTo(-0.1, 9);
  });
  it('stress test et exposition', () => {
    const s = replay(submit([init(10_000)], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000)));
    const sh = shock(s, { BTC: 50_000 }, { BTC: -0.05 });
    expect(sh.delta).toBeCloseTo(-250, 6);
    const e = exposure(s, { BTC: 50_000 });
    expect(e.byAsset[0].weight + e.cashWeight).toBeCloseTo(1, 9);
  });
  it('limites : concentration, absence de stop, risque par opération', () => {
    const s = apply([init(10_000)]);
    const c = checkLimits(s, { asset: 'BTC', side: 'buy', type: 'market', qty: 0.15 }, 50_000, {}, DEFAULT_LIMITS, 10_000);
    expect(c.map((x) => x.rule).sort()).toEqual(['maxPositionPct', 'requireStop']);
    const c2 = checkLimits(s, { asset: 'BTC', side: 'buy', type: 'market', qty: 0.05, stopPrice: 40_000 }, 50_000, {}, DEFAULT_LIMITS, 10_000);
    expect(c2.map((x) => x.rule)).toEqual(['maxRiskPerTradePct']);
  });
  it('VaR historique : refuse un échantillon trop court', () => {
    expect(historicalVaR([0.01, -0.02]).insufficient).toBe(true);
    const r = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
    expect(historicalVaR(r, 0.95).var).toBeCloseTo(0.04505, 4);
  });
});

describe('indicateurs', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('SMA / EMA', () => {
    expect(sma(xs, 3)[2]).toBe(2);
    expect(sma(xs, 3)[9]).toBe(9);
    expect(Number.isNaN(sma(xs, 3)[1])).toBe(true);
    expect(ema(xs, 3)[2]).toBe(2);
    expect(ema(xs, 3)[3]).toBe(3);
  });
  it('RSI borné, 100 en hausse continue', () => {
    expect(rsi(xs, 5)[9]).toBe(100);
    const r = rsi(SNAPSHOT.BTC.candles.map((c) => c.c));
    r.filter(Number.isFinite).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); });
  });
  it('ATR, Donchian (exclut la séance courante), corrélation', () => {
    const c: Candle[] = xs.map((x, i) => ({ t: i, o: x, h: x + 1, l: x - 1, c: x, v: 1 }));
    expect(atr(c, 3)[9]).toBeGreaterThan(0);
    expect(donchian(c, 3).upper[5]).toBe(6); // max des H d'index 2..4 = 5+1
    expect(correlation(xs, xs.map((x) => 2 * x + 1))).toBeCloseTo(1, 9);
    expect(correlation(xs, xs.map((x) => -x))).toBeCloseTo(-1, 9);
  });
  it('pas de regard vers le futur : modifier le futur ne change pas le passé', () => {
    const c = SNAPSHOT.BTC.candles;
    const mutated = c.map((b, i) => (i > 200 ? { ...b, c: b.c * 3, h: b.h * 3 } : b));
    const a = sma(c.map((x) => x.c), 20).slice(0, 201), b = sma(mutated.map((x) => x.c), 20).slice(0, 201);
    expect(a).toEqual(b);
    expect(signals('donchian', c, { entry: 20, exit: 10 }).slice(0, 201)).toEqual(signals('donchian', mutated, { entry: 20, exit: 10 }).slice(0, 201));
    expect(realizedVol(c.map((x) => x.c), 30, 150)).toBe(realizedVol(mutated.map((x) => x.c), 30, 150));
  });
});

describe('données snapshot', () => {
  it('provenance, ordre chronologique, bougie partielle exclue', () => {
    const s = SNAPSHOT.BTC;
    expect(s.source).toMatch(/Coinbase/);
    expect(s.candles.length).toBe(349);
    expect(s.partial).toBeDefined();
    for (let i = 1; i < s.candles.length; i++) expect(s.candles[i].t - s.candles[i - 1].t).toBe(86_400_000);
  });
  it('conversion Coinbase', () => {
    const c = fromCoinbase([[2, 1, 4, 2, 3, 10], [1, 1, 2, 1, 2, 5]]);
    expect(c[0]).toEqual({ t: 1000, o: 1, h: 2, l: 1, c: 2, v: 5 });
    expect(splitClosed(c, 2000 + 1).partial?.t).toBe(2000);
  });
});

describe('radar', () => {
  it('détecte un mouvement extrême et explique la règle', () => {
    const base: Candle[] = Array.from({ length: 40 }, (_, i) => ({ t: i * 86_400_000, o: 100, h: 101 + (i % 2), l: 99, c: 100 + (i % 2) * 0.5, v: 10 }));
    base.push({ t: 40 * 86_400_000, o: 100, h: 115, l: 99, c: 112, v: 50 });
    const a = detect('BTC', base, 'test');
    const kinds = a.map((x) => x.kind);
    expect(kinds).toContain('move');
    expect(kinds).toContain('volume');
    expect(kinds).toContain('breakout');
    a.forEach((x) => { expect(x.rule.length).toBeGreaterThan(5); expect(x.dataAt).toBe(40 * 86_400_000); });
  });
  it('ne déclenche rien sur une série calme', () => {
    const calm: Candle[] = Array.from({ length: 60 }, (_, i) => ({ t: i, o: 100, h: 100.5, l: 99.5, c: 100 + Math.sin(i) * 0.1, v: 10 }));
    expect(detect('BTC', calm, 't').filter((x) => x.kind === 'move' || x.kind === 'volume')).toHaveLength(0);
  });
  it('invalidation de scénario', () => {
    const c: Candle[] = [{ t: 10, o: 1, h: 1, l: 1, c: 105, v: 1 }, { t: 20, o: 1, h: 1, l: 1, c: 95, v: 1 }];
    const al = detectInvalidation({ id: 's', asset: 'BTC', label: 'test', bias: 'haussier', invalidation: 100, createdAt: 5 }, c, 't');
    expect(al?.metrics.close).toBe(95);
    expect(detectInvalidation({ id: 's', asset: 'BTC', label: 'test', bias: 'haussier', invalidation: 90, createdAt: 5 }, c, 't')).toBeNull();
  });
  it('spread temps réel et tri par sévérité', () => {
    expect(detectSpread(q(100, 0, { bid: 99.8, ask: 100.2 }))).toHaveLength(1);
    expect(detectSpread(q(100, 0, { bid: 99.99, ask: 100.01 }))).toHaveLength(0);
    const r = rankAlerts([{ severity: 'info', dataAt: 2 }, { severity: 'important', dataAt: 1 }] as never);
    expect(r[0].severity).toBe('important');
  });
});

describe('backtest', () => {
  const c = SNAPSHOT.BTC.candles;
  it('achat-conservation sans coûts = rendement de l\'actif d\'ouverture à clôture', () => {
    const r = run(c, signals('buy_hold', c, {}), { feeRate: 0, spreadBps: 0, slippageBps: 0 });
    expect(r.equity[r.equity.length - 1] / 10_000).toBeCloseTo(c[c.length - 1].c / c[1].o, 6);
  });
  it('les coûts réduisent toujours la performance', () => {
    const sig = signals('sma_cross', c, { fast: 10, slow: 30 });
    const free = run(c, sig, { feeRate: 0, spreadBps: 0, slippageBps: 0 }).metrics.totalReturn;
    const paid = run(c, sig, DEFAULT_EXECUTION).metrics.totalReturn;
    expect(paid).toBeLessThan(free);
  });
  it('exécution à l\'ouverture suivante (aucune exécution sur la séance du signal)', () => {
    const tiny: Candle[] = [0, 1, 2].map((i) => ({ t: i, o: 10 + i, h: 11 + i, l: 9 + i, c: 10.5 + i, v: 1e9 }));
    const r = run(tiny, [1, 1, 1], { feeRate: 0, spreadBps: 0, slippageBps: 0 }, 100);
    expect(r.equity[0]).toBe(100);
    expect(r.trades[0].entry).toBe(11);
  });
  it('découpage chronologique sans chevauchement', () => {
    const sp = chronoSplit(Array.from({ length: 100 }));
    expect(sp.train).toEqual([0, 60]);
    expect(sp.valid).toEqual([60, 80]);
    expect(sp.test).toEqual([80, 100]);
  });
  it('protocole complet sur données réelles : segments ordonnés et avertissements', () => {
    const p = protocol(c, 'sma_cross', DEFAULT_EXECUTION);
    expect(p.configsTested).toBe(9);
    expect(p.segments[0].to).toBeLessThan(p.segments[1].from);
    expect(p.segments[1].to).toBeLessThan(p.segments[2].from);
    expect(p.warnings.length).toBeGreaterThanOrEqual(4);
  });
});

describe('objectif', () => {
  it('1 000 € → 100 000 € en 90 jours : hors historique, levier et risque de ruine expliqués', () => {
    const g = analyzeGoal({ capital: 1_000, target: 100_000, days: 90, feeRate: 0.006, tradesPerMonth: 20 }, SNAPSHOT.BTC.candles);
    expect(g.requiredReturn).toBeCloseTo(99, 9);
    expect(g.verdict).toBe('hors_historique');
    expect(g.leverage!.needed).toBeGreaterThan(50);
    expect(g.explanation.join(' ')).toMatch(/perte totale/);
  });
  it('objectif modeste comparé honnêtement', () => {
    const g = analyzeGoal({ capital: 1_000, target: 1_000, days: 90, feeRate: 0.006, tradesPerMonth: 2 }, SNAPSHOT.BTC.candles);
    expect(g.history!.windows).toBe(349 - 90);
    expect(g.history!.shareAtLeastRequired).toBeGreaterThanOrEqual(0);
  });
  it('données insuffisantes', () => {
    expect(analyzeGoal({ capital: 1, target: 2, days: 90, feeRate: 0, tradesPerMonth: 0 }, SNAPSHOT.BTC.candles.slice(0, 50)).verdict).toBe('donnees_insuffisantes');
  });
});

describe('bilan', () => {
  it('signale l\'absence de stop et un échantillon réduit', () => {
    let evs = submit([init()], { asset: 'BTC', side: 'buy', type: 'market', qty: 0.1 }, q(50_000));
    evs = submit(evs, { asset: 'BTC', side: 'sell', type: 'market', qty: 0.1 }, q(49_000));
    const d = debrief(apply(evs), {}, DEFAULT_LIMITS, 10_000);
    const titles = d.map((x) => x.title).join(' | ');
    expect(titles).toMatch(/Aucun stop/);
    expect(titles).toMatch(/Échantillon réduit/);
    expect(d[0].tone).toBe('negative');
  });
});
