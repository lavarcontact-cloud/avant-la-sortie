// Applique les migrations SQL sur DATABASE_URL. Usage : npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL requis.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, onnotice: () => {} });
await sql`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const done = new Set((await sql<{ name: string }[]>`SELECT name FROM _migrations`).map((r) => r.name));
const dir = path.join(import.meta.dirname, "..", "db", "migrations");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  await sql.begin(async (tx) => {
    await tx.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
    await tx`INSERT INTO _migrations (name) VALUES (${f})`;
  });
  console.log("appliquée :", f);
}
await sql.end();
