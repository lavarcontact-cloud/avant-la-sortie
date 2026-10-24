export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, message, code) => { throw new HttpError(status, message, code); };

// Validation minimale et explicite des entrées (pas de dépendance de schéma).
export function str(v, { max = 500, min = 0, field = 'champ', optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    fail(400, `${field} est requis`);
  }
  if (typeof v !== 'string') fail(400, `${field} invalide`);
  const s = v.trim();
  if (s.length < min) fail(400, `${field} trop court`);
  if (s.length > max) fail(400, `${field} trop long (${max} max)`);
  return s;
}
export function oneOf(v, list, field = 'valeur', { optional = false } = {}) {
  if ((v === undefined || v === null || v === '') && optional) return null;
  if (!list.includes(v)) fail(400, `${field} invalide`);
  return v;
}
export function date(v, field = 'date', { optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    fail(400, `${field} est requise`);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) fail(400, `${field} invalide`);
  return d;
}
export function url(v, field = 'lien', { optional = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    fail(400, `${field} est requis`);
  }
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.toString();
  } catch {
    fail(400, `${field} : URL invalide (http/https)`);
  }
}
export const uuid = (v, field = 'identifiant', { optional = false } = {}) => {
  if ((v === undefined || v === null || v === '') && optional) return null;
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) fail(400, `${field} invalide`);
  return v;
};
export const bool = (v) => v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
