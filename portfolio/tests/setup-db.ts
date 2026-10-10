import { migrate, query, resetDriver } from "@/lib/db";

/** Base de test dédiée (PostgreSQL réel) : vidée avant chaque fichier de test. */
export async function freshDb() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://portfolio:portfolio@localhost:5432/portfolio_test";
  await resetDriver();
  await query(`DROP SCHEMA public CASCADE`);
  await query(`CREATE SCHEMA public`);
  await migrate();
}
