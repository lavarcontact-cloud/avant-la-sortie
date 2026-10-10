// Proxy en lecture seule vers l'API publique Coinbase Exchange (bougies).
// Rôle : contourner une éventuelle restriction CORS et mutualiser le cache.
// Paramètres strictement filtrés par liste blanche : aucun relais arbitraire.

import { clientKey, json, log, rateLimit } from './_lib';

const PRODUCTS = new Set(['BTC-EUR', 'ETH-EUR']);
const GRANULARITIES = new Set(['3600', '86400']);
const UPSTREAM = 'https://api.exchange.coinbase.com';

export async function handleCandles(req: Request, fetchImpl: typeof fetch = fetch) {
  const url = new URL(req.url);
  const product = url.searchParams.get('product') ?? '';
  const granularity = url.searchParams.get('granularity') ?? '86400';
  if (!PRODUCTS.has(product) || !GRANULARITIES.has(granularity)) return json({ error: 'Paramètres non autorisés' }, 400);
  if (!rateLimit(`candles:${clientKey(req)}`, 30, 60_000)) return json({ error: 'Trop de requêtes' }, 429, { 'retry-after': '10' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const r = await fetchImpl(`${UPSTREAM}/products/${product}/candles?granularity=${granularity}`, { signal: ctrl.signal, headers: { 'user-agent': 'vigie-mvp' } });
    if (!r.ok) { log('upstream_error', { product, status: r.status }); return json({ error: 'Source indisponible' }, 502); }
    const rows = await r.json();
    if (!Array.isArray(rows)) return json({ error: 'Réponse inattendue de la source' }, 502);
    return json({ product, granularity: Number(granularity), source: 'Coinbase Exchange', fetchedAt: new Date().toISOString(), candles: rows },
      200, { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=120' });
  } catch {
    log('upstream_timeout', { product });
    return json({ error: 'Source indisponible' }, 504);
  } finally {
    clearTimeout(timer);
  }
}

export const GET = (req: Request) => handleCandles(req);
