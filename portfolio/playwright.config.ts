import { defineConfig, devices } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3100";
// Navigateur Chromium préinstallé (pas de téléchargement).
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
// UA "réel" : le filtre anti-robots rejette les UA headless, ce qui est voulu en production.
const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 E2E";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e/report", open: "never" }]],
  use: { baseURL: base, userAgent, launchOptions, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], userAgent, launchOptions } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, userAgent, launchOptions } },
  ],
});
