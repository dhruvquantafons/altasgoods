import { basename } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { ApiError, conflict, notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, FILE_STORE, KYC_PROVIDER, REDIS } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import {
  categories,
  kycDocuments,
  sellerApplicationEvents,
  sellerApplications,
  sellerMembers,
  type BankCheck,
  type GstCheck,
  type KycDocumentKind,
  type PanCheck,
} from "../../db/schema.js";
import { normalizePhone } from "../auth/phone.js";
import { ApplicationStore, type Application } from "./applications.store.js";
import { sniffMime, type FileStore } from "./files.js";
import { gstinProblem, PAN_HOLDER_TYPES } from "./kyc/india.js";
import { matchResult, nameMatchScore } from "./kyc/names.js";
import type { KycProvider, PanLookup } from "./kyc/provider.js";
import { AGREEMENT_VERSION, EDITABLE, missingItems, REVIEW_SLA_HOURS } from "./onboarding.rules.js";
import type { updateApplicationBody } from "./sellers.schemas.js";
import type { z } from "zod";

const MB = 1024 * 1024;
const LOCKED_MESSAGE: Record<string, string> = {
  SUBMITTED: "Your application is with our verification team, so it cannot be changed now.",
  UNDER_REVIEW: "Your application is with our verification team, so it cannot be changed now.",
  APPROVED: "Your application is approved. Manage your details in Seller Hub settings.",
  REJECTED: "This application was declined. It can be reopened by BluBuy after 30 days.",
};

/** The applicant's side of seller onboarding (spec 9.2.1). */
@Injectable()
export class OnboardingService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(KYC_PROVIDER) private readonly kyc: KycProvider,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(ApplicationStore) private readonly store: ApplicationStore,
  ) {}

  async get(userId: string) {
    const app = await this.store.byUser(userId);
    if (!app) throw notFound("Application");
    return this.store.applicantView(app);
  }

  /** Starts an application, or returns the one already started. */
  async start(userId: string) {
    const existing = await this.store.byUser(userId);
    if (existing) return { created: false, view: await this.store.applicantView(existing) };
    const [member] = await this.db.select({ id: sellerMembers.sellerId }).from(sellerMembers).where(eq(sellerMembers.userId, userId)).limit(1);
    if (member) throw conflict("ALREADY_SELLER", "You already have a seller account. Open Seller Hub to manage it.");
    try {
      const app = await this.db.transaction(async (tx) => {
        const [{ n }] = (await tx.execute<{ n: number }>(sql`select nextval('seller_application_seq')::int as n`)).rows as [{ n: number }];
        const [row] = await tx.insert(sellerApplications).values({ id: `SA-${n}`, userId }).returning();
        await tx.insert(sellerApplicationEvents).values({ applicationId: row!.id, fromStatus: null, toStatus: "KYC_IN_PROGRESS", actor: "SELLER", actorUserId: userId, note: "Application started", at: this.clock.now() });
        return row!;
      });
      return { created: true, view: await this.store.applicantView(app) };
    } catch (e) {
      // a parallel request created it first
      const again = await this.store.byUser(userId);
      if (again) return { created: false, view: await this.store.applicantView(again) };
      throw e;
    }
  }

  private async editable(tx: Tx, userId: string) {
    const app = await this.store.lock(tx, { userId });
    if (!EDITABLE.includes(app.status)) throw conflict("APPLICATION_LOCKED", LOCKED_MESSAGE[app.status] ?? "This application cannot be changed now.");
    return app;
  }

  private async save(tx: Tx, app: Application, patch: Partial<Application>) {
    if (!Object.keys(patch).length) return app;
    const [next] = await tx
      .update(sellerApplications)
      .set({ ...patch, updatedAt: this.clock.now() })
      .where(eq(sellerApplications.id, app.id))
      .returning();
    return next!;
  }

  /** Paid checks (penny drops especially) are limited per application per day. */
  private async allowCheck(applicationId: string, kind: string, perDay: number) {
    const key = `kyc:${applicationId}:${kind}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, 24 * 3600);
    if (n > perDay) throw new ApiError(429, "CHECK_LIMIT", "You have used today's verification attempts. Try again tomorrow or contact Seller Support.");
  }

  async update(userId: string, body: z.infer<typeof updateApplicationBody>) {
    const app = await this.db.transaction(async (tx) => {
      const app = await this.editable(tx, userId);
      const patch: Partial<Application> = {};
      if (body.constitution !== undefined) patch.constitution = body.constitution;

      if (body.gstExempt !== undefined && body.gstExempt !== app.gstExempt) {
        // switching paths clears what came from the other one
        Object.assign(patch, { gstExempt: body.gstExempt, gstin: null, gstCheck: null, tradeName: null, gstState: null, legalName: null, registeredAddress: null, pan: null, panCheck: null, bankCheck: null });
      }
      const exempt = patch.gstExempt ?? app.gstExempt;
      if (body.legalName !== undefined || body.registeredAddress !== undefined) {
        if (!exempt) throw conflict("FROM_GSTIN", "Your legal name and address come from your GSTIN.");
        if (body.legalName !== undefined && body.legalName !== app.legalName) Object.assign(patch, { legalName: body.legalName, panCheck: null, bankCheck: null });
        if (body.registeredAddress !== undefined) patch.registeredAddress = body.registeredAddress;
      }

      if (body.storeName !== undefined && body.storeName !== app.storeName) {
        if (await this.store.storeNameTaken(body.storeName, app.id)) throw conflict("STORE_NAME_TAKEN", "That store name is taken. Try adding your city or speciality.");
        patch.storeName = body.storeName;
      }
      if (body.storeDescription !== undefined) patch.storeDescription = body.storeDescription || null;
      if (body.careNumber !== undefined) patch.careNumber = body.careNumber;
      if (body.grievanceContact !== undefined) patch.grievanceContact = body.grievanceContact;
      if (body.pickup) patch.pickup = { ...body.pickup, contactPhone: normalizePhone(body.pickup.contactPhone) ?? body.pickup.contactPhone };
      if (body.brand) patch.brand = body.brand.ownBrand ? body.brand : { ownBrand: false, reseller: body.brand.reseller };

      if (body.categories) {
        const wanted = [...new Set(body.categories)];
        const known = wanted.length ? await tx.select({ id: categories.id }).from(categories).where(and(inArray(categories.id, wanted), isNull(categories.parentId))) : [];
        if (known.length !== wanted.length) throw unprocessable("CATEGORY_UNKNOWN", "Choose categories from the list");
        patch.categories = wanted;
      }
      return this.save(tx, app, patch);
    });
    return this.store.applicantView(app);
  }

  private panCheck(pan: string, lookup: PanLookup, expectedName: string, checkedAt: string): PanCheck {
    const holderType = PAN_HOLDER_TYPES[pan[3]!] ?? "Other";
    if (lookup.status === "NOT_FOUND") return { result: "FAILED", pan, holderName: "", holderType, nameMatchScore: 0, aadhaarLinked: false, checkedAt };
    const score = nameMatchScore(lookup.holderName, expectedName);
    return { result: matchResult(score), pan, holderName: lookup.holderName, holderType, nameMatchScore: score, aadhaarLinked: lookup.aadhaarLinked, checkedAt };
  }

  private async current(userId: string) {
    const app = await this.store.byUser(userId);
    if (!app) throw notFound("Application");
    if (!EDITABLE.includes(app.status)) throw conflict("APPLICATION_LOCKED", LOCKED_MESSAGE[app.status] ?? "This application cannot be changed now.");
    return app;
  }

  /** Looks the GSTIN up on the GST portal and fills in the legal details and PAN from it. */
  async verifyGstin(userId: string, gstin: string) {
    const problem = gstinProblem(gstin);
    if (problem) throw new ApiError(422, "GSTIN_INVALID", problem, [{ path: "gstin", message: problem }]);
    const before = await this.current(userId);
    if (before.gstExempt) throw conflict("GST_EXEMPT", "Turn off the GST exempt option to add a GSTIN.");
    await this.allowCheck(before.id, "gst", 15);

    const gst = await this.kyc.lookupGstin(gstin, { constitution: before.constitution });
    if (gst.status === "NOT_FOUND") throw new ApiError(422, "GSTIN_NOT_FOUND", "The GST portal has no registration with this GSTIN", [{ path: "gstin", message: "No registration found" }]);
    const pan = gstin.slice(2, 12);
    const checkedAt = this.clock.now().toISOString();
    const gstCheck: GstCheck = {
      result: gst.status === "ACTIVE" ? "VERIFIED" : "FAILED",
      gstin,
      portalStatus: gst.status,
      legalName: gst.legalName,
      tradeName: gst.tradeName,
      constitution: gst.constitution,
      state: gst.state,
      principalAddress: gst.principalAddress,
      registeredOn: gst.registeredOn,
      filing: gst.filing,
      checkedAt,
    };
    const panCheck = this.panCheck(pan, await this.kyc.lookupPan(pan, gst.legalName), gst.legalName, checkedAt);

    const app = await this.db.transaction(async (tx) => {
      const app = await this.editable(tx, userId);
      return this.save(tx, app, {
        gstin,
        gstCheck,
        legalName: gst.legalName,
        tradeName: gst.tradeName,
        registeredAddress: gst.principalAddress,
        gstState: gst.state,
        constitution: app.constitution ?? gst.constitution,
        pan,
        panCheck,
        // the bank was matched against the old legal name
        bankCheck: app.legalName === gst.legalName ? app.bankCheck : null,
      });
    });
    return this.store.applicantView(app);
  }

  /** For GST exempt sellers, who give their PAN and legal name directly. */
  async verifyPan(userId: string, input: { pan: string; legalName: string }) {
    const before = await this.current(userId);
    if (!before.gstExempt) throw conflict("PAN_FROM_GSTIN", "Your PAN comes from your GSTIN.");
    await this.allowCheck(before.id, "pan", 15);
    const panCheck = this.panCheck(input.pan, await this.kyc.lookupPan(input.pan, input.legalName), input.legalName, this.clock.now().toISOString());
    const app = await this.db.transaction(async (tx) => {
      const app = await this.editable(tx, userId);
      return this.save(tx, app, { pan: input.pan, legalName: input.legalName, panCheck, bankCheck: app.legalName === input.legalName ? app.bankCheck : null });
    });
    return this.store.applicantView(app);
  }

  /** ₹1 penny drop: the bank returns the account holder's name, which must match the business. */
  async verifyBank(userId: string, input: { holder: string; account: string; ifsc: string }) {
    const before = await this.current(userId);
    if (!before.legalName) throw conflict("BUSINESS_FIRST", "Verify your business details before adding a bank account.");
    const branch = await this.kyc.lookupIfsc(input.ifsc);
    if (!branch) throw new ApiError(422, "IFSC_NOT_FOUND", "No bank branch has this IFSC", [{ path: "ifsc", message: "No bank branch has this IFSC" }]);
    await this.allowCheck(before.id, "bank", 5);

    const drop = await this.kyc.pennyDrop({ account: input.account, ifsc: input.ifsc, expectedName: before.legalName });
    const score = drop.beneficiaryName ? nameMatchScore(drop.beneficiaryName, before.legalName) : 0;
    const bankCheck: BankCheck = {
      result: drop.status === "FAILED" ? "FAILED" : matchResult(score),
      bankName: branch.bankName,
      branch: branch.branch,
      ifsc: input.ifsc,
      accountLast4: input.account.slice(-4),
      beneficiaryName: drop.beneficiaryName,
      nameMatchScore: score,
      reference: drop.reference,
      ...(drop.failureReason ? { failureReason: drop.failureReason } : {}),
      checkedAt: this.clock.now().toISOString(),
    };
    const app = await this.db.transaction(async (tx) => {
      const app = await this.editable(tx, userId);
      return this.save(tx, app, { bankHolder: input.holder, bankAccount: input.account, bankIfsc: input.ifsc, bankCheck });
    });
    return this.store.applicantView(app);
  }

  async storeName(userId: string, name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 3) return { available: false, reason: "Use at least 3 characters" };
    const app = await this.store.byUser(userId);
    return (await this.store.storeNameTaken(trimmed, app?.id)) ? { available: false, reason: "That name is taken. Try adding your city or speciality." } : { available: true };
  }

  /** Stores a document; a new upload of the same kind replaces the previous one. */
  async upload(userId: string, kind: KycDocumentKind, file: { originalname: string; buffer: Buffer; size: number } | undefined) {
    if (!file?.buffer?.length) throw unprocessable("FILE_REQUIRED", "Choose a file to upload");
    const limit = kind === "SIGNATURE" ? 1 * MB : 4 * MB;
    if (file.size > limit) throw new ApiError(413, "FILE_TOO_LARGE", `Files can be up to ${limit / MB} MB`);
    const mime = sniffMime(file.buffer);
    const allowed = kind === "SIGNATURE" ? ["image/png", "image/jpeg"] : ["application/pdf", "image/png", "image/jpeg"];
    if (!mime || !allowed.includes(mime)) throw unprocessable("FILE_TYPE", kind === "SIGNATURE" ? "Upload a PNG or JPG image" : "Upload a PDF, PNG or JPG file");

    await this.current(userId);
    const fileName = basename(file.originalname || "document").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
    const fileId = await this.files.put(file.buffer, mime);
    let replaced: string | null = null;
    try {
      const doc = await this.db.transaction(async (tx) => {
        const app = await this.editable(tx, userId);
        const values = { fileId, fileName, mimeType: mime, sizeBytes: file.size, status: "PENDING" as const, note: null, uploadedAt: this.clock.now(), reviewedAt: null };
        const [existing] = await tx.select({ id: kycDocuments.id, fileId: kycDocuments.fileId }).from(kycDocuments).where(and(eq(kycDocuments.applicationId, app.id), eq(kycDocuments.kind, kind)));
        if (existing) {
          replaced = existing.fileId;
          const [row] = await tx.update(kycDocuments).set(values).where(eq(kycDocuments.id, existing.id)).returning();
          return row!;
        }
        const [row] = await tx.insert(kycDocuments).values({ applicationId: app.id, kind, ...values }).returning();
        return row!;
      });
      if (replaced) await this.files.remove(replaced);
      return this.store.applicantView(await this.store.byId(doc.applicationId));
    } catch (e) {
      await this.files.remove(fileId);
      throw e;
    }
  }

  async removeDocument(userId: string, documentId: string) {
    const fileId = await this.db.transaction(async (tx) => {
      const app = await this.editable(tx, userId);
      const [row] = await tx
        .delete(kycDocuments)
        .where(and(eq(kycDocuments.id, documentId), eq(kycDocuments.applicationId, app.id)))
        .returning({ fileId: kycDocuments.fileId });
      if (!row) throw notFound("Document");
      return row.fileId;
    });
    await this.files.remove(fileId);
  }

  async documentFile(userId: string, documentId: string) {
    const app = await this.store.byUser(userId);
    if (!app) throw notFound("Document");
    return this.fileOf(app.id, documentId);
  }

  async fileOf(applicationId: string, documentId: string) {
    const [doc] = await this.db
      .select({ fileId: kycDocuments.fileId, fileName: kycDocuments.fileName, mimeType: kycDocuments.mimeType })
      .from(kycDocuments)
      .where(and(eq(kycDocuments.id, documentId), eq(kycDocuments.applicationId, applicationId)));
    const file = doc ? await this.files.get(doc.fileId) : null;
    if (!doc || !file) throw notFound("Document");
    return { content: file.content, mimeType: doc.mimeType, fileName: doc.fileName };
  }

  /**
   * Submit (or resubmit after corrections). Automatic checks and risk
   * screening run straight away, so the application lands in the review
   * queue as UNDER_REVIEW (spec 11.8).
   */
  async submit(userId: string) {
    const app = await this.db.transaction(async (tx) => {
      let app = await this.editable(tx, userId);
      const docs = await this.store.documents(app.id, tx);
      const missing = missingItems(app, docs, await this.store.owner(userId, tx));
      if (missing.length)
        throw new ApiError(
          422,
          "APPLICATION_INCOMPLETE",
          "Some steps still need your attention",
          missing.map((m) => ({ path: m.key, message: m.message })),
        );
      const now = this.clock.now();
      const resubmission = app.status === "ACTION_REQUIRED";
      app = await this.store.move(tx, app, "SUBMITTED", "SELLER", userId, resubmission ? "Resubmitted with corrections" : "Submitted for verification, seller agreement accepted", {
        submittedAt: now,
        agreementVersion: AGREEMENT_VERSION,
        agreementAcceptedAt: now,
        flaggedItems: [],
      });
      const riskFlags = await this.store.screen(tx, app);
      const checks = [
        app.gstExempt ? "GST exempt" : "GSTIN active",
        `PAN name match ${app.panCheck?.nameMatchScore ?? 0}%`,
        `bank name match ${app.bankCheck?.nameMatchScore ?? 0}%`,
      ];
      return this.store.move(tx, app, "UNDER_REVIEW", "SYSTEM", null, `Automatic checks done: ${checks.join(", ")}`, {
        riskFlags,
        slaDueAt: new Date(now.getTime() + REVIEW_SLA_HOURS * 3600_000),
      });
    });
    await this.store.notify(app, "We received your BluBuy seller application", `Application ${app.id} is with our verification team. Most applications are decided within ${REVIEW_SLA_HOURS} hours.`);
    return this.store.applicantView(app);
  }
}
