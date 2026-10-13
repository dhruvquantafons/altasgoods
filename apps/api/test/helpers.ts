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
import { DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD, DEMO_STAFF_EMAIL, careAgentEmail } from "../src/db/demo.js";
import { seed } from "../src/db/seed.js";
import { seedDemoAccounts } from "../src/db/seed-demo.js";

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

/** Fresh schema, the seeded catalog and demo accounts, and a running app on the test database. */
export async function createTestApp(overrides: { provide: symbol; useValue: unknown }[] = []): Promise<TestContext> {
  await resetDatabase(env().TEST_DATABASE_URL);
  const { db, pool } = createDb(env().TEST_DATABASE_URL);
  await seed(db);
  await seedDemoAccounts(db);
  await pool.end();

  const redis = new Redis(env().REDIS_URL);
  const keys = await redis.keys("bbtest:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();

  const clock = new TestClock();
  let builder = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK).useValue(clock);
  // stand-ins for outside services (a fake courier, for example)
  for (const o of overrides) builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication({ rawBody: true, logger: false }));
  await app.init();
  return { app, http: request(app.getHttpServer()), clock, close: () => app.close() };
}

/** Signs in with email and password and returns a bearer header. */
export async function signIn(http: TestContext["http"], email: string, password = DEMO_PASSWORD) {
  const session = await http.post("/v1/auth/login").send({ email, password }).expect(200);
  return { auth: { Authorization: `Bearer ${session.body.accessToken}` }, session: session.body };
}

/** Creates a fresh shopper account and returns a bearer header. */
export async function signUp(http: TestContext["http"], email: string, name = "Test Shopper", password = "a-long-password") {
  const session = await http.post("/v1/auth/signup").send({ email, name, password }).expect(201);
  return { auth: { Authorization: `Bearer ${session.body.accessToken}` }, session: session.body };
}

export const DEMO_CUSTOMER = DEMO_CUSTOMER_EMAIL;
export const DEMO_STAFF = DEMO_STAFF_EMAIL;
export const DEMO_AGENT = careAgentEmail(0);
