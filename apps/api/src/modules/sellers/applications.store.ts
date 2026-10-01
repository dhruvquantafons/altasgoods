import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { conflict, notFound } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, EMAIL_PROVIDER } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import {
  kycDocuments,
  sellerApplicationEvents,
  sellerApplications,
  sellers,
  users,
  type ApplicationStatus,
  type RiskFlag,
} from "../../db/schema.js";
import type { EmailProvider } from "../auth/sms.provider.js";
import { PAN_TYPE_FOR } from "./kyc/india.js";
import { AGREEMENT_VERSION, approvalBlockers, canMove, DOCUMENT_LABEL, documentRequirements, missingItems, SECTIONS } from "./onboarding.rules.js";

export type Application = typeof sellerApplications.$inferSelect;
type Actor = "SELLER" | "SYSTEM" | "STAFF";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Shared persistence for seller applications: loading, status moves with history, and API views. */
@Injectable()
export class ApplicationStore {
  private readonly logger = new Logger("Onboarding");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async byUser(userId: string, tx: Tx = this.db) {
    const [app] = await tx.select().from(sellerApplications).where(eq(sellerApplications.userId, userId));
    return app ?? null;
  }

  async byId(id: string, tx: Tx = this.db) {
    const [app] = await tx.select().from(sellerApplications).where(eq(sellerApplications.id, id));
    if (!app) throw notFound("Application");
    return app;
  }

  /** Locks the row for the rest of the transaction, so two decisions cannot race. */
  async lock(tx: Tx, where: { id?: string; userId?: string }) {
    const [app] = await tx
      .select()
      .from(sellerApplications)
      .where(where.id ? eq(sellerApplications.id, where.id) : eq(sellerApplications.userId, where.userId!))
      .for("update");
    if (!app) throw notFound("Application");
    return app;
  }

  /** The single place an application changes status. Validates the move and records it. */
  async move(tx: Tx, app: Application, to: ApplicationStatus, actor: Actor, actorUserId: string | null, note: string | null, patch: Partial<Application> = {}) {
    if (!canMove(app.status, to)) throw conflict("INVALID_TRANSITION", `An application that is ${app.status.toLowerCase().replace(/_/g, " ")} cannot move to ${to.toLowerCase().replace(/_/g, " ")}`);
    const at = this.clock.now();
    const [next] = await tx
      .update(sellerApplications)
      .set({ ...patch, status: to, updatedAt: at })
      .where(and(eq(sellerApplications.id, app.id), eq(sellerApplications.status, app.status)))
      .returning();
    if (!next) throw conflict("STALE_APPLICATION", "This application changed meanwhile. Reload and try again.");
    await tx.insert(sellerApplicationEvents).values({ applicationId: app.id, fromStatus: app.status, toStatus: to, actor, actorUserId, note, at });
    return next;
  }

  documents(applicationId: string, tx: Tx = this.db) {
    return tx
      .select({
        id: kycDocuments.id,
        kind: kycDocuments.kind,
        fileId: kycDocuments.fileId,
        fileName: kycDocuments.fileName,
        mimeType: kycDocuments.mimeType,
        sizeBytes: kycDocuments.sizeBytes,
        status: kycDocuments.status,
        note: kycDocuments.note,
        uploadedAt: kycDocuments.uploadedAt,
      })
      .from(kycDocuments)
      .where(eq(kycDocuments.applicationId, applicationId))
      .orderBy(asc(kycDocuments.uploadedAt));
  }

  private events(applicationId: string) {
    return this.db
      .select({
        fromStatus: sellerApplicationEvents.fromStatus,
        toStatus: sellerApplicationEvents.toStatus,
        actor: sellerApplicationEvents.actor,
        note: sellerApplicationEvents.note,
        at: sellerApplicationEvents.at,
        actorName: users.name,
      })
      .from(sellerApplicationEvents)
      .leftJoin(users, eq(users.id, sellerApplicationEvents.actorUserId))
      .where(eq(sellerApplicationEvents.applicationId, applicationId))
      .orderBy(asc(sellerApplicationEvents.at), asc(sellerApplicationEvents.id));
  }

  async owner(userId: string, tx: Tx = this.db) {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    if (!u) throw notFound("User");
    return { name: u.name, phone: u.phone, email: u.email, emailVerified: !!u.emailVerifiedAt };
  }

  /**
   * Automatic screening at submission: duplicate PAN, GSTIN or bank account
   * across sellers and other applications, and consistency between the
   * documents (spec 9.3.2 risk flags).
   */
  async screen(tx: Tx, app: Application): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];
    if (app.pan) {
      const samePan = await tx.select({ name: sellers.displayName, status: sellers.status }).from(sellers).where(eq(sellers.pan, app.pan));
      for (const s of samePan) {
        flags.push(
          ["SUSPENDED", "DEACTIVATED"].includes(s.status)
            ? { code: "PAN_LINKED_SUSPENDED", severity: "HIGH", message: `PAN is linked to ${s.name}, which is ${s.status.toLowerCase()}` }
            : { code: "PAN_LINKED_SELLER", severity: "MEDIUM", message: `PAN is already used by ${s.name}. Confirm this is the same business opening another store.` },
        );
      }
      const otherApps = await tx
        .select({ id: sellerApplications.id, status: sellerApplications.status })
        .from(sellerApplications)
        .where(and(eq(sellerApplications.pan, app.pan), ne(sellerApplications.id, app.id), ne(sellerApplications.status, "APPROVED")));
      for (const o of otherApps) {
        flags.push(
          o.status === "REJECTED"
            ? { code: "PAN_PREVIOUSLY_REJECTED", severity: "HIGH", message: `PAN was on application ${o.id}, which was rejected` }
            : { code: "PAN_ON_OTHER_APPLICATION", severity: "MEDIUM", message: `PAN is also on application ${o.id}` },
        );
      }
    }
    if (app.gstin) {
      const sameGstin = await tx.select({ name: sellers.displayName }).from(sellers).where(eq(sellers.gstin, app.gstin));
      for (const s of sameGstin) flags.push({ code: "GSTIN_LINKED_SELLER", severity: "MEDIUM", message: `GSTIN is already registered to ${s.name}` });
    }
    if (app.bankAccount && app.bankIfsc) {
      const sameBank = await tx
        .select({ id: sellerApplications.id })
        .from(sellerApplications)
        .where(and(eq(sellerApplications.bankAccount, app.bankAccount), eq(sellerApplications.bankIfsc, app.bankIfsc), ne(sellerApplications.id, app.id)));
      for (const o of sameBank) flags.push({ code: "BANK_ON_OTHER_APPLICATION", severity: "HIGH", message: `Bank account is also registered on application ${o.id}` });
    }
    if (app.constitution && app.pan && PAN_TYPE_FOR[app.constitution] !== app.pan[3]) {
      flags.push({ code: "PAN_TYPE_MISMATCH", severity: "MEDIUM", message: `A ${app.constitution.toLowerCase().replace(/_/g, " ")} should have a PAN of type ${PAN_TYPE_FOR[app.constitution]}, this one is type ${app.pan[3]}` });
    }
    if (app.gstCheck && app.constitution && app.gstCheck.constitution !== app.constitution) {
      flags.push({ code: "CONSTITUTION_MISMATCH", severity: "MEDIUM", message: "Business type differs from the GST registration" });
    }
    if (app.panCheck?.result === "PARTIAL") flags.push({ code: "PAN_NAME_PARTIAL", severity: "MEDIUM", message: `PAN holder name matches ${app.panCheck.nameMatchScore}%` });
    if (app.panCheck?.result === "FAILED") flags.push({ code: "PAN_NAME_MISMATCH", severity: "HIGH", message: `PAN holder ${app.panCheck.holderName} does not match the business` });
    if (app.panCheck && app.pan?.[3] === "P" && !app.panCheck.aadhaarLinked) flags.push({ code: "PAN_NOT_LINKED", severity: "MEDIUM", message: "PAN is not linked with Aadhaar, so it is inoperative" });
    if (app.bankCheck?.result === "PARTIAL") flags.push({ code: "BANK_NAME_PARTIAL", severity: "MEDIUM", message: `Bank returned ${app.bankCheck.beneficiaryName}, a ${app.bankCheck.nameMatchScore}% match. Check the bank proof.` });
    if (!app.gstExempt && app.gstState && app.pickup && app.pickup.state !== app.gstState) {
      flags.push({ code: "PICKUP_OUTSIDE_GST_STATE", severity: "LOW", message: `Pickup address is in ${app.pickup.state}; it must be an additional place of business on the ${app.gstState} GST registration` });
    }
    return flags;
  }

  /** What the applicant sees. Risk screening stays internal. */
  async applicantView(app: Application) {
    const [docs, events, owner] = await Promise.all([this.documents(app.id), this.events(app.id), this.owner(app.userId)]);
    return {
      id: app.id,
      status: app.status,
      account: owner,
      business: {
        constitution: app.constitution,
        gstExempt: app.gstExempt,
        gstin: app.gstin,
        legalName: app.legalName,
        tradeName: app.tradeName,
        registeredAddress: app.registeredAddress,
        gstState: app.gstState,
        pan: app.pan,
      },
      store: { name: app.storeName, description: app.storeDescription, careNumber: app.careNumber, grievanceContact: app.grievanceContact },
      pickup: app.pickup ?? null,
      bank: app.bankAccount && app.bankHolder && app.bankIfsc ? { holder: app.bankHolder, accountLast4: app.bankAccount.slice(-4), ifsc: app.bankIfsc } : null,
      categories: app.categories,
      brand: app.brand ?? null,
      checks: { gst: app.gstCheck ?? null, pan: app.panCheck ?? null, bank: app.bankCheck ?? null },
      documents: docs.map((d) => ({
        id: d.id,
        kind: d.kind,
        label: DOCUMENT_LABEL[d.kind],
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        status: d.status,
        note: d.note,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
      requiredDocuments: documentRequirements(app),
      missing: missingItems(app, docs, owner),
      flaggedItems: app.flaggedItems,
      reviewerMessage: app.reviewerMessage,
      rejectionReason: app.rejectionReason,
      agreementVersion: AGREEMENT_VERSION,
      submittedAt: iso(app.submittedAt),
      slaDueAt: iso(app.slaDueAt),
      decidedAt: iso(app.decidedAt),
      sellerId: app.sellerId,
      events: events.map(({ actorName: _n, ...e }) => ({ ...e, at: e.at.toISOString() })),
      updatedAt: app.updatedAt.toISOString(),
    };
  }

  /** What a verifier sees: the applicant view plus contact details, risk flags and blockers. */
  async reviewView(app: Application) {
    const [base, docs, events] = await Promise.all([this.applicantView(app), this.documents(app.id), this.events(app.id)]);
    return {
      ...base,
      owner: { name: base.account.name, phone: base.account.phone, email: base.account.email },
      bank:
        app.bankAccount && app.bankHolder && app.bankIfsc
          ? { holder: app.bankHolder, accountMasked: `${"X".repeat(Math.max(0, app.bankAccount.length - 4))}${app.bankAccount.slice(-4)}`, accountLast4: app.bankAccount.slice(-4), ifsc: app.bankIfsc }
          : null,
      riskFlags: app.riskFlags,
      blockers: app.status === "UNDER_REVIEW" ? approvalBlockers(app, docs) : [],
      agreementAcceptedAt: iso(app.agreementAcceptedAt),
      notes: app.staffNotes.map(({ byName, at, body }) => ({ byName, at, body })),
      events: events.map((e) => ({ ...e, at: e.at.toISOString() })),
    };
  }

  /** Allowed keys a verifier can flag: wizard sections plus the documents this application needs. */
  flaggable(app: Application) {
    return [
      ...Object.entries(SECTIONS).map(([key, label]) => ({ key, label })),
      ...documentRequirements(app).map((d) => ({ key: d.kind, label: d.label })),
    ];
  }

  async notify(app: Application, subject: string, body: string) {
    const owner = await this.owner(app.userId).catch(() => null);
    if (!owner?.email) return;
    await this.email.send(owner.email, subject, body).catch((e: unknown) => this.logger.warn(`Notification failed for ${app.id}: ${String(e)}`));
  }

  /** Lowercased store names already taken by sellers or by other live applications. */
  async storeNameTaken(name: string, exceptApplicationId?: string) {
    const lower = name.trim().toLowerCase();
    const [seller] = await this.db.select({ id: sellers.id }).from(sellers).where(sql`lower(${sellers.displayName}) = ${lower}`);
    if (seller) return true;
    const [other] = await this.db
      .select({ id: sellerApplications.id })
      .from(sellerApplications)
      .where(
        and(
          sql`lower(${sellerApplications.storeName}) = ${lower}`,
          inArray(sellerApplications.status, ["KYC_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "ACTION_REQUIRED"]),
          exceptApplicationId ? ne(sellerApplications.id, exceptApplicationId) : undefined,
        ),
      );
    return !!other;
  }
}
