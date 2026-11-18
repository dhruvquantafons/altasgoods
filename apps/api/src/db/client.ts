import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { databaseUrl } from "../config/env.js";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

// bigint columns hold paise and fit comfortably in a JS number
pg.types.setTypeParser(20, (v) => Number(v));

/**
 * `connectionTimeoutMillis`: when every connection is busy, a request waits at
 * most this long for one and then fails, rather than hanging the API.
 */
export function createDb(url = databaseUrl(), options: { max?: number; connectionTimeoutMillis?: number } = {}) {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10, connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000 });
  return { db: drizzle(pool, { schema }), pool };
}
