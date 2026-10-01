import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client.js";

/** Applies pending SQL migrations from src/db/migrations. */
export async function runMigrations(url?: string) {
  const { db, pool } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)) });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runMigrations();
  console.log("Migrations applied");
}
