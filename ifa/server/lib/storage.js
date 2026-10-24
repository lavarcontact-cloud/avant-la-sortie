// Stockage des fichiers, deux pilotes derrière la même interface :
//  - "local" : disque (volume persistant) — Docker, VPS, développement, tests ;
//  - "blob"  : Vercel Blob en accès PRIVÉ (activé si BLOB_READ_WRITE_TOKEN est
//    défini). Aucun fichier n'a d'adresse publique : /api/media/:id vérifie les
//    droits puis redirige vers une URL signée qui expire (60 s pour le Labo).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { fail } from './http.js';

export const driver = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local';
if (driver === 'local') fs.mkdirSync(config.uploadDir, { recursive: true });

// Vérification par signature binaire (on ne fait pas confiance au type MIME déclaré).
export function sniff(buf) {
  const hex = buf.subarray(0, 16).toString('hex');
  const ascii = buf.subarray(0, 16).toString('latin1');
  if (hex.startsWith('ffd8ff')) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (hex.startsWith('89504e47')) return { kind: 'image', mime: 'image/png', ext: 'png' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  if (ascii.startsWith('GIF8')) return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12);
    if (/^M4A /.test(brand)) return { kind: 'audio', mime: 'audio/mp4', ext: 'm4a' };
    if (/^qt  /.test(brand)) return { kind: 'video', mime: 'video/quicktime', ext: 'mov' };
    return { kind: 'video', mime: 'video/mp4', ext: 'mp4' };
  }
  if (hex.startsWith('1a45dfa3')) return { kind: 'video', mime: 'video/webm', ext: 'webm' };
  if (ascii.startsWith('ID3') || hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('fff2'))
    return { kind: 'audio', mime: 'audio/mpeg', ext: 'mp3' };
  if (ascii.startsWith('OggS')) return { kind: 'audio', mime: 'audio/ogg', ext: 'ogg' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return { kind: 'audio', mime: 'audio/wav', ext: 'wav' };
  return null;
}

export const LIMITS = {
  fan: { image: 12e6, video: 80e6, audio: 0 },          // les fans ne publient pas d'audio
  staff: { image: 25e6, video: 600e6, audio: 120e6 },
};
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav'];

function check(type, size, { allowed, limits }) {
  if (!type || !allowed.includes(type.kind)) fail(415, 'Format de fichier non pris en charge');
  if (size > limits[type.kind]) fail(413, `Fichier trop lourd (${Math.round(limits[type.kind] / 1e6)} Mo max)`);
}

// ---------------------------------------------------------------- pilote Blob
let blobMod;
const blob = async () => (blobMod ||= await import('@vercel/blob'));
let readToken = null; // délégation de lecture mise en cache (~50 min), signatures locales ensuite
async function signedGet(pathname, ttlMs) {
  const b = await blob();
  if (!readToken || readToken.validUntil - Date.now() < 5 * 60e3) {
    readToken = await b.issueSignedToken({ pathname: '*', operations: ['get'], validUntil: Date.now() + 55 * 60e3 });
  }
  const { presignedUrl } = await b.presignUrl(readToken, { operation: 'get', pathname, validUntil: Math.min(Date.now() + ttlMs, readToken.validUntil), access: 'private' });
  return presignedUrl;
}

// ---------------------------------------------------------------- interface
// Enregistre un fichier reçu par le serveur (envoi classique ou démo).
export async function saveBuffer(buf, { allowed = ['image', 'video', 'audio'], limits }) {
  const type = sniff(buf);
  check(type, buf.length, { allowed, limits });
  const key = `m/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${type.ext}`;
  if (driver === 'blob') {
    await (await blob()).put(key, buf, { access: 'private', contentType: type.mime, addRandomSuffix: false });
  } else {
    const abs = path.join(config.uploadDir, key);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
  }
  return { ...type, key, size: buf.length };
}

// Préfixe imposé aux envois directs depuis le navigateur (mode Blob).
export const uploadPrefix = (userId) => `u/${userId}/`;

// Valide un fichier envoyé directement par le navigateur dans Blob : il doit être
// dans le dossier de l'utilisateur, et son contenu réel (signature) doit être admis.
export async function finalizeDirectUpload(pathname, userId, { allowed, limits }) {
  if (driver !== 'blob') fail(400, 'Envoi direct indisponible sur ce serveur');
  if (typeof pathname !== 'string' || !pathname.startsWith(uploadPrefix(userId)) || pathname.includes('..')) fail(400, 'Fichier invalide');
  const b = await blob();
  let meta;
  try { meta = await b.head(pathname); } catch { fail(400, 'Fichier introuvable'); }
  const res = await fetch(await signedGet(pathname, 60e3), { headers: { Range: 'bytes=0-31' } });
  const head = Buffer.from(await res.arrayBuffer());
  const type = sniff(head);
  try { check(type, meta.size, { allowed, limits }); } catch (e) { await b.del(pathname).catch(() => {}); throw e; }
  return { ...type, key: pathname, size: meta.size };
}

// Jeton d'envoi direct (route /api/uploads/blob, via handleUpload).
export function uploadConstraints(role) {
  const staff = role !== 'fan';
  return {
    allowedContentTypes: ACCEPTED_TYPES.filter((t) => staff || !t.startsWith('audio/')),
    maximumSizeInBytes: staff ? LIMITS.staff.video : LIMITS.fan.video,
    addRandomSuffix: true,
  };
}

// Sert le fichier : envoi direct (local) ou redirection signée (Blob).
export async function serve(res, m, { protectedFile, cacheSeconds }) {
  if (driver === 'blob') {
    const url = await signedGet(m.storage_key, protectedFile ? 60e3 : 3600e3);
    res.setHeader('Cache-Control', protectedFile ? 'private, no-store' : `private, max-age=${Math.min(cacheSeconds, 1800)}`);
    return res.redirect(302, url);
  }
  const abs = pathFor(m.storage_key);
  if (!fs.existsSync(abs)) fail(404, 'Fichier introuvable');
  res.setHeader('Content-Type', m.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', protectedFile ? 'private, no-store' : cacheSeconds ? `public, max-age=${cacheSeconds}` : 'private, no-store');
  // sendFile gère les requêtes partielles (Range) : lecture et avance rapide audio/vidéo
  return res.sendFile(abs, { headers: { 'Content-Type': m.mime }, cacheControl: false, lastModified: false });
}

export const pathFor = (key) => {
  const abs = path.resolve(config.uploadDir, key);
  if (!abs.startsWith(path.resolve(config.uploadDir))) fail(400, 'Chemin invalide');
  return abs;
};
export async function remove(key) {
  if (driver === 'blob') return (await blob()).del(key).catch(() => {});
  return fs.promises.unlink(pathFor(key)).catch(() => {});
}
