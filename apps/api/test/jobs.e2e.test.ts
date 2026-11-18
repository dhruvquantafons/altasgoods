import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DB } from "../src/common/tokens.js";
import type { Db } from "../src/db/client.js";
import { jobs } from "../src/db/schema.js";
import { JOB_MAX_ATTEMPTS, JobsService, retryDelayMs } from "../src/modules/jobs/jobs.service.js";
import { createTestApp, type TestContext } from "./helpers.js";

let t: TestContext;
let svc: JobsService;
let db: Db;

beforeAll(async () => {
  t = await createTestApp();
  svc = t.app.get(JobsService);
  db = t.app.get(DB);
});
afterAll(() => t.close());
beforeEach(() => t.clock.reset());

const row = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0]!;
let n = 0;
const kind = () => `test.job.${++n}`;

describe("jobs", () => {
  it("is enqueued atomically with the transaction that needs it", async () => {
    const k = kind();
    await expect(
      db.transaction(async (tx) => {
        await svc.enqueue(tx, k, { n: 1 });
        throw new Error("the business change failed");
      }),
    ).rejects.toThrow();
    expect(await db.select().from(jobs).where(eq(jobs.kind, k))).toHaveLength(0);

    const id = await db.transaction((tx) => svc.enqueue(tx, k, { n: 2 }));
    expect(await row(id)).toMatchObject({ kind: k, status: "QUEUED", attempts: 0, payload: { n: 2 } });
  });

  it("runs a due job once, and not before its time", async () => {
    const k = kind();
    const run = vi.fn(async () => {});
    svc.register(k, run);
    const id = await svc.enqueue(db, k, { hello: "world" }, { runAfter: new Date(t.clock.now().getTime() + 3_600_000) });

    await svc.runDue();
    expect(run).not.toHaveBeenCalled();

    t.clock.advance(3_600_001);
    await svc.runDue();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ hello: "world" }, expect.objectContaining({ jobId: id, attempt: 1 }));
    expect(await row(id)).toMatchObject({ status: "DONE", attempts: 1, lastError: null });

    await svc.runDue();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries a failing job later, with backoff", async () => {
    const k = kind();
    const run = vi.fn().mockRejectedValueOnce(new Error("gateway down")).mockResolvedValue(undefined);
    svc.register(k, run);
    const id = await svc.enqueue(db, k, {});

    const before = t.clock.now().getTime();
    await svc.runDue();
    const failed = await row(id);
    expect(failed).toMatchObject({ status: "QUEUED", attempts: 1, lastError: "gateway down" });
    expect(failed.runAfter.getTime()).toBeGreaterThanOrEqual(before + retryDelayMs(1));

    // not yet due
    await svc.runDue();
    expect(run).toHaveBeenCalledTimes(1);

    t.clock.advance(retryDelayMs(1) + 1000);
    await svc.runDue();
    expect(run).toHaveBeenCalledTimes(2);
    expect(await row(id)).toMatchObject({ status: "DONE", attempts: 2 });
  });

  it("backs off exponentially up to an hour", () => {
    expect(retryDelayMs(1)).toBe(30_000);
    expect(retryDelayMs(2)).toBe(60_000);
    expect(retryDelayMs(3)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(3_600_000);
  });

  it("gives up after the last attempt and says why", async () => {
    const k = kind();
    const run = vi.fn(async () => {
      throw new Error("still broken");
    });
    const onExhausted = vi.fn(async () => {});
    svc.register(k, run, { onExhausted });
    const id = await svc.enqueue(db, k, { ref: "x" });

    for (let i = 0; i < JOB_MAX_ATTEMPTS + 2; i++) {
      await svc.runDue();
      t.clock.advance(2 * 3_600_000);
    }
    expect(run).toHaveBeenCalledTimes(JOB_MAX_ATTEMPTS);
    expect(await row(id)).toMatchObject({ status: "FAILED", attempts: JOB_MAX_ATTEMPTS, lastError: "still broken" });
    expect(onExhausted).toHaveBeenCalledTimes(1);
    expect(onExhausted).toHaveBeenCalledWith({ ref: "x" }, expect.objectContaining({ message: "still broken" }));
  });

  it("never runs the same job on two workers at once", async () => {
    const k = kind();
    const seen: string[] = [];
    const handler = async (p: { i: number }) => {
      seen.push(String(p.i));
      await new Promise((r) => setTimeout(r, 20));
    };
    // a second API instance on the same database
    const other = new JobsService(db, t.clock);
    svc.register(k, handler);
    other.register(k, handler);
    for (let i = 0; i < 6; i++) await svc.enqueue(db, k, { i });

    await Promise.all([svc.runDue(2), other.runDue(2), svc.runDue(2), other.runDue(2)]);
    await Promise.all([svc.runDue(), other.runDue()]);
    expect(seen.sort()).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("takes over a job whose worker died mid-run", async () => {
    const k = kind();
    const run = vi.fn(async () => {});
    svc.register(k, run);
    const id = await svc.enqueue(db, k, {});
    await db.update(jobs).set({ status: "RUNNING", attempts: 1, lockedAt: new Date(t.clock.now().getTime() - 20 * 60_000) }).where(eq(jobs.id, id));

    await svc.runDue();
    expect(run).toHaveBeenCalledTimes(1);
    expect(await row(id)).toMatchObject({ status: "DONE", attempts: 2 });
  });

  it("does not run a job another worker is running right now", async () => {
    const k = kind();
    const run = vi.fn(async () => {});
    svc.register(k, run);
    const id = await svc.enqueue(db, k, {});
    await db.update(jobs).set({ status: "RUNNING", attempts: 1, lockedAt: t.clock.now() }).where(eq(jobs.id, id));
    await svc.runDue();
    expect(run).not.toHaveBeenCalled();
  });

  it("runs straight after the producer commits when kicked", async () => {
    const k = kind();
    const run = vi.fn(async () => {});
    svc.register(k, run);
    svc.autoKick = true;
    try {
      await svc.scope(() => db.transaction((tx) => svc.enqueue(tx, k, {})));
      await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1), { timeout: 2000 });
    } finally {
      svc.autoKick = false;
      await svc.runDue();
    }
  });
});
