import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, ilike, inArray, min, or, sql, type SQL } from "drizzle-orm";
import { ApiError, conflict, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { kycDocuments, sellerApplications, sellerMembers, sellers, users, type ApplicationStatus, type FlaggedItem, type StaffNote } from "../../db/schema.js";
import { ApplicationStore, type Application } from "./applications.store.js";
import { approvalBlockers, isDocumentKind, REOPEN_COOL_OFF_DAYS, slugify } from "./onboarding.rules.js";

const TABS: Record<"open" | "in_progress" | "decided", ApplicationStatus[]> = {
  open: ["SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED"],
  in_progress: ["KYC_IN_PROGRESS"],
  decided: ["APPROVED", "REJECTED"],
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** BluBuy Control: the seller application queue and decisions (spec 9.3.2). */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ApplicationStore) private readonly store: ApplicationStore,
  ) {}

  async list(query: { tab: keyof typeof TABS; q?: string; page: number; pageSize: number }) {
    const conditions: SQL[] = [inArray(sellerApplications.status, TABS[query.tab])];
    if (query.q) {
      const like = `%${query.q}%`;
      conditions.push(
        or(
          ilike(sellerApplications.id, like),
          ilike(sellerApplications.storeName, like),
          ilike(sellerApplications.legalName, like),
          ilike(sellerApplications.gstin, like),
          ilike(sellerApplications.pan, like),
          ilike(users.name, like),
        )!,
      );
    }
    const where = and(...conditions);
    const order =
      query.tab === "open"
        ? [sql`${sellerApplications.submittedAt} asc nulls last`]
        : query.tab === "decided"
          ? [desc(sellerApplications.decidedAt)]
          : [desc(sellerApplications.updatedAt)];

    const since = new Date(this.clock.now().getTime() - 30 * 24 * 3600_000);
    const [rows, [total], byStatus, [oldest], decided30] = await Promise.all([
      this.db
        .select({ app: sellerApplications, ownerName: users.name })
        .from(sellerApplications)
        .innerJoin(users, eq(users.id, sellerApplications.userId))
        .where(where)
        .orderBy(...order, asc(sellerApplications.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.select({ n: count() }).from(sellerApplications).innerJoin(users, eq(users.id, sellerApplications.userId)).where(where),
      this.db.select({ status: sellerApplications.status, n: count() }).from(sellerApplications).groupBy(sellerApplications.status),
      this.db
        .select({ at: min(sellerApplications.submittedAt) })
        .from(sellerApplications)
        .where(inArray(sellerApplications.status, ["SUBMITTED", "UNDER_REVIEW"])),
      this.db
        .select({ status: sellerApplications.status, n: count() })
        .from(sellerApplications)
        .where(and(inArray(sellerApplications.status, ["APPROVED", "REJECTED"]), gte(sellerApplications.decidedAt, since)))
        .groupBy(sellerApplications.status),
    ]);

    const n = (statuses: ApplicationStatus[]) => byStatus.filter((r) => statuses.includes(r.status)).reduce((a, r) => a + Number(r.n), 0);
    const approved = Number(decided30.find((r) => r.status === "APPROVED")?.n ?? 0);
    const decidedTotal = decided30.reduce((a, r) => a + Number(r.n), 0);

    return {
      items: rows.map(({ app, ownerName }) => ({
        id: app.id,
        status: app.status,
        storeName: app.storeName,
        legalName: app.legalName,
        ownerName,
        constitution: app.constitution,
        city: app.pickup?.city ?? null,
        state: app.pickup?.state ?? app.gstState,
        checks: { gst: app.gstCheck?.result ?? null, pan: app.panCheck?.result ?? null, bank: app.bankCheck?.result ?? null },
        riskFlags: app.riskFlags,
        submittedAt: iso(app.submittedAt),
        slaDueAt: iso(app.slaDueAt),
        decidedAt: iso(app.decidedAt),
        updatedAt: app.updatedAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total?.n ?? 0),
      counts: {
        open: n(TABS.open),
        inProgress: n(TABS.in_progress),
        decided: n(TABS.decided),
        awaitingReview: n(["SUBMITTED", "UNDER_REVIEW"]),
        waitingOnSeller: n(["ACTION_REQUIRED"]),
      },
      oldestOpenSubmittedAt: iso(oldest?.at ?? null),
      approvalRate30d: decidedTotal ? approved / decidedTotal : null,
    };
  }

  async detail(id: string) {
    return this.store.reviewView(await this.store.byId(id));
  }

  private async note(tx: Tx, staffUserId: string, body: string | undefined): Promise<StaffNote[]> {
    if (!body) return [];
    const [staff] = await tx.select({ name: users.name }).from(users).where(eq(users.id, staffUserId));
    return [{ byUserId: staffUserId, byName: staff?.name ?? null, at: this.clock.now().toISOString(), body }];
  }

  /** Approves: the seller account is created with the applicant as owner. */
  async approve(staffUserId: string, id: string, note?: string) {
    const app = await this.db.transaction(async (tx) => {
      const app = await this.store.lock(tx, { id });
      if (app.status !== "UNDER_REVIEW") throw conflict("NOT_UNDER_REVIEW", "Only applications under review can be approved.");
      const blockers = approvalBlockers(app, await this.store.documents(app.id, tx));
      if (blockers.length) throw new ApiError(409, "APPROVAL_BLOCKED", "This application cannot be approved yet. Request changes or reject it.", blockers.map((message) => ({ path: "", message })));

      const sellerId = await this.createSeller(tx, app);
      const now = this.clock.now();
      await tx.update(kycDocuments).set({ status: "VERIFIED", reviewedAt: now }).where(and(eq(kycDocuments.applicationId, app.id), eq(kycDocuments.status, "PENDING")));
      return this.store.move(tx, app, "APPROVED", "STAFF", staffUserId, "All checks verified. The seller can now create listings.", {
        decidedAt: now,
        decidedBy: staffUserId,
        sellerId,
        staffNotes: [...app.staffNotes, ...(await this.note(tx, staffUserId, note))],
      });
    });
    await this.store.notify(app, "Your BluBuy seller account is approved", `${app.storeName} is ready. Sign in to Seller Hub to create your first listing.`);
    return this.store.reviewView(app);
  }

  private async createSeller(tx: Tx, app: Application) {
    const [owner] = await tx.select().from(users).where(eq(users.id, app.userId));
    const base = slugify(app.storeName ?? app.legalName ?? app.id);
    const taken = new Set((await tx.select({ slug: sellers.slug }).from(sellers).where(sql`${sellers.slug} like ${`${base}%`}`)).map((r) => r.slug));
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

    const id = `s-${slug}`;
    await tx.insert(sellers).values({
      id,
      slug,
      displayName: app.storeName!,
      legalName: app.legalName!,
      ownerName: owner?.name ?? app.legalName!,
      email: owner?.email ?? "",
      phone: owner!.phone,
      gstin: app.gstin,
      pan: app.pan,
      city: app.pickup!.city,
      state: app.pickup!.state,
      pincode: app.pickup!.pincode,
      // becomes ACTIVE once the first listing passes QC and the pickup address is verified
      status: "APPROVED",
      tier: "Bronze",
      joinedAt: this.clock.now(),
    });
    await tx.insert(sellerMembers).values({ sellerId: id, userId: app.userId, role: "OWNER" });
    return id;
  }

  async requestChanges(staffUserId: string, id: string, input: { items: string[]; message: string }) {
    const app = await this.db.transaction(async (tx) => {
      const app = await this.store.lock(tx, { id });
      if (app.status !== "UNDER_REVIEW") throw conflict("NOT_UNDER_REVIEW", "Changes can only be requested while the application is under review.");
      const allowed = this.store.flaggable(app);
      const flagged: FlaggedItem[] = [];
      for (const key of new Set(input.items)) {
        const item = allowed.find((a) => a.key === key);
        if (!item) throw unprocessable("UNKNOWN_ITEM", `${key} is not part of this application`);
        flagged.push(item);
      }
      const docKinds = flagged.map((f) => f.key).filter(isDocumentKind);
      if (docKinds.length) {
        await tx
          .update(kycDocuments)
          .set({ status: "REJECTED", note: input.message, reviewedAt: this.clock.now() })
          .where(and(eq(kycDocuments.applicationId, app.id), inArray(kycDocuments.kind, docKinds)));
      }
      return this.store.move(tx, app, "ACTION_REQUIRED", "STAFF", staffUserId, input.message, { flaggedItems: flagged, reviewerMessage: input.message });
    });
    await this.store.notify(app, "Action needed on your BluBuy seller application", `${input.message} Fix the flagged items in Seller Hub and resubmit within 30 days.`);
    return this.store.reviewView(app);
  }

  async reject(staffUserId: string, id: string, input: { reason: string; note?: string }) {
    const app = await this.db.transaction(async (tx) => {
      const app = await this.store.lock(tx, { id });
      if (app.status !== "UNDER_REVIEW" && app.status !== "ACTION_REQUIRED") throw conflict("NOT_UNDER_REVIEW", "Only open applications can be rejected.");
      return this.store.move(tx, app, "REJECTED", "STAFF", staffUserId, input.reason, {
        rejectionReason: input.reason,
        decidedAt: this.clock.now(),
        decidedBy: staffUserId,
        staffNotes: [...app.staffNotes, ...(await this.note(tx, staffUserId, input.note))],
      });
    });
    await this.store.notify(app, "Your BluBuy seller application was declined", `Reason: ${input.reason}. You can ask Seller Support to reopen it after ${REOPEN_COOL_OFF_DAYS} days.`);
    return this.store.reviewView(app);
  }

  /** A rejected application can be reopened after the cool-off period. */
  async reopen(staffUserId: string, id: string) {
    const app = await this.db.transaction(async (tx) => {
      const app = await this.store.lock(tx, { id });
      if (app.status !== "REJECTED") throw conflict("NOT_REJECTED", "Only rejected applications can be reopened.");
      const allowedAt = new Date((app.decidedAt?.getTime() ?? 0) + REOPEN_COOL_OFF_DAYS * 24 * 3600_000);
      if (allowedAt > this.clock.now()) throw conflict("COOL_OFF", `This application can be reopened from ${allowedAt.toISOString().slice(0, 10)}, ${REOPEN_COOL_OFF_DAYS} days after the decision.`);
      return this.store.move(tx, app, "KYC_IN_PROGRESS", "STAFF", staffUserId, "Reopened after the cool-off period", {
        rejectionReason: null,
        decidedAt: null,
        decidedBy: null,
        flaggedItems: [],
        reviewerMessage: null,
        riskFlags: [],
        submittedAt: null,
        slaDueAt: null,
      });
    });
    return this.store.reviewView(app);
  }
}
