import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env, onVercel } from "../../../config/env.js";
import { JobsService } from "../../jobs/jobs.service.js";
import { ShippingService } from "./shipping.service.js";

const EVERY_MS = 10 * 60_000;

/** Polls the courier for scans every 10 minutes, so tracking works without a webhook. */
@Injectable()
export class ShipmentTracker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger("ShipmentTracker");

  constructor(
    @Inject(ShippingService) private readonly shipping: ShippingService,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  onApplicationBootstrap() {
    // on Vercel, Vercel Cron calls /v1/cron/tick instead
    if (env().NODE_ENV === "test" || onVercel() || this.shipping.providerName === "SIMULATED") return;
    this.timer = setInterval(() => {
      // scans can cancel or return lines, which queues jobs: run them once the poll is done
      this.jobs.scope(() => this.shipping.pollTracking()).then(
        (n) => n && this.logger.log(`Tracking moved ${n} items`),
        (e) => this.logger.error(e),
      );
    }, EVERY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
