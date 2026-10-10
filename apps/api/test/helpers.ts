import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Redis } from "ioredis";
import request from "supertest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import { env } from "../src/config/env.js";
import { CLOCK } from "../src/common/tokens.js";
import { createDb } from "../src/db/client.js";
import { resetDatabase } from "../src/db/reset.js";
import { seed } from "../src/db/seed.js";

/** A clock tests can move forward. */
export class TestClock {
  private offsetMs = 0;
  now() {
    return new Date(Date.now() + this.offsetMs);
  }
  advance(ms: number) {
    this.offsetMs += ms;
  }
  reset() {
    this.offsetMs = 0;
  }
}

export interface TestContext {
  app: INestApplication;
  http: ReturnType<typeof request>;
  clock: TestClock;
  close: () => Promise<void>;
}

/** Fresh schema, seeded demo data, and a running app on the test database. */
export async function createTestApp(): Promise<TestContext> {
  await resetDatabase(env().TEST_DATABASE_URL);
  const { db, pool } = createDb(env().TEST_DATABASE_URL);
  await seed(db);
  await pool.end();

  const redis = new Redis(env().REDIS_URL);
  const keys = await redis.keys("bbtest:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();

  const clock = new TestClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK).useValue(clock).compile();
  const app = configureApp(moduleRef.createNestApplication({ rawBody: true, logger: false }));
  await app.init();
  return { app, http: request(app.getHttpServer()), clock, close: () => app.close() };
}

/** Signs in with the development OTP and returns a bearer header. */
export async function signIn(http: TestContext["http"], phone: string, name?: string) {
  const otp = await http.post("/v1/auth/otp").send({ phone }).expect(200);
  const session = await http.post("/v1/auth/otp/verify").send({ challengeId: otp.body.challengeId, code: otp.body.devCode, name }).expect(200);
  return { auth: { Authorization: `Bearer ${session.body.accessToken}` }, session: session.body };
}

export const DEMO_CUSTOMER = "9845012345";
export const DEMO_STAFF = "9811012345";
export const DEMO_AGENT = "9811020001";
