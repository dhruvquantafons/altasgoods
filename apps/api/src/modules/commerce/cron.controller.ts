import { createHash, timingSafeEqual } from "node:crypto";
import { Controller, Get, Headers, HttpCode, Inject, Logger } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { ApiError } from "../../common/errors.js";
import { env } from "../../config/env.js";
import { Public } from "../auth/auth.guard.js";
import { JobsService } from "../jobs/jobs.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { RefundsService } from "./payments/refunds.service.js";
import { ShippingService } from "./shipping/shipping.service.js";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Whether the Authorization header carries exactly "Bearer <CRON_SECRET>", compared in constant time. */
export function cronAuthorized(header: string | undefined, secret: string | undefined) {
  if (!secret || !header) return false;
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * Vercel only. A Vercel Function does not outlive its request, so the timers that
 * run the background work on a normal server are off there (see `onVercel`), and
 * Vercel Cron calls this endpoint instead. It does one round of every timer's work.
 * Each step is idempotent and locks the rows it changes, so an overlap with a
 * request, or a repeated call, is harmless. Closed (404) unless CRON_SECRET is set.
 */
@ApiExcludeController()
@Controller("v1/cron")
export class CronController {
  private readonly logger = new Logger("Cron");

  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(ShippingService) private readonly shipping: ShippingService,
  ) {}

  @Public()
  @Get("tick")
  @HttpCode(200)
  async tick(@Headers("authorization") authorization?: string) {
    const secret = env().CRON_SECRET;
    if (!secret) throw new ApiError(404, "NOT_FOUND", "Not found");
    if (!cronAuthorized(authorization, secret)) throw new ApiError(401, "UNAUTHORIZED", "Not authorised");

    // the same order as the timers: confirm payments the gateway took before expiring unpaid orders
    const result = await this.jobs.scope(async () => {
      const paymentsConfirmed = await this.payments.reconcileOpen();
      const ordersExpired = await this.payments.expireStale();
      const refundsSettled = await this.refunds.refreshProcessing();
      const trackingMoved = this.shipping.providerName === "SIMULATED" ? 0 : await this.shipping.pollTracking();
      return { paymentsConfirmed, ordersExpired, refundsSettled, trackingMoved };
    });
    // the queued work (refunds, emails) runs here, inside the request, so the cron call covers it
    await this.jobs.runDue();
    await this.jobs.idle();
    const jobsPruned = await this.jobs.prune();
    this.logger.log(`Cron tick: ${JSON.stringify({ ...result, jobsPruned })}`);
    return { ...result, jobsPruned };
  }
}
