import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { env, onVercel } from "../../../config/env.js";
import { JobsService } from "../../jobs/jobs.service.js";
import { PaymentsService } from "./payments.service.js";
import { RefundsService } from "./refunds.service.js";

/** Refunds the gateway is still processing are re-read this often. */
const REFUND_RECHECK_MS = 15 * 60_000;

/**
 * Every minute: confirms payments the gateway took but never told us about,
 * then expires unpaid orders. Every 15 minutes: re-reads refunds the gateway
 * is still processing. Several instances may run this at once: each step
 * locks the rows it changes and is idempotent.
 */
@Injectable()
export class PaymentSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];
  private readonly logger = new Logger("PaymentSweeper");

  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  onApplicationBootstrap() {
    // on Vercel, Vercel Cron calls /v1/cron/tick instead
    if (env().NODE_ENV === "test" || onVercel()) return;
    this.timers.push(
      setInterval(async () => {
        try {
          // a late capture found here queues a refund: the scope runs it straight after
          await this.jobs.scope(async () => {
            // reconcile first, so an order that was paid is never expired
            const paid = await this.payments.reconcileOpen();
            if (paid) this.logger.log(`Confirmed ${paid} payments from the gateway`);
            const expired = await this.payments.expireStale();
            if (expired) this.logger.log(`Expired ${expired} unpaid orders`);
          });
        } catch (e) {
          this.logger.error(e);
        }
      }, 60_000),
      setInterval(async () => {
        try {
          // a settled refund queues the customer's email: the scope sends it straight after
          const settled = await this.jobs.scope(() => this.refunds.refreshProcessing());
          if (settled) this.logger.log(`Settled ${settled} refunds from the gateway`);
        } catch (e) {
          this.logger.error(e);
        }
      }, REFUND_RECHECK_MS),
    );
  }

  onApplicationShutdown() {
    for (const t of this.timers) clearInterval(t);
  }
}
