// Stockage des fichiers. Pilote "disque local" (volume persistant).
// L'interface (save / pathFor / remove) est volontairement réduite pour
// pouvoir brancher un stockage objet S3/R2 sans toucher aux routes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { fail } from './http.js';

fs.mkdirSync(config.uploadDir, { recursive: true });

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

export function saveBuffer(buf, { allowed = ['image', 'video', 'audio'], limits }) {
  const type = sniff(buf);
  if (!type || !allowed.includes(type.kind)) fail(415, 'Format de fichier non pris en charge');
  if (buf.length > limits[type.kind]) fail(413, `Fichier trop lourd (${Math.round(limits[type.kind] / 1e6)} Mo max)`);
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${type.ext}`;
  const abs = path.join(config.uploadDir, key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  return { ...type, key, size: buf.length };
}
export const pathFor = (key) => {
  const abs = path.resolve(config.uploadDir, key);
  if (!abs.startsWith(path.resolve(config.uploadDir))) fail(400, 'Chemin invalide');
  return abs;
};
export const remove = (key) => fs.promises.unlink(pathFor(key)).catch(() => {});
