// Intégrations autorisées uniquement (API officielles, jetons fournis par
// l'équipe). Aucun scraping. Les contenus importés arrivent en BROUILLON :
// l'équipe relit, classe (clip, freestyle…) et publie. On ne réhéberge pas les
// médias des plateformes : on garde un lien vers l'original.
import { one } from '../db.js';
import { config } from '../config.js';

export function integrationStatus() {
  return {
    youtube: Boolean(config.youtube.apiKey && config.youtube.channelId),
    instagram: Boolean(config.instagram.accessToken),
    tiktok: false,   // Display API : nécessite une app TikTok validée + connexion OAuth du compte d'Ifa (voir docs)
    snapchat: false, // pas d'API publique de lecture des stories : ajout manuel avec lien
  };
}

async function importDraft(user, { externalId, kind, title, body, platform, url, publishedAt }) {
  const r = await one(`insert into posts (author_id, kind, title, body, source_type, source_platform, source_url, external_id, status, publish_at)
    values ($1,$2,$3,$4,'integration',$5,$6,$7,'draft',$8) on conflict (external_id) do nothing returning id`,
  [user?.id || null, kind, title.slice(0, 140), body ? body.slice(0, 5000) : null, platform, url, externalId, publishedAt]);
  return Boolean(r);
}

async function getJson(u) {
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// YouTube Data API v3 — clé API (données publiques), quota gratuit 10 000 unités/jour.
// channels.list (1 unité) puis playlistItems.list (1 unité) : ~2 unités par synchro.
export async function syncYouTube(user) {
  const { apiKey, channelId } = config.youtube;
  if (!apiKey || !channelId) return { ok: false, reason: 'YOUTUBE_API_KEY et YOUTUBE_CHANNEL_ID non configurés' };
  try {
    // accepte un identifiant de chaîne (UC…) ou un pseudo (@ifapursang)
    const selector = channelId.startsWith('@') ? `forHandle=${encodeURIComponent(channelId)}` : `id=${encodeURIComponent(channelId)}`;
    const ch = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${selector}&key=${apiKey}`);
    const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return { ok: false, reason: 'Chaîne introuvable' };
    const pl = await getJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=15&playlistId=${uploads}&key=${apiKey}`);
    let imported = 0;
    for (const it of pl.items || []) {
      const s = it.snippet; const vid = s?.resourceId?.videoId;
      if (!vid) continue;
      if (await importDraft(user, { externalId: `youtube:${vid}`, kind: 'video', title: s.title, body: s.description, platform: 'youtube', url: `https://www.youtube.com/watch?v=${vid}`, publishedAt: s.publishedAt }))
        imported++;
    }
    return { ok: true, imported, seen: pl.items?.length || 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Instagram API (connexion Instagram, compte professionnel d'Ifa) — jeton longue durée
// fourni par l'équipe, à renouveler tous les 60 jours. Publications du compte uniquement.
export async function syncInstagram(user) {
  const token = config.instagram.accessToken;
  if (!token) return { ok: false, reason: 'INSTAGRAM_ACCESS_TOKEN non configuré' };
  try {
    const data = await getJson(`https://graph.instagram.com/me/media?fields=id,caption,media_type,permalink,timestamp&limit=15&access_token=${encodeURIComponent(token)}`);
    let imported = 0;
    for (const m of data.data || []) {
      const caption = m.caption || '';
      const title = caption.split('\n')[0].slice(0, 120) || 'Publication Instagram';
      if (await importDraft(user, { externalId: `instagram:${m.id}`, kind: m.media_type === 'VIDEO' ? 'video' : 'news', title, body: caption, platform: 'instagram', url: m.permalink, publishedAt: m.timestamp }))
        imported++;
    }
    return { ok: true, imported, seen: data.data?.length || 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
