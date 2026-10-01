import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import type pg from "pg";
import { env } from "../config/env.js";
import { createDb } from "../db/client.js";
import { CLOCK, DB, DB_POOL, REDIS } from "./tokens.js";

export interface Clock {
  now(): Date;
}

/** Database, Redis and clock, available to every module. */
@Global()
@Module({
  providers: [
    { provide: DB_POOL, useFactory: () => createDb() },
    { provide: DB, useFactory: (h: ReturnType<typeof createDb>) => h.db, inject: [DB_POOL] },
    {
      provide: REDIS,
      useFactory: () => new Redis(env().REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2, keyPrefix: env().NODE_ENV === "test" ? "bbtest:" : "bb:" }),
    },
    { provide: CLOCK, useValue: { now: () => new Date() } satisfies Clock },
  ],
  exports: [DB, REDIS, CLOCK, DB_POOL],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(DB_POOL) private readonly handle: { pool: pg.Pool },
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown() {
    await Promise.allSettled([this.handle.pool.end(), this.redis.quit()]);
  }
}
