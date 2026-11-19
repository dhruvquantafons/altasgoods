import { Inject, Injectable, Logger, type BeforeApplicationShutdown, type OnApplicationBootstrap } from "@nestjs/common";
import { env } from "../../config/env.js";
import { JobsService } from "./jobs.service.js";

/** How often each instance looks for due jobs (kicks make most runs immediate). */
export const JOBS_POLL_MS = 10_000;
/** How often old finished jobs are deleted. */
export const JOBS_PRUNE_MS = 6 * 3_600_000;

/** Polls for due jobs, and now and then deletes old finished ones. Off in tests, which call JobsService.runDue() directly. */
@Injectable()
export class JobsWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private pruneTimer?: NodeJS.Timeout;
  private readonly logger = new Logger("JobsWorker");

  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.jobs.runDue().catch((e) => this.logger.error(e));
    }, JOBS_POLL_MS);
    this.pruneTimer = setInterval(() => {
      this.jobs
        .prune()
        .then((n) => n && this.logger.log(`Deleted ${n} old finished jobs`))
        .catch((e) => this.logger.error(e));
    }, JOBS_PRUNE_MS);
  }

  /** Stops polling and waits for the job in progress, before the database pool closes. */
  async beforeApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.jobs.autoKick = false;
    await this.jobs.idle();
  }
}
