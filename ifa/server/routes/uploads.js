// Envoi direct navigateur → Vercel Blob (mode "blob" uniquement). Évite de faire
// transiter les vidéos par la fonction serveur (limite de 4,5 Mo par requête).
// Le serveur délivre un jeton limité : dossier de l'utilisateur, types et poids
// admis selon le rôle, accès privé. Le fichier n'est ensuite rattaché à une
// publication qu'après vérification de sa signature binaire (finalizeDirectUpload).
import { Router } from 'express';
import { fail } from '../lib/http.js';
import { driver, uploadPrefix, uploadConstraints } from '../lib/storage.js';
import { ROLE_RANK } from '../lib/auth.js';

const r = Router();
export default r;

r.post('/uploads/blob', async (req, res) => {
  if (driver !== 'blob') fail(404, 'Envoi direct indisponible');
  const { handleUpload } = await import('@vercel/blob/client');
  const isTokenRequest = req.body?.type === 'blob.generate-client-token';
  if (isTokenRequest) {
    if (req.get('x-frq') !== '1') fail(403, 'Requête refusée', 'csrf');
    if (!req.user || req.user.status !== 'active') fail(401, 'Connexion requise');
  }
  const out = await handleUpload({
    body: req.body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const purpose = clientPayload === 'staff' ? 'staff' : 'fan';
      if (purpose === 'staff' && ROLE_RANK[req.user.role] < ROLE_RANK.editor) fail(403, 'Réservé à l\'équipe');
      if (!pathname.startsWith(uploadPrefix(req.user.id)) || pathname.includes('..')) fail(400, 'Chemin invalide');
      return { ...uploadConstraints(purpose === 'staff' ? req.user.role : 'fan'), tokenPayload: req.user.id };
    },
    onUploadCompleted: async () => {}, // le rattachement se fait à la publication, après vérification
  });
  res.json(out);
});
