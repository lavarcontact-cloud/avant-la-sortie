// Test navigateur — phase 2 (veille, scoring, Business Forecast, Audience Value, apprentissage, rapports).
// Données de test UNIQUEMENT (domaines example-test…, comptes @test_…). À lancer sur une base dédiée.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3100", PASS = process.env.PASS, SHOTS = process.env.SHOTS, CRON = process.env.CRON;
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(["OK", name]); console.log("✓", name); } catch (e) { results.push(["FAIL", name]); console.log("✗", name, "\n   ", e.message.split("\n")[0]); throw e; } };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const IMPORT = [
  "https://www.example-test-cameras.fr/presse ; Example Test Cameras — Espace presse ; Example Test Cameras lance sa nouvelle gamme de caméra hybride et son programme ambassadeur pour créateurs.",
  "https://fr.linkedin.com/in/test-jeanne ; Jeanne Testeuse - Influence Manager - Example Test Cameras | LinkedIn ;",
  "https://www.example-test-casino.fr ; Test Casino en ligne ; bonus casino paris sportifs",
  "https://www.linkedin.com/company/example ; Example | LinkedIn ; page entreprise",
  "https://www.example-test-sneakers.com/drop ; Test Sneakers — nouvelle collection capsule ; Drop streetwear et recherche de créateurs UGC",
].join("\n");

try {
  await step("Connexion", async () => {
    await page.goto(`${BASE}/login`); await page.fill("#password", PASS); await page.click("button:has-text('Entrer')"); await page.waitForURL(`${BASE}/hub`);
    await page.getByText("Qui contacter aujourd'hui ?").waitFor();
    await page.getByText("Valeur de l'audience").waitFor();
  });
  await step("Veille sans source configurée : aucune veille simulée", async () => {
    await page.goto(`${BASE}/hub/watch`);
    await page.getByText("Non configurée").waitFor();
    await page.click("button:has-text('Lancer la veille maintenant')");
    await page.getByText(/Aucun fournisseur de recherche configuré/).first().waitFor();
  });
  await step("Import manuel : signaux, score, exclusions éthiques, profils publics", async () => {
    await page.click("button:has-text('Coller des résultats')");
    await page.fill("textarea[name=results]", IMPORT);
    await page.click("button:has-text('Analyser et dédoublonner')");
    await page.getByText(/5 résultat\(s\) analysé\(s\) : 2 nouvelle\(s\) marque\(s\), 1 interlocuteur\(s\)/).waitFor();
    await page.reload();
    const txt = await page.locator("main").innerText();
    assert.match(txt, /Example Test Cameras/); assert.match(txt, /Test Sneakers/);
    assert.doesNotMatch(txt, /Test Casino/); // secteur exclu
    assert.match(txt, /Programme ambassadeur/); assert.match(txt, /Recherche de créateurs UGC/);
    assert.match(txt, /Jeanne Testeuse/); assert.match(txt, /poste actuel à confirmer/);
    await shot("10-veille");
  });
  await step("Déduplication : un ré-import ne crée aucune nouvelle découverte", async () => {
    await page.click("button:has-text('Coller des résultats')");
    await page.fill("textarea[name=results]", IMPORT);
    await page.click("button:has-text('Analyser et dédoublonner')");
    await page.getByText(/0 nouvelle\(s\) marque\(s\), 0 interlocuteur\(s\), 3 déjà connu\(s\)/).waitFor();
  });
  await step("Préparer les démarches d'une sélection", async () => {
    await page.reload();
    const boxes = page.locator("input[name=ids]");
    await boxes.nth(0).check(); await boxes.nth(1).check();
    await page.click("button:has-text('Préparer les démarches de la sélection')");
    await page.waitForURL(/\/hub\/watch\/prepare\?ids=/);
    await page.getByText("Préparer 2 démarche(s)").waitFor();
    const cam = page.locator("section", { hasText: "Example Test Cameras" }).first();
    await cam.getByText("Jeanne Testeuse").first().waitFor();
    const pre = await cam.locator("pre").innerText();
    assert.match(pre, /Bonjour Jeanne/); assert.match(pre, /programme ambassadeur/i);
    await shot("11-preparation");
  });
  await step("Validation une par une → fiche CRM avec interlocuteur sourcé", async () => {
    const cam = page.locator("section", { hasText: "Example Test Cameras" }).first();
    await cam.locator("input[name=contact_ids]").check();
    await cam.locator("input[name=verified]").check();
    await cam.locator("button:has-text('Valider : créer la fiche CRM')").click();
    await cam.getByText("Ajoutée au CRM (vérifiée).").waitFor();
    await page.goto(`${BASE}/hub/brands?q=Example%20Test%20Cameras`);
    await page.click("text=Example Test Cameras");
    await page.waitForURL(/\/hub\/brands\/\d+$/);
    await page.locator("li", { hasText: "Jeanne Testeuse" }).first().waitFor();
    assert.match(await page.locator("main").innerText(), /Source : https:\/\/fr\.linkedin\.com\/in\/test-jeanne/);
    assert.match(await page.locator("select[name=stage_id] option:checked").first().innerText(), /Marque qualifiée/);
  });
  await step("Business Forecast : provisoire, hypothèses explicites, opportunités pondérées", async () => {
    // Faire passer la marque au statut Contacté via une démarche.
    await page.click("button:has-text('✉ Démarche envoyée')");
    await page.click("button:has-text('Enregistrer la démarche')");
    await page.getByText(/Démarche enregistrée/).waitFor();
    await page.goto(`${BASE}/hub/forecast`);
    await page.getByText("Prévision provisoire.").waitFor();
    const txt = await page.locator("main").innerText();
    assert.match(txt, /hypothèse/); assert.match(txt, /Scénario prudent/); assert.match(txt, /Scénario ambitieux/);
    assert.match(txt, /Example Test Cameras/);
    assert.match(txt, /Facteurs de risque/);
    await page.click("button:has-text('Enregistrer la prévision du jour')");
    await page.getByText("Prévision du jour enregistrée dans l'historique").waitFor();
    await shot("12-forecast");
  });
  await step("Hypothèses modifiables et reprises dans la prévision", async () => {
    await page.goto(`${BASE}/hub/settings#forecast`);
    await page.fill("input[name=capacity_per_month]", "4");
    await page.click("button:has-text('Enregistrer les hypothèses')");
    await page.getByText("Hypothèses enregistrées").waitFor();
    await page.goto(`${BASE}/hub/forecast`);
    await page.getByText("4 contrats / mois").waitFor();
  });
  await step("Audience Value : comptes, relevés sourcés, CSV, tarifs production + diffusion", async () => {
    await page.goto(`${BASE}/hub/audience`);
    const add = page.locator("form:has(input[name=handle])");
    await add.locator("select[name=platform]").selectOption("instagram");
    await add.locator("input[name=handle]").fill("test_instagram");
    await add.locator("button:has-text('Ajouter')").click();
    await page.getByText("Compte ajouté").waitFor();
    await page.reload();
    await page.click("button:has-text('↑ Import CSV')");
    const f = page.locator("form:has(textarea[name=csv])");
    await f.locator("input[name=source]").fill("TEST — export fictif");
    await f.locator("textarea[name=csv]").fill("date,followers,views_30d,posts_30d,engagements_30d,reach_30d\n2026-09-30,10000,40000,10,1500,30000\n2026-11-01,11000,50000,10,2000,40000");
    await f.locator("button:has-text('Importer')").click();
    await page.getByText("2 relevé(s) importé(s)").waitFor();
    await page.reload();
    const txt = await page.locator("main").innerText();
    assert.match(txt, /Croissance\/mois\s*\d/);
    assert.match(txt, /engagement = interactions 30 j ÷ portée 30 j/);
    assert.match(txt, /TikTok sponsorisé\s*Non estimable/);
    assert.match(txt, /Reel Instagram/);
    assert.match(txt, /Dans 6 mois/);
    await shot("13-audience");
  });
  await step("Entités séparées : La Var Media n'est jamais additionnée", async () => {
    const before = await page.locator(".card", { has: page.locator('div:text-is("Abonnés (entité)")') }).innerText();
    await page.goto(`${BASE}/hub/audience?owner=lavar_media`);
    const add = page.locator("form:has(input[name=handle])");
    await add.locator("input[name=handle]").fill("test_lavar");
    await add.locator("button:has-text('Ajouter')").click();
    await page.getByText("Compte ajouté").waitFor();
    await page.reload();
    await page.click("button:has-text('+ Relevé manuel')");
    const f = page.locator("form:has(input[name=captured_on])");
    await f.locator("input[name=source]").fill("TEST — saisie fictive");
    await f.locator("input[name=followers]").fill("50000");
    await f.locator("button:has-text('Enregistrer le relevé')").click();
    await page.getByText("Relevé enregistré").waitFor();
    await page.goto(`${BASE}/hub/audience?owner=personal`);
    const after = await page.locator(".card", { has: page.locator('div:text-is("Abonnés (entité)")') }).innerText();
    assert.equal(after, before);
    assert.match(after, /11\s?000/);
  });
  await step("Tâche planifiée : veille (sans source) + prévision + bilan enrichi", async () => {
    const r = await page.request.get(`${BASE}/api/cron/reports?slot=midday&watch=1`, { headers: { authorization: `Bearer ${CRON}` } });
    const j = await r.json();
    assert.equal(j.watch, "skipped"); assert.ok(["saved", "already"].includes(j.forecast));
    assert.ok(["generated", "already_generated"].includes(j.report));
    await page.goto(`${BASE}/hub/reports`);
    await page.getByText("Prévision du jour :").first().waitFor();
  });
  await step("Dashboard : deux moteurs de prévision côte à côte", async () => {
    await page.goto(`${BASE}/hub?p=1`);
    await page.getByText("Potentiel commercial (prospection)").waitFor();
    await page.getByText("Valeur de l'audience — potentiel / mois").waitFor();
    await shot("14-dashboard");
  });
} finally {
  await browser.close();
  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n${results.length - fails.length}/${results.length} étapes réussies`);
  process.exitCode = fails.length ? 1 : 0;
}
