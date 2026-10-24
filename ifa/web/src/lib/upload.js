// Envoi d'un fichier : direct vers le stockage (Vercel Blob, accès privé) quand
// le serveur est en mode "blob", sinon envoi classique au serveur (multipart).
import { api } from './api.js';

export async function sendWithFile(url, file, fields, { config, user, purpose }) {
  if (config?.storage === 'blob') {
    const { upload } = await import('@vercel/blob/client');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const b = await upload(`u/${user.id}/${Date.now()}.${ext}`, file, {
      access: 'private', handleUploadUrl: '/api/uploads/blob', clientPayload: purpose,
      headers: { 'x-frq': '1' }, multipart: file.size > 20e6, contentType: file.type || undefined,
    });
    return api.post(url, { ...fields, blob_pathname: b.pathname });
  }
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
  return api.upload(url, form);
}
