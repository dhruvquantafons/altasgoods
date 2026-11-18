import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Tx } from "../../../db/client.js";
import { emailLog } from "../../../db/schema.js";
import { SettingsService } from "../../admin/settings.service.js";
import { JobsService } from "../../jobs/jobs.service.js";
import { DEDUPE_PREFIX, type NotificationData, type NotificationKind } from "./emails.js";

/** Job kind that sends one customer email. */
export const EMAIL_JOB = "email.send";

/** References a notification may carry, for the record and for loading details at send time. */
export interface NotificationRefs {
  orderId?: string;
  returnId?: string;
  ticketId?: string;
  refundId?: string;
}

export interface EmailJobPayload<K extends NotificationKind = NotificationKind> {
  kind: K;
  dedupeKey: string;
  userId: string;
  refs: NotificationRefs;
  data: NotificationData[K];
}

/**
 * Queues customer emails. Producers call `notify` inside the transaction that
 * makes the change, so the email goes out only if the change commits, and
 * never send anything themselves: the `email.send` job does (see
 * EmailNotificationsWorker), retrying on failure.
 *
 * Each email has a dedupe key (`<prefix>:<key>`, such as
 * order-placed:BB-...). It is queued at most once: not while a job with that
 * key is queued or running (a unique partial index on jobs.dedupe_key, so
 * racing transactions cannot both queue it), and not once email_log has it.
 * The worker checks email_log again before sending.
 *
 * Nothing is queued while the store has customer emails switched off
 * (settings notifications.customerEmails); those emails are not sent later.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  /** Queues one email. `key` identifies it within its kind. Returns the job id, or null when nothing was queued. */
  async notify<K extends NotificationKind>(tx: Tx, kind: K, input: { userId: string | null; key: string; data: NotificationData[K] } & NotificationRefs) {
    const { userId, key, data, ...refs } = input;
    if (!userId) return null;
    if (!(await this.settings.get()).notifications.customerEmails) return null;
    const dedupeKey = `${DEDUPE_PREFIX[kind]}:${key}`;
    const [sent] = await tx.select({ key: emailLog.dedupeKey }).from(emailLog).where(eq(emailLog.dedupeKey, dedupeKey));
    if (sent) return null;
    const payload: EmailJobPayload<K> = { kind, dedupeKey, userId, refs, data };
    return this.jobs.enqueue(tx, EMAIL_JOB, payload, { dedupeKey });
  }
}
