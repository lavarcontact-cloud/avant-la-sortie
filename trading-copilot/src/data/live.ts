// Données temps réel : Coinbase Exchange (API publique, sans clé).
// - Historique : REST /products/{id}/candles (directement, puis via le proxy /api/candles).
// - Cotations : WebSocket canal « ticker », reconnexion avec backoff exponentiel.
// - Repli : snapshot réel horodaté si tout échoue. Jamais de donnée inventée.

import type { AssetId, Quote } from '../engine/types';
import { fromCoinbase, splitClosed, SNAPSHOT, type Series } from './snapshot';

export const PRODUCT: Record<AssetId, string> = { BTC: 'BTC-EUR', ETH: 'ETH-EUR' };
const ASSET_OF: Record<string, AssetId> = { 'BTC-EUR': 'BTC', 'ETH-EUR': 'ETH' };
const REST = 'https://api.exchange.coinbase.com';
export const WS_URL = 'wss://ws-feed.exchange.coinbase.com';

/** Analyse un message « ticker » Coinbase. Retourne null si le message est incomplet ou incohérent. */
export function parseTicker(msg: unknown): Quote | null {
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'ticker' || typeof m.product_id !== 'string') return null;
  const asset = ASSET_OF[m.product_id];
  const last = Number(m.price), bid = Number(m.best_bid), ask = Number(m.best_ask);
  const at = Date.parse(String(m.time));
  if (!asset || !(last > 0) || !Number.isFinite(at)) return null;
  const q: Quote = { asset, last, at, source: 'Coinbase Exchange (WebSocket)' };
  if (bid > 0 && ask > 0 && ask >= bid) { q.bid = bid; q.ask = ask; }
  return q;
}

async function fetchJson(url: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

export interface LoadResult { series: Record<AssetId, Series>; kind: 'live' | 'snapshot'; errors: string[] }

/** Charge l'historique journalier ; repli sur le snapshot actif par actif. */
export async function loadDaily(): Promise<LoadResult> {
  const errors: string[] = [];
  const out = { ...SNAPSHOT };
  let liveCount = 0;
  await Promise.all((Object.keys(PRODUCT) as AssetId[]).map(async (a) => {
    const p = PRODUCT[a];
    for (const url of [`${REST}/products/${p}/candles?granularity=86400`, `/api/candles?product=${p}&granularity=86400`]) {
      try {
        const body = await fetchJson(url);
        const rows = Array.isArray(body) ? body : (body as { candles?: unknown }).candles;
        if (!Array.isArray(rows) || rows.length < 100) throw new Error('réponse incomplète');
        const now = Date.now();
        const { closed, partial } = splitClosed(fromCoinbase(rows as number[][]), now);
        out[a] = { asset: a, candles: closed, partial, source: url.startsWith('/') ? 'Coinbase Exchange (via proxy)' : 'Coinbase Exchange', fetchedAt: now, kind: 'live' };
        liveCount++;
        return;
      } catch (e) {
        errors.push(`${p} ${url.startsWith('/') ? 'proxy' : 'direct'} : ${(e as Error).message}`);
      }
    }
  }));
  return { series: out, kind: liveCount === 2 ? 'live' : 'snapshot', errors };
}

export type FeedState = 'connecting' | 'open' | 'closed' | 'unavailable';

/** Flux de cotations avec reconnexion. Appelle onQuote au plus toutes les `throttleMs` par actif. */
export function startTicker(onQuote: (q: Quote) => void, onState: (s: FeedState, detail?: string) => void, throttleMs = 250) {
  let ws: WebSocket | null = null;
  let attempts = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lastEmit: Record<string, number> = {};

  const connect = () => {
    if (stopped) return;
    if (typeof WebSocket === 'undefined') { onState('unavailable', 'WebSocket non supporté'); return; }
    onState('connecting');
    try { ws = new WebSocket(WS_URL); } catch (e) { schedule(String(e)); return; }
    ws.onopen = () => {
      attempts = 0;
      ws?.send(JSON.stringify({ type: 'subscribe', product_ids: Object.values(PRODUCT), channels: ['ticker'] }));
      onState('open');
    };
    ws.onmessage = (ev) => {
      let msg: unknown;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      const q = parseTicker(msg);
      if (!q) return;
      const now = Date.now();
      if (now - (lastEmit[q.asset] ?? 0) < throttleMs) return;
      lastEmit[q.asset] = now;
      onQuote(q);
    };
    ws.onerror = () => { /* géré par onclose */ };
    ws.onclose = () => { if (!stopped) schedule('connexion fermée'); };
  };
  const schedule = (why: string) => {
    attempts++;
    if (attempts > 8) { onState('unavailable', `abandon après ${attempts - 1} tentatives (${why})`); return; }
    const delay = Math.min(30_000, 1000 * 2 ** (attempts - 1)) * (0.8 + Math.random() * 0.4);
    onState('closed', `nouvelle tentative dans ${Math.round(delay / 1000)} s`);
    timer = setTimeout(connect, delay);
  };
  connect();
  return () => { stopped = true; clearTimeout(timer); ws?.close(); };
}

/** Fraîcheur d'une donnée temps réel. */
export function freshness(at: number, now: number): 'fresh' | 'delayed' | 'stale' {
  const age = now - at;
  return age < 15_000 ? 'fresh' : age < 120_000 ? 'delayed' : 'stale';
}
