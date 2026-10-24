// Applique les migrations SQL de db/migrations dans l'ordre, une seule fois chacune.
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../server/db.js';

export async function migrate({ quiet = false } = {}) {
  const dir = new URL('../db/migrations/', import.meta.url).pathname;
  await pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await pool.query('select name from schema_migrations')).rows.map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      if (!quiet) console.log(`✓ ${file}`);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`Migration ${file} échouée : ${e.message}`);
    } finally {
      client.release();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
}
