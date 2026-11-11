import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyResponse } from "../src/lib/classify";
import { docTotals, lineTotals } from "../src/lib/money";
import { checkEthics } from "../src/lib/ethics";
import { splitSql } from "../src/lib/db";
import { parisMidnight, parisParts, slotOf } from "../src/lib/dates";
import { buildMessages } from "../src/lib/templates";
import { renderDocumentPdf, sanitize } from "../src/lib/pdf";
import { DEFAULT_LEGAL } from "../src/lib/settings";

test("classification : réponse positive avec rendez-vous", () => {
  const r = classifyResponse("Bonjour Sébastien, avec plaisir ! Votre profil nous intéresse, seriez-vous disponible pour un appel jeudi ?");
  assert.equal(r.classification, "positive");
  assert.ok(r.intents.includes("meeting"));
  assert.ok(r.confidence >= 0.6);
});
test("classification : refus", () => {
  assert.equal(classifyResponse("Merci pour votre message mais malheureusement nous ne sommes pas intéressés pour le moment.").classification, "negative");
});
test("classification : opposition → négative + intent opt_out", () => {
  const r = classifyResponse("Merci de ne plus nous contacter.");
  assert.equal(r.classification, "negative");
  assert.ok(r.intents.includes("opt_out"));
});
test("classification : réponse automatique", () => {
  assert.equal(classifyResponse("Réponse automatique : je suis actuellement absente du bureau jusqu'au 20/11.").classification, "automatic");
});
test("classification : demande de tarifs / media kit", () => {
  const r = classifyResponse("Pouvez-vous nous envoyer votre media kit et vos tarifs ?");
  assert.equal(r.classification, "info_request");
  assert.ok(r.intents.includes("pricing_request") && r.intents.includes("media_kit_request"));
});
test("classification : texte vide → neutre, confiance 0", () => {
  const r = classifyResponse("");
  assert.equal(r.classification, "neutral"); assert.equal(r.confidence, 0);
});

test("totaux : remise, TVA multi-taux, acompte", () => {
  const t = docTotals([
    { description: "Pack UGC", quantity: 3, unit_price: 250, discount_pct: 10, vat_rate: 20 },
    { description: "Photo", quantity: 1, unit_price: 100, vat_rate: 10 },
  ], 200, 0);
  assert.equal(t.gross, 850); assert.equal(t.discount, 75); assert.equal(t.ht, 775);
  assert.equal(t.vat, 145); assert.equal(t.ttc, 920); assert.equal(t.balance, 720);
  assert.deepEqual(t.vatByRate.map((v) => v.rate), [20, 10]);
});
test("totaux : arrondis au centime", () => {
  assert.equal(lineTotals({ description: "x", quantity: 3, unit_price: 33.333, vat_rate: 20 }).ht, 100);
  assert.equal(docTotals([{ description: "x", quantity: 1, unit_price: 0.1, vat_rate: 0 }, { description: "y", quantity: 1, unit_price: 0.2, vat_rate: 0 }]).ttc, 0.3);
});
test("totaux : solde jamais négatif", () => {
  assert.equal(docTotals([{ description: "x", quantity: 1, unit_price: 100, vat_rate: 0 }], 80, 50).balance, 0);
});

test("éthique : secteurs exclus bloqués, marques légitimes acceptées", () => {
  assert.equal(checkEthics("Casino Royal Online").ok, false);
  assert.equal(checkEthics("Plateforme de copy trading Forex").ok, false);
  assert.equal(checkEthics("Opportunité MLM").ok, false);
  assert.equal(checkEthics("Sony France", "Caméras et hybrides Alpha").ok, true);
  assert.equal(checkEthics("MPB", "Matériel photo d'occasion").ok, true);
});

test("splitSql respecte les blocs $$", () => {
  const parts = splitSql("create table a(x int); -- commentaire ; ici\ndo $$ begin perform 1; end $$; insert into a values (1);");
  assert.equal(parts.length, 3);
  assert.ok(parts[1].startsWith("do $$"));
});

test("dates : minuit à Paris hiver / été, créneaux", () => {
  assert.equal(new Date(parisMidnight("2026-01-15")).toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(new Date(parisMidnight("2026-07-15")).toISOString(), "2026-07-14T22:00:00.000Z");
  assert.equal(parisParts(new Date("2026-07-15T07:30:00Z")).hour, 9);
  assert.equal(slotOf(23), "night"); assert.equal(slotOf(3), "night"); assert.equal(slotOf(10), "morning");
});

test("modèles : aucune information inventée, champs manquants signalés", () => {
  const m = buildMessages({ brand: { name: "Sony" }, profile: {}, collabType: "gifting" });
  assert.ok(m.missing.length >= 2);
  assert.match(m.email, /\[À COMPLÉTER/);
  assert.match(m.email, /produit offert/);
  const full = buildMessages({ brand: { name: "MPB" }, contact: { first_name: "Léa" }, profile: { display_name: "Sébastien", pitch: "Je réalise des clips.", portfolio_url: "https://x.y" }, collabType: "ugc_paid", angle: "J'achète déjà mon matériel d'occasion chez vous." });
  assert.match(full.email, /^Bonjour Léa,/);
  assert.equal(full.missing.filter((x) => !x.includes("élément nouveau") && !x.includes("droits") && !x.includes("Budget")).length, 0);
});

test("PDF : génération valide avec accents, € et filigrane brouillon", async () => {
  const bytes = await renderDocumentPdf({
    kind: "invoice", number: null, status: "draft", client_name: "Société Générale d'Édition", client_address: "12 rue de l'Église\n75001 Paris",
    client_siret: null, client_vat: null, client_email: null, issue_date: "2026-11-11", due_date: "2026-12-11",
    lines: Array.from({ length: 40 }, (_, i) => ({ description: `Vidéo UGC n°${i + 1} — format 9:16, sous-titres, droits 12 mois`, quantity: 1, unit_price: 350, vat_rate: 0 })),
    deposit: 500, paid_amount: 0, notes: "Mention « partenariat » incluse.", currency: "EUR",
  }, { ...DEFAULT_LEGAL, legal_name: "Sébastien Fula-Pitu" }, false);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.length > 3000);
  assert.equal(sanitize("1 000 €"), "1 000 €");
});
