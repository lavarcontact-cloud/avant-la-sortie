import { expect, test, type Page } from "@playwright/test";

/**
 * Configuration "aperçu déployé" : build de production, AUCUNE variable
 * d'environnement (pas de base, pas de secret, pas de Stripe), comme le
 * projet Vercel sfp-portfolio. À lancer avec E2E_PREVIEW=1 contre ce serveur.
 * Vérifie que tout le parcours visiteur fonctionne et que ce qui dépend de
 * la base l'annonce clairement, sans faux succès.
 */
test.skip(!process.env.E2E_PREVIEW, "suite réservée au mode aperçu (E2E_PREVIEW=1)");

async function refuseCookies(page: Page) {
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Tout refuser" }).click();
  await expect(banner).toBeHidden();
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  return errors;
}

const PAGES: [string, RegExp][] = [
  ["/", /Fula-Pitu/],
  ["/flux", /Flux de réalisations/],
  ["/artistes", /Artistes/],
  ["/artistes/brk", /BRK/],
  ["/projets", /Travaux/],
  ["/projets/leto-enleve-tes-pessas", /Enlève tes Pessas/],
  ["/photo", /Photographie/],
  ["/a-propos", /studio/],
  ["/prestations", /Travailler ensemble/],
  ["/contact", /Parlons image/],
  ["/devis", /On en parle/],
  ["/mentions-legales", /Mentions légales/],
  ["/confidentialite", /confidentialité/i],
  ["/cookies", /Cookies et traceurs/],
  ["/cgv", /Conditions générales/],
  ["/retractation", /Se rétracter/],
];

test("toutes les pages publiques s'affichent sans erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await refuseCookies(page);
  for (const [path, title] of PAGES) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(200);
    await expect(page.locator("h1").first(), path).toHaveText(title);
  }
  expect(errors).toEqual([]);
});

test("images et vidéos se chargent, la vidéo du flux joue", async ({ page, request }) => {
  for (const f of ["/media/photos/brk-photo-1.jpg", "/media/posters/l2b-noir-cuts.jpg", "/media/videos/l2b-noir-cuts.mp4", "/media/videos/l2b-noir-cuts.webm"]) {
    const r = await request.get(f, { headers: { range: "bytes=0-1023" } });
    expect([200, 206], f).toContain(r.status());
  }
  await page.goto("/flux");
  await refuseCookies(page);
  const v = page.locator("article.feed-item").first().locator("video");
  await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2);
  // Images visibles à l'écran (les autres se chargent au défilement, c'est voulu).
  await page.goto("/photo");
  await page.waitForLoadState("networkidle");
  const visible = await page.locator("main img").evaluateAll((els) =>
    els.filter((e) => e.getBoundingClientRect().top < innerHeight).map((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0),
  );
  expect(visible.length).toBeGreaterThan(1);
  expect(visible.every(Boolean)).toBe(true);
});

test("navigation tactile : dock, bulle, projet, devis pré-rempli", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "écran tactile : profil mobile uniquement");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await refuseCookies(page);
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Artistes" }).tap();
  await expect(page).toHaveURL(/\/artistes$/);
  await page.locator('a[href="/artistes/leto"]').first().tap();
  await expect(page.getByRole("heading", { level: 1, name: "Leto" })).toBeVisible();
  await page.locator('a[href="/projets/leto-enleve-tes-pessas"]').first().tap();
  await page.getByRole("link", { name: "Demander un devis" }).last().tap();
  await expect(page.getByText("En lien avec")).toBeVisible();
});

test("devis : message clair, aucun faux succès, saisie conservée", async ({ page }) => {
  await page.goto("/devis");
  await refuseCookies(page);
  await page.getByText("Réalisation de clip").click();
  const desc = "Clip test pour vérifier le mode aperçu sans base de données.";
  await page.getByLabel("Le projet").fill(desc);
  await page.getByText("À définir ensemble").click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Nom").fill("Test Aperçu");
  await page.getByLabel("E-mail").fill("apercu@example.com");
  await page.getByLabel("Vous êtes").selectOption("artiste");
  await page.waitForTimeout(4100);
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByText(/pas encore activé sur cette version d'aperçu/)).toBeVisible();
  await expect(page.getByText("Demande envoyée")).toHaveCount(0);
  // Les champs restent remplis : rien n'est perdu.
  await expect(page.getByLabel("Nom")).toHaveValue("Test Aperçu");
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page.getByLabel("Le projet")).toHaveValue(desc);
});

test("admin et paiement : fermés, sans page d'erreur", async ({ page, request, context, baseURL }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Mot de passe").fill("nimporte-quoi");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/pas activé sur cette version d'aperçu/)).toBeVisible();
  for (const p of ["/admin/demandes", "/admin/commandes", "/admin/contenus"]) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/admin\/login$/);
  }
  await context.addCookies([{ name: "sfp_admin", value: "eyJzdWIiOiJhZG1pbiJ9.forged", url: baseURL! }]);
  await page.goto("/admin/commandes");
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await request.get("/paiement/AAAAAAAAAAAAAAAAAAAAAAAA")).status()).toBe(404);
  expect((await request.post("/api/stripe/webhook", { data: "{}" })).status()).toBe(503);
  expect((await request.get("/api/cron/purge")).status()).toBe(401);
});

test("consentement : accepter n'envoie rien de stocké et ne provoque aucune erreur", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByTestId("consent-banner").getByRole("button", { name: "Tout accepter" }).click();
  await page.goto("/projets");
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Cookies" }).click();
  await expect(page.getByTestId("consent-banner")).toBeVisible();
});

test("page introuvable, noindex et en-têtes de sécurité", async ({ page, request }) => {
  const r = await page.goto("/cette-page-n-existe-pas");
  expect(r?.status()).toBe(404);
  await expect(page.getByText("Cette page n'existe pas.")).toBeVisible();
  const home = await request.get("/");
  const html = await home.text();
  expect(html).toContain('name="robots" content="noindex, nofollow"');
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  const h = home.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["strict-transport-security"]).toBeTruthy();
  expect(h["x-frame-options"]).toBe("DENY");
});
