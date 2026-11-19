import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, EMAIL_PROVIDER } from "../../../common/tokens.js";
import { env } from "../../../config/env.js";
import type { Db } from "../../../db/client.js";
import { emailLog, supportMessages, users } from "../../../db/schema.js";
import { settingsPlaceholders } from "../../admin/admin.schemas.js";
import { SettingsService } from "../../admin/settings.service.js";
import type { EmailProvider } from "../../auth/email.provider.js";
import { JobsService } from "../../jobs/jobs.service.js";
import { buildEmail, type EmailContext } from "./emails.js";
import { EMAIL_JOB, type EmailJobPayload } from "./notifications.service.js";

/** The address an anonymised account is left with (see AccountDeletionService). */
const MASKED = /@invalid\.altasgoods$/i;

/**
 * Sends the customer emails queued by NotificationsService, one job each.
 *
 * Jobs run at least once, so every run first looks for the email's dedupe key
 * in email_log and does nothing if it is there; after a successful send the
 * key is written. The one gap is a crash between the send and that write: the
 * job then runs again and the customer gets the same email twice. That is rare
 * and harmless, and better than the alternative (recording first) which would
 * lose the email for good.
 *
 * The address is read now, not when the email was queued: an account deleted
 * or blocked meanwhile gets nothing. A provider failure throws, so the job
 * retries with backoff; after the last attempt it is logged as an error.
 */
@Injectable()
export class EmailNotificationsWorker implements OnModuleInit {
  private readonly logger = new Logger("CustomerEmails");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  onModuleInit() {
    this.jobs.register<EmailJobPayload>(EMAIL_JOB, (p) => this.send(p), {
      onExhausted: async (p, e) => {
        this.logger.error(`Gave up on the ${p.kind} email (${p.dedupeKey}) after every attempt failed: ${e.message}`);
      },
    });
  }

  async send(p: EmailJobPayload) {
    const [done] = await this.db.select({ key: emailLog.dedupeKey }).from(emailLog).where(eq(emailLog.dedupeKey, p.dedupeKey));
    if (done) return;
    const [user] = await this.db.select({ email: users.email, name: users.name, status: users.status }).from(users).where(eq(users.id, p.userId));
    // deleted (anonymised) or blocked accounts get no email
    if (!user || user.status !== "ACTIVE" || MASKED.test(user.email)) return;

    const settings = await this.settings.get();
    const ctx: EmailContext = {
      to: user.email,
      name: user.name,
      web: env().WEB_ORIGIN,
      signOff: settingsPlaceholders(settings).includes("Company legal name") ? "AltasGoods" : settings.company.legalName,
    };
    if (p.kind === "CARE_REPLY") {
      const { messageId, ticketId } = (p as EmailJobPayload<"CARE_REPLY">).data;
      const [m] = await this.db
        .select({ author: supportMessages.author, body: supportMessages.body })
        .from(supportMessages)
        .where(and(eq(supportMessages.id, messageId), eq(supportMessages.ticketId, ticketId), eq(supportMessages.kind, "AGENT")));
      if (!m) return;
      ctx.reply = { agent: m.author.split(" ")[0] || "Our team", body: m.body };
    }

    const sent = await this.email.send(buildEmail(p.kind, ctx, p.data));
    await this.db
      .insert(emailLog)
      .values({ dedupeKey: p.dedupeKey, kind: p.kind, userId: p.userId, sentAt: this.clock.now(), providerMessageId: sent?.messageId ?? null })
      .onConflictDoNothing();
  }
}
