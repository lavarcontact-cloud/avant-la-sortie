// Tests d'intégration de l'API contre une vraie base PostgreSQL (ifa_test).
// Lancement : DATABASE_URL=postgres://ifa:ifa@localhost:5432/ifa_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATABASE_URL ||= 'postgres://ifa:ifa@localhost:5432/ifa_test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'frq-up-'));
process.env.DISABLE_RATE_LIMIT = '1';
process.env.DISABLE_SCHEDULER = '1';

const { pool, q, one } = await import('../server/db.js');
const { migrate } = await import('../scripts/migrate.js');
const { createApp } = await import('../server/app.js');
const { tick } = await import('../server/lib/scheduler.js');
const { sha256 } = await import('../server/lib/auth.js');

let server, base;
const fixture = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url));

// Petit client HTTP avec cookie de session.
function client() {
  let cookie = '';
  const call = async (method, url, body, { form } = {}) => {
    const headers = { 'x-frq': '1' };
    if (cookie) headers.cookie = cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data, headers: res.headers };
  };
  return {
    get: (u) => call('GET', u), post: (u, b, o) => call('POST', u, b, o), put: (u, b) => call('PUT', u, b),
    patch: (u, b) => call('PATCH', u, b), del: (u, b) => call('DELETE', u, b),
  };
}
const thisYear = new Date().getUTCFullYear();
let n = 0;
async function signup(age = 20, extra = {}) {
  const c = client();
  n++;
  const res = await c.post('/api/auth/signup', {
    email: `fan${n}@test.fr`, password: 'motdepasse1', handle: `fan_${n}`, birth_year: thisYear - age - 1, birth_month: 1,
    accept_terms: true, ...extra,
  });
  return { c, res, user: res.data.user };
}
async function staff(role) {
  const { c, user } = await signup(30);
  await q('update users set role = $2 where id = $1', [user.id, role]);
  return { c, user };
}
async function upload(c, url, file, name, fields = {}) {
  const form = new FormData();
  form.append('file', new Blob([fixture(file)]), name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return c.post(url, undefined, { form });
}

before(async () => {
  await pool.query('drop schema public cascade; create schema public;');
  await migrate({ quiet: true });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await pool.end(); });

test('inscription majeure : compte actif + badge de lancement', async () => {
  const { res, c } = await signup(19);
  assert.equal(res.status, 201);
  assert.equal(res.data.user.status, 'active');
  assert.equal(res.data.user.is_minor, false);
  const me = await c.get('/api/auth/me');
  assert.equal(me.data.badges[0].code, 'premiere_onde');
  assert.equal(me.data.prefs.personalized, true);
});

test('e-mail et pseudo uniques, pseudos réservés refusés', async () => {
  const c = client();
  const a = await c.post('/api/auth/signup', { email: 'dup@test.fr', password: 'motdepasse1', handle: 'dup_one', birth_year: 2000, birth_month: 1, accept_terms: true });
  assert.equal(a.status, 201);
  const b = await client().post('/api/auth/signup', { email: 'dup@test.fr', password: 'motdepasse1', handle: 'dup_two', birth_year: 2000, birth_month: 1, accept_terms: true });
  assert.equal(b.status, 409);
  const off = await client().post('/api/auth/signup', { email: 'x@test.fr', password: 'motdepasse1', handle: 'ifa_officiel', birth_year: 2000, birth_month: 1, accept_terms: true });
  assert.equal(off.status, 400);
});

test('âge minimum et consentement parental sous 15 ans', async () => {
  const tooYoung = await signup(10);
  assert.equal(tooYoung.res.status, 403);
  const noParent = await signup(13);
  assert.equal(noParent.res.status, 400, 'e-mail parent requis');
  const kid = await signup(13, { parent_email: 'parent@test.fr' });
  assert.equal(kid.res.status, 201);
  assert.equal(kid.user.status, 'pending_parent');
  // lecture seule tant que le parent n'a pas répondu
  const prefs = await kid.c.get('/api/auth/me');
  assert.equal(prefs.data.prefs.personalized, false, 'personnalisation désactivée par défaut pour un mineur');
  assert.equal(prefs.data.prefs.quiet_start, 21);
  const post = await one(`insert into posts (kind, title, status, publish_at) values ('news','Actu', 'published', now()) returning id`);
  const blocked = await kid.c.post('/api/comments', { target_type: 'post', target_id: post.id, body: 'trop bien' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.code, 'pending_parent');
  // le parent accepte via son lien
  await q('update users set parent_token_hash = $2 where id = $1', [kid.user.id, sha256('jeton-test')]);
  const info = await client().get('/api/parent/jeton-test');
  assert.equal(info.data.handle, kid.user.handle);
  const ok = await client().post('/api/parent/jeton-test', { decision: 'accept' });
  assert.equal(ok.data.status, 'active');
  const now = await kid.c.post('/api/comments', { target_type: 'post', target_id: post.id, body: 'trop bien' });
  assert.equal(now.status, 201);
});

test('protection CSRF : écriture sans en-tête refusée', async () => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('rôles : un fan n\'accède pas à l\'admin, un modérateur ne publie pas', async () => {
  const { c } = await signup(20);
  assert.equal((await c.get('/api/admin/overview')).status, 403);
  const m = await staff('moderator');
  assert.equal((await m.c.get('/api/admin/overview')).status, 200);
  assert.equal((await m.c.post('/api/admin/posts', { kind: 'news', title: 'x' })).status, 403);
  assert.equal((await m.c.get('/api/admin/moderation')).status, 200);
});

test('publication immédiate, programmée, et règle de source', async () => {
  const e = await staff('editor');
  const fan = await signup(20);
  const now = await e.c.post('/api/admin/posts', { kind: 'announcement', title: 'Annonce test', body: 'Texte' });
  assert.equal(now.status, 201);
  assert.equal(now.data.status, 'published');
  const qg = await fan.c.get('/api/qg');
  assert.ok(qg.data.feed.some((p) => p.id === now.data.id));

  const later = new Date(Date.now() + 3600e3).toISOString();
  const sch = await e.c.post('/api/admin/posts', { kind: 'news', title: 'Plus tard', publish_at: later, action: 'schedule' });
  assert.equal(sch.data.status, 'scheduled');
  assert.equal((await fan.c.get(`/api/posts/${sch.data.id}`)).status, 404);
  await q(`update posts set publish_at = now() - interval '1 minute' where id = $1`, [sch.data.id]);
  await tick();
  assert.equal((await fan.c.get(`/api/posts/${sch.data.id}`)).status, 200);

  const noSource = await e.c.post('/api/admin/posts', { kind: 'news', title: 'Repris d\'Insta', source_type: 'manual' });
  assert.equal(noSource.status, 400);
  const withSource = await e.c.post('/api/admin/posts', { kind: 'news', title: 'Repris d\'Insta', source_type: 'manual', source_platform: 'instagram', source_url: 'https://www.instagram.com/p/abc/' });
  assert.equal(withSource.status, 201);
  const p = await fan.c.get(`/api/posts/${withSource.data.id}`);
  assert.equal(p.data.source.platform, 'instagram');

  const story = await e.c.post('/api/admin/posts', { kind: 'story', title: 'Story' });
  assert.ok(new Date(story.data.expires_at) > new Date(), 'une story expire par défaut sous 24 h');
  await q(`update posts set expires_at = now() - interval '1 second' where id = $1`, [story.data.id]);
  assert.equal((await fan.c.get(`/api/posts/${story.data.id}`)).status, 404, 'story expirée invisible');
});

test('Labo : aucun fichier confidentiel exposé avant l\'ouverture', async () => {
  const e = await staff('editor');
  const fan = await signup(20);
  const anon = client();
  // un fichier d'avant-première doit être "protected"
  const pub = await upload(e.c, '/api/admin/media', 'tone.mp3', 'a.mp3', { visibility: 'public' });
  const refused = await e.c.post('/api/admin/drops', { title: 'X', kind: 'preview', opens_at: new Date().toISOString(), media_id: pub.data.id });
  assert.equal(refused.status, 400);

  const media = await upload(e.c, '/api/admin/media', 'tone.mp3', 'extrait.mp3', { visibility: 'protected' });
  assert.equal(media.status, 201);
  const noRights = await e.c.post('/api/admin/drops', { title: 'Extrait', kind: 'preview', opens_at: new Date(Date.now() + 864e5).toISOString(), media_id: media.data.id, is_published: true });
  assert.equal(noRights.status, 400, 'droits de diffusion obligatoires');
  const drop = await e.c.post('/api/admin/drops', {
    title: 'Extrait inédit', teaser: 'Bientôt', body: 'Texte secret', kind: 'preview',
    opens_at: new Date(Date.now() + 864e5).toISOString(), media_id: media.data.id, rights_note: 'Autorisé par l\'équipe', is_published: true,
  });
  assert.equal(drop.status, 201);

  const locked = await fan.c.get(`/api/labo/${drop.data.id}`);
  assert.equal(locked.data.unlocked, false);
  assert.equal(locked.data.media, undefined);
  assert.equal(locked.data.body, undefined);
  assert.ok(!JSON.stringify(locked.data).includes(media.data.id), 'l\'identifiant du fichier ne fuit pas');
  assert.equal((await fan.c.get(`/api/media/${media.data.id}`)).status, 403);
  assert.equal((await anon.get(`/api/media/${media.data.id}`)).status, 403);
  const modo = await staff('moderator');
  assert.equal((await modo.c.get(`/api/media/${media.data.id}`)).status, 403, 'un modérateur n\'écoute pas les inédits');

  await q(`update drops set opens_at = now() - interval '1 minute' where id = $1`, [drop.data.id]);
  const open = await fan.c.get(`/api/labo/${drop.data.id}`);
  assert.equal(open.data.unlocked, true);
  assert.equal(open.data.body, 'Texte secret');
  const stream = await fan.c.get(open.data.media.url);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get('cache-control'), 'private, no-store');
  assert.equal((await anon.get(`/api/media/${media.data.id}`)).status, 403, 'connexion requise même ouvert');

  await q(`update drops set closes_at = now() - interval '1 second' where id = $1`, [drop.data.id]);
  assert.equal((await fan.c.get(`/api/media/${media.data.id}`)).status, 403, 'refermé après la date de fin');
});

test('Labo : accès par badge, ouverture notifiée une seule fois', async () => {
  const e = await staff('editor');
  const fan = await signup(20);
  const d = await e.c.post('/api/admin/drops', { title: 'Réservé', kind: 'process', opens_at: new Date(Date.now() - 1000).toISOString(), access: 'badge', required_badge: 'selection', is_published: true });
  assert.equal((await fan.c.get(`/api/labo/${d.data.id}`)).data.unlocked, false);
  await q(`insert into user_badges (user_id, badge_code) values ($1, 'selection')`, [fan.user.id]);
  assert.equal((await fan.c.get(`/api/labo/${d.data.id}`)).data.unlocked, true);
  await tick();
  await tick();
  const b = await one(`select count(*)::int n from broadcasts where origin = $1`, [`drop:${d.data.id}`]);
  assert.equal(b.n, 1);
});

test('vote : un seul vote, résultats masqués avant de voter', async () => {
  const e = await staff('editor');
  const fan = await signup(20);
  const d = await e.c.post('/api/admin/drops', { title: 'Quelle pochette ?', kind: 'vote', opens_at: new Date(Date.now() - 1000).toISOString(), is_published: true, options: [{ label: 'A' }, { label: 'B' }] });
  const before = await fan.c.get(`/api/labo/${d.data.id}`);
  assert.equal(before.data.options.length, 2);
  assert.equal(before.data.options[0].votes, null);
  const v = await fan.c.post(`/api/labo/${d.data.id}/vote`, { option_id: before.data.options[1].id });
  assert.equal(v.status, 200);
  assert.equal(v.data.total_votes, 1);
  assert.equal(v.data.my_vote, before.data.options[1].id);
  assert.equal((await fan.c.post(`/api/labo/${d.data.id}/vote`, { option_id: before.data.options[0].id })).status, 409);
});

test('création de fan : pré-modération, puis validation et badge', async () => {
  const fan = await signup(16);
  const other = await signup(20);
  const m = await staff('moderator');
  const noRights = await upload(fan.c, '/api/fan-posts', 'img.jpg', 'p.jpg', { caption: 'Mon playback' });
  assert.equal(noRights.status, 400);
  const fake = new FormData();
  fake.append('file', new Blob([Buffer.from('pas une image')]), 'x.jpg');
  fake.append('rights', 'true');
  assert.equal((await fan.c.post('/api/fan-posts', undefined, { form: fake })).status, 415, 'type vérifié par signature binaire');

  const p = await upload(fan.c, '/api/fan-posts', 'img.jpg', 'p.jpg', { caption: 'Mon playback', rights: 'true' });
  assert.equal(p.status, 201);
  assert.equal(p.data.status, 'pending');
  assert.ok(!(await other.c.get('/api/fan-posts')).data.some((x) => x.id === p.data.id), 'invisible avant validation');
  const mine = await fan.c.get('/api/fan-posts/mine');
  assert.equal(mine.data[0].status, 'pending');
  assert.equal((await other.c.get(`/api/media/${mine.data[0].media_id}`)).status, 404, 'fichier en attente non accessible');

  const q1 = await m.c.get('/api/admin/moderation');
  assert.ok(q1.data.pending.some((x) => x.id === p.data.id));
  assert.equal((await m.c.post(`/api/admin/fan-posts/${p.data.id}/decision`, { decision: 'reject' })).status, 400, 'motif obligatoire au refus');
  const ok = await m.c.post(`/api/admin/fan-posts/${p.data.id}/decision`, { decision: 'approve' });
  assert.equal(ok.status, 200);
  assert.ok((await other.c.get('/api/fan-posts')).data.some((x) => x.id === p.data.id));
  const me = await fan.c.get('/api/auth/me');
  assert.ok(me.data.badges.some((b) => b.code === 'createur'));
  assert.ok(me.data.unread >= 1, 'notification de validation');
});

test('commentaires : filtre, signalements, masquage auto et blocage', async () => {
  const a = await signup(20); const b = await signup(20); const c = await signup(20); const d = await signup(20);
  const post = await one(`insert into posts (kind, title, status, publish_at) values ('news','Actu 2', 'published', now()) returning id`);
  const insult = await a.c.post('/api/comments', { target_type: 'post', target_id: post.id, body: 'sale pute' });
  assert.equal(insult.status, 422);
  const phone = await a.c.post('/api/comments', { target_type: 'post', target_id: post.id, body: 'appelle moi 06 12 34 56 78' });
  assert.equal(phone.status, 422, 'pas de coordonnées dans les espaces publics');
  const ok = await a.c.post('/api/comments', { target_type: 'post', target_id: post.id, body: 'Une dispute de haut niveau' });
  assert.equal(ok.status, 201);

  await b.c.post('/api/blocks', { user_id: a.user.id });
  const seenByB = await b.c.get(`/api/comments?target_type=post&target_id=${post.id}`);
  assert.equal(seenByB.data.length, 0, 'commentaires d\'un compte bloqué masqués');

  for (const x of [b, c, d]) await x.c.post('/api/reports', { target_type: 'comment', target_id: ok.data.id, reason: 'harassment' });
  const after = await c.c.get(`/api/comments?target_type=post&target_id=${post.id}`);
  assert.equal(after.data.length, 0, 'masqué après 3 signalements');
  const m = await staff('moderator');
  const mod = await m.c.get('/api/admin/moderation');
  assert.ok(mod.data.reports.some((r) => r.target_id === ok.data.id && r.count === 3));
  await m.c.post('/api/admin/reports/resolve', { target_type: 'comment', target_id: ok.data.id, action: 'suspend' });
  const login = await client().post('/api/auth/login', { email: `fan${n - 4}@test.fr`, password: 'motdepasse1' });
  assert.equal(login.status, 403, 'compte suspendu');
});

test('signaux : préférences respectées, push non simulé sans configuration', async () => {
  const e = await staff('editor');
  const yes = await signup(20);
  const no = await signup(20);
  await no.c.put('/api/notifications/prefs', { categories: { event: false } });
  const b = await e.c.post('/api/admin/broadcasts', { category: 'event', title: 'Rappel : concert ce soir', url: '/ifa' });
  assert.equal(b.status, 201);
  assert.equal((await e.c.post('/api/admin/broadcasts', { category: 'event', title: 'x', url: 'https://ailleurs.com' })).status, 400);
  await tick();
  const sent = await one('select status, stats from broadcasts where id = $1', [b.data.id]);
  assert.equal(sent.status, 'sent');
  assert.equal(sent.stats.push_configured, false);
  assert.equal(sent.stats.push_sent, 0);
  assert.ok((await yes.c.get('/api/notifications')).data.items.some((x) => x.title === 'Rappel : concert ce soir'));
  assert.ok(!(await no.c.get('/api/notifications')).data.items.some((x) => x.title === 'Rappel : concert ce soir'));
  const sub = await yes.c.post('/api/push/subscribe', { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } });
  assert.equal(sub.status, 503, 'abonnement refusé honnêtement quand le push n\'est pas configuré');
  const t = await yes.c.post('/api/push/test');
  assert.equal(t.data.ok, false);
});

test('heures calmes (fuseau Europe/Paris)', async () => {
  const { inQuietHours } = await import('../server/lib/notify.js');
  const at = (h) => new Date(Date.UTC(2026, 0, 15, h - 1)); // janvier : Paris = UTC+1
  assert.equal(inQuietHours({ quiet_start: 22, quiet_end: 8 }, at(23)), true);
  assert.equal(inQuietHours({ quiet_start: 22, quiet_end: 8 }, at(7)), true);
  assert.equal(inQuietHours({ quiet_start: 22, quiet_end: 8 }, at(12)), false);
});

test('RGPD : export puis suppression du compte', async () => {
  const fan = await signup(20);
  const exp = await fan.c.get('/api/me/export');
  assert.equal(exp.data.account.handle, fan.user.handle);
  assert.equal(exp.data.account.password_hash, undefined);
  assert.equal((await fan.c.del('/api/me', { password: 'mauvais' })).status, 401);
  assert.equal((await fan.c.del('/api/me', { password: 'motdepasse1' })).status, 200);
  assert.equal(await one('select 1 from users where id = $1', [fan.user.id]), null);
});
