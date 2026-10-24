// Push web : uniquement si le navigateur le permet ET si le serveur est configuré.
// Rien n'est simulé : chaque étape renvoie un état réel.
import { api } from './api.js';

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function pushSupport(config) {
  if (!config?.push?.configured) return { ok: false, reason: 'server', text: 'Les notifications push ne sont pas encore activées par l\'équipe. Tu recevras tout dans ta boîte Signaux.' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'browser', text: 'Ton navigateur ne gère pas les notifications web.' };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install', text: 'Sur iPhone, les notifications marchent seulement une fois Fréquence ajoutée à l\'écran d\'accueil (iOS 16.4 ou plus).' };
  if (!('PushManager' in window) || !('Notification' in window)) return { ok: false, reason: 'browser', text: 'Ton navigateur ne gère pas les notifications web.' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied', text: 'Les notifications sont bloquées pour Fréquence dans les réglages de ton téléphone ou de ton navigateur.' };
  return { ok: true };
}

const b64ToUint8 = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(config) {
  const s = pushSupport(config);
  if (!s.ok) throw new Error(s.text);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Autorisation refusée. Tu peux la redonner dans les réglages.');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(config.push.publicKey) });
  await api.post('/api/push/subscribe', sub.toJSON());
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
}
