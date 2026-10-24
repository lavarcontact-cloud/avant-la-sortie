// Configuration centralisée. Toute intégration externe est optionnelle :
// si sa variable est absente, la fonctionnalité est désactivée et l'UI le dit.
const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 8787),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || 'postgres://ifa:ifa@localhost:5432/ifa_dev',
  uploadDir: env.UPLOAD_DIR || new URL('../data/uploads', import.meta.url).pathname,
  sessionDays: Number(env.SESSION_DAYS || 30),

  // Règles d'âge (voir docs/04-securite-mineurs.md)
  minAge: Number(env.MIN_AGE || 12),
  parentalConsentAge: Number(env.PARENTAL_CONSENT_AGE || 15), // art. 45 loi Informatique et Libertés
  termsVersion: env.TERMS_VERSION || '2026-10',

  // Web Push (VAPID) — `npm run vapid` génère une paire de clés
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY || '',
    privateKey: env.VAPID_PRIVATE_KEY || '',
    subject: env.VAPID_SUBJECT || '',
  },
  // E-mail (consentement parental, réinitialisation) — SMTP
  smtp: {
    url: env.SMTP_URL || '',
    from: env.MAIL_FROM || 'Fréquence <no-reply@example.com>',
  },
  // Intégrations sociales
  youtube: { apiKey: env.YOUTUBE_API_KEY || '', channelId: env.YOUTUBE_CHANNEL_ID || '' },
  instagram: { accessToken: env.INSTAGRAM_ACCESS_TOKEN || '' },

  schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS || 30_000),
  disableScheduler: env.DISABLE_SCHEDULER === '1',
};

export const pushConfigured = () => Boolean(config.vapid.publicKey && config.vapid.privateKey && config.vapid.subject);
export const mailConfigured = () => Boolean(config.smtp.url);
