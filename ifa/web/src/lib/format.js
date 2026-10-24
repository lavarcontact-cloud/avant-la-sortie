const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
export function ago(d) {
  const s = (new Date(d) - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return 'à l\'instant';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: a > 86400 * 300 ? 'numeric' : undefined });
}
export const dateLong = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export const time = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const dayParts = (d) => {
  const x = new Date(d);
  return { day: x.toLocaleDateString('fr-FR', { day: '2-digit' }), month: x.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), year: x.getFullYear() };
};
export function countdown(to) {
  let s = Math.max(0, Math.floor((new Date(to) - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return { d, h, m, s, done: new Date(to) <= Date.now() };
}
export const pad = (n) => String(n).padStart(2, '0');

export const KIND_LABEL = {
  news: 'Actu', announcement: 'Annonce', release: 'Sortie', clip: 'Clip', freestyle: 'Freestyle',
  video: 'Vidéo', backstage: 'Coulisses', story: 'Story', event: 'Événement',
};
export const PLATFORM_LABEL = {
  instagram: 'Instagram', tiktok: 'TikTok', snapchat: 'Snapchat', youtube: 'YouTube', spotify: 'Spotify',
  deezer: 'Deezer', apple_music: 'Apple Music', press: 'Presse', other: 'Lien externe',
  soundcloud: 'SoundCloud', tidal: 'Tidal', amazon_music: 'Amazon Music', x: 'X', website: 'Site', booking: 'Booking',
};
export const EVENT_KIND = {
  concert: 'Concert', showcase: 'Showcase', release_party: 'Release party', appearance: 'Apparition',
  live: 'Live', qa: 'Questions-réponses', meetup: 'Rencontre',
};
export const RELEASE_KIND = { single: 'Single', ep: 'EP', album: 'Album', mixtape: 'Mixtape', clip: 'Clip', freestyle: 'Freestyle' };

export function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Miniature YouTube en bonne définition : verticale d'origine pour les Shorts,
// 1280 px pour les vidéos classiques ; repli sur la 480 px si elle n'existe pas.
export function youtubeThumb(url) {
  const id = youtubeId(url);
  if (!id) return null;
  const big = /shorts\//.test(url) ? 'oardefault' : 'maxresdefault';
  return { src: `https://i.ytimg.com/vi/${id}/${big}.jpg`, fallback: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}
export function thumbFallback(e, fallback) {
  if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
}
