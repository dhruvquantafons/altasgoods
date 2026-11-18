import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import { env } from "../../config/env.js";
import type { Db, Tx } from "../../db/client.js";
import { jobs } from "../../db/schema.js";

/** Runs per job before it is marked FAILED. */
export const JOB_MAX_ATTEMPTS = 8;
/** A RUNNING job claimed this long ago belongs to a worker that died; another may take it over. */
export const JOB_STALE_MS = 15 * 60_000;
/** Wait before run `attempts + 1`: 30s, 1m, 2m, 4m ... capped at an hour. */
export const retryDelayMs = (attempts: number) => Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 3_600_000);

export interface JobContext {
  jobId: string;
  /** 1 on the first run */
  attempt: number;
  /** a throw now marks the job FAILED instead of retrying it */
  lastAttempt: boolean;
}

/**
 * Does the work of one job. It may run more than once for the same job (a
 * retry after a throw, or a takeover after a crash), so it must be idempotent.
 * Throwing schedules a retry; returning marks the job DONE.
 */
export type JobHandler<P> = (payload: P, ctx: JobContext) => Promise<void>;

export interface JobOptions<P> {
  /** Called once when the last attempt has failed, to record the failure in business terms. */
  onExhausted?: (payload: P, error: Error) => Promise<void>;
}

type Registered = { run: JobHandler<unknown>; opts: JobOptions<unknown> };
type Scope = { enqueued: boolean };

/**
 * Durable background jobs on the `jobs` table.
 *
 * - `enqueue(tx, kind, payload)` inserts a QUEUED row inside the caller's
 *   transaction, so the job exists exactly when the change that needs it commits.
 * - `runDue(limit)` claims due rows in one statement with FOR UPDATE SKIP LOCKED
 *   (QUEUED -> RUNNING, attempts + 1), which is safe with several API instances,
 *   then runs each handler outside that claim, one after another. A handler owns
 *   its transactions. Success marks the row DONE; a throw puts it back to QUEUED
 *   after `retryDelayMs(attempts)`, or marks it FAILED (with `last_error`) after
 *   JOB_MAX_ATTEMPTS and calls the handler's `onExhausted`. A RUNNING row whose
 *   claim is older than JOB_STALE_MS is taken over (its worker died).
 * - `kick()` runs `runDue` on the next tick. Producers do not call it inside their
 *   transaction: HTTP requests are wrapped by JobsKickInterceptor and other code by
 *   `scope(fn)`, which kick once the work (and so its commits) has finished, if
 *   anything was enqueued. The worker's interval picks up anything else.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger("Jobs");
  private readonly handlers = new Map<string, Registered>();
  private readonly scopes = new AsyncLocalStorage<Scope>();
  /** runs in this process happen one at a time, in order */
  private chain: Promise<unknown> = Promise.resolve();
  private kickPending = false;
  /** off in tests, which call runDue() themselves so results are deterministic */
  autoKick = env().NODE_ENV !== "test";

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  register<P>(kind: string, run: JobHandler<P>, opts: JobOptions<P> = {}) {
    this.handlers.set(kind, { run: run as JobHandler<unknown>, opts: opts as JobOptions<unknown> });
  }

  /** Inserts a job in the caller's transaction (or directly with the db handle). Returns its id. */
  async enqueue<P>(tx: Tx, kind: string, payload: P, opts: { runAfter?: Date } = {}) {
    const [row] = await tx
      .insert(jobs)
      .values({ kind, payload: payload as object, runAfter: opts.runAfter ?? this.clock.now() })
      .returning({ id: jobs.id });
    const scope = this.scopes.getStore();
    if (scope) scope.enqueued = true;
    return row!.id;
  }

  /** Runs `fn`; once it settles, kicks the worker if `fn` enqueued anything. Nested scopes join the outer one. */
  async scope<T>(fn: () => Promise<T>): Promise<T> {
    if (this.scopes.getStore()) return fn();
    const scope: Scope = { enqueued: false };
    try {
      return await this.scopes.run(scope, fn);
    } finally {
      if (scope.enqueued) this.kick();
    }
  }

  /** For the HTTP interceptor: runs `fn` inside a scope the caller flushes itself. */
  runInScope<T>(scope: Scope, fn: () => T): T {
    return this.scopes.run(scope, fn);
  }

  /** Schedules a run on the next tick (never inside the caller's transaction). */
  kick() {
    if (!this.autoKick || this.kickPending) return;
    this.kickPending = true;
    setImmediate(() => {
      this.kickPending = false;
      // switched off since (the app is shutting down)
      if (!this.autoKick) return;
      this.runDue().catch((e) => this.logger.error(e));
    });
  }

  /** Claims and runs up to `limit` due jobs. Returns how many it ran. */
  runDue(limit = 20): Promise<number> {
    const run = this.chain.then(() => this.runBatch(limit));
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Resolves when the run in progress (if any) has finished. */
  idle() {
    return this.chain.then(() => undefined);
  }

  private async runBatch(limit: number) {
    const kinds = [...this.handlers.keys()];
    if (!kinds.length) return 0;
    const now = this.clock.now();
    const due = this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          inArray(jobs.kind, kinds),
          or(and(eq(jobs.status, "QUEUED"), lte(jobs.runAfter, now)), and(eq(jobs.status, "RUNNING"), lt(jobs.lockedAt, new Date(now.getTime() - JOB_STALE_MS)))),
        ),
      )
      .orderBy(asc(jobs.runAfter))
      .limit(limit)
      .for("update", { skipLocked: true });
    const claimed = await this.db
      .update(jobs)
      .set({ status: "RUNNING", attempts: sql`${jobs.attempts} + 1`, lockedAt: now })
      .where(inArray(jobs.id, due))
      .returning();
    for (const job of claimed) await this.execute(job);
    return claimed.length;
  }

  private async execute(job: typeof jobs.$inferSelect) {
    const handler = this.handlers.get(job.kind)!;
    const lastAttempt = job.attempts >= JOB_MAX_ATTEMPTS;
    try {
      await handler.run(job.payload, { jobId: job.id, attempt: job.attempts, lastAttempt });
      await this.db.update(jobs).set({ status: "DONE", lockedAt: null, lastError: null }).where(eq(jobs.id, job.id));
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const lastError = error.message.slice(0, 2000);
      if (lastAttempt) {
        await this.db.update(jobs).set({ status: "FAILED", lockedAt: null, lastError }).where(eq(jobs.id, job.id));
        this.logger.error(`${job.kind} ${job.id} failed for good after ${job.attempts} attempts: ${lastError}`);
        try {
          await handler.opts.onExhausted?.(job.payload, error);
        } catch (f) {
          this.logger.error(`${job.kind} ${job.id} could not record its failure: ${(f as Error).message}`);
        }
      } else {
        const runAfter = new Date(this.clock.now().getTime() + retryDelayMs(job.attempts));
        await this.db.update(jobs).set({ status: "QUEUED", lockedAt: null, lastError, runAfter }).where(eq(jobs.id, job.id));
        this.logger.warn(`${job.kind} ${job.id} attempt ${job.attempts} failed, retrying at ${runAfter.toISOString()}: ${lastError}`);
      }
    }
  }
}
