// Requêtes de lecture partagées par plusieurs routes.
import { many, one } from '../db.js';

export const mediaRef = (id, kind, mime) => (id ? { id, kind, mime, url: `/api/media/${id}` } : null);

// Seules les publications publiées, non expirées et déjà datées sont visibles.
export const VISIBLE_POST = `p.status = 'published' and coalesce(p.publish_at, p.created_at) <= now()
  and (p.expires_at is null or p.expires_at > now())`;

const POST_SELECT = `
  select p.id, p.kind, p.title, p.body, p.source_type, p.source_platform, p.source_url, p.is_pinned, p.is_featured,
         p.is_demo, p.expires_at, coalesce(p.publish_at, p.created_at) as published_at,
         m.id as media_id, m.kind as media_kind, m.mime as media_mime,
         u.handle as author_handle, u.display_name as author_name, u.is_official as author_official,
         (select count(*)::int from reactions r where r.target_type='post' and r.target_id=p.id and r.kind='like') as likes,
         (select count(*)::int from comments c where c.target_type='post' and c.target_id=p.id and c.status='visible') as comments
  from posts p
  left join media m on m.id = p.media_id
  left join users u on u.id = p.author_id`;

export function shapePost(r, mine = {}) {
  return {
    id: r.id, kind: r.kind, title: r.title, body: r.body,
    source: { type: r.source_type, platform: r.source_platform, url: r.source_url },
    published_at: r.published_at, expires_at: r.expires_at,
    is_pinned: r.is_pinned, is_featured: r.is_featured, is_demo: r.is_demo,
    media: mediaRef(r.media_id, r.media_kind, r.media_mime),
    author: r.author_handle ? { handle: r.author_handle, name: r.author_name, official: r.author_official } : null,
    likes: r.likes, comments: r.comments,
    liked: Boolean(mine[`${r.id}:like`]), saved: Boolean(mine[`${r.id}:save`]),
  };
}

export async function myReactions(user, type, ids) {
  if (!user || !ids.length) return {};
  const rows = await many('select target_id, kind from reactions where user_id=$1 and target_type=$2 and target_id = any($3)', [user.id, type, ids]);
  return Object.fromEntries(rows.map((x) => [`${x.target_id}:${x.kind}`, true]));
}

export async function listPosts(user, { where = '', params = [], order = 'published_at desc', limit = 20 } = {}) {
  const rows = await many(`${POST_SELECT} where ${VISIBLE_POST} ${where ? `and ${where}` : ''} order by ${order} limit ${Number(limit)}`, params);
  const mine = await myReactions(user, 'post', rows.map((r) => r.id));
  return rows.map((r) => shapePost(r, mine));
}

export async function getPost(user, id) {
  const r = await one(`${POST_SELECT} where p.id = $1 and ${VISIBLE_POST}`, [id]);
  if (!r) return null;
  return shapePost(r, await myReactions(user, 'post', [id]));
}

// Créations de fans approuvées, en excluant les comptes bloqués par le lecteur.
export async function listFanPosts(user, { where = '', params = [], limit = 30, order = 'f.created_at desc' } = {}) {
  const p = [...params];
  let blockClause = '';
  if (user) { p.push(user.id); blockClause = `and f.author_id not in (select blocked_id from blocks where blocker_id = $${p.length})`; }
  const rows = await many(`
    select f.id, f.caption, f.is_featured, f.created_at, f.circle_id, f.challenge_id,
           m.id as media_id, m.kind as media_kind, m.mime as media_mime,
           u.handle, u.display_name, u.avatar_style,
           (select count(*)::int from reactions r where r.target_type='fan_post' and r.target_id=f.id and r.kind='like') as likes,
           (select count(*)::int from comments c where c.target_type='fan_post' and c.target_id=f.id and c.status='visible') as comments
    from fan_posts f join media m on m.id = f.media_id join users u on u.id = f.author_id
    where f.status = 'approved' and u.status = 'active' ${blockClause} ${where ? `and ${where}` : ''}
    order by ${order} limit ${Number(limit)}`, p);
  const mine = await myReactions(user, 'fan_post', rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id, caption: r.caption, is_featured: r.is_featured, created_at: r.created_at,
    circle_id: r.circle_id, challenge_id: r.challenge_id,
    media: mediaRef(r.media_id, r.media_kind, r.media_mime),
    author: { handle: r.handle, name: r.display_name, avatar_style: r.avatar_style },
    likes: r.likes, comments: r.comments,
    liked: Boolean(mine[`${r.id}:like`]), saved: Boolean(mine[`${r.id}:save`]),
  }));
}
