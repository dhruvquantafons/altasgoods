import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env } from "../../../config/env.js";
import { PaymentsService } from "./payments.service.js";

/**
 * Every minute: confirms payments the gateway took but never told us about,
 * then expires unpaid orders. A job queue replaces this when the API scales out.
 */
@Injectable()
export class PaymentSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger("PaymentSweeper");

  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === "test") return;
    this.timer = setInterval(async () => {
      try {
        // reconcile first, so an order that was paid is never expired
        const paid = await this.payments.reconcileOpen();
        if (paid) this.logger.log(`Confirmed ${paid} payments from the gateway`);
        const expired = await this.payments.expireStale();
        if (expired) this.logger.log(`Expired ${expired} unpaid orders`);
      } catch (e) {
        this.logger.error(e);
      }
    }, 60_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
