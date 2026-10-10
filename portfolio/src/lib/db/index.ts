import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Accès base de données minimal : requêtes SQL paramétrées ($1, $2...)
 * uniquement, jamais de concaténation de valeurs (protection contre
 * l'injection SQL).
 *
 * - DATABASE_URL défini : PostgreSQL (Supabase, Neon, local...) via postgres.js.
 * - Sinon, hors production : PGlite (PostgreSQL embarqué) dans .data/,
 *   pour que `npm run dev` fonctionne sans rien installer.
 */

type Row = Record<string, unknown>;
type Driver = {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
};

let driver: Promise<Driver> | null = null;

async function create(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, {
      max: process.env.VERCEL ? 1 : 5,
      prepare: false, // compatible avec les poolers (Supabase pgbouncer)
      onnotice: () => {},
    });
    return {
      query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never,
      close: () => sql.end(),
    };
  }
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE) {
    throw new Error("DATABASE_URL manquant en production.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  const drv: Driver = {
    query: async (text, params = []) => (await db.query(text, params)).rows as never,
    close: () => db.close(),
  };
  await migrate(drv);
  return drv;
}

export function db(): Promise<Driver> {
  if (!driver) driver = create().catch((e) => { driver = null; throw e; });
  return driver;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db()).query<T>(text, params);
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0];
}

/** Applique les fichiers db/migrations/*.sql non encore appliqués, dans l'ordre. */
export async function migrate(d?: Driver) {
  const drv = d ?? (await db());
  await drv.query(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const dir = path.join(process.cwd(), "db", "migrations");
  const done = new Set((await drv.query<{ name: string }>(`SELECT name FROM _migrations`)).map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const sqlText = fs.readFileSync(path.join(dir, f), "utf8");
    for (const stmt of sqlText.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) {
      await drv.query(stmt);
    }
    await drv.query(`INSERT INTO _migrations (name) VALUES ($1)`, [f]);
  }
}

/** Pour les tests. */
export async function resetDriver() {
  if (driver) (await driver).close().catch(() => {});
  driver = null;
}
