import { waitUntil } from "@vercel/functions";
import { AsyncLocalStorage } from "node:async_hooks";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import { env, onVercel } from "../../config/env.js";
import type { Db, Tx } from "../../db/client.js";
import { jobs } from "../../db/schema.js";

/** Runs per job before it is marked FAILED. */
export const JOB_MAX_ATTEMPTS = 8;
/**
 * A job's lease: a RUNNING job whose run started (or, while it waits in a
 * claimed batch, whose claim was made) this long ago belongs to a worker that
 * died, and another worker may take it over.
 */
export const JOB_STALE_MS = 15 * 60_000;
/** Finished jobs are kept this long (by when they last changed), then deleted. Emails stay in email_log, their dedupe record, for good. */
export const JOB_KEEP_DONE_MS = 14 * 86_400_000;
export const JOB_KEEP_FAILED_MS = 90 * 86_400_000;
const PRUNE_BATCH = 1_000;
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
  /**
   * Called when the last attempt has failed, to record the failure in business
   * terms. The job is marked FAILED only after this returns; if it throws (or
   * the worker dies first) the job is retried later, run and all, so it may be
   * called more than once and must be idempotent too.
   */
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
 *   after `retryDelayMs(attempts)`. After JOB_MAX_ATTEMPTS the handler's
 *   `onExhausted` runs first and only then is the row marked FAILED (with
 *   `last_error`), so a crash in between retries the job instead of losing it.
 * - Leases: `locked_at` is renewed when each job actually starts, and the start
 *   only proceeds if the row still carries this worker's lease. A RUNNING row
 *   older than JOB_STALE_MS is taken over by any worker. So a job waiting in a
 *   batch behind slow jobs may be taken over, and is then skipped here; and the
 *   end of a run only records DONE / QUEUED / FAILED while the lease is still
 *   ours. Guarantee: at least once; two runs of one job overlap only if a run
 *   takes longer than JOB_STALE_MS; a job runs again after a success only if its
 *   worker died before recording DONE. Handlers must be idempotent, and anything
 *   that cannot be repeated (sending an email) should record that it happened in
 *   its own transaction and check that record first.
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

  /**
   * Inserts a job in the caller's transaction (or directly with the db handle). Returns its id.
   * With `dedupeKey`, nothing is inserted (and null is returned) while another job with that key
   * is QUEUED or RUNNING: a unique partial index decides, so two racing transactions cannot both
   * queue it. A key whose job is DONE or FAILED can be queued again; the handler checks its own
   * record of finished work.
   */
  enqueue<P>(tx: Tx, kind: string, payload: P, opts?: { runAfter?: Date }): Promise<string>;
  enqueue<P>(tx: Tx, kind: string, payload: P, opts: { runAfter?: Date; dedupeKey: string }): Promise<string | null>;
  async enqueue<P>(tx: Tx, kind: string, payload: P, opts: { runAfter?: Date; dedupeKey?: string } = {}): Promise<string | null> {
    const insert = tx.insert(jobs).values({ kind, payload: payload as object, runAfter: opts.runAfter ?? this.clock.now(), dedupeKey: opts.dedupeKey ?? null });
    const [row] = await (opts.dedupeKey ? insert.onConflictDoNothing({ target: jobs.dedupeKey, where: sql`status in ('QUEUED', 'RUNNING')` }) : insert).returning({ id: jobs.id });
    if (!row) return null;
    const scope = this.scopes.getStore();
    if (scope) scope.enqueued = true;
    return row.id;
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
    const run = () => {
      this.kickPending = false;
      // switched off since (the app is shutting down)
      if (!this.autoKick) return Promise.resolve();
      return this.runDue().then(
        () => undefined,
        (e) => this.logger.error(e),
      );
    };
    // On Vercel the function may be frozen once the response is sent, so the run is
    // handed to waitUntil, which keeps it alive until the queued work is done.
    if (onVercel()) waitUntil(Promise.resolve().then(run));
    else setImmediate(run);
  }

  /** Claims and runs up to `limit` due jobs. Returns how many it ran. */
  runDue(limit = 20): Promise<number> {
    // a job may queue others (a refund queues its email): kick again for them once this batch is done
    const run = this.chain.then(() => this.scope(() => this.runBatch(limit)));
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Resolves when the run in progress (if any) has finished. */
  idle() {
    return this.chain.then(() => undefined);
  }

  /**
   * Deletes DONE jobs older than JOB_KEEP_DONE_MS and FAILED ones older than
   * JOB_KEEP_FAILED_MS, a batch at a time so no statement holds many rows.
   * Returns how many went. Safe with several instances.
   */
  async prune(batch = PRUNE_BATCH): Promise<number> {
    const now = this.clock.now().getTime();
    let total = 0;
    for (const [status, keep] of [["DONE", JOB_KEEP_DONE_MS], ["FAILED", JOB_KEEP_FAILED_MS]] as const) {
      for (;;) {
        const old = this.db
          .select({ id: jobs.id })
          .from(jobs)
          .where(and(eq(jobs.status, status), lt(jobs.updatedAt, new Date(now - keep))))
          .limit(batch)
          .for("update", { skipLocked: true });
        const gone = await this.db.delete(jobs).where(inArray(jobs.id, old)).returning({ id: jobs.id });
        total += gone.length;
        if (gone.length < batch) break;
      }
    }
    return total;
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
    // UPDATE ... RETURNING does not keep the subquery's order: oldest first
    claimed.sort((a, b) => a.runAfter.getTime() - b.runAfter.getTime());
    for (const job of claimed) await this.execute(job);
    return claimed.length;
  }

  private async execute(job: typeof jobs.$inferSelect) {
    const handler = this.handlers.get(job.kind)!;
    // renew the lease now that the run starts; another worker may have taken the job over while it waited in this batch
    const startedAt = this.clock.now();
    const [started] = await this.db
      .update(jobs)
      .set({ lockedAt: startedAt })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "RUNNING"), eq(jobs.lockedAt, job.lockedAt!)))
      .returning({ id: jobs.id });
    if (!started) {
      this.logger.warn(`${job.kind} ${job.id} was taken over by another worker before it started here`);
      return;
    }
    const ours = and(eq(jobs.id, job.id), eq(jobs.status, "RUNNING"), eq(jobs.lockedAt, startedAt));
    const finish = async (patch: Partial<typeof jobs.$inferInsert>) => {
      const [kept] = await this.db.update(jobs).set(patch).where(ours).returning({ id: jobs.id });
      if (!kept) this.logger.warn(`${job.kind} ${job.id} ran past its lease and was taken over; its result here is not recorded`);
    };
    const lastAttempt = job.attempts >= JOB_MAX_ATTEMPTS;
    const retryLater = (lastError: string) => finish({ status: "QUEUED", lockedAt: null, lastError, runAfter: new Date(this.clock.now().getTime() + retryDelayMs(job.attempts)) });
    try {
      await handler.run(job.payload, { jobId: job.id, attempt: job.attempts, lastAttempt });
      await finish({ status: "DONE", lockedAt: null, lastError: null });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const lastError = error.message.slice(0, 2000);
      if (!lastAttempt) {
        this.logger.warn(`${job.kind} ${job.id} attempt ${job.attempts} failed, will retry: ${lastError}`);
        return retryLater(lastError);
      }
      try {
        await handler.opts.onExhausted?.(job.payload, error);
      } catch (f) {
        // the failure is not recorded yet: keep the job, so it is tried again rather than lost
        this.logger.error(`${job.kind} ${job.id} could not record its failure, will retry: ${(f as Error).message}`);
        return retryLater(lastError);
      }
      await finish({ status: "FAILED", lockedAt: null, lastError });
      this.logger.error(`${job.kind} ${job.id} failed for good after ${job.attempts} attempts: ${lastError}`);
    }
  }
}
