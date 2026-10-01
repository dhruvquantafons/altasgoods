import type { ApplicationStatus, Constitution, SellerApplication } from "@/lib/api/types";
import type { Tone } from "@/lib/status";

/** Seller registration wizard steps; `key` matches the API's section keys reviewers flag. */
export const STEPS = [
  { key: "account", title: "Account", hint: "Mobile, name and email" },
  { key: "business", title: "Business details", hint: "GSTIN and legal name" },
  { key: "pan", title: "PAN", hint: "For TDS and KYC" },
  { key: "store", title: "Store", hint: "Name customers see" },
  { key: "pickup", title: "Pickup address", hint: "Where we collect orders" },
  { key: "bank", title: "Bank account", hint: "Verified with ₹1" },
  { key: "documents", title: "Documents", hint: "By business type" },
  { key: "signature", title: "Signature", hint: "For tax invoices" },
  { key: "categories", title: "Categories", hint: "What you will sell" },
  { key: "brand", title: "Brand registry", hint: "Optional" },
  { key: "review", title: "Review and submit", hint: "Check and agree" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export const CONSTITUTION_LABEL: Record<Constitution, string> = {
  PROPRIETORSHIP: "Proprietorship",
  PARTNERSHIP: "Partnership firm",
  LLP: "Limited liability partnership (LLP)",
  PRIVATE_LIMITED: "Private limited company",
  PUBLIC_LIMITED: "Public limited company",
};

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  KYC_IN_PROGRESS: { label: "In progress", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  ACTION_REQUIRED: { label: "Action required", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** For use mid-sentence: "a limited liability partnership (LLP)". */
export const constitutionNoun = (c: Constitution) => CONSTITUTION_LABEL[c].charAt(0).toLowerCase() + CONSTITUTION_LABEL[c].slice(1);

/** The wizard step a flagged item (section key or document kind) is fixed in. */
export function stepForFlag(key: string): number {
  if (key === "SIGNATURE") return STEPS.findIndex((s) => s.key === "signature");
  if (key === "TRADEMARK") return STEPS.findIndex((s) => s.key === "brand");
  if (/^[A-Z_]+$/.test(key)) return STEPS.findIndex((s) => s.key === "documents");
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

const usable = (d: { status: string } | undefined) => !!d && d.status !== "REJECTED";

/** Whether a step is complete, judged from the saved application. */
export function stepDone(key: StepKey, app: SellerApplication | null, me: { name: string | null; emailVerified: boolean } | null): boolean {
  if (key === "account") return !!me && (me.name?.trim().length ?? 0) >= 2 && me.emailVerified && !!app;
  if (!app) return false;
  const doc = (kind: string) => app.documents.find((d) => d.kind === kind);
  switch (key) {
    case "business":
      return !!app.business.constitution && (app.business.gstExempt ? !!app.business.legalName && !!app.business.registeredAddress : app.checks.gst?.portalStatus === "ACTIVE");
    case "pan":
      return !!app.checks.pan?.holderName && app.checks.pan.result !== "FAILED";
    case "store":
      return !!app.store.name && !!app.store.careNumber && !!app.store.grievanceContact;
    case "pickup":
      return !!app.pickup;
    case "bank":
      return !!app.checks.bank && app.checks.bank.result !== "FAILED";
    case "documents":
      return app.requiredDocuments.filter((r) => r.required && r.kind !== "SIGNATURE").every((r) => usable(doc(r.kind)));
    case "signature":
      return usable(doc("SIGNATURE"));
    case "categories":
      return app.categories.length > 0;
    case "brand":
      return !!app.brand && (!app.brand.ownBrand || (!!app.brand.brandName && !!app.brand.trademark));
    default:
      return false;
  }
}

export const formatPhone = (p: string) => p.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");
export const fileSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
