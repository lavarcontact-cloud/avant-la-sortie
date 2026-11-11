// Test de bout en bout des 10 parcours du MVP (Playwright).
// Usage : BASE=http://localhost:3100 PASS=... node tests/e2e.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // installé globalement dans l’environnement
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3100";
const PASS = process.env.PASS;
const SHOTS = process.env.SHOTS;
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(["OK", name]); console.log("✓", name); } catch (e) { results.push(["FAIL", name, e.message]); console.log("✗", name, "\n   ", e.message.split("\n")[0]); throw e; } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });

try {
  await step("Accès privé protégé (redirection /login)", async () => {
    const r = await page.request.get(`${BASE}/api/hub/export`, { maxRedirects: 0 });
    assert.equal(r.status(), 401);
    await page.goto(`${BASE}/hub`);
    assert.match(page.url(), /\/login/);
    await page.fill("#password", "mauvais");
    await page.click("button:has-text('Entrer')");
    await page.getByText("Mot de passe incorrect").waitFor();
  });
  await step("1. Ouvrir l'application", async () => {
    await page.fill("#password", PASS);
    await page.click("button:has-text('Entrer')");
    await page.waitForURL(`${BASE}/hub`);
    await page.getByText("Votre CRM est vide").waitFor();
    await shot("01-dashboard-vide");
  });
  await step("Charte éthique : marque de casino refusée", async () => {
    await page.goto(`${BASE}/hub/brands/new`);
    await page.fill("input[name=name]", "Casino Lucky Online");
    await page.click("button:has-text('Créer la marque')");
    await page.getByText(/Secteur exclu par la charte/).waitFor();
  });
  let brandUrl;
  await step("2. Ajouter une marque", async () => {
    await page.goto(`${BASE}/hub/brands/new`);
    await page.fill("input[name=name]", "Marque Test Tech");
    await page.selectOption("select[name=sector_id]", { label: "Tech & Creator Economy" });
    await page.fill("input[name=website]", "https://example.com");
    await page.fill("input[name=score]", "82");
    await page.fill("input[name=score_notes]", "Test E2E");
    await page.locator("label:has-text('UGC rémunéré')").click();
    await page.locator("label:has-text('Gifting')").first().click();
    await page.click("button:has-text('Créer la marque')");
    await page.waitForURL(/\/hub\/brands\/\d+$/);
    brandUrl = page.url();
    await page.getByRole("heading", { name: "Marque Test Tech" }).waitFor();
  });
  await step("3. Ajouter un interlocuteur RP (source obligatoire)", async () => {
    await page.fill("input[name=first_name]", "Camille");
    await page.fill("input[name=last_name]", "Test");
    await page.fill("input[name=role]", "Influence Manager");
    await page.selectOption("select[name=role_type]", "Influence Manager");
    await page.fill("form:has(input[name=first_name]) input[name=email]", "camille@example.com");
    await page.click("button:has-text(\"Ajouter l'interlocuteur\")");
    await page.getByText(/Indiquez la source/).waitFor();
    await page.fill("form:has(input[name=first_name]) input[name=source]", "Page presse officielle (test)");
    await page.click("button:has-text(\"Ajouter l'interlocuteur\")");
    await page.getByText("Interlocuteur ajouté").waitFor();
    await page.reload();
    await page.locator("li", { hasText: "Camille Test" }).first().waitFor();
  });
  await step("Préparer un message personnalisé + copier", async () => {
    await page.fill("textarea[placeholder^='ex. J']", "Votre nouvelle gamme de micros correspond à mes tournages.");
    const pre = await page.locator("pre").first().innerText();
    assert.match(pre, /Bonjour Camille/);
    assert.match(pre, /nouvelle gamme de micros/);
    await shot("02-fiche-marque");
  });
  await step("4 + 5. Enregistrer un email envoyé et planifier une relance", async () => {
    await page.click("button:has-text('✉ Démarche envoyée')");
    const f = page.locator("form:has(button:has-text('Enregistrer la démarche'))");
    await f.locator("select[name=channel]").selectOption("email");
    await f.locator("select[name=contact_id]").selectOption({ label: "Camille Test" });
    await f.locator("select[name=collab_type]").selectOption("ugc_paid");
    await f.locator("input[name=sent_at]").fill("2026-11-10T10:15");
    await f.locator("input[name=follow_up_at]").fill("2026-11-11");
    await f.locator("input[name=subject]").fill("Marque Test × Sébastien");
    await f.locator("button:has-text('Enregistrer la démarche')").click();
    await page.getByText(/Démarche enregistrée — relance prévue le 2026-11-11/).waitFor();
    await page.goto(`${BASE}/hub/followups`);
    await page.getByText("Marque Test Tech").first().waitFor();
  });
  await step("6 + 7. Enregistrer une réponse et détecter qu'elle est positive", async () => {
    await page.goto(brandUrl);
    await page.click("button:has-text('↩ Réponse reçue')");
    const f = page.locator("form:has(button:has-text('Enregistrer la réponse'))");
    await f.locator("input[name=received_at]").fill("2026-11-10T16:40");
    await f.locator("textarea[name=content]").fill("Bonjour, avec plaisir ! Votre profil nous intéresse. Pouvez-vous nous envoyer vos tarifs ? On peut caler un appel jeudi.");
    await f.getByText("Positive").first().waitFor();
    await f.locator("button:has-text('Enregistrer la réponse')").click();
    await page.getByText("Réponse enregistrée — Positive").waitFor();
    await page.reload();
    assert.match(await page.locator("select[name=stage_id] option:checked").first().innerText(), /Intérêt potentiel/);
    await page.goto(`${BASE}/hub/notifications`);
    await page.getByText("NOUVELLE OPPORTUNITÉ — Marque Test Tech").waitFor();
    await page.getByText("Marque Test Tech — Demande de tarifs").waitFor();
    await shot("03-notifications");
  });
  await step("Réponse négative + reclassement manuel", async () => {
    await page.goto(`${BASE}/hub/brands/new`);
    await page.fill("input[name=name]", "Marque Test Food");
    await page.selectOption("select[name=sector_id]", { label: "Food & Lifestyle" });
    await page.click("button:has-text('Créer la marque')");
    await page.waitForURL(/\/hub\/brands\/\d+$/);
    await page.click("button:has-text('✉ Démarche envoyée')");
    await page.locator("form:has(button:has-text('Enregistrer la démarche')) select[name=channel]").selectOption("instagram");
    await page.click("button:has-text('Enregistrer la démarche')");
    await page.getByText(/Démarche enregistrée/).waitFor();
    await page.click("button:has-text('↩ Réponse reçue')");
    await page.fill("form:has(button:has-text('Enregistrer la réponse')) textarea[name=content]", "Merci mais nous ne sommes pas intéressés pour le moment.");
    await page.click("button:has-text('Enregistrer la réponse')");
    await page.getByText("Réponse enregistrée — Négative").waitFor();
  });
  await step("9. Enregistrer une prestation et son montant (+ gifting hors CA)", async () => {
    await page.goto(brandUrl);
    await page.click("button:has-text('€ Prestation / gifting')");
    let f = page.locator("form:has(button:has-text('Enregistrer la prestation'))");
    await f.locator("input[name=title]").fill("Pack 3 vidéos UGC");
    await f.locator("select[name=service_category]").selectOption("Pack UGC");
    await f.locator("select[name=status]").selectOption("signed");
    await f.locator("input[name=planned_price]").fill("1200");
    await f.locator("input[name=negotiated_price]").fill("1050");
    await f.locator("input[name=production_hours]").fill("10");
    await f.locator("button:has-text('Enregistrer la prestation')").click();
    await page.getByText("Prestation enregistrée").waitFor();
    await f.locator("select[name=collab_type]").selectOption("gifting");
    await f.locator("input[name=title]").fill("Micro offert");
    await f.locator("input[name=gift_value]").fill("349");
    await f.locator("select[name=status]").selectOption("signed");
    await f.locator("button:has-text('Enregistrer la prestation')").click();
    await page.getByText("Prestation enregistrée").waitFor();
  });
  await step("8. Voir les démarches et montants dans le dashboard", async () => {
    await page.goto(`${BASE}/hub?p=90`);
    const kpi = async (label) => (await page.locator(".card", { has: page.locator(`div:text-is("${label}")`) }).first().innerText()).split("\n")[1];
    assert.equal(await kpi("Démarches"), "2");
    assert.equal(await kpi("Réponses positives"), "1");
    assert.equal(await kpi("Réponses négatives"), "1");
    assert.match(await kpi("CA signé"), /1\s?050/);
    assert.match(await kpi("Valeur gifting reçue"), /349/);
    await page.getByText("Performance par secteur").waitFor();
    await shot("04-dashboard");
  });
  await step("10a. Brouillon de facture → émission bloquée sans mentions légales", async () => {
    await page.goto(`${BASE}/hub/documents/new?kind=invoice`);
    await page.fill("input[name=client_name]", "Marque Test Tech SAS");
    await page.fill("textarea[placeholder^='Désignation']", "Pack 3 vidéos UGC — formats 9:16");
    await page.locator("input[type=number]").nth(1).fill("2");
    await page.locator("input[type=number]").nth(2).fill("525");
    await page.click("button:has-text('Créer le brouillon')");
    await page.waitForURL(/\/hub\/documents\/\d+$/);
    await page.getByText("Document non finalisé").waitFor();
    await page.click("button:has-text('Émettre')");
    await page.getByText(/Impossible d'émettre : informations légales manquantes/).waitFor();
    const pdf = await page.request.get(page.url().replace("/hub/documents/", "/api/hub/documents/") + "/pdf");
    assert.equal(pdf.status(), 200);
    assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
  });
  await step("10b. Mentions légales → émission numérotée → PDF téléchargé → payée", async () => {
    const docUrl = page.url();
    await page.goto(`${BASE}/hub/settings`);
    const f = page.locator("form:has(input[name=legal_name])");
    await f.locator("input[name=legal_name]").fill("TEST E2E — identité fictive de test");
    await f.locator("input[name=legal_status]").fill("Entrepreneur individuel (test)");
    await f.locator("input[name=address]").fill("Adresse de test");
    await f.locator("input[name=siret]").fill("00000000000000");
    await f.locator("input[name=late_penalty]").fill("Pénalités : test");
    await f.locator("button:has-text('Enregistrer')").click();
    await page.getByText("Informations de facturation enregistrées").waitFor();
    await page.goto(docUrl);
    await page.click("button:has-text('Émettre')");
    await page.getByText(/Document émis : F-\d{4}-0001/).waitFor();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.evaluate((u) => { const a = document.createElement("a"); a.href = u; a.download = ""; document.body.appendChild(a); a.click(); }, docUrl.replace("/hub/documents/", "/api/hub/documents/") + "/pdf")]);
    assert.match(dl.suggestedFilename(), /^Facture-F-\d{4}-0001\.pdf$/);
    await page.reload();
    await page.locator("select[name=status]").selectOption("paid");
    await page.click("button:has-text('Mettre à jour')");
    await page.getByText("Statut mis à jour").waitFor();
    await page.goto(`${BASE}/hub/finance`);
    const txt = await page.locator("main").innerText();
    assert.match(txt, /Revenus encaissés\s*1\s?050/);
    assert.match(txt, /Produits reçus \(gifting\)\s*349/);
    await shot("05-finance");
  });
  await step("Devis PDF", async () => {
    await page.goto(`${BASE}/hub/documents/new?kind=quote`);
    await page.fill("input[name=client_name]", "Client devis test");
    await page.fill("textarea[placeholder^='Désignation']", "Production photo");
    await page.locator("input[type=number]").nth(2).fill("400");
    await page.click("button:has-text('Créer le brouillon')");
    await page.waitForURL(/\/hub\/documents\/\d+$/);
    await page.click("button:has-text('Émettre')");
    await page.getByText(/Document émis : D-\d{4}-0001/).waitFor();
  });
  await step("Bilan planifié : endpoint protégé + génération", async () => {
    assert.equal((await page.request.get(`${BASE}/api/cron/reports`)).status(), 401);
    const r = await page.request.get(`${BASE}/api/cron/reports?slot=evening`, { headers: { authorization: "Bearer e2e-cron" } });
    const j = await r.json();
    assert.equal(j.report.status, "generated");
    const r2 = await page.request.get(`${BASE}/api/cron/reports?slot=evening`, { headers: { authorization: "Bearer e2e-cron" } });
    assert.equal((await r2.json()).report.status, "already_generated");
    await page.goto(`${BASE}/hub/reports`);
    await page.getByText("Bilan de fin de journée").first().waitFor();
  });
  await step("Opposition : contact bloqué pour les démarches", async () => {
    await page.goto(brandUrl);
    page.once("dialog", (d) => d.accept());
    await page.click("button:has-text('Opposition')");
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/hub/settings`);
    await page.getByText("camille@example.com").waitFor();
  });
  await step("Site public + formulaire de collaboration → notification", async () => {
    const pub = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pub.goto(`${BASE}/`);
    await pub.getByText("Des images").waitFor();
    if (SHOTS) await pub.screenshot({ path: `${SHOTS}/06-public-mobile.png` });
    await pub.fill("input[name=company]", "Entreprise Test");
    await pub.fill("input[name=name]", "Jean Test");
    await pub.fill("input[name=email]", "jean@example.com");
    await pub.fill("textarea[name=message]", "Nous aimerions discuter d'une campagne UGC.");
    await pub.check("input[name=consent]");
    await pub.click("button:has-text('Proposer une collaboration')");
    await pub.getByText("Merci, votre demande est bien reçue").waitFor();
    await pub.goto(`${BASE}/media-kit`);
    await pub.getByText("Media Kit").first().waitFor();
    await pub.close();
    await page.goto(`${BASE}/hub/notifications`);
    await page.getByText("Entreprise Test").first().waitFor();
  });
  await step("Export des données (JSON)", async () => {
    const r = await page.request.get(`${BASE}/api/hub/export`);
    const j = await r.json();
    assert.ok(j.data.brands.length >= 2 && j.data.documents.length >= 2);
  });
  await step("Recherche globale", async () => {
    await page.goto(`${BASE}/hub/search?q=Camille`);
    await page.locator("li", { hasText: "Camille Test" }).first().waitFor();
  });
} finally {
  await browser.close();
  const fails = results.filter((r) => r[0] === "FAIL");
  console.log(`\n${results.length - fails.length}/${results.length} étapes réussies`);
  process.exitCode = fails.length ? 1 : 0;
}
