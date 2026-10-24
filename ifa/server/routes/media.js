// Diffusion des fichiers. Aucun fichier n'est accessible par une URL statique.
import { Router } from 'express';
import { one } from '../db.js';
import { fail, uuid } from '../lib/http.js';
import { serve } from '../lib/storage.js';
import { canStreamProtected } from '../lib/access.js';
import { isStaff } from '../lib/auth.js';

const r = Router();
export default r;

r.get('/media/:id', async (req, res) => {
  const m = await one('select id, mime, storage_key, visibility, owner_id from media where id = $1', [uuid(req.params.id)]);
  if (!m) fail(404, 'Fichier introuvable');
  if (m.visibility === 'protected') {
    if (!(await canStreamProtected(req.user, m.id))) fail(403, 'Accès non autorisé');
    return serve(res, m, { protectedFile: true });
  }
  // un fichier de fan en attente/refusé n'est visible que de son auteur et de l'équipe
  const fp = await one('select status, author_id from fan_posts where media_id = $1', [m.id]);
  if (fp && fp.status !== 'approved' && req.user?.id !== fp.author_id && !isStaff(req.user)) fail(404, 'Fichier introuvable');
  return serve(res, m, { protectedFile: false, cacheSeconds: fp && fp.status !== 'approved' ? 0 : 86400 });
});
