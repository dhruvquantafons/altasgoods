import type { TicketStatus as UiStatus } from "@/lib/status";

/** API ticket statuses (spec 11.11) to the badge keys in lib/status.ts. Safe for client components. */
export const UI_TICKET_STATUS: Record<"NEW" | "OPEN" | "PENDING_CUSTOMER" | "PENDING_INTERNAL" | "ESCALATED" | "RESOLVED" | "REOPENED" | "CLOSED", UiStatus> = {
  NEW: "open",
  OPEN: "in_progress",
  PENDING_CUSTOMER: "awaiting_customer",
  PENDING_INTERNAL: "pending_internal",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
  REOPENED: "reopened",
  CLOSED: "closed",
};
