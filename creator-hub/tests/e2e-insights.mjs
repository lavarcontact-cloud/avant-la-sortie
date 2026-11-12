// Test navigateur — intégration du relevé Instagram personnel réel (data/imports/instagram-personnel-2026-11-12.json).
// Le compte La Var Media utilisé ici est une donnée de TEST (« test_lavar »). Base dédiée obligatoire.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100", PASS = process.env.PASS, CRON = process.env.CRON, SHOTS = process.env.SHOTS;
const FILE = path.resolve("data/imports/instagram-personnel-2026-11-12.json");
const results = [];
const step = async (name, fn) => { try { await fn(); results.push("OK"); console.log("✓", name); } catch (e) { results.push("FAIL"); console.log("✗", name, "\n   ", e.message.split("\n")[0]); throw e; } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
const main = () => page.locator("main").innerText();

try {
  await step("Connexion + compte La Var Media de test pré-existant", async () => {
    await page.goto(`${BASE}/login`); await page.fill("#password", PASS); await page.click("button:has-text('Entrer')"); await page.waitForURL(`${BASE}/hub`);
    await page.goto(`${BASE}/hub/audience?owner=lavar_media`);
    const add = page.locator("form:has(input[name=handle])");
    await add.locator("input[name=handle]").fill("test_lavar"); await add.locator("button:has-text('Ajouter')").click();
    await page.getByText("Compte ajouté").waitFor(); await page.reload();
    await page.click("button:has-text('+ Relevé manuel')");
    const f = page.locator("form:has(input[name=captured_on])");
    await f.locator("input[name=source]").fill("TEST — donnée fictive La Var"); await f.locator("input[name=followers]").fill("50000");
    await f.locator("button:has-text('Enregistrer le relevé')").click(); await page.getByText("Relevé enregistré").waitFor();
  });
  await step("Import du relevé réel via l'interface", async () => {
    await page.goto(`${BASE}/hub/audience`);
    await page.click("button:has-text('↑ Import JSON')");
    await page.locator("form:has(textarea[name=json]) input[name=file]").setInputFiles(FILE);
    await page.click("button:has-text('Importer le relevé')");
    await page.getByText(/Compte « personnel » créé : 2 relevé\(s\) ajouté\(s\), 14 contenu\(s\) ajouté\(s\)/).waitFor();
  });
  await step("Indicateurs réels affichés (abonnés, engagement, croissance, vues/publication, story)", async () => {
    await page.reload();
    const t = await main();
    assert.match(t, /Abonnés\s*2\s?386/); assert.match(t, /Portée 30 j\s*15\s?381/); assert.match(t, /Vues 30 j\s*61\s?458/);
    assert.match(t, /Engagement\s*10,3 %/); assert.match(t, /Croissance\/mois\s*4,2 %/);
    assert.match(t, /médiane de 5 publications/); assert.match(t, /Vues \/ story : 313/);
    assert.match(t, /non extrapolée/);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/20-audience-reelle.png`, fullPage: true });
  });
  await step("Détail du relevé : démographie, formats, profil, contenus", async () => {
    const t = await main();
    for (const re of [/France\s*78,6 %/, /25-34[\s\S]{0,40}51,9 %/, /hommes[\s\S]{0,40}78,3 %/i, /Français\s*91,4 %/, /18 h – 21 h/, /Appuis lien en bio\s*0/, /Contenus saisis \(14\)/, /JE ME CROIS/]) assert.match(t, re);
  });
  await step("Tarifs proposés (UGC vs influence) et recommandations", async () => {
    const t = await main();
    assert.match(t, /UGC sans publication\s*140\s€\s*220\s€\s*340\s€\s*220\s€/);
    assert.match(t, /Reel Instagram\s*178\s€\s*292\s€\s*460\s€\s*290\s€/);
    assert.match(t, /Influence seule \(diffusion d'un contenu fourni\)/);
    assert.match(t, /Ajouter un lien en bio/);
    assert.match(t, /TikTok sponsorisé\s*Non estimable/);
  });
  await step("Ré-import : rien n'est dupliqué ni écrasé", async () => {
    await page.click("button:has-text('↑ Import JSON')");
    await page.locator("form:has(textarea[name=json]) input[name=file]").setInputFiles(FILE);
    await page.click("button:has-text('Importer le relevé')");
    await page.getByText(/0 relevé\(s\) ajouté\(s\), 2 déjà présent\(s\) conservé\(s\) sans modification/).waitFor();
  });
  await step("Séparation des entités : La Var Media inchangée, jamais additionnée", async () => {
    await page.goto(`${BASE}/hub/audience?owner=lavar_media`);
    const t = await main();
    assert.match(t, /Abonnés \(entité\)\s*50\s?000/); assert.doesNotMatch(t, /2\s?386/);
    await page.goto(`${BASE}/hub/audience`);
    const p = await main();
    assert.match(p, /Abonnés \(entité\)\s*2\s?386/); assert.doesNotMatch(p, /52\s?386|50\s?000/);
  });
  await step("Renommage de l'identifiant du compte", async () => {
    await page.click("button:has-text(\"Modifier l'identifiant\")");
    await page.locator("form:has(input[name=id]) input[name=handle]").fill("test_identifiant");
    await page.locator("form:has(input[name=id]) button:has-text('Enregistrer')").click();
    await page.getByText("Compte mis à jour").waitFor();
  });
  await step("Dashboard et bilans intègrent l'audience personnelle", async () => {
    await page.goto(`${BASE}/hub`);
    assert.match(await main(), /instagram @test_identifiant : 2\s?386 abonnés · 15\s?381 comptes atteints \/ 30 j · engagement 10,3 %/);
    const r = await page.request.get(`${BASE}/api/cron/reports?slot=evening`, { headers: { authorization: `Bearer ${CRON}` } });
    assert.ok(r.ok());
    await page.goto(`${BASE}/hub/reports`);
    assert.match(await main(), /Audience \(personnel\) : instagram @test_identifiant — 2\s?386 abonnés/);
  });
} finally {
  await browser.close();
  console.log(`\n${results.filter((r) => r === "OK").length}/${results.length} étapes réussies`);
  process.exitCode = results.includes("FAIL") ? 1 : 0;
}
