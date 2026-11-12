// Import d'un relevé de statistiques dans la base configurée (DATABASE_URL, sinon PGlite local).
// Usage : npx tsx scripts/import-insights.ts data/imports/instagram-personnel-2026-11-12.json
// Idempotent : un relevé ou un contenu déjà présent n'est jamais modifié.
import fs from "node:fs";
import { importInsights } from "../src/lib/insights-import";

(async () => {
  const file = process.argv[2];
  if (!file) { console.error("Usage : npx tsx scripts/import-insights.ts <fichier.json>"); process.exit(1); }
  const r = await importInsights(JSON.parse(fs.readFileSync(file, "utf8")));
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
