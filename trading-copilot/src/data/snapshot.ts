// Données historiques RÉELLES figées (snapshot), avec provenance.
// Utilisées en repli quand le temps réel est indisponible, pour le mode
// « replay » et pour le backtest.

import btc from './snapshot/btc-eur-1d.json';
import eth from './snapshot/eth-eur-1d.json';
import type { AssetId, Candle } from '../engine/types';

export interface Series {
  asset: AssetId;
  candles: Candle[]; // ordre chronologique, bougies CLÔTURÉES uniquement
  partial?: Candle; // séance en cours au moment de la collecte
  source: string;
  fetchedAt: number;
  kind: 'snapshot' | 'live';
}

type Raw = { source: string; fetchedAt: string; candles: number[][] };

/** Convertit le format Coinbase [t, low, high, open, close, volume] (récent d'abord). */
export function fromCoinbase(rows: number[][]): Candle[] {
  return rows
    .map(([t, l, h, o, c, v]) => ({ t: t * 1000, o, h, l, c, v }))
    .sort((a, b) => a.t - b.t);
}

const DAY = 86_400_000;

export function splitClosed(candles: Candle[], fetchedAt: number) {
  const last = candles[candles.length - 1];
  if (last && last.t + DAY > fetchedAt) return { closed: candles.slice(0, -1), partial: last };
  return { closed: candles, partial: undefined };
}

function build(asset: AssetId, raw: Raw): Series {
  const fetchedAt = Date.parse(raw.fetchedAt);
  const { closed, partial } = splitClosed(fromCoinbase(raw.candles), fetchedAt);
  return { asset, candles: closed, partial, source: 'Coinbase Exchange (snapshot)', fetchedAt, kind: 'snapshot' };
}

export const SNAPSHOT: Record<AssetId, Series> = {
  BTC: build('BTC', btc as Raw),
  ETH: build('ETH', eth as Raw),
};
