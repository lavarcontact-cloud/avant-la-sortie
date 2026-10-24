// Lecture publique : Le QG, l'artiste, l'agenda, la discographie, Immersion.
import { Router } from 'express';
import { q, one, many } from '../db.js';
import { config, pushConfigured } from '../config.js';
import { listPosts, getPost, listFanPosts, mediaRef } from '../lib/content.js';
import { getPrefs } from '../lib/notify.js';
import { fail, uuid, oneOf } from '../lib/http.js';
import { dropWindow } from '../lib/access.js';
import { driver as storageDriver } from '../lib/storage.js';

const r = Router();
export default r;

r.get('/config', (_req, res) => {
  res.json({
    push: { configured: pushConfigured(), publicKey: pushConfigured() ? config.vapid.publicKey : null },
    storage: storageDriver,
    minAge: config.minAge, parentalConsentAge: config.parentalConsentAge, termsVersion: config.termsVersion,
  });
});

async function artistProfile() {
  const a = await one('select name, tagline, bio, avatar_media_id, banner_media_id, links, updated_at from artist_profile where id = 1');
  return { ...a, avatar: mediaRef(a.avatar_media_id, 'image'), banner: mediaRef(a.banner_media_id, 'image') };
}
const shapeRelease = (x) => ({ ...x, cover: mediaRef(x.cover_media_id, 'image') });
const shapeEvent = (x) => x;

r.get('/qg', async (req, res) => {
  const u = req.user;
  const [stories, pinned, feed, nextEvent, nextRelease, drops, featured, artist, challenge] = await Promise.all([
    listPosts(u, { where: `p.kind = 'story'`, order: 'published_at desc', limit: 12 }),
    listPosts(u, { where: `p.is_pinned and p.kind <> 'story'`, limit: 3 }),
    listPosts(u, { where: `p.kind <> 'story' and not p.is_pinned`, limit: 20 }),
    one(`select * from events where status = 'confirmed' and starts_at > now() order by starts_at limit 1`),
    one(`select * from releases where is_published and release_date >= current_date order by release_date limit 1`),
    many(`select id, title, teaser, kind, opens_at, closes_at, cover_media_id, is_demo from drops
          where is_published and (closes_at is null or closes_at > now()) order by opens_at limit 4`),
    listFanPosts(u, { where: 'f.is_featured', limit: 6 }),
    artistProfile(),
    one(`select id, title, brief, ends_at, is_demo from challenges where is_published and starts_at <= now() and (ends_at is null or ends_at > now()) order by starts_at desc limit 1`),
  ]);
  res.json({
    artist: { name: artist.name, tagline: artist.tagline, avatar: artist.avatar },
    stories, pinned, feed,
    next_event: nextEvent && shapeEvent(nextEvent),
    next_release: nextRelease && shapeRelease(nextRelease),
    drops: drops.map((d) => ({ ...d, state: dropWindow(d), cover: mediaRef(d.cover_media_id, 'image') })),
    featured, challenge,
  });
});

// Historique des actualités (archives), pagination par date.
r.get('/posts', async (req, res) => {
  const kind = oneOf(req.query.kind, ['news', 'announcement', 'release', 'clip', 'freestyle', 'video', 'backstage', 'story', 'event'], 'type', { optional: true });
  const params = [];
  const where = [`p.kind <> 'story'`];
  if (kind) { params.push(kind); where.push(`p.kind = $${params.length}`); }
  if (req.query.before) { params.push(new Date(req.query.before)); where.push(`coalesce(p.publish_at, p.created_at) < $${params.length}`); }
  const items = await listPosts(req.user, { where: where.join(' and '), params, limit: 20 });
  res.json({ items, next: items.length === 20 ? items.at(-1).published_at : null });
});

r.get('/posts/:id', async (req, res) => {
  const p = await getPost(req.user, uuid(req.params.id));
  if (!p) fail(404, 'Contenu introuvable');
  res.json(p);
});

r.get('/artist', async (req, res) => {
  const [artist, releases, upcoming, past, announcements, videos] = await Promise.all([
    artistProfile(),
    many(`select * from releases where is_published order by release_date desc nulls last`),
    many(`select * from events where status in ('confirmed','postponed','cancelled') and coalesce(ends_at, starts_at) >= now() order by starts_at`),
    many(`select * from events where status = 'confirmed' and coalesce(ends_at, starts_at) < now() order by starts_at desc limit 20`),
    listPosts(req.user, { where: `p.kind = 'announcement'`, limit: 5 }),
    listPosts(req.user, { where: `p.kind in ('clip','freestyle','video')`, limit: 12 }),
  ]);
  const official = await many(`select handle, display_name, role from users where is_official and status = 'active' order by role desc`);
  res.json({ artist, releases: releases.map(shapeRelease), upcoming, past, announcements, videos, team: official });
});

r.post('/views', async (req, res) => {
  const type = oneOf(req.body?.type, ['post', 'fan_post', 'drop'], 'type');
  const id = uuid(req.body?.id);
  await q(`insert into content_views (target_type, target_id, day, views) values ($1,$2,current_date,1)
           on conflict (target_type, target_id, day) do update set views = content_views.views + 1`, [type, id]);
  res.json({ ok: true });
});

// ------------------------------------------------ Immersion
// Pistes : chaque piste est une sélection lisible, pas une boîte noire.
const TRACKS = {
  'pour-toi': null,
  clips: `p.kind in ('clip','freestyle')`,
  coulisses: `p.kind = 'backstage'`,
  signaux: `p.kind = 'story'`,
  selection: `p.is_featured`,
};

r.get('/immersion', async (req, res) => {
  const track = oneOf(req.query.track || 'pour-toi', [...Object.keys(TRACKS), 'fans', 'defis'], 'piste');
  const videoWhere = `(m.kind = 'video' or (p.source_platform = 'youtube' and p.source_url is not null))`;
  let official = [];
  let fans = [];
  if (track === 'fans' || track === 'defis') {
    fans = await listFanPosts(req.user, { where: track === 'defis' ? `f.challenge_id is not null and m.kind = 'video'` : `m.kind = 'video'`, limit: 30 });
  } else if (track === 'pour-toi') {
    official = await listPosts(req.user, { where: videoWhere, limit: 30 });
    fans = await listFanPosts(req.user, { where: `m.kind = 'video' and f.is_featured`, limit: 10 });
    // Découverte personnalisée, transparente : on remonte les formats que la
    // personne a aimés. Désactivable dans les réglages (désactivée par défaut
    // pour les mineurs).
    if (req.user && (await getPrefs(req.user)).personalized) {
      const liked = await many(`select p.kind, count(*)::int n from reactions r join posts p on p.id = r.target_id
        where r.user_id = $1 and r.target_type = 'post' and r.kind = 'like' group by p.kind`, [req.user.id]);
      const w = Object.fromEntries(liked.map((x) => [x.kind, x.n]));
      const age = (x) => (Date.now() - new Date(x.published_at)) / 864e5;
      official.sort((a, b) => (w[b.kind] || 0) * 2 - age(b) / 7 + (b.is_featured ? 3 : 0) - ((w[a.kind] || 0) * 2 - age(a) / 7 + (a.is_featured ? 3 : 0)));
    }
  } else {
    official = await listPosts(req.user, { where: `${videoWhere} and ${TRACKS[track]}`, limit: 30 });
  }
  const items = [
    ...official.map((p) => ({ type: 'post', ...p })),
    ...fans.map((f) => ({ type: 'fan_post', ...f })),
  ];
  // en "pour toi", on intercale une création de fan tous les 4 contenus officiels
  if (track === 'pour-toi' && fans.length) {
    const mixed = []; let fi = 0;
    official.forEach((p, i) => { mixed.push({ type: 'post', ...p }); if ((i + 1) % 4 === 0 && fans[fi]) mixed.push({ type: 'fan_post', ...fans[fi++] }); });
    while (fans[fi]) mixed.push({ type: 'fan_post', ...fans[fi++] });
    return res.json({ track, items: mixed });
  }
  res.json({ track, items });
});
