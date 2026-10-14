import { createRequire } from "node:module";
import path from "node:path";

/**
 * Direct reads of the API's database, to check that what the UI shows was
 * really stored. Set E2E_DATABASE_URL to the database the API under test uses;
 * specs that read it are skipped without it.
 */
export const DATABASE_URL = process.env.E2E_DATABASE_URL;

type Pool = { query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>; end: () => Promise<void> };
let pool: Pool | undefined;

function connect(): Pool {
  if (pool) return pool;
  // pg is a dependency of the API, not the web app
  const pg = createRequire(path.resolve(__dirname, "../../../api/package.json"))("pg") as {
    Pool: new (o: { connectionString?: string }) => Pool;
    types: { setTypeParser: (oid: number, parse: (v: string) => unknown) => void };
  };
  pg.types.setTypeParser(20, Number); // money is bigint paise; read it as a number
  return (pool = new pg.Pool({ connectionString: DATABASE_URL }));
}

/** The first row of a query, or undefined. */
export const row = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await connect().query<T>(sql, params)).rows[0];

/** The latest audit log entry for an action on an entity. */
export const audited = (action: string, entityId: string) =>
  row<{ actor_name: string; summary: string; changes: Record<string, unknown> | null }>(
    "select actor_name, summary, changes from audit_events where action = $1 and entity_id = $2 order by created_at desc limit 1",
    [action, entityId],
  );

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
