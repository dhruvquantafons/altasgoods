import { KYC_DOCUMENT_KINDS, type ApplicationStatus, type Constitution, type KycDocumentKind, type sellerApplications } from "../../db/schema.js";

type Application = typeof sellerApplications.$inferSelect;

/** Spec section 11.8 transitions (REGISTERED is the user account itself). */
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  KYC_IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ACTION_REQUIRED", "APPROVED", "REJECTED"],
  ACTION_REQUIRED: ["SUBMITTED", "REJECTED"],
  APPROVED: [],
  REJECTED: ["KYC_IN_PROGRESS"],
};

export const canMove = (from: ApplicationStatus, to: ApplicationStatus) => TRANSITIONS[from].includes(to);

/** The applicant can change the application only while filling it in or fixing flagged items. */
export const EDITABLE: ApplicationStatus[] = ["KYC_IN_PROGRESS", "ACTION_REQUIRED"];

export const REVIEW_SLA_HOURS = 72;
export const REOPEN_COOL_OFF_DAYS = 30;
export const AGREEMENT_VERSION = "BSA-2026-04";

export const CONSTITUTION_LABEL: Record<Constitution, string> = {
  PROPRIETORSHIP: "Proprietorship",
  PARTNERSHIP: "Partnership firm",
  LLP: "Limited liability partnership (LLP)",
  PRIVATE_LIMITED: "Private limited company",
  PUBLIC_LIMITED: "Public limited company",
};

export const isDocumentKind = (key: string): key is KycDocumentKind => (KYC_DOCUMENT_KINDS as readonly string[]).includes(key);

export const DOCUMENT_LABEL: Record<KycDocumentKind, string> = {
  SIGNATURE: "Authorised signatory specimen",
  ID_PROOF: "Identity proof of the proprietor",
  ADDRESS_PROOF: "Proof of the principal place of business",
  PARTNERSHIP_DEED: "Partnership deed",
  LLP_CERTIFICATE: "LLP certificate of incorporation",
  INCORPORATION_CERTIFICATE: "Certificate of incorporation and MOA",
  BANK_PROOF: "Cancelled cheque or bank statement",
  TRADEMARK: "Trademark certificate or application receipt",
};

const DOCUMENT_HINT: Record<KycDocumentKind, string> = {
  SIGNATURE: "Printed on the tax invoices BluBuy generates for you",
  ID_PROOF: "Aadhaar, passport, voter ID or driving licence",
  ADDRESS_PROOF: "Electricity bill, rent agreement or property tax receipt, under 3 months old",
  PARTNERSHIP_DEED: "Signed deed listing every partner",
  LLP_CERTIFICATE: "Form 16 certificate and the LLP agreement",
  INCORPORATION_CERTIFICATE: "Certificate of incorporation with the memorandum of association",
  BANK_PROOF: "Shows the account holder name, needed because the bank returned a different name",
  TRADEMARK: "From IP India, for Brand Registry",
};

const CONSTITUTION_DOC: Record<Constitution, KycDocumentKind> = {
  PROPRIETORSHIP: "ID_PROOF",
  PARTNERSHIP: "PARTNERSHIP_DEED",
  LLP: "LLP_CERTIFICATE",
  PRIVATE_LIMITED: "INCORPORATION_CERTIFICATE",
  PUBLIC_LIMITED: "INCORPORATION_CERTIFICATE",
};

/** Documents for this application: required ones by constitution and checks, plus optional ones. */
export function documentRequirements(app: Application) {
  const kinds: { kind: KycDocumentKind; required: boolean }[] = [{ kind: "SIGNATURE", required: true }];
  if (app.constitution) kinds.push({ kind: CONSTITUTION_DOC[app.constitution], required: true });
  kinds.push({ kind: "ADDRESS_PROOF", required: true });
  if (app.bankCheck && app.bankCheck.result !== "VERIFIED") kinds.push({ kind: "BANK_PROOF", required: true });
  if (app.brand?.ownBrand) kinds.push({ kind: "TRADEMARK", required: false });
  return kinds.map((k) => ({ ...k, label: DOCUMENT_LABEL[k.kind], hint: DOCUMENT_HINT[k.kind] }));
}

/** Wizard sections, in order; keys are what reviewers flag and what the web wizard shows. */
export const SECTIONS = {
  account: "Account",
  business: "Business details",
  pan: "PAN",
  store: "Store",
  pickup: "Pickup address",
  bank: "Bank account",
  documents: "Documents",
  categories: "Categories",
  brand: "Brand registry",
} as const;
export type SectionKey = keyof typeof SECTIONS;

/** What still blocks submission, as { key, message } with key a section. */
export function missingItems(app: Application, docs: { kind: KycDocumentKind; status: string }[], user: { name: string | null; emailVerified: boolean }) {
  const out: { key: SectionKey; message: string }[] = [];
  if (!user.name || user.name.trim().length < 2) out.push({ key: "account", message: "Add the owner's full name" });
  if (!user.emailVerified) out.push({ key: "account", message: "Verify your business email" });

  if (!app.constitution) out.push({ key: "business", message: "Choose your business type" });
  if (app.gstExempt) {
    if (!app.legalName) out.push({ key: "business", message: "Enter your legal business name" });
  } else if (!app.gstCheck) out.push({ key: "business", message: "Verify your GSTIN" });
  else if (app.gstCheck.portalStatus !== "ACTIVE") out.push({ key: "business", message: `Your GSTIN is ${app.gstCheck.portalStatus.toLowerCase()} on the GST portal. Use an active GSTIN.` });

  if (!app.pan || !app.panCheck) out.push({ key: "pan", message: "Verify your PAN" });
  else if (!app.panCheck.holderName) out.push({ key: "pan", message: "This PAN was not found in the Income Tax database" });
  else if (app.panCheck.result === "FAILED") out.push({ key: "pan", message: `The PAN belongs to ${app.panCheck.holderName}, which does not match your business name` });

  if (!app.storeName) out.push({ key: "store", message: "Choose a store name" });
  if (!app.careNumber) out.push({ key: "store", message: "Add a customer care number" });
  if (!app.grievanceContact) out.push({ key: "store", message: "Name a grievance officer" });

  if (!app.pickup) out.push({ key: "pickup", message: "Add a pickup address" });

  if (!app.bankCheck) out.push({ key: "bank", message: "Verify your bank account" });
  else if (app.bankCheck.result === "FAILED")
    out.push({ key: "bank", message: app.bankCheck.beneficiaryName ? "The bank holds this account in another name. Use an account in your business name." : "The ₹1 check failed. Add a different account." });

  for (const r of documentRequirements(app).filter((d) => d.required)) {
    const doc = docs.find((d) => d.kind === r.kind);
    if (!doc) out.push({ key: "documents", message: `Upload the ${r.label.toLowerCase()}` });
    else if (doc.status === "REJECTED") out.push({ key: "documents", message: `Upload a new ${r.label.toLowerCase()}` });
  }

  if (!app.categories.length) out.push({ key: "categories", message: "Choose at least one category" });
  if (app.brand?.ownBrand && (!app.brand.brandName || !app.brand.trademark)) out.push({ key: "brand", message: "Add the brand name and trademark number, or turn off Brand Registry" });
  return out;
}

/** Reasons a verifier cannot approve yet. */
export function approvalBlockers(app: Application, docs: { kind: KycDocumentKind; status: string }[]) {
  const out: string[] = [];
  if (!app.gstExempt && app.gstCheck?.result === "FAILED") out.push("GSTIN is not active on the GST portal");
  if (app.panCheck?.result === "FAILED") out.push("PAN holder name does not match the business");
  if (app.bankCheck?.result === "FAILED") out.push("Bank account name does not match the business");
  for (const r of documentRequirements(app).filter((d) => d.required)) {
    const doc = docs.find((d) => d.kind === r.kind);
    if (!doc) out.push(`${r.label} is missing`);
    else if (doc.status === "REJECTED") out.push(`${r.label} was rejected`);
  }
  if (app.riskFlags.some((f) => f.severity === "HIGH")) out.push("A high severity risk flag is open");
  return out;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "store"
  );
}
