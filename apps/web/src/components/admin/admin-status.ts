/**
 * Status maps for AltasGoods Control entities that are not in lib/status.ts
 * (claims, KYC, moderation, rules, reconciliation and so on). Every status is
 * rendered as words plus tone through <StatusBadge meta={...} />.
 */
import type { StatusMeta, Tone } from "@/lib/status";

type M<K extends string> = Record<K, StatusMeta>;

export const KYC_STATUS: M<"kyc_in_progress" | "submitted" | "under_review" | "action_required" | "approved" | "rejected"> = {
  kyc_in_progress: { label: "In progress", tone: "neutral", description: "Seller is still filling the onboarding wizard" },
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  action_required: { label: "Action required", tone: "warning", description: "Waiting for the seller to fix flagged items" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const KYC_DOC_STATUS: M<"auto_verified" | "verified" | "pending" | "rejected" | "missing" | "expired"> = {
  auto_verified: { label: "Auto verified", tone: "success" },
  verified: { label: "Verified", tone: "success" },
  pending: { label: "To review", tone: "info" },
  rejected: { label: "Rejected", tone: "danger" },
  missing: { label: "Missing", tone: "neutral" },
  expired: { label: "Expired", tone: "warning" },
};

export const VERIFY_RESULT: M<"verified" | "partial" | "failed" | "pending"> = {
  verified: { label: "Verified", tone: "success" },
  partial: { label: "Partial match", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  pending: { label: "Not run", tone: "neutral" },
};

export const CHECK_RESULT: M<"pass" | "warn" | "fail"> = {
  pass: { label: "Passed", tone: "success" },
  warn: { label: "Review", tone: "warning" },
  fail: { label: "Failed", tone: "danger" },
};

export const RISK_LEVEL: M<"low" | "medium" | "high"> = {
  low: { label: "Low risk", tone: "neutral" },
  medium: { label: "Medium risk", tone: "warning" },
  high: { label: "High risk", tone: "danger" },
};

export const MODERATION_TYPE: Record<"new_listing" | "edit" | "gated_brand" | "appeal", string> = {
  new_listing: "New listing",
  edit: "Edit to live listing",
  gated_brand: "Gated brand",
  appeal: "Block appeal",
};

export const GUARANTEE_STATUS: M<"submitted" | "awaiting_seller" | "under_review" | "granted" | "denied" | "appealed" | "withdrawn"> = {
  submitted: { label: "Submitted", tone: "info" },
  awaiting_seller: { label: "Awaiting seller", tone: "warning" },
  under_review: { label: "Under review", tone: "info" },
  granted: { label: "Granted", tone: "success" },
  denied: { label: "Denied", tone: "neutral" },
  appealed: { label: "Appealed", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const SAFECLAIM_STATUS: M<"submitted" | "under_review" | "info_requested" | "approved" | "partially_approved" | "rejected" | "appealed" | "reimbursed"> = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  info_requested: { label: "Info requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  partially_approved: { label: "Part approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  appealed: { label: "Appealed", tone: "warning" },
  reimbursed: { label: "Reimbursed", tone: "success" },
};

export const CHARGEBACK_STATUS: M<"open" | "evidence_submitted" | "won" | "lost" | "accepted"> = {
  open: { label: "Open", tone: "warning" },
  evidence_submitted: { label: "Evidence sent", tone: "info" },
  won: { label: "Won", tone: "success" },
  lost: { label: "Lost", tone: "danger" },
  accepted: { label: "Accepted", tone: "neutral" },
};

export const BRAND_REQUEST_STATUS: M<"pending" | "info_requested" | "approved" | "rejected"> = {
  pending: { label: "In review", tone: "info" },
  info_requested: { label: "Info requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const RULE_STATUS: M<"enabled" | "simulating" | "disabled"> = {
  enabled: { label: "Enabled", tone: "success" },
  simulating: { label: "Simulating", tone: "info", description: "Logs hits without acting" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export const GATEWAY_STATUS: M<"operational" | "degraded" | "down"> = {
  operational: { label: "Operational", tone: "success" },
  degraded: { label: "Degraded", tone: "warning" },
  down: { label: "Down", tone: "danger" },
};

export const RECON_STATUS: M<"matched" | "mismatch" | "pending" | "resolved"> = {
  matched: { label: "Matched", tone: "success" },
  mismatch: { label: "Mismatch", tone: "danger" },
  pending: { label: "Awaiting file", tone: "neutral" },
  resolved: { label: "Resolved", tone: "info" },
};

export const COD_REMIT_STATUS: M<"reconciled" | "banked" | "deposited" | "short"> = {
  reconciled: { label: "Reconciled", tone: "success" },
  banked: { label: "Banked", tone: "info" },
  deposited: { label: "Deposited", tone: "info" },
  short: { label: "Short", tone: "danger" },
};

export const ORPHAN_STATUS: M<"auto_refund_initiated" | "refunded" | "order_revived"> = {
  auto_refund_initiated: { label: "Auto refund started", tone: "info" },
  refunded: { label: "Refunded", tone: "success" },
  order_revived: { label: "Order revived", tone: "success" },
};

export const CMS_STATUS: M<"live" | "scheduled" | "draft" | "ended"> = {
  live: { label: "Live", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
};

export const REPORT_RUN_STATUS: M<"ready" | "running" | "failed"> = {
  ready: { label: "Ready", tone: "success" },
  running: { label: "Running", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
};

export const STAFF_STATUS: M<"active" | "invited" | "disabled"> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invite sent", tone: "info" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export const EVENT_STATUS: M<"ended" | "live" | "submissions_open" | "planning"> = {
  ended: { label: "Ended", tone: "neutral" },
  live: { label: "Live now", tone: "accent" },
  submissions_open: { label: "Deal submissions open", tone: "info" },
  planning: { label: "Planning", tone: "neutral" },
};

export const AD_STATUS: M<"active" | "low_balance" | "paused"> = {
  active: { label: "Active", tone: "success" },
  low_balance: { label: "Low wallet", tone: "warning" },
  paused: { label: "Paused", tone: "neutral" },
};

export const REVIEW_MOD_STATUS: M<"published" | "pending" | "flagged" | "removed"> = {
  published: { label: "Published", tone: "success" },
  pending: { label: "Pending", tone: "info" },
  flagged: { label: "Flagged", tone: "warning" },
  removed: { label: "Removed", tone: "neutral" },
};

export const PAYOUT_RUN_STATUS: M<"draft" | "pending_approval" | "approved" | "processing" | "paid" | "failed" | "cancelled"> = {
  draft: { label: "Draft", tone: "neutral" },
  pending_approval: { label: "Awaiting approval", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  processing: { label: "Processing", tone: "brand" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const CUSTOMER_STATUS: M<"active" | "flagged" | "blocked"> = {
  active: { label: "Active", tone: "success" },
  flagged: { label: "Flagged", tone: "warning" },
  blocked: { label: "Blocked", tone: "danger" },
};

export const VIOLATION_STATUS: M<"open" | "appealed" | "resolved"> = {
  open: { label: "Open", tone: "warning" },
  appealed: { label: "Appealed", tone: "info" },
  resolved: { label: "Resolved", tone: "neutral" },
};

export const HOLD_STATUS: StatusMeta = { label: "On hold", tone: "warning" };

/* ------------------------------- Seller Health ------------------------------ */

export type HealthBand = "excellent" | "good" | "fair" | "poor" | "critical";

export const HEALTH_BAND: M<HealthBand> = {
  excellent: { label: "Excellent", tone: "success" },
  good: { label: "Good", tone: "info" },
  fair: { label: "Fair, at risk", tone: "warning" },
  poor: { label: "Poor", tone: "danger" },
  critical: { label: "Critical", tone: "danger" },
};

/** Seller Health bands from spec 10.6 (0 to 1000). */
export function healthBand(score: number): HealthBand {
  if (score >= 800) return "excellent";
  if (score >= 600) return "good";
  if (score >= 400) return "fair";
  if (score >= 200) return "poor";
  return "critical";
}

export const TIER_TONE: Record<"Bronze" | "Silver" | "Gold" | "Platinum", Tone> = {
  Platinum: "brand",
  Gold: "accent",
  Silver: "neutral",
  Bronze: "neutral",
};

export function riskTone(score: number): Tone {
  return score >= 70 ? "danger" : score >= 40 ? "warning" : "success";
}
