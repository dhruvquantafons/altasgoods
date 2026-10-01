import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env } from "../../../config/env.js";
import { PaymentsService } from "./payments.service.js";

/** Expires unpaid orders every minute. A job queue replaces this when the API scales out. */
@Injectable()
export class PaymentSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger("PaymentSweeper");

  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === "test") return;
    this.timer = setInterval(() => {
      this.payments.expireStale().then(
        (n) => n && this.logger.log(`Expired ${n} unpaid orders`),
        (e) => this.logger.error(e),
      );
    }, 60_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
