// Indicateurs techniques déterministes. Convention : la valeur à l'index i
// n'utilise que les données d'index <= i (aucun regard vers le futur).
// Valeur NaN tant que la fenêtre n'est pas complète.

import type { Candle } from './types';

export const DAYS_PER_YEAR = 365; // la crypto cote tous les jours

export function sma(xs: number[], n: number): number[] {
  const out = new Array(xs.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= n) sum -= xs[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(xs: number[], n: number): number[] {
  const out = new Array(xs.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = NaN;
  for (let i = 0; i < xs.length; i++) {
    if (i === n - 1) prev = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else if (i >= n) prev = xs[i] * k + prev * (1 - k);
    if (i >= n - 1) out[i] = prev;
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(closes: number[], n = 14): number[] {
  const out = new Array(closes.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) {
      gain += g; loss += l;
      if (i === n) { gain /= n; loss /= n; out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss); }
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

export function trueRange(c: Candle[]): number[] {
  return c.map((b, i) => (i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - c[i - 1].c), Math.abs(b.l - c[i - 1].c))));
}

export function atr(c: Candle[], n = 14): number[] {
  const tr = trueRange(c);
  const out = new Array(c.length).fill(NaN);
  let prev = NaN;
  for (let i = 0; i < c.length; i++) {
    if (i === n - 1) prev = tr.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else if (i >= n) prev = (prev * (n - 1) + tr[i]) / n;
    if (i >= n - 1) out[i] = prev;
  }
  return out;
}

export function logReturns(closes: number[]): number[] {
  return closes.map((c, i) => (i === 0 ? NaN : Math.log(c / closes[i - 1])));
}

export function simpleReturns(closes: number[]): number[] {
  return closes.map((c, i) => (i === 0 ? NaN : c / closes[i - 1] - 1));
}

export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Volatilité réalisée annualisée sur les n derniers rendements log. */
export function realizedVol(closes: number[], n: number, end = closes.length - 1): number {
  const r = logReturns(closes).slice(Math.max(1, end - n + 1), end + 1);
  return r.length < 2 ? NaN : stdev(r) * Math.sqrt(DAYS_PER_YEAR);
}

/** Canal de Donchian : plus haut / plus bas des n périodes PRÉCÉDENTES (exclut la période i). */
export function donchian(c: Candle[], n: number) {
  const upper = new Array(c.length).fill(NaN);
  const lower = new Array(c.length).fill(NaN);
  for (let i = n; i < c.length; i++) {
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n; j < i; j++) { hi = Math.max(hi, c[j].h); lo = Math.min(lo, c[j].l); }
    upper[i] = hi; lower[i] = lo;
  }
  return { upper, lower };
}

export function correlation(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
