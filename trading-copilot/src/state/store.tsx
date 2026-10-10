// État applicatif : relie les données de marché, le moteur et la persistance.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AssetId, Candle, LedgerEvent, LedgerState, Quote } from '../engine/types';
import { ASSETS } from '../engine/types';
import { matchLimitsOnCandle, matchLimitsOnQuote, replay, submitOrder, valuate, type Marks, type OrderDraft } from '../engine/ledger';
import { detect, detectCorrelation, detectInvalidation, detectSpread, rankAlerts, type RadarAlert, type Scenario } from '../engine/radar';
import { SNAPSHOT, type Series } from '../data/snapshot';
import { freshness, loadDaily, startTicker, type FeedState } from '../data/live';
import { load, save, wipe, defaults, type Persisted, type ReplayBook } from './persist';
import { EXERCISES, exerciseRange } from './exercises';
import type { DataStatus } from '../copilot/copilot';

export type Mode = 'live' | 'replay';

interface Market {
  series: Record<AssetId, Series>;
  loading: boolean;
  loadErrors: string[];
  quotes: Partial<Record<AssetId, Quote>>;
  feed: FeedState;
  feedDetail?: string;
}

interface Ctx {
  p: Persisted;
  update: (fn: (p: Persisted) => Persisted) => void;
  notice?: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  now: number;
  market: Market;
  // vue active (temps réel ou replay)
  view: {
    series: Record<AssetId, Series>; // bougies visibles (tronquées en replay)
    quotes: Partial<Record<AssetId, Quote>>;
    marks: Marks;
    status: DataStatus;
    ledger: LedgerState;
    events: LedgerEvent[];
    equity: { t: number; v: number; fees: number; btc?: number }[];
    peak: number;
    alerts: RadarAlert[];
    canTrade: boolean;
    tradeBlock?: string;
  };
  place: (d: OrderDraft) => { ok: true } | { ok: false; errors: string[] };
  cancel: (orderId: string) => void;
  advance: (days?: number) => void;
  startExercise: (id: string) => void;
  resetLive: (capital: number) => void;
  addScenario: (s: Omit<Scenario, 'id' | 'createdAt'>) => void;
  removeScenario: (id: string) => void;
  wipeAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp hors du fournisseur');
  return c;
};

const DAY = 86_400_000;

function sliceSeries(all: Record<AssetId, Series>, cursor: number): Record<AssetId, Series> {
  const out = {} as Record<AssetId, Series>;
  for (const a of ASSETS) out[a] = { ...all[a], candles: all[a].candles.slice(0, cursor), partial: undefined };
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [{ state: initial, notice }] = useState(() => load(Date.now()));
  const [p, setP] = useState<Persisted>(initial);
  const [mode, setMode] = useState<Mode>(initial.replay ? 'replay' : 'live');
  const [now, setNow] = useState(Date.now());
  const [market, setMarket] = useState<Market>({ series: SNAPSHOT, loading: true, loadErrors: [], quotes: {}, feed: 'connecting' });
  const pRef = useRef(p);
  pRef.current = p;

  const update = useCallback((fn: (p: Persisted) => Persisted) => setP((prev) => fn(prev)), []);
  useEffect(() => { save(p); }, [p]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Chargement de l'historique puis flux temps réel.
  useEffect(() => {
    let alive = true;
    loadDaily().then((r) => alive && setMarket((m) => ({ ...m, series: r.series, loading: false, loadErrors: r.errors })));
    const stop = startTicker(
      (q) => setMarket((m) => ({ ...m, quotes: { ...m.quotes, [q.asset]: q } })),
      (feed, feedDetail) => setMarket((m) => ({ ...m, feed, feedDetail })),
    );
    return () => { alive = false; stop(); };
  }, []);

  // Exécution des ordres limite en temps réel.
  // Le calcul se fait dans la fonction de mise à jour pour ne jamais exécuter deux fois le même ordre.
  useEffect(() => {
    if (!replay(pRef.current.live.events).openOrders.length) return;
    update((x) => {
      const s = replay(x.live.events);
      const fills = Object.values(market.quotes).flatMap((q) => (q ? matchLimitsOnQuote(s, q) : []));
      return fills.length ? { ...x, live: { ...x.live, events: [...x.live.events, ...fills] } } : x;
    });
  }, [market.quotes, update]);

  const liveLedger = useMemo(() => replay(p.live.events), [p.live.events]);
  const replayLedger = useMemo(() => (p.replay ? replay(p.replay.events) : null), [p.replay]);

  const view = useMemo(() => {
    if (mode === 'replay' && p.replay && replayLedger) {
      const rb = p.replay;
      const series = sliceSeries(SNAPSHOT, rb.cursor);
      const quotes: Partial<Record<AssetId, Quote>> = {};
      const marks: Marks = {};
      for (const a of ASSETS) {
        const bar = SNAPSHOT[a].candles[rb.cursor];
        if (bar) { quotes[a] = { asset: a, last: bar.o, at: bar.t, source: 'Replay historique (Coinbase, ouverture de séance)' }; marks[a] = bar.o; }
      }
      const done = rb.cursor > rb.endIdx;
      const at = SNAPSHOT.BTC.candles[Math.min(rb.cursor, SNAPSHOT.BTC.candles.length - 1)].t;
      const status: DataStatus = { kind: 'snapshot', freshness: 'fresh', at, source: 'Replay historique' };
      const alerts = computeAlerts(series, p.scenarios, quotes, 'Replay Coinbase');
      const peak = Math.max(replayLedger.initialCapital, ...rb.equity.map((e) => e.v));
      return { series, quotes, marks, status, ledger: replayLedger, events: rb.events, equity: rb.equity, peak, alerts, canTrade: !done, tradeBlock: done ? 'Exercice terminé : consulte ton bilan.' : undefined };
    }
    const series = market.series;
    const quotes = market.quotes;
    const marks: Marks = {};
    let latest = 0;
    for (const a of ASSETS) {
      const q = quotes[a];
      if (q) { marks[a] = q.last; latest = Math.max(latest, q.at); }
      else { const c = series[a].partial ?? series[a].candles.at(-1); if (c) marks[a] = c.c; }
    }
    const isLive = latest > 0;
    const fr = isLive ? freshness(latest, now) : 'stale';
    const status: DataStatus = isLive
      ? { kind: 'live', freshness: fr, at: latest, source: 'Coinbase Exchange (WebSocket)' }
      : { kind: series.BTC.kind === 'live' ? 'live' : 'snapshot', freshness: 'stale', at: series.BTC.fetchedAt, source: series.BTC.source };
    const alerts = computeAlerts(series, p.scenarios, quotes, series.BTC.source);
    const peak = Math.max(liveLedger.initialCapital, ...p.live.equity.map((e) => e.v));
    const canTrade = isLive && fr !== 'stale';
    return {
      series, quotes, marks, status, ledger: liveLedger, events: p.live.events, equity: p.live.equity, peak, alerts, canTrade,
      tradeBlock: canTrade ? undefined : 'Cotations temps réel indisponibles : les ordres sont bloqués pour ne pas s\'exécuter sur un prix périmé. Le mode Replay historique reste disponible.',
    };
  }, [mode, p.replay, p.live, p.scenarios, replayLedger, liveLedger, market.series, market.quotes, now]);

  // Historique de capital en temps réel : au plus un point par minute.
  useEffect(() => {
    if (mode !== 'live' || !view.canTrade) return;
    const v = valuate(liveLedger, view.marks);
    const last = p.live.equity.at(-1);
    if (last && now - last.t < 60_000) return;
    update((x) => ({ ...x, live: { ...x.live, equity: [...x.live.equity.slice(-2000), { t: now, v: v.equity, fees: liveLedger.feesPaid, btc: view.marks.BTC }] } }));
  }, [mode, view.canTrade, view.marks, liveLedger, now, p.live.equity, update]);

  const place = useCallback((d: OrderDraft) => {
    if (!view.canTrade) return { ok: false as const, errors: [view.tradeBlock ?? 'Ordres indisponibles.'] };
    const q = view.quotes[d.asset];
    const at = mode === 'replay' ? (q?.at ?? Date.now()) : Date.now();
    const r = submitOrder(view.ledger, d, q, at);
    if (!r.ok) return r;
    update((x) => {
      if (mode === 'replay' && x.replay) return { ...x, replay: { ...x.replay, events: [...x.replay.events, ...r.events] } };
      return { ...x, live: { ...x.live, events: [...x.live.events, ...r.events] } };
    });
    return { ok: true as const };
  }, [view, mode, update]);

  const cancel = useCallback((orderId: string) => {
    const at = mode === 'replay' ? (view.status.at) : Date.now();
    const ev: LedgerEvent = { kind: 'cancel', at, orderId, reason: 'annulé par l\'utilisateur' };
    update((x) => (mode === 'replay' && x.replay ? { ...x, replay: { ...x.replay, events: [...x.replay.events, ev] } } : { ...x, live: { ...x.live, events: [...x.live.events, ev] } }));
  }, [mode, view.status.at, update]);

  const advance = useCallback((days = 1) => {
    update((x) => {
      if (!x.replay) return x;
      let rb: ReplayBook = x.replay;
      for (let k = 0; k < days && rb.cursor <= rb.endIdx; k++) {
        const i = rb.cursor;
        let s = replay(rb.events);
        const fills: LedgerEvent[] = [];
        for (const a of ASSETS) {
          const bar: Candle | undefined = SNAPSHOT[a].candles[i];
          if (bar) fills.push(...matchLimitsOnCandle(s, a, bar, 'Replay historique (Coinbase)'));
        }
        const events = [...rb.events, ...fills];
        s = replay(events);
        const marks: Marks = Object.fromEntries(ASSETS.map((a) => [a, SNAPSHOT[a].candles[i].c]));
        const eq = valuate(s, marks).equity;
        rb = { ...rb, events, cursor: i + 1, equity: [...rb.equity, { t: SNAPSHOT.BTC.candles[i].t + DAY, v: eq, fees: s.feesPaid, btc: SNAPSHOT.BTC.candles[i].c }] };
      }
      return { ...x, replay: rb };
    });
  }, [update]);

  const startExercise = useCallback((id: string) => {
    const ex = EXERCISES.find((e) => e.id === id)!;
    const { startIdx, endIdx } = exerciseRange(ex, SNAPSHOT.BTC.candles);
    const t0 = SNAPSHOT.BTC.candles[startIdx].t;
    update((x) => ({
      ...x,
      replay: {
        exerciseId: id, startIdx, endIdx, cursor: startIdx,
        events: [{ kind: 'init', at: t0, capital: 10_000, label: ex.title, execution: { ...x.execution } }],
        equity: [{ t: t0, v: 10_000, fees: 0, btc: SNAPSHOT.BTC.candles[startIdx].o }],
      },
    }));
    setMode('replay');
  }, [update]);

  const resetLive = useCallback((capital: number) => {
    update((x) => ({ ...x, live: { events: [{ kind: 'init', at: Date.now(), capital, label: 'Simulation temps réel', execution: { ...x.execution } }], equity: [] } }));
  }, [update]);

  const addScenario = useCallback((s: Omit<Scenario, 'id' | 'createdAt'>) => {
    const createdAt = mode === 'replay' ? view.status.at : Date.now();
    update((x) => ({ ...x, scenarios: [...x.scenarios, { ...s, id: `${createdAt.toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt }] }));
  }, [mode, view.status.at, update]);

  const removeScenario = useCallback((id: string) => update((x) => ({ ...x, scenarios: x.scenarios.filter((s) => s.id !== id) })), [update]);

  const wipeAll = useCallback(() => { wipe(); setP(defaults(Date.now())); setMode('live'); }, []);

  const value: Ctx = { p, update, notice, mode, setMode, now, market, view, place, cancel, advance, startExercise, resetLive, addScenario, removeScenario, wipeAll };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

function computeAlerts(series: Record<AssetId, Series>, scenarios: Scenario[], quotes: Partial<Record<AssetId, Quote>>, source: string): RadarAlert[] {
  const out: RadarAlert[] = [];
  for (const a of ASSETS) out.push(...detect(a, series[a].candles, source));
  out.push(...detectCorrelation('BTC', series.BTC.candles, 'ETH', series.ETH.candles, source));
  for (const q of Object.values(quotes)) if (q) out.push(...detectSpread(q));
  for (const sc of scenarios) {
    const al = detectInvalidation(sc, series[sc.asset].candles, source);
    if (al) out.push(al);
  }
  return rankAlerts(out);
}
