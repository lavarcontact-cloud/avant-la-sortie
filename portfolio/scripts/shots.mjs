// Captures d'écran de contrôle visuel. Usage : node scripts/shots.mjs <baseUrl> <outDir> [paths...]
import { chromium } from "@playwright/test";
const [base, out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, vp, mobile] of [["m", { width: 390, height: 844 }, true], ["d", { width: 1440, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    const file = `${out}/${name}${p.replace(/[/?=&]/g, "_") || "_home"}.png`;
    await page.screenshot({ path: file, fullPage: !p.startsWith("/flux") });
    console.log(file);
  }
  if (errors.length) console.log("ERRORS", name, [...new Set(errors)].map((e) => e.slice(0, 160)).join("\n"));
  await ctx.close();
}
await browser.close();
