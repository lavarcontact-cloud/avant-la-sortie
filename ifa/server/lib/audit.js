import { q } from '../db.js';
export const audit = (actor, action, targetType = null, targetId = null, meta = null) =>
  q('insert into audit_log (actor_id, action, target_type, target_id, meta) values ($1,$2,$3,$4,$5)',
    [actor?.id || null, action, targetType, targetId ? String(targetId) : null, meta]);
