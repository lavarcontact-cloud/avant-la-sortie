// Limiteur en mémoire (fenêtre fixe). Suffisant pour une instance unique ;
// à remplacer par Redis si l'API passe sur plusieurs instances.
import { fail } from './http.js';
const buckets = new Map();
export function rateLimit({ key, max, windowMs }) {
  return (req, _res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === '1') return next();
    const k = `${key}:${req.user?.id || req.ip}`;
    const now = Date.now();
    const b = buckets.get(k);
    if (!b || b.reset < now) buckets.set(k, { n: 1, reset: now + windowMs });
    else if (++b.n > max) fail(429, 'Trop de tentatives, réessaie dans un moment', 'rate_limited');
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60_000).unref();
