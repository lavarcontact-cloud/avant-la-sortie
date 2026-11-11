import fs from "node:fs";
import path from "node:path";

/**
 * Couche d'accès aux données.
 * - Production : PostgreSQL (Supabase) via DATABASE_URL.
 * - Développement / démarrage sans configuration : PGlite (PostgreSQL embarqué,
 *   persistant sur disque dans .data/pglite). Même SQL, mêmes migrations.
 */
export type Row = Record<string, any>;
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (q: Db["query"]) => Promise<T>): Promise<T>;
  driver: "postgres" | "pglite";
}

const g = globalThis as unknown as { __hubDb?: Promise<Db> };

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    db = {
      driver: "postgres",
      query: async (q, p = []) => (await sql.unsafe(q, p as any[])) as any,
      tx: async (fn) =>
        (await sql.begin(async (t) => fn(async (q, p = []) => (await t.unsafe(q, p as any[])) as any))) as any,
    };
  } else {
    if (process.env.VERCEL || process.env.NODE_ENV === "production" && process.env.REQUIRE_DATABASE_URL === "1") {
      throw new Error("DATABASE_URL manquant : en production, configurez la base PostgreSQL (Supabase). PGlite ne sert qu'en local.");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    await pg.waitReady;
    db = {
      driver: "pglite",
      query: async (q, p = []) => (await pg.query(q, p as any[])).rows as any,
      tx: async (fn) => pg.transaction(async (t) => fn(async (q, p = []) => (await t.query(q, p as any[])).rows as any)),
    };
  }
  await migrate(db);
  return db;
}

async function migrate(db: Db) {
  await db.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(process.cwd(), "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db.query<{ name: string }>(`select name from schema_migrations`)).map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const sqlText = fs.readFileSync(path.join(dir, f), "utf8");
    await db.tx(async (q) => {
      await execMulti(db, q, sqlText);
      await q(`insert into schema_migrations (name) values ($1)`, [f]);
    });
  }
}

/** Exécute un fichier SQL contenant plusieurs instructions. */
async function execMulti(db: Db, q: Db["query"], sqlText: string) {
  void db;
  for (const stmt of splitSql(sqlText)) await q(stmt);
}

/** Découpe un script SQL en instructions en respectant les blocs $$ … $$ et les chaînes. */
export function splitSql(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inDollar = false, inQuote = false, inLineComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inLineComment) { if (c === "\n") inLineComment = false; continue; }
    if (!inDollar && !inQuote && c === "-" && n === "-") { inLineComment = true; continue; }
    if (!inQuote && c === "$" && n === "$") { inDollar = !inDollar; cur += "$$"; i++; continue; }
    if (!inDollar && c === "'") inQuote = !inQuote;
    if (!inDollar && !inQuote && c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function getDb(): Promise<Db> {
  if (!g.__hubDb) g.__hubDb = createDb().catch((e) => { g.__hubDb = undefined; throw e; });
  return g.__hubDb;
}

export async function q<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}
export async function one<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined> {
  return (await q<T>(sql, params))[0];
}
export async function tx<T>(fn: (q: Db["query"]) => Promise<T>): Promise<T> {
  return (await getDb()).tx(fn);
}

/** Numeric Postgres → number (les drivers renvoient parfois des chaînes). */
export const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
