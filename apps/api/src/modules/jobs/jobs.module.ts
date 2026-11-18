import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JobsKickInterceptor } from "./jobs.interceptor.js";
import { JobsService } from "./jobs.service.js";
import { JobsWorker } from "./jobs.worker.js";

/** Durable background jobs (see JobsService). Global, so any module can enqueue. */
@Global()
@Module({
  providers: [JobsService, JobsWorker, { provide: APP_INTERCEPTOR, useClass: JobsKickInterceptor }],
  exports: [JobsService],
})
export class JobsModule {}
