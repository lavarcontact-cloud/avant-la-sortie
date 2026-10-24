// Parcours de bout en bout dans un vrai navigateur (Chromium/Playwright), en
// viewport mobile. Prérequis : `npm run build`, base avec `npm run seed:demo`.
// Usage : npm run test:e2e   (captures dans tests/screens/)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const RUN = Date.now().toString(36); // textes uniques : la base de démo garde les passages précédents
const OUT = new URL('./screens/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['server/index.js'], { env: { ...process.env, PORT: String(PORT), SCHEDULER_INTERVAL_MS: '2000', DISABLE_RATE_LIMIT: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => server.stdout.on('data', (d) => d.toString().includes('API sur') && ok()));

const browser = await chromium.launch();
const errors = [];
const results = [];
async function ctx() {
  const c = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const p = await c.newPage();
  p.on('console', (m) => m.type() === 'error' && !m.text().includes('youtube') && !m.text().includes('422') && errors.push(`${p.url()} → ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`${p.url()} → ${e.message}`));
  return p;
}
async function step(name, fn) {
  try { await fn(); results.push(`✓ ${name}`); } catch (e) { results.push(`✗ ${name} : ${e.message.split('\n')[0]}`); }
}
const shot = (p, n) => p.screenshot({ path: `${OUT}${n}.png` });
async function login(p, email) {
  await p.goto(`${BASE}/bienvenue`);
  await p.getByRole('button', { name: 'J\'ai déjà un compte' }).click();
  await p.getByLabel('E-mail').fill(email);
  await p.getByLabel('Mot de passe').fill('frequence-demo');
  await p.getByRole('button', { name: 'Me connecter' }).click();
  await p.waitForURL(`${BASE}/`);
}

const anon = await ctx();
await step('QG (visiteur) : signal, ondes courtes, fil officiel', async () => {
  await anon.goto(BASE);
  await anon.getByText('Les news').waitFor();
  await anon.getByText('Exemple · Une annonce importante').first().waitFor();
  await shot(anon, '01-qg');
  await anon.evaluate(() => window.scrollTo(0, 900)); await anon.waitForTimeout(300); await shot(anon, '01b-qg-fil');
});
await step('Onde courte en plein écran', async () => {
  await anon.goto(BASE);
  await anon.locator('button.story').first().click();
  await anon.locator('.viewer').waitFor();
  await shot(anon, '02-onde-courte');
  await anon.getByRole('button', { name: 'Fermer' }).click();
});
await step('Immersion : le tunnel et ses pistes', async () => {
  await anon.goto(`${BASE}/immersion`);
  await anon.locator('.shot video').first().waitFor();
  await anon.waitForTimeout(800);
  await shot(anon, '03-immersion');
  await anon.getByRole('tab', { name: 'Créations fans' }).click();
  await anon.waitForTimeout(500);
});
await step('Labo visiteur : contenu verrouillé, aucun fichier exposé', async () => {
  await anon.goto(`${BASE}/labo`);
  await anon.getByText('Exemple · Extrait inédit').waitFor();
  await shot(anon, '04-labo');
  await anon.getByText('Exemple · Extrait inédit').click();
  await anon.getByText('Connecte-toi pour accéder au Labo').waitFor();
  if (await anon.locator('audio').count()) throw new Error('lecteur visible sans connexion');
});
await step('Profil officiel Ifa', async () => {
  await anon.goto(`${BASE}/ifa`);
  await anon.getByText('Profil officiel').waitFor();
  await anon.locator('a[href="https://www.instagram.com/ifa_pursang"]').waitFor();
  await shot(anon, '05-ifa');
});
await step('Cercles', async () => {
  await anon.goto(`${BASE}/cercles`);
  await anon.getByText('Défis ouverts').waitFor();
  await shot(anon, '06-cercles');
});

const newbie = await ctx();
await step('Inscription d\'un nouveau fan (14 ans → accord parental)', async () => {
  await newbie.goto(`${BASE}/bienvenue`);
  await shot(newbie, '07-onboarding');
  await newbie.getByRole('button', { name: 'Créer mon compte' }).click();
  await newbie.getByLabel('Pseudo').fill(`e2e_${Date.now() % 1e6}`);
  await newbie.getByLabel('Mois de naissance').selectOption('1');
  await newbie.getByLabel('Année').selectOption(String(new Date().getFullYear() - 14));
  await newbie.getByLabel('E-mail d\'un parent').fill('parent-e2e@example.com');
  await newbie.getByLabel('E-mail', { exact: true }).fill(`e2e${Date.now()}@example.com`);
  await newbie.getByLabel('Mot de passe').fill('motdepasse-e2e');
  await newbie.locator('.check input').check();
  await shot(newbie, '08-inscription');
  await newbie.getByRole('button', { name: 'Créer mon compte' }).click();
  await newbie.getByText('On a envoyé un e-mail à ton parent').waitFor();
  await shot(newbie, '09-attente-parent');
});

const fan = await ctx();
await step('Fan : connexion, Labo ouvert avec lecteur', async () => {
  await login(fan, 'nora.19@demo.frequence.local');
  await fan.goto(`${BASE}/labo`);
  await fan.getByText('Exemple · Extrait inédit').click();
  await fan.locator('.player').waitFor();
  const src = await fan.locator('audio').getAttribute('src');
  const res = await fan.request.get(`${BASE}${src}`);
  if (res.status() !== 200) throw new Error(`flux audio ${res.status()}`);
  await shot(fan, '10-labo-ouvert');
});
await step('Fan : vote (résultats après le vote)', async () => {
  await fan.goto(`${BASE}/labo`);
  await fan.getByText('Exemple · Choisis la pochette').click();
  await fan.locator('.vote-opt').first().waitFor();
  if (await fan.getByText('Résultats').count() === 0) await fan.locator('.vote-opt').first().click();
  await fan.getByText('Résultats').waitFor();
  await shot(fan, '11-vote');
});
await step('Fan : commentaire filtré puis publié', async () => {
  await fan.goto(BASE);
  await fan.getByText('Exemple · Une annonce importante').first().click();
  await fan.getByLabel('Ton commentaire').fill('appelle moi au 06 12 34 56 78');
  await fan.getByRole('button', { name: 'Envoyer' }).click();
  await fan.getByText('Pas de coordonnées personnelles').waitFor();
  await fan.getByLabel('Ton commentaire').fill(`Trop hâte de la suite ! ${RUN}`);
  await fan.getByRole('button', { name: 'Envoyer' }).click();
  await fan.getByText(`Trop hâte de la suite ! ${RUN}`).waitFor();
  await shot(fan, '12-commentaires');
});
await step('Fan : publier une création (pré-modération)', async () => {
  await fan.goto(`${BASE}/cercles/publier`);
  await fan.locator('input[type=file]').setInputFiles(new URL('./fixtures/img.jpg', import.meta.url).pathname);
  await fan.getByLabel('Légende').fill(`Création e2e ${RUN}`);
  await fan.locator('.check input').check();
  await shot(fan, '13-publier');
  await fan.getByRole('button', { name: 'Envoyer en validation' }).click();
  await fan.getByText('C\'est').waitFor();
});
await step('Fan : réglages des signaux (push non configuré, dit honnêtement)', async () => {
  await fan.goto(`${BASE}/moi/signaux`);
  await fan.getByText('pas encore activées par l\'équipe').waitFor();
  await shot(fan, '14-reglages-signaux');
  await fan.goto(`${BASE}/moi`);
  await shot(fan, '15-moi');
});

const modo = await ctx();
await step('Modérateur : valide la création', async () => {
  await login(modo, 'demo_modo@demo.frequence.local');
  await modo.goto(`${BASE}/regie/moderation`);
  await modo.getByText(`Création e2e ${RUN}`).waitFor();
  await shot(modo, '16-regie-moderation');
  const item = modo.locator('.mod-item', { hasText: `Création e2e ${RUN}` });
  await item.getByRole('button', { name: 'Publier' }).click();
  await modo.getByText(`Création e2e ${RUN}`).waitFor({ state: 'detached' });
});

const ed = await context2();
async function context2() { const p = await ctx(); await p.setViewportSize({ width: 1280, height: 860 }); return p; }
await step('Édition : publie une annonce avec signal, le fan la reçoit', async () => {
  await login(ed, 'demo_edition@demo.frequence.local');
  await ed.goto(`${BASE}/regie`);
  await ed.getByRole('heading', { name: 'Tableau de bord' }).waitFor();
  await shot(ed, '17-regie-tableau');
  await ed.goto(`${BASE}/regie/publications?nouveau=announcement`);
  await ed.getByLabel('Titre').fill(`Exemple · Annonce e2e ${RUN}`);
  await ed.locator('.check', { hasText: 'Envoyer un signal' }).locator('input').check();
  await shot(ed, '18-regie-publier');
  await ed.getByRole('button', { name: 'Publier', exact: true }).click();
  await ed.getByText('Publié sur le QG').waitFor();
  await fan.waitForTimeout(5000);
  await fan.goto(`${BASE}/signaux`);
  await fan.getByText(`Exemple · Annonce e2e ${RUN}`).waitFor();
  await shot(fan, '19-signaux');
  await fan.getByText(`Exemple · Annonce e2e ${RUN}`).click();
  await fan.waitForURL(/\/qg\//);
});
await step('Édition : signaux, statistiques', async () => {
  await ed.goto(`${BASE}/regie/signaux`);
  await ed.getByText('push non configuré').first().waitFor();
  await shot(ed, '20-regie-signaux');
  await ed.goto(`${BASE}/regie/stats`);
  await ed.getByText('Contenus les plus vus').waitFor();
  await shot(ed, '21-regie-stats');
});
await step('PWA : manifeste et service worker', async () => {
  const m = await (await anon.request.get(`${BASE}/manifest.webmanifest`)).json();
  if (m.display !== 'standalone' || m.icons.length < 3) throw new Error('manifeste incomplet');
  await anon.goto(BASE);
  const sw = await anon.evaluate(async () => { const r = await navigator.serviceWorker.ready; return Boolean(r.active); });
  if (!sw) throw new Error('service worker inactif');
});

await browser.close();
server.kill();
console.log(results.join('\n'));
if (errors.length) console.log(`\nErreurs console (${errors.length}) :\n${[...new Set(errors)].slice(0, 15).join('\n')}`);
const failed = results.filter((r) => r.startsWith('✗')).length;
console.log(`\n${results.length - failed}/${results.length} parcours OK`);
process.exit(failed ? 1 : 0);
