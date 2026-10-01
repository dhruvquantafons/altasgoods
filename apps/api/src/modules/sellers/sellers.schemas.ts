import { z } from "zod";
import { APPLICATION_STATUSES, CONSTITUTIONS, KYC_DOCUMENT_KINDS } from "../../db/schema.js";
import { GSTIN_RE, IFSC_RE, PAN_RE } from "./kyc/india.js";

const checkResult = z.enum(["VERIFIED", "PARTIAL", "FAILED"]);
const statusEnum = z.enum(APPLICATION_STATUSES);
const constitution = z.enum(CONSTITUTIONS);
const docKind = z.enum(KYC_DOCUMENT_KINDS);

const pickupSchema = z.object({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().regex(/^[1-8]\d{5}$/, "Enter a valid 6 digit pincode"),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10 digit mobile number"),
  slot: z.string().trim().min(3).max(40),
});

const brandSchema = z.object({
  ownBrand: z.boolean(),
  brandName: z.string().trim().min(2).max(60).optional(),
  trademark: z
    .string()
    .regex(/^\d{6,8}$/, "Trademark or application numbers are 6 to 8 digits")
    .optional(),
  trademarkClass: z.string().max(4).optional(),
  reseller: z.boolean(),
});

/* -------------------------------- Requests -------------------------------- */

export const updateApplicationBody = z.object({
  constitution: constitution.optional(),
  gstExempt: z.boolean().optional(),
  legalName: z.string().trim().min(3).max(120).optional().describe("Only for GST exempt sellers; otherwise it comes from the GSTIN"),
  registeredAddress: z.string().trim().min(5).max(200).optional().describe("Only for GST exempt sellers"),
  storeName: z.string().trim().min(3).max(40).optional(),
  storeDescription: z.string().trim().max(300).optional(),
  careNumber: z.string().trim().min(8).max(20).optional(),
  grievanceContact: z.string().trim().min(4).max(120).optional(),
  pickup: pickupSchema.optional(),
  categories: z.array(z.string()).max(20).optional(),
  brand: brandSchema.optional(),
});

export const verifyGstinBody = z.object({ gstin: z.string().trim().toUpperCase().pipe(z.string().regex(GSTIN_RE, "Enter the 15 character GSTIN")) });
export const verifyPanBody = z.object({
  pan: z.string().trim().toUpperCase().pipe(z.string().regex(PAN_RE, "PAN is 5 letters, 4 digits and a letter")),
  legalName: z.string().trim().min(3).max(120),
});
export const verifyBankBody = z.object({
  holder: z.string().trim().min(3).max(120),
  account: z.string().regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits"),
  ifsc: z.string().trim().toUpperCase().pipe(z.string().regex(IFSC_RE, "IFSC is 11 characters and the fifth is 0")),
});
export const submitBody = z.object({ acceptAgreement: z.literal(true, "Accept the seller agreement to submit") });
export const storeNameQuery = { name: z.string().trim().min(1).max(40) };
export const uploadKind = z.object({ kind: docKind });

export const listQuery = z.object({
  tab: z.enum(["open", "in_progress", "decided"]).default("open"),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(30),
});

export const requestChangesBody = z.object({
  items: z.array(z.string().min(2).max(40)).min(1).max(12).describe("Section keys (business, bank, ...) or document kinds (ADDRESS_PROOF, ...)"),
  message: z.string().trim().min(5).max(1000),
});
export const rejectBody = z.object({ reason: z.string().trim().min(5).max(200), note: z.string().trim().max(1000).optional() });
export const approveBody = z.object({ note: z.string().trim().max(1000).optional() });

/* -------------------------------- Responses ------------------------------- */

const gstCheck = z.object({
  result: checkResult,
  gstin: z.string(),
  portalStatus: z.enum(["ACTIVE", "CANCELLED", "SUSPENDED"]),
  legalName: z.string(),
  tradeName: z.string(),
  constitution,
  state: z.string(),
  principalAddress: z.string(),
  registeredOn: z.string(),
  filing: z.string(),
  checkedAt: z.string(),
});
const panCheck = z.object({
  result: checkResult,
  pan: z.string(),
  holderName: z.string(),
  holderType: z.string(),
  nameMatchScore: z.number().int(),
  aadhaarLinked: z.boolean(),
  checkedAt: z.string(),
});
const bankCheck = z.object({
  result: checkResult,
  bankName: z.string(),
  branch: z.string(),
  ifsc: z.string(),
  accountLast4: z.string(),
  beneficiaryName: z.string().nullable(),
  nameMatchScore: z.number().int(),
  reference: z.string(),
  failureReason: z.string().optional(),
  checkedAt: z.string(),
});

export const documentSchema = z.object({
  id: z.uuid(),
  kind: docKind,
  label: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  note: z.string().nullable(),
  uploadedAt: z.iso.datetime(),
});

const eventSchema = z.object({
  fromStatus: statusEnum.nullable(),
  toStatus: statusEnum,
  actor: z.enum(["SELLER", "SYSTEM", "STAFF"]),
  note: z.string().nullable(),
  at: z.iso.datetime(),
});

const flagged = z.object({ key: z.string(), label: z.string() });

export const applicationSchema = z.object({
  id: z.string(),
  status: statusEnum,
  account: z.object({ phone: z.string(), name: z.string().nullable(), email: z.string().nullable(), emailVerified: z.boolean() }),
  business: z.object({
    constitution: constitution.nullable(),
    gstExempt: z.boolean(),
    gstin: z.string().nullable(),
    legalName: z.string().nullable(),
    tradeName: z.string().nullable(),
    registeredAddress: z.string().nullable(),
    gstState: z.string().nullable(),
    pan: z.string().nullable(),
  }),
  store: z.object({ name: z.string().nullable(), description: z.string().nullable(), careNumber: z.string().nullable(), grievanceContact: z.string().nullable() }),
  pickup: pickupSchema.nullable(),
  bank: z.object({ holder: z.string(), accountLast4: z.string(), ifsc: z.string() }).nullable(),
  categories: z.array(z.string()),
  brand: brandSchema.nullable(),
  checks: z.object({ gst: gstCheck.nullable(), pan: panCheck.nullable(), bank: bankCheck.nullable() }),
  documents: z.array(documentSchema),
  requiredDocuments: z.array(z.object({ kind: docKind, label: z.string(), hint: z.string(), required: z.boolean() })),
  missing: z.array(z.object({ key: z.string(), message: z.string() })).describe("What still blocks submission"),
  flaggedItems: z.array(flagged),
  reviewerMessage: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  agreementVersion: z.string(),
  submittedAt: z.iso.datetime().nullable(),
  slaDueAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  sellerId: z.string().nullable(),
  events: z.array(eventSchema),
  updatedAt: z.iso.datetime(),
});

const riskFlag = z.object({ code: z.string(), severity: z.enum(["LOW", "MEDIUM", "HIGH"]), message: z.string() });

export const reviewSchema = applicationSchema.extend({
  owner: z.object({ name: z.string().nullable(), phone: z.string(), email: z.string().nullable() }),
  bank: z.object({ holder: z.string(), accountMasked: z.string(), accountLast4: z.string(), ifsc: z.string() }).nullable(),
  riskFlags: z.array(riskFlag),
  blockers: z.array(z.string()),
  agreementAcceptedAt: z.iso.datetime().nullable(),
  notes: z.array(z.object({ byName: z.string().nullable(), at: z.string(), body: z.string() })).describe("Internal reviewer notes"),
  events: z.array(eventSchema.extend({ actorName: z.string().nullable() })),
});

export const reviewListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: statusEnum,
      storeName: z.string().nullable(),
      legalName: z.string().nullable(),
      ownerName: z.string().nullable(),
      constitution: constitution.nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      checks: z.object({ gst: checkResult.nullable(), pan: checkResult.nullable(), bank: checkResult.nullable() }),
      riskFlags: z.array(riskFlag),
      submittedAt: z.iso.datetime().nullable(),
      slaDueAt: z.iso.datetime().nullable(),
      decidedAt: z.iso.datetime().nullable(),
      updatedAt: z.iso.datetime(),
    }),
  ),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  counts: z.object({ open: z.number().int(), inProgress: z.number().int(), decided: z.number().int(), awaitingReview: z.number().int(), waitingOnSeller: z.number().int() }),
  oldestOpenSubmittedAt: z.iso.datetime().nullable(),
  approvalRate30d: z.number().nullable().describe("Share of applications decided in the last 30 days that were approved, 0 to 1"),
});

export const storeNameSchema = z.object({ available: z.boolean(), reason: z.string().optional() });
