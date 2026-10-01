import { Controller, Get, Inject } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { DB, REDIS } from "../../common/tokens.js";
import { Public } from "../auth/auth.guard.js";

const healthSchema = z.object({ status: z.enum(["ok", "degraded"]), database: z.boolean(), redis: z.boolean(), time: z.iso.datetime() });

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get("health")
  @ApiResponse({ status: 200, standardSchema: healthSchema })
  async health() {
    const [database, redis] = await Promise.all([
      this.db.execute(sql`select 1`).then(() => true, () => false),
      this.redis.ping().then((r) => r === "PONG", () => false),
    ]);
    return { status: database && redis ? "ok" : "degraded", database, redis, time: new Date().toISOString() };
  }
}
