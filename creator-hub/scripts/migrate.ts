import { getDb, q } from "../src/lib/db";

(async () => {
  const db = await getDb();
  const tables = await q<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema='public' order by 1`
  );
  console.log(`Driver: ${db.driver}. Tables:`, tables.map((t) => t.table_name).join(", "));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
