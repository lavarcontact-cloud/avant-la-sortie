// Utilitaires communs aux fonctions serveur (Vercel, runtime Node, API Web standard).

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers },
  });

// Limiteur de débit en mémoire, par instance. Suffisant pour un prototype ;
// en production, utiliser la limitation du pare-feu de l'hébergeur ou un store partagé.
const buckets = new Map<string, { tokens: number; at: number }>();
export function rateLimit(key: string, capacity: number, perMs: number, now = Date.now()): boolean {
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  const refill = ((now - b.at) / perMs) * capacity;
  b.tokens = Math.min(capacity, b.tokens + refill);
  b.at = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear(); // borne mémoire
  return true;
}

export const clientKey = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'anon';

export function log(event: string, data: Record<string, unknown>) {
  // Journal structuré des événements sensibles, sans contenu utilisateur ni secret.
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
}
