// Génère les icônes PNG de la PWA à partir de web/public/icons/icon.svg (via Chromium/Playwright).
import fs from 'node:fs';
import { createRequire } from 'node:module';
// Playwright (pré-installé ou en devDependency) est chargé via require.
const { chromium } = createRequire(import.meta.url)('playwright');
const dir = new URL('../web/public/icons/', import.meta.url).pathname;
const svg = fs.readFileSync(`${dir}icon.svg`, 'utf8');
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<g fill', '<g transform="translate(51 51) scale(.8)" fill').replace('<rect x="132" y="408"', '<rect transform="translate(51 51) scale(.8)" x="132" y="408"');
const badge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="#fff"><rect x="22" y="42" width="8" height="16" rx="4"/><rect x="36" y="30" width="8" height="40" rx="4"/><rect x="50" y="18" width="8" height="60" rx="4"/><rect x="64" y="34" width="8" height="30" rx="4"/></g></svg>';
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, src, transparent] of [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['apple-touch-icon.png', 180, maskable], ['icon-maskable-512.png', 512, maskable], ['badge-96.png', 96, badge, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${dir}${name}`, omitBackground: Boolean(transparent) });
}
await browser.close();
console.log('icônes générées');
