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
    const max = Number(process.env.DB_POOL_MAX) || 5;
    const sql = postgres(url, { max, prepare: false, idle_timeout: 20, connect_timeout: 10 });
    // postgres.js « pipeline » plusieurs requêtes sur une même connexion quand le pool est saturé ;
    // le pooler Supabase (mode transaction) ne le supporte pas et la requête reste bloquée.
    // On limite donc le nombre de requêtes simultanées au nombre de connexions.
    const gate = semaphore(max);
    db = {
      driver: "postgres",
      query: (q, p = []) => gate(() => timed(q, sql.unsafe(q, p as any[]) as unknown as Promise<any>)),
      tx: (fn) => gate(async () =>
        (await sql.begin(async (t) => fn(async (q, p = []) => (await t.unsafe(q, p as any[])) as any))) as any),
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

/** Limite le nombre de tâches asynchrones simultanées. */
export function semaphore(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((r) => waiting.push(r));
    else active++;
    try { return await fn(); }
    finally { const next = waiting.shift(); if (next) next(); else active--; }
  };
}

const QUERY_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT_MS) || 20000;
/** Journalise les requêtes lentes et coupe celles qui ne répondent pas (évite une page bloquée jusqu'au délai max de Vercel). */
async function timed<T>(sqlText: string, p: Promise<T>): Promise<T> {
  const t0 = Date.now();
  const head = sqlText.replace(/\s+/g, " ").trim().slice(0, 90);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`[db] délai dépassé (${QUERY_TIMEOUT_MS} ms) : ${head}`)), QUERY_TIMEOUT_MS); })]);
  } catch (e) {
    console.error(`[db] échec après ${Date.now() - t0} ms : ${head} — ${(e as Error).message}`);
    throw e;
  } finally {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (ms > 1500) console.warn(`[db] lente ${ms} ms : ${head}`);
  }
}

async function migrate(db: Db) {
  await db.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(dir)) {
    // Dossier absent du bundle : la base doit déjà être migrée (ex. migrations appliquées via Supabase).
    console.warn(`[db] dossier migrations introuvable (${dir}) : aucune migration appliquée au démarrage`);
    return;
  }
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
