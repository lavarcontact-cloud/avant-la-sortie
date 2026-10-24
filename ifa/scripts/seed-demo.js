// Données de DÉMONSTRATION pour présenter l'appli (npm run seed:demo).
// Règles :
//  - aucun fait sur Ifa n'est inventé : les contenus sont des gabarits explicites
//    ("Exemple · …"), tous marqués is_demo et affichés avec l'étiquette "Exemple" ;
//  - les médias sont des visuels abstraits générés (ffmpeg), pas des photos d'Ifa ;
//  - `npm run seed:demo -- --remove` supprime tout ce qui a été créé ici.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrate } from './migrate.js';
import { pool, q, one } from '../server/db.js';
import { hashPassword } from '../server/lib/auth.js';
import { saveBuffer, LIMITS, remove } from '../server/lib/storage.js';
import { config } from '../server/config.js';

const DEMO_DOMAIN = 'demo.frequence.local';
const PASSWORD = 'frequence-demo';

async function removeDemo() {
  const keys = (await q(`select storage_key from media where owner_id in (select id from users where email like $1)`, [`%@${DEMO_DOMAIN}`])).rows;
  for (const t of ['posts', 'releases', 'events', 'drops', 'challenges']) await q(`delete from ${t} where is_demo`);
  await q(`delete from circles where slug like 'demo-%'`);
  await q(`delete from media where owner_id in (select id from users where email like $1)`, [`%@${DEMO_DOMAIN}`]);
  await q(`delete from users where email like $1`, [`%@${DEMO_DOMAIN}`]);
  keys.forEach((k) => remove(k.storage_key));
  console.log('✓ données de démonstration supprimées');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frq-seed-'));
function gen(name, args) {
  const out = path.join(tmp, name);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args, out]);
  return fs.readFileSync(out);
}
const palettes = [['0xFFB81C', '0x2A1F5C'], ['0x8D6BFF', '0x0A0A0B'], ['0x35D9B8', '0x131315'], ['0xFF5A3C', '0x1B1B1F'], ['0xEEE9DF', '0x2A1F5C']];
const img = (i, w = 1080, h = 1350) => gen(`img${i}.jpg`, ['-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${palettes[i % 5][0]}:c1=${palettes[i % 5][1]}:x0=0:y0=0:x1=${w}:y1=${h}:seed=${i}`, '-frames:v', '1', '-q:v', '4']);
const vid = (i) => gen(`vid${i}.mp4`, ['-f', 'lavfi', '-i', `gradients=s=720x1280:c0=${palettes[i % 5][0]}:c1=${palettes[i % 5][1]}:speed=0.02:d=6:seed=${i}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '30', '-movflags', '+faststart', '-an']);
const tone = () => gen('preview.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=110:duration=20', '-f', 'lavfi', '-i', 'sine=frequency=165:duration=20', '-filter_complex', 'amix=inputs=2,volume=0.6,afade=t=in:d=1,afade=t=out:st=18:d=2', '-b:a', '96k']);

async function addMedia(owner, buf, visibility = 'public') {
  const s = saveBuffer(buf, { limits: LIMITS.staff });
  return (await one('insert into media (owner_id, kind, mime, size_bytes, storage_key, visibility) values ($1,$2,$3,$4,$5,$6) returning id',
    [owner, s.kind, s.mime, s.size, s.key, visibility])).id;
}
async function user(handle, role, { age = 25, style = 'craie:◉' } = {}) {
  const y = new Date().getFullYear() - age;
  return one(`insert into users (email, password_hash, handle, birth_year, birth_month, role, terms_version, avatar_style)
    values ($1,$2,$3,$4,1,$5,$6,$7) on conflict (email) do update set role = $5 returning id`,
  [`${handle}@${DEMO_DOMAIN}`, await hashPassword(PASSWORD), handle, y, role, config.termsVersion, style]);
}
const H = 3600e3;
const at = (ms) => new Date(Date.now() + ms);

async function seed() {
  await removeDemo();
  const admin = await user('demo_admin', 'admin', { style: 'sodium:✦' });
  const editor = await user('demo_edition', 'editor', { style: 'uv:◆' });
  await user('demo_modo', 'moderator', { style: 'canal:■' });
  const fans = [];
  for (const [h, s, age] of [['nora.19', 'sodium:◉', 17], ['ylan_prod', 'uv:▲', 20], ['mika.bzh', 'canal:✚', 16], ['sana_vibes', 'brique:○', 19]]) fans.push(await user(h, 'fan', { style: s, age }));
  for (const f of fans) await q(`insert into user_badges (user_id, badge_code) values ($1,'premiere_onde') on conflict do nothing`, [f.id]);

  console.log('… génération des médias de démonstration');
  const imgs = []; for (let i = 0; i < 6; i++) imgs.push(await addMedia(editor.id, img(i)));
  const vids = []; for (let i = 0; i < 4; i++) vids.push(await addMedia(editor.id, vid(i)));
  const preview = await addMedia(editor.id, tone(), 'protected');
  const coverA = await addMedia(editor.id, img(7, 1080, 1080), 'protected');
  const coverB = await addMedia(editor.id, img(8, 1080, 1080), 'protected');

  const post = (o) => q(`insert into posts (author_id, kind, title, body, media_id, source_type, source_platform, source_url, status, publish_at, expires_at, is_pinned, is_featured, is_demo)
    values ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$10,$11,$12,true)`,
  [editor.id, o.kind, o.title, o.body || null, o.media || null, o.source_type || 'app', o.platform || null, o.url || null, o.at || at(-H), o.expires || null, o.pinned || false, o.featured || false]);

  await post({ kind: 'announcement', title: 'Exemple · Une annonce importante de l\'équipe', body: 'Gabarit de démonstration : ici l\'équipe d\'Ifa publie une annonce officielle. Elle peut être épinglée et envoyer un signal aux fans.', pinned: true, at: at(-2 * H) });
  await post({ kind: 'backstage', title: 'Exemple · Session studio', body: 'Gabarit : coulisses filmées pendant une séance de travail.', media: vids[0], featured: true, at: at(-5 * H) });
  await post({ kind: 'clip', title: 'Exemple · Nouveau clip', body: 'Gabarit : un clip publié dans l\'appli, avec lien vers la plateforme d\'origine.', media: vids[1], source_type: 'manual', platform: 'youtube', url: 'https://www.youtube.com/', at: at(-26 * H), featured: true });
  await post({ kind: 'news', title: 'Exemple · Une publication reprise d\'Instagram', body: 'Gabarit : un post repris d\'un réseau social affiche toujours sa source et un lien vers l\'original.', media: imgs[0], source_type: 'manual', platform: 'instagram', url: 'https://www.instagram.com/', at: at(-30 * H) });
  await post({ kind: 'freestyle', title: 'Exemple · Freestyle', media: vids[2], at: at(-50 * H) });
  await post({ kind: 'backstage', title: 'Exemple · Répétition', media: imgs[1], at: at(-72 * H) });
  await post({ kind: 'story', title: 'Exemple · Onde courte', body: 'Disparaît au bout de 24 h.', media: vids[3], at: at(-3 * H), expires: at(21 * H) });
  await post({ kind: 'story', title: 'Ce soir, 20 h (exemple)', at: at(-1 * H), expires: at(23 * H) });
  await post({ kind: 'story', title: 'Exemple · Photo du jour', media: imgs[2], at: at(-6 * H), expires: at(18 * H) });

  await q(`insert into releases (title, kind, release_date, cover_media_id, description, is_demo) values
    ('Exemple · Prochain single', 'single', current_date + 9, $1, 'Gabarit de sortie annoncée.', true),
    ('Exemple · Projet précédent', 'ep', current_date - 200, $2, 'Gabarit de sortie passée.', true)`, [imgs[3], imgs[4]]);
  await q(`insert into events (title, kind, venue, city, starts_at, status, age_policy, is_demo) values
    ('Exemple · Showcase', 'showcase', 'Salle (exemple)', 'Paris 19e', $1, 'confirmed', 'Tous publics, -16 ans accompagnés', true),
    ('Exemple · Questions-réponses en live', 'qa', 'Dans Fréquence', 'En ligne', $2, 'confirmed', null, true)`, [at(24 * 24 * H), at(4 * 24 * H)]);

  const d1 = await one(`insert into drops (title, teaser, body, kind, cover_media_id, media_id, opens_at, closes_at, rights_note, is_published, notify_on_open, notified_at, is_demo, created_by)
    values ('Exemple · Extrait inédit', 'Gabarit : 20 secondes avant tout le monde.', 'Gabarit : texte révélé seulement après l''ouverture. Le son de cet exemple est une simple tonalité générée.', 'preview', $1, $2, $3, $4, 'Exemple : extrait autorisé par l''équipe pour 7 jours', true, true, now(), true, $5) returning id`,
  [imgs[5], preview, at(-2 * H), at(7 * 24 * H), editor.id]);
  const d2 = await one(`insert into drops (title, teaser, kind, opens_at, closes_at, is_published, notify_on_open, notified_at, is_demo, created_by)
    values ('Exemple · Choisis la pochette', 'Gabarit de vote : deux propositions, un vote par compte.', 'vote', $1, $2, true, true, now(), true, $3) returning id`, [at(-H), at(5 * 24 * H), editor.id]);
  await q(`insert into drop_options (drop_id, label, media_id, position) values ($1,'Proposition A',$2,0), ($1,'Proposition B',$3,1)`, [d2.id, coverA, coverB]);
  await q(`insert into drops (title, teaser, kind, opens_at, is_published, notify_on_open, is_demo, created_by)
    values ('Exemple · Ouverture programmée', 'Gabarit : le contenu reste crypté jusqu''à l''heure fixée.', 'process', $1, true, true, true, $2)`, [at(2 * 24 * H + 3 * H), editor.id]);
  for (const f of fans.slice(0, 3)) await q(`insert into drop_votes (drop_id, user_id, option_id) select $1, $2, id from drop_options where drop_id = $1 order by random() limit 1`, [d2.id, f.id]);

  const c1 = await one(`insert into circles (slug, name, description) values ('demo-19', 'Ceux du 19 (exemple)', 'Gabarit de cercle thématique.') returning id`);
  await q(`insert into circles (slug, name, description, kind, ends_at) values ('demo-sortie', 'Salle de sortie (exemple)', 'Gabarit de cercle temporaire autour d''une sortie.', 'release_room', $1)`, [at(10 * 24 * H)]);
  const ch = await one(`insert into challenges (title, brief, rules, starts_at, ends_at, notified_at, is_demo) values
    ('Exemple · Défi playback', 'Gabarit : refais le passage de ton choix en playback.', '30 secondes max. Son officiel uniquement. Pas de coordonnées dans la vidéo.', $1, $2, now(), true) returning id`, [at(-24 * H), at(6 * 24 * H)]);
  for (const f of fans) await q(`insert into circle_members (circle_id, user_id) values ($1,$2) on conflict do nothing`, [c1.id, f.id]);

  // créations de fans fictifs (comptes de démo), validées, dont une mise en avant
  for (let i = 0; i < fans.length; i++) {
    const m = await addMedia(fans[i].id, i % 2 ? vid(i + 5) : img(i + 10, 1080, 1440));
    await q(`insert into fan_posts (author_id, circle_id, challenge_id, caption, media_id, status, is_featured, rights_accepted_at, moderated_by, moderated_at)
      values ($1,$2,$3,$4,$5,'approved',$6,now(),$7,now())`, [fans[i].id, c1.id, i < 2 ? ch.id : null, `Exemple de création de fan n°${i + 1}`, m, i === 0, admin.id]);
  }
  // une création en attente pour montrer la file de modération
  const pending = await addMedia(fans[2].id, img(20, 1080, 1440));
  await q(`insert into fan_posts (author_id, caption, media_id, rights_accepted_at) values ($1,'Exemple en attente de modération',$2,now())`, [fans[2].id, pending]);

  console.log(`✓ démo prête. Comptes (mot de passe « ${PASSWORD} ») :`);
  console.log(`  demo_admin@${DEMO_DOMAIN} (admin) · demo_edition@${DEMO_DOMAIN} (édition) · demo_modo@${DEMO_DOMAIN} (modération) · nora.19@${DEMO_DOMAIN} (fan)`);
}

await migrate({ quiet: true });
if (process.argv.includes('--remove')) await removeDemo(); else await seed();
fs.rmSync(tmp, { recursive: true, force: true });
await pool.end();
