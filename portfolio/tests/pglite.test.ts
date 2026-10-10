import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { query, resetDriver } from "@/lib/db";
import { recordServerEvent } from "@/lib/server-utils";

/** Mode développement sans PostgreSQL installé : PostgreSQL embarqué (PGlite). */
describe("PGlite (développement sans base installée)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pglite-"));
  afterAll(async () => {
    await resetDriver();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("applique les migrations et stocke le JSON comme un objet", async () => {
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = dir;
    await resetDriver();
    await recordServerEvent("quote_submitted", { ref: "D-TEST", service: "clip" });
    const rows = await query<{ ref: string }>(`SELECT props->>'ref' AS ref FROM events WHERE name = 'quote_submitted'`);
    expect(rows[0].ref).toBe("D-TEST");
    const tables = await query<{ n: string }>(`SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'`);
    expect(Number(tables[0].n)).toBeGreaterThanOrEqual(8);
  }, 60_000);
});
