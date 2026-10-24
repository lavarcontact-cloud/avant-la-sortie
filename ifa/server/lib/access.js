// Règles d'accès aux contenus du Labo. Point unique de vérité, utilisé à la
// fois par l'API (métadonnées) et par la route de diffusion des fichiers.
import { one } from '../db.js';
import { isStaff } from './auth.js';

export function dropWindow(drop, now = new Date()) {
  if (now < new Date(drop.opens_at)) return 'upcoming';
  if (drop.closes_at && now >= new Date(drop.closes_at)) return 'closed';
  return 'open';
}

// Renvoie { allowed, reason } pour un utilisateur donné.
export async function canAccessDrop(user, drop, now = new Date()) {
  if (isStaff(user) && user.role !== 'moderator') return { allowed: true, reason: 'staff' };
  if (!drop.is_published) return { allowed: false, reason: 'not_found' };
  const w = dropWindow(drop, now);
  if (w !== 'open') return { allowed: false, reason: w };
  if (!user) return { allowed: false, reason: 'auth_required' };
  if (user.status !== 'active') return { allowed: false, reason: user.status };
  if (drop.access === 'badge') {
    const has = await one('select 1 from user_badges where user_id = $1 and badge_code = $2', [user.id, drop.required_badge]);
    if (!has) return { allowed: false, reason: 'badge_required' };
  }
  if (drop.access === 'circle') {
    const has = await one('select 1 from circle_members where user_id = $1 and circle_id = $2', [user.id, drop.required_circle_id]);
    if (!has) return { allowed: false, reason: 'circle_required' };
  }
  return { allowed: true, reason: 'ok' };
}

// Un fichier protégé est lisible si l'utilisateur peut accéder à AU MOINS un
// drop (ou une option de vote) qui le référence. Fichier orphelin = staff seulement.
export async function canStreamProtected(user, mediaId) {
  if (isStaff(user) && user.role !== 'moderator') return true;
  const drop = await one(
    `select d.* from drops d
     left join drop_options o on o.drop_id = d.id
     where d.media_id = $1 or o.media_id = $1 limit 1`, [mediaId]);
  if (!drop) return false;
  return (await canAccessDrop(user, drop)).allowed;
}
