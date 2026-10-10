/**
 * Accès centralisé aux variables d'environnement. Les secrets ne sont lus
 * que côté serveur (ce module n'est jamais importé par un composant client
 * pour autre chose que siteUrl, qui est public).
 */

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() appelé côté client");
  return {
    databaseUrl: process.env.DATABASE_URL,
    sessionSecret: process.env.SESSION_SECRET,
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    notifyEmail: process.env.NOTIFY_EMAIL,
    ipHashSalt: process.env.IP_HASH_SALT ?? process.env.SESSION_SECRET ?? "dev-salt",
  };
}

/** Garde-fou : en production, seules des clés Stripe de test sont acceptées
 *  tant que STRIPE_LIVE_APPROVED n'est pas explicitement positionné. */
export function assertStripeKeyAllowed(key: string) {
  if (key.startsWith("sk_live_") && process.env.STRIPE_LIVE_APPROVED !== "true") {
    throw new Error("Clé Stripe live refusée : STRIPE_LIVE_APPROVED n'est pas activé.");
  }
}
