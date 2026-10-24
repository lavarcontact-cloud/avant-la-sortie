import webpush from 'web-push';
import { q, many, one } from '../db.js';
import { config, pushConfigured } from '../config.js';
import { ageOf } from './auth.js';

export const CATEGORIES = {
  news:         'Actus importantes',
  drop:         'Extraits inédits du Labo',
  release:      'Sorties (morceaux, clips)',
  event:        'Événements confirmés',
  challenge:    'Défis',
  exclusive:    'Contenus exclusifs',
  announcement: 'Annonces de l\'équipe',
};

export function defaultPrefs(user) {
  const minor = ageOf(user.birth_year, user.birth_month) < 18;
  return {
    categories: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, true])),
    frequency: 'all',
    quiet_start: minor ? 21 : 22,   // horaires respectueux, plus larges pour les mineurs
    quiet_end: 8,
    personalized: !minor,           // découverte personnalisée désactivée par défaut pour les mineurs
  };
}

export async function getPrefs(user) {
  const row = await one('select categories, frequency, quiet_start, quiet_end, personalized from notification_prefs where user_id = $1', [user.id]);
  const d = defaultPrefs(user);
  return row ? { ...d, ...row, categories: { ...d.categories, ...row.categories } } : d;
}

let vapidSet = false;
function ensureVapid() {
  if (!pushConfigured()) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
    vapidSet = true;
  }
  return true;
}

export function parisHour(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour').value);
}
export function inQuietHours(prefs, d = new Date()) {
  const h = parisHour(d);
  const { quiet_start: s, quiet_end: e } = prefs;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

// Point d'envoi isolé pour pouvoir inspecter les requêtes générées dans les tests.
export const transport = { send: (sub, body, opts) => webpush.sendNotification(sub, body, opts) };

async function pushTo(userId, payload) {
  const subs = await many('select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [userId]);
  let sent = 0, failed = 0;
  for (const s of subs) {
    try {
      await transport.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: payload.important ? 'high' : 'normal' });
      sent++;
      await q('update push_subscriptions set last_ok_at = now() where id = $1', [s.id]);
    } catch (e) {
      failed++;
      // abonnement expiré ou révoqué par l'utilisateur côté navigateur
      if (e.statusCode === 404 || e.statusCode === 410) await q('delete from push_subscriptions where id = $1', [s.id]);
      else console.warn('[push] échec', e.statusCode || e.message);
    }
  }
  return { sent, failed, hadSubs: subs.length > 0 };
}

// Notification personnelle (badge, modération…) : boîte de réception uniquement.
export async function notifyUser(userId, { category, title, body = null, url = null }) {
  await q('insert into notifications (user_id, category, title, body, url) values ($1,$2,$3,$4,$5)',
    [userId, category, title, body, url]);
}

// Distribue un signal programmé : boîte in-app pour chaque compte qui a la
// catégorie activée, puis push web si (et seulement si) le service est configuré,
// que la personne y a souscrit, que sa fréquence l'autorise et qu'on n'est pas
// dans ses heures calmes.
export async function dispatchBroadcast(b) {
  const users = await many(`select id, birth_year, birth_month from users where status = 'active'`);
  const pushOn = ensureVapid();
  const stats = { recipients: 0, inapp: 0, push_configured: pushOn, push_sent: 0, push_failed: 0, push_skipped_quiet: 0, push_skipped_frequency: 0, push_no_subscription: 0 };
  const important = b.importance === 'important';
  const now = new Date();
  for (const u of users) {
    const prefs = await getPrefs(u);
    if (!prefs.categories[b.category]) continue;
    stats.recipients++;
    await q('insert into notifications (user_id, broadcast_id, category, title, body, url) values ($1,$2,$3,$4,$5,$6)',
      [u.id, b.id, b.category, b.title, b.body, b.url]);
    stats.inapp++;
    if (!pushOn) continue;
    if (prefs.frequency === 'off' || (prefs.frequency === 'important' && !important)) { stats.push_skipped_frequency++; continue; }
    if (inQuietHours(prefs, now)) { stats.push_skipped_quiet++; continue; }
    const r = await pushTo(u.id, { title: b.title, body: b.body || '', url: b.url || '/', tag: b.id, important });
    if (!r.hadSubs) stats.push_no_subscription++;
    stats.push_sent += r.sent;
    stats.push_failed += r.failed;
  }
  return stats;
}

// Programme un signal (utilisé par l'admin et par les publications avec "prévenir les fans").
export async function scheduleBroadcast({ category, importance = 'normal', title, body = null, url = null, sendAt = new Date(), origin = 'manual', createdBy = null }) {
  return one(
    `insert into broadcasts (category, importance, title, body, url, send_at, origin, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [category, importance, title.slice(0, 80), body ? body.slice(0, 200) : null, url, sendAt, origin, createdBy]);
}

export async function sendTestPush(userId) {
  if (!ensureVapid()) return { ok: false, reason: 'push_not_configured' };
  const r = await pushTo(userId, { title: 'Fréquence', body: 'Test de signal : les notifications fonctionnent sur cet appareil.', url: '/notifs', tag: 'test' });
  if (!r.hadSubs) return { ok: false, reason: 'no_subscription' };
  return { ok: r.sent > 0, ...r };
}
