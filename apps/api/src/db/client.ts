import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { databaseUrl } from "../config/env.js";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

// bigint columns hold paise and fit comfortably in a JS number
pg.types.setTypeParser(20, (v) => Number(v));

export function createDb(url = databaseUrl()) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}
