import { Inject, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { finalize, type Observable } from "rxjs";
import { JobsService } from "./jobs.service.js";

/**
 * Runs every request inside a jobs scope. When the handler has finished (its
 * transactions committed) and it enqueued a job, the worker is kicked so the
 * job runs at once instead of on the next poll.
 */
@Injectable()
export class JobsKickInterceptor implements NestInterceptor {
  constructor(@Inject(JobsService) private readonly jobs: JobsService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const scope = { enqueued: false };
    return this.jobs.runInScope(scope, () => next.handle()).pipe(
      finalize(() => {
        if (scope.enqueued) this.jobs.kick();
      }),
    );
  }
}
