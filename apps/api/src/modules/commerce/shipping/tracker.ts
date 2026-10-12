import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env } from "../../../config/env.js";
import { ShippingService } from "./shipping.service.js";

const EVERY_MS = 10 * 60_000;

/** Polls the courier for scans every 10 minutes, so tracking works without a webhook. */
@Injectable()
export class ShipmentTracker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger("ShipmentTracker");

  constructor(@Inject(ShippingService) private readonly shipping: ShippingService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === "test" || this.shipping.providerName === "SIMULATED") return;
    this.timer = setInterval(() => {
      this.shipping.pollTracking().then(
        (n) => n && this.logger.log(`Tracking moved ${n} items`),
        (e) => this.logger.error(e),
      );
    }, EVERY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
