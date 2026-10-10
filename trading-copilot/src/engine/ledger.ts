// Registre de simulation (paper trading) à journal d'événements.
// L'état est toujours reconstruit en rejouant les événements : l'historique
// est donc auditable et reproductible à l'identique.

import type {
  AssetId, Candle, ClosedTrade, ExecutionModel, Fill, LedgerEvent, LedgerState,
  Order, Position, Quote,
} from './types';

const QTY_DP = 8;
const EUR_DP = 6;
export const roundTo = (x: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
};
const rq = (x: number) => roundTo(x, QTY_DP);
const re = (x: number) => roundTo(x, EUR_DP);

interface PosInternal extends Position {
  entryFees: number; // frais d'achat non encore imputés à une vente
  openedAt: number;
  stopPrice?: number;
}

export function emptyState(): LedgerState {
  return {
    label: '', initialCapital: 0, execution: { feeRate: 0, spreadBps: 0, slippageBps: 0 },
    cash: 0, reservedCash: 0, positions: {}, openOrders: [], fills: [], closedTrades: [],
    realizedGross: 0, feesPaid: 0, implicitCosts: 0, startedAt: 0,
  };
}

function reserveForBuy(order: Order, feeRate: number) {
  return re(order.qty * (order.limitPrice ?? 0) * (1 + feeRate));
}

export function applyEvent(s: LedgerState, ev: LedgerEvent): LedgerState {
  switch (ev.kind) {
    case 'init':
      return { ...emptyState(), label: ev.label, initialCapital: ev.capital, cash: ev.capital, execution: ev.execution, startedAt: ev.at };
    case 'place': {
      const o = ev.order;
      if (o.type !== 'limit') return s; // les ordres au marché sont exécutés immédiatement (événement fill)
      const next = { ...s, openOrders: [...s.openOrders, o], positions: { ...s.positions } };
      if (o.side === 'buy') next.reservedCash = re(s.reservedCash + reserveForBuy(o, s.execution.feeRate));
      else {
        const p = next.positions[o.asset] as PosInternal;
        next.positions[o.asset] = { ...p, reservedQty: rq(p.reservedQty + o.qty) };
      }
      return next;
    }
    case 'cancel': {
      const o = s.openOrders.find((x) => x.id === ev.orderId);
      if (!o) return s;
      return releaseOrder(s, o);
    }
    case 'fill':
      return applyFill(s, ev.fill);
  }
}

function releaseOrder(s: LedgerState, o: Order): LedgerState {
  const next = { ...s, openOrders: s.openOrders.filter((x) => x.id !== o.id), positions: { ...s.positions } };
  if (o.type === 'limit') {
    if (o.side === 'buy') next.reservedCash = Math.max(0, re(s.reservedCash - reserveForBuy(o, s.execution.feeRate)));
    else {
      const p = next.positions[o.asset];
      if (p) next.positions[o.asset] = { ...p, reservedQty: Math.max(0, rq(p.reservedQty - o.qty)) };
    }
  }
  return next;
}

function applyFill(s0: LedgerState, f: Fill): LedgerState {
  const order = s0.openOrders.find((x) => x.id === f.orderId);
  let s = order ? releaseOrder(s0, order) : { ...s0, positions: { ...s0.positions } };
  s = { ...s, fills: [...s.fills, f], feesPaid: re(s.feesPaid + f.fee), implicitCosts: re(s.implicitCosts + f.implicitCost) };
  const notional = f.qty * f.price;
  const prev = s.positions[f.asset] as PosInternal | undefined;
  if (f.side === 'buy') {
    s.cash = re(s.cash - notional - f.fee);
    const qty0 = prev?.qty ?? 0;
    const qty = rq(qty0 + f.qty);
    const avg = qty0 > 0 ? (qty0 * prev!.avgPrice + notional) / qty : f.price;
    const pos: PosInternal = {
      asset: f.asset, qty, avgPrice: avg, reservedQty: prev?.reservedQty ?? 0,
      entryFees: re((prev?.entryFees ?? 0) + f.fee),
      openedAt: qty0 > 0 ? prev!.openedAt : f.at,
      stopPrice: f.stopPrice ?? order?.stopPrice ?? prev?.stopPrice,
    };
    s.positions[f.asset] = pos;
  } else {
    if (!prev || prev.qty + 1e-12 < f.qty) throw new Error('Vente supérieure à la position détenue');
    s.cash = re(s.cash + notional - f.fee);
    const share = f.qty / prev.qty;
    const entryFeePart = re(prev.entryFees * share);
    const gross = re((f.price - prev.avgPrice) * f.qty);
    s.realizedGross = re(s.realizedGross + gross);
    const trade: ClosedTrade = {
      asset: f.asset, qty: f.qty, entryAvg: prev.avgPrice, exitPrice: f.price, grossPnl: gross,
      fees: re(entryFeePart + f.fee), netPnl: re(gross - entryFeePart - f.fee),
      openedAt: prev.openedAt, closedAt: f.at, stopPrice: prev.stopPrice,
    };
    s.closedTrades = [...s.closedTrades, trade];
    const qty = rq(prev.qty - f.qty);
    if (qty <= 0) delete s.positions[f.asset];
    else s.positions[f.asset] = { ...prev, qty, entryFees: re(prev.entryFees - entryFeePart) } as PosInternal;
  }
  return s;
}

export function replay(events: LedgerEvent[]): LedgerState {
  return events.reduce(applyEvent, emptyState());
}

// ---------- Validation et exécution ----------

export interface OrderDraft {
  asset: AssetId;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  note?: string;
}

export const MAX_QUOTE_AGE_MS = 30_000;
const MAX_NOTIONAL = 10_000_000;

export function availableCash(s: LedgerState) {
  return re(s.cash - s.reservedCash);
}
export function availableQty(s: LedgerState, asset: AssetId) {
  const p = s.positions[asset];
  return p ? rq(p.qty - p.reservedQty) : 0;
}

/** Prix d'exécution estimé d'un ordre au marché et coût implicite associé. */
export function marketFillPrice(side: 'buy' | 'sell', q: Quote, ex: ExecutionModel) {
  const halfSpread = ex.spreadBps / 2 / 1e4;
  const slip = ex.slippageBps / 1e4;
  const ref = side === 'buy' ? (q.ask ?? q.last * (1 + halfSpread)) : (q.bid ?? q.last * (1 - halfSpread));
  const price = side === 'buy' ? ref * (1 + slip) : ref * (1 - slip);
  return { price, implicitPerUnit: Math.abs(price - q.last) };
}

export function estimateOrder(s: LedgerState, d: OrderDraft, q: Quote) {
  const px = d.type === 'limit' && d.limitPrice ? d.limitPrice : marketFillPrice(d.side, q, s.execution).price;
  const notional = d.qty * px;
  const fee = notional * s.execution.feeRate;
  const implicit = d.type === 'market' ? marketFillPrice(d.side, q, s.execution).implicitPerUnit * d.qty : 0;
  return { price: px, notional, fee, implicit, totalCashOut: d.side === 'buy' ? notional + fee : -(notional - fee) };
}

export function validateDraft(s: LedgerState, d: OrderDraft, q: Quote | undefined, now: number): string[] {
  const errs: string[] = [];
  if (!Number.isFinite(d.qty) || d.qty <= 0) errs.push('La quantité doit être un nombre positif.');
  if (Number.isFinite(d.qty) && rq(d.qty) !== d.qty && Math.abs(rq(d.qty) - d.qty) > 1e-12) errs.push('Quantité limitée à 8 décimales.');
  if (d.type === 'limit' && (!Number.isFinite(d.limitPrice) || (d.limitPrice ?? 0) <= 0)) errs.push('Le prix limite doit être un nombre positif.');
  if (d.stopPrice !== undefined && (!Number.isFinite(d.stopPrice) || d.stopPrice <= 0)) errs.push('Le stop doit être un nombre positif.');
  if (!q) { errs.push('Aucune cotation disponible : ordre impossible.'); return errs; }
  if (now - q.at > MAX_QUOTE_AGE_MS && d.type === 'market') errs.push(`Cotation trop ancienne (${Math.round((now - q.at) / 1000)} s) : un ordre au marché exige une donnée de moins de ${MAX_QUOTE_AGE_MS / 1000} s.`);
  if (errs.length) return errs;
  const est = estimateOrder(s, d, q);
  if (est.notional > MAX_NOTIONAL) errs.push('Montant hors limites du simulateur.');
  if (d.side === 'buy') {
    const need = d.type === 'limit' ? d.qty * d.limitPrice! * (1 + s.execution.feeRate) : est.totalCashOut;
    if (need > availableCash(s) + 1e-9) errs.push(`Liquidités disponibles insuffisantes (${availableCash(s).toFixed(2)} € disponibles, ${need.toFixed(2)} € nécessaires frais inclus).`);
    if (d.stopPrice !== undefined && d.stopPrice >= est.price) errs.push('Pour un achat, le stop doit être inférieur au prix d\'entrée.');
  } else if (d.qty > availableQty(s, d.asset) + 1e-12) {
    errs.push(`Quantité disponible insuffisante (${availableQty(s, d.asset)} ${d.asset}). La vente à découvert n'est pas proposée.`);
  }
  return errs;
}

let seq = 0;
export function newId(now: number) {
  seq = (seq + 1) % 1e6;
  return `${now.toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Soumet un ordre. Retourne les événements à ajouter au journal, ou des erreurs.
 * Un ordre au marché est exécuté immédiatement contre la cotation fournie.
 */
export function submitOrder(s: LedgerState, d: OrderDraft, q: Quote | undefined, now: number):
  { ok: true; events: LedgerEvent[] } | { ok: false; errors: string[] } {
  const errors = validateDraft(s, d, q, now);
  if (errors.length) return { ok: false, errors };
  const order: Order = { id: newId(now), asset: d.asset, side: d.side, type: d.type, qty: rq(d.qty), limitPrice: d.limitPrice, stopPrice: d.stopPrice, createdAt: now, note: d.note };
  const events: LedgerEvent[] = [{ kind: 'place', at: now, order }];
  if (d.type === 'market') {
    const { price, implicitPerUnit } = marketFillPrice(d.side, q!, s.execution);
    events.push({ kind: 'fill', at: now, fill: makeFill(order, price, q!.last, implicitPerUnit * order.qty, s.execution, now, q!.source) });
  }
  return { ok: true, events };
}

function makeFill(o: Order, price: number, ref: number, implicit: number, ex: ExecutionModel, at: number, src: string): Fill {
  return {
    orderId: o.id, asset: o.asset, side: o.side, qty: o.qty, price, refPrice: ref,
    fee: re(o.qty * price * ex.feeRate), implicitCost: re(implicit), at, quoteSource: src,
    ...(o.stopPrice !== undefined ? { stopPrice: o.stopPrice } : {}),
  };
}

/** Exécution des ordres limite contre une bougie (mode replay). Pas de regard vers le futur : la bougie fournie est la période qui suit l'ordre. */
export function matchLimitsOnCandle(s: LedgerState, asset: AssetId, bar: Candle, source: string): LedgerEvent[] {
  const out: LedgerEvent[] = [];
  for (const o of s.openOrders) {
    if (o.asset !== asset || o.type !== 'limit' || o.createdAt > bar.t || !o.limitPrice) continue;
    let price: number | undefined;
    if (o.side === 'buy' && bar.l <= o.limitPrice) price = Math.min(o.limitPrice, bar.o);
    if (o.side === 'sell' && bar.h >= o.limitPrice) price = Math.max(o.limitPrice, bar.o);
    if (price !== undefined) out.push({ kind: 'fill', at: bar.t, fill: makeFill(o, price, price, 0, s.execution, bar.t, source) });
  }
  return out;
}

/** Exécution des ordres limite contre une cotation temps réel. */
export function matchLimitsOnQuote(s: LedgerState, q: Quote): LedgerEvent[] {
  const out: LedgerEvent[] = [];
  for (const o of s.openOrders) {
    if (o.asset !== q.asset || o.type !== 'limit' || !o.limitPrice) continue;
    const ask = q.ask ?? q.last, bid = q.bid ?? q.last;
    if (o.side === 'buy' && ask <= o.limitPrice) out.push({ kind: 'fill', at: q.at, fill: makeFill(o, ask, q.last, 0, s.execution, q.at, q.source) });
    if (o.side === 'sell' && bid >= o.limitPrice) out.push({ kind: 'fill', at: q.at, fill: makeFill(o, bid, q.last, 0, s.execution, q.at, q.source) });
  }
  return out;
}

// ---------- Valorisation ----------

export type Marks = Partial<Record<AssetId, number>>;

export interface Valuation {
  equity: number;
  cash: number;
  availableCash: number;
  reservedCash: number;
  positionsValue: number;
  unrealized: number;
  realizedGross: number;
  feesPaid: number;
  implicitCosts: number;
  netPnl: number; // equity - capital initial
  netReturn: number;
  grossPnl: number; // P&L avant frais explicites
  missingMarks: AssetId[];
  lines: { asset: AssetId; qty: number; avgPrice: number; mark: number; value: number; unrealized: number; unrealizedPct: number }[];
}

export function valuate(s: LedgerState, marks: Marks): Valuation {
  let positionsValue = 0, unrealized = 0;
  const missing: AssetId[] = [];
  const lines: Valuation['lines'] = [];
  for (const p of Object.values(s.positions)) {
    const m = marks[p.asset];
    if (m === undefined) { missing.push(p.asset); continue; }
    const value = p.qty * m;
    const u = (m - p.avgPrice) * p.qty;
    positionsValue += value; unrealized += u;
    lines.push({ asset: p.asset, qty: p.qty, avgPrice: p.avgPrice, mark: m, value, unrealized: u, unrealizedPct: m / p.avgPrice - 1 });
  }
  const equity = s.cash + positionsValue;
  const netPnl = equity - s.initialCapital;
  return {
    equity, cash: s.cash, availableCash: availableCash(s), reservedCash: s.reservedCash, positionsValue,
    unrealized, realizedGross: s.realizedGross, feesPaid: s.feesPaid, implicitCosts: s.implicitCosts,
    netPnl, netReturn: s.initialCapital ? netPnl / s.initialCapital : 0, grossPnl: netPnl + s.feesPaid,
    missingMarks: missing, lines,
  };
}
