import { q } from '../db.js';
import { notifyUser } from './notify.js';

// Les badges récompensent une participation, jamais un volume ou un classement.
export async function award(userId, code, reason = null) {
  const r = await q(
    `insert into user_badges (user_id, badge_code, reason) values ($1,$2,$3) on conflict do nothing returning badge_code`,
    [userId, code, reason]);
  if (r.rowCount) {
    const b = (await q('select name from badges where code = $1', [code])).rows[0];
    await notifyUser(userId, { category: 'badge', title: `Badge débloqué : ${b?.name || code}`, url: '/moi' });
  }
  return r.rowCount > 0;
}
