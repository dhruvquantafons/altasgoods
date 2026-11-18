import { Inject, Injectable, Logger, type BeforeApplicationShutdown, type OnApplicationBootstrap } from "@nestjs/common";
import { env } from "../../config/env.js";
import { JobsService } from "./jobs.service.js";

/** How often each instance looks for due jobs (kicks make most runs immediate). */
export const JOBS_POLL_MS = 10_000;

/** Polls for due jobs. Off in tests, which call JobsService.runDue() directly. */
@Injectable()
export class JobsWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger("JobsWorker");

  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.jobs.runDue().catch((e) => this.logger.error(e));
    }, JOBS_POLL_MS);
  }

  /** Stops polling and waits for the job in progress, before the database pool closes. */
  async beforeApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.jobs.autoKick = false;
    await this.jobs.idle();
  }
}
