import { test, expect, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Commencer' });
  await expect(start).toBeDisabled();
  await page.getByText('Je comprends que cette application').click();
  await start.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('accueil : mode simulation affiché, repli honnête sur le snapshot', async ({ page }) => {
  await onboard(page);
  await expect(page.locator('.mode-banner')).toContainText('Simulation');
  await expect(page.getByTestId('equity')).toHaveText(/10\s000,00\s€/);
  // Le réseau du conteneur bloque Coinbase : l'application doit l'indiquer, pas simuler un flux.
  await expect(page.locator('.status-pill')).toContainText(/Snapshot|Flux interrompu/, { timeout: 20_000 });
  await page.goto('/#/marche');
  await expect(page.getByRole('alert').first()).toContainText('Cotations temps réel indisponibles');
  await expect(page.getByRole('button', { name: /Simuler l'achat/ })).toBeDisabled();
});

test('replay : achat simulé, frais, avance, bilan', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Replay historique' }).click();
  await expect(page.locator('.h2', { hasText: 'Le choc de février 2026' })).toBeVisible();
  await page.goto('/#/marche');
  await page.getByLabel('Quantité (BTC)').fill('0,02');
  await page.getByLabel(/Stop d'invalidation/).fill('60000');
  await expect(page.getByText('Frais (0,60 %)')).toBeVisible();
  const ack = page.getByLabel(/je maintiens cet ordre/);
  if (await ack.count()) await ack.check();
  await page.getByRole('button', { name: "Simuler l'achat" }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ordre simulé exécuté' })).toBeVisible();
  await page.goto('/#/cockpit');
  await expect(page.locator('table').filter({ hasText: 'Prix moyen' })).toContainText('BTC');
  await page.getByRole('button', { name: '+5 séances' }).click();
  await expect(page.getByText('Bilan de la simulation')).toBeVisible();
  await expect(page.getByText('Historique des exécutions')).toBeVisible();
  const net = await page.getByTestId('net-pnl').textContent();
  expect(net).toMatch(/€/);
});

test('copilote : réponse structurée, sans prédiction, IA désactivée sans clé', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/vigie');
  await page.getByRole('button', { name: "Pourquoi Bitcoin bouge aujourd'hui ?" }).click();
  await expect(page.getByText('1 · Faits observés')).toBeVisible();
  await expect(page.getByText('3 · Hypothèses')).toBeVisible();
  await expect(page.getByText(/aucune source d'actualités vérifiée/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reformulation IA indisponible' })).toBeDisabled();
  await page.getByLabel('Question').fill('Dois-je acheter du bitcoin maintenant ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText("Je ne te dirai pas d'acheter ou de vendre")).toBeVisible();
});

test('objectif 100 000 € en 90 jours : verdict honnête', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/objectif');
  await expect(page.getByText('Hors de tout ce qui a été observé')).toBeVisible();
  await expect(page.getByText(/perdre tout le capital/)).toBeVisible();
});

test('espace pro : protocole de backtest dans un worker', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/pro');
  await page.getByRole('button', { name: 'Lancer le protocole' }).click();
  await expect(page.getByRole('cell', { name: /Test/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/configuration\(s\) testée\(s\)/)).toBeVisible();
});

test('fil : cartes réelles et fin explicite ; radar : règles visibles', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/fil');
  await expect(page.locator('.feed-card').first()).toBeVisible();
  while (await page.getByRole('button', { name: /Afficher \d+ cartes de plus/ }).count()) await page.getByRole('button', { name: /Afficher \d+ cartes de plus/ }).click();
  await expect(page.getByText('Tu es à jour.')).toBeVisible();
  await page.goto('/#/radar');
  await expect(page.getByText('Seuils utilisés')).toBeVisible();
});

test('pas de défilement horizontal et aucune erreur console', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|WebSocket|api\/candles|api\/copilot/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await onboard(page);
  for (const r of ['cockpit', 'marche', 'fil', 'radar', 'vigie', 'pro', 'objectif', 'reglages']) {
    await page.goto(`/#/${r}`);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `débordement horizontal sur ${r}`).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
