import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import Stripe from "stripe";

/**
 * Parcours de bout en bout sur le serveur local, avec une vraie base
 * PostgreSQL (DATABASE_URL de .env.local). Les vérifications portent sur ce
 * qui est réellement écrit en base, pas seulement sur l'affichage.
 */
const sql = postgres(process.env.E2E_DATABASE_URL ?? "postgres://portfolio:portfolio@localhost:5432/portfolio", { onnotice: () => {} });
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-test-password-123";
const WEBHOOK_SECRET = process.env.E2E_WEBHOOK_SECRET ?? "whsec_e2e_local_secret";

// Les quotas anti-abus (5 connexions / 15 min, 5 devis / h) seraient
// atteints par les relances de tests locaux : on repart de zéro.
test.beforeEach(async () => {
  await sql`DELETE FROM rate_limits`;
});

test.afterAll(async () => {
  await sql.end();
});

async function choose(page: Page, choice: "Tout accepter" | "Tout refuser") {
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: choice }).click();
  await expect(banner).toBeHidden();
}

test.describe("consentement et mesure d'audience", () => {
  test("refus : aucun événement enregistré, même après navigation et clics", async ({ page }) => {
    const before = (await sql`SELECT count(*)::int AS c FROM events WHERE server_side = false`)[0].c;
    const posted: string[] = [];
    page.on("request", (r) => r.url().includes("/api/events") && posted.push(r.url()));
    await page.goto("/");
    await choose(page, "Tout refuser");
    await page.getByRole("link", { name: "Tout l'univers →" }).click();
    await expect(page).toHaveURL(/\/artistes$/);
    await page.waitForTimeout(2500);
    expect(posted).toHaveLength(0);
    const after = (await sql`SELECT count(*)::int AS c FROM events WHERE server_side = false`)[0].c;
    expect(after).toBe(before);
    const proof = await sql`SELECT action, choices FROM consents ORDER BY seq DESC LIMIT 1`;
    expect(proof[0]).toMatchObject({ action: "reject_all", choices: { audience: false } });
  });

  test("accord : les événements arrivent en base, marqués internes avec ?internal=1", async ({ page }) => {
    const marker = Date.now() - 5000;
    await page.goto("/?internal=1");
    await choose(page, "Tout accepter");
    await page.locator('a[href="/artistes/brk"]').first().click();
    await expect(page).toHaveURL(/\/artistes\/brk$/);
    await page.waitForTimeout(400);
    // Le lot est envoyé au passage en arrière-plan ou après 1,5 s.
    await page.waitForTimeout(2200);
    const rows = await sql`SELECT name, internal, props FROM events WHERE ts > to_timestamp(${marker / 1000}) AND server_side = false ORDER BY ts`;
    const names = rows.map((r) => r.name);
    expect(names).toContain("page_view");
    expect(names).toContain("artist_bubble_click");
    expect(rows.every((r) => r.internal === true)).toBe(true);
    expect(rows.find((r) => r.name === "artist_bubble_click")?.props).toMatchObject({ artist: "brk", surface: "home" });
  });

  test("retrait : rouvrir les préférences et refuser efface les identifiants", async ({ page }) => {
    await page.goto("/a-propos");
    await choose(page, "Tout accepter");
    await page.getByRole("button", { name: "Cookies" }).click();
    await choose(page, "Tout refuser");
    const ids = await page.evaluate(() => [localStorage.getItem("sfp_vid"), sessionStorage.getItem("sfp_sid")]);
    expect(ids).toEqual([null, null]);
  });
});

test.describe("découverte", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await choose(page, "Tout refuser");
  });

  test("le flux lit la vidéo visible et passe à la suivante au clavier", async ({ page }) => {
    await page.goto("/flux");
    const first = page.locator("article.feed-item").first();
    await expect(first).toBeVisible();
    await expect.poll(async () => first.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.2);
    const firstSlug = new URL(page.url()).searchParams.get("p");
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => new URL(page.url()).searchParams.get("p"), { timeout: 10_000 }).not.toBe(firstSlug);
  });

  test("un lien partagé ouvre le flux sur la bonne vidéo", async ({ page }) => {
    await page.goto("/flux?p=la-var");
    await expect(page.locator('article[aria-current="true"] h2')).toHaveText("La Var");
  });

  test("bulle d'artiste → page artiste → projet → devis pré-rempli (mouvement réduit)", async ({ page }) => {
    // Avec "réduire les animations", la dérive des bulles doit s'arrêter : sinon
    // Playwright, qui attend un élément immobile, ne pourrait pas cliquer.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/artistes");
    await page.locator('a[href="/artistes/leto"]').first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Leto" })).toBeVisible();
    await page.locator('a[href="/projets/leto-enleve-tes-pessas"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Enlève tes Pessas");
    await page.getByRole("link", { name: "Demander un devis" }).last().click();
    await expect(page).toHaveURL(/ref=leto-enleve-tes-pessas/);
    await expect(page.getByText("En lien avec")).toBeVisible();
  });

  test("galerie photo : la visionneuse s'ouvre, navigue et se ferme au clavier", async ({ page }) => {
    await page.goto("/photo");
    await page.getByRole("button", { name: /Agrandir/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Visionneuse" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^1 \//)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText(/^2 \//)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("filtres de la grille et de la constellation", async ({ page }) => {
    await page.goto("/projets");
    await page.getByRole("button", { name: "Photo", exact: true }).click();
    await expect(page.locator("ul.grid > li")).not.toHaveCount(0);
    await page.goto("/artistes");
    await page.getByRole("button", { name: "Liste" }).click();
    await expect(page.getByRole("link", { name: /BRK/ }).first()).toBeVisible();
  });
});

test.describe("demande de devis", () => {
  test("validation par étape, puis envoi enregistré en base", async ({ page }) => {
    await page.goto("/devis");
    await choose(page, "Tout refuser");
    await page.getByText("Réalisation de clip").click();
    await expect(page.getByRole("heading", { name: "Parlez-moi du projet." })).toBeVisible();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText(/20 caractères minimum/)).toBeVisible();
    await page.getByLabel("Le projet").fill("Clip pour un single, tournage de nuit à Paris, ambiance néon. Test E2E.");
    await page.getByText("1 000 à 3 000 €").click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Nom").fill("Test E2E");
    await page.getByLabel("E-mail").fill("not-an-email");
    await page.getByLabel("Vous êtes").selectOption("manager");
    await page.waitForTimeout(4100); // délai anti-robot minimal
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText(/Adresse e-mail invalide/)).toBeVisible();
    await page.getByLabel("E-mail").fill("e2e@example.com");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("Demande envoyée");
    const ref = (await status.locator("b").first().textContent())!;
    expect(ref).toMatch(/^D-\d{4}-[A-Z0-9]{5}$/);
    const row = await sql`SELECT service, budget_range, client_role, email FROM quotes WHERE ref = ${ref}`;
    expect(row[0]).toMatchObject({ service: "clip", budget_range: "1k-3k", client_role: "manager", email: "e2e@example.com" });
    const ev = await sql`SELECT count(*)::int AS c FROM events WHERE name = 'quote_submitted' AND props->>'ref' = ${ref}`;
    expect(ev[0].c).toBe(1);
  });
});

test.describe("API : garde-fous", () => {
  test("refuse les requêtes d'une autre origine et sans consentement", async ({ request, baseURL }) => {
    const cross = await request.post("/api/quote", { headers: { origin: "https://evil.example" }, data: {} });
    expect(cross.status()).toBe(403);
    const noConsent = await request.post("/api/events", {
      headers: { origin: baseURL! },
      data: { sid: "abcdefgh12", events: [{ id: crypto.randomUUID(), name: "page_view", ts: Date.now(), props: { path: "/" } }] },
    });
    expect(noConsent.status()).toBe(202);
    expect((await noConsent.json()).reason).toBe("no-consent");
  });

  test("webhook Stripe : non signé rejeté, signé accepté", async ({ request }) => {
    const payload = JSON.stringify({ id: `evt_e2e_${Date.now()}`, object: "event", type: "customer.created", livemode: false, data: { object: {} } });
    const bad = await request.post("/api/stripe/webhook", { headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" }, data: payload });
    expect(bad.status()).toBe(400);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const ok = await request.post("/api/stripe/webhook", { headers: { "stripe-signature": header, "content-type": "application/json" }, data: payload });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).result).toBe("ignored");
  });

  test("en-têtes de sécurité présents", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("purge planifiée protégée par secret", async ({ request }) => {
    expect((await request.get("/api/cron/purge")).status()).toBe(401);
  });
});

test.describe("administration", () => {
  test("accès refusé sans session, connexion, KPI, commande et page de paiement", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.getByLabel("Mot de passe").fill("mauvais");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
    await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText("Demandes de devis").first()).toBeVisible();

    await page.goto("/admin/demandes");
    const first = page.locator("details").first();
    await first.locator("summary").click();
    await first.getByLabel("Total TTC (€)").fill("1500");
    await first.getByLabel("Acompte (€)").fill("450");
    await first.getByRole("button", { name: "Créer la commande" }).click();
    const linkEl = first.getByText(/\/paiement\/[A-Za-z0-9_-]{20,}/);
    await expect(linkEl).toBeVisible();
    const link = (await linkEl.textContent())!;
    expect(link).toMatch(/\/paiement\/[A-Za-z0-9_-]{20,}/);

    await page.goto(new URL(link).pathname);
    await expect(page.getByText("1 500,00 €").first()).toBeVisible();
    await expect(page.getByText("450,00 €").first()).toBeVisible();
    // Sans clé Stripe configurée, aucun bouton de paiement n'est proposé.
    await expect(page.getByText("Le paiement en ligne n'est pas encore activé")).toBeVisible();
  });

  test("une session falsifiée ne donne pas accès", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "sfp_admin", value: "eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake", url: baseURL! }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});

test.describe("accessibilité (axe-core)", () => {
  for (const path of ["/", "/flux", "/artistes", "/projets/brk-developpement", "/devis", "/prestations", "/confidentialite"]) {
    test(`aucune violation grave sur ${path}`, async ({ page }) => {
      await page.goto(path);
      await choose(page, "Tout refuser");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target})`)).toEqual([]);
    });
  }
});
