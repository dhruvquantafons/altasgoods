import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseUrl, isProduction } from "../config/env.js";
import { runMigrations } from "./migrate.js";

/** Drops and recreates the public schema, then migrates. Refuses to run in production. */
export async function resetDatabase(url = databaseUrl()) {
  if (isProduction()) throw new Error("Refusing to reset a production database");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await client.end();
  await runMigrations(url);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await resetDatabase();
  console.log(`Reset ${databaseUrl().replace(/\/\/.*@/, "//")}`);
}
