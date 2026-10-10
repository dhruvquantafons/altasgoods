import type { StaffRole, TicketPriority, TicketStatus } from "../../db/schema.js";

/** Spec 11.11 transitions an agent can make by hand. Customers reopen and assignment opens. */
export const AGENT_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "RESOLVED", "CLOSED"],
  OPEN: ["PENDING_CUSTOMER", "PENDING_INTERNAL", "ESCALATED", "RESOLVED"],
  PENDING_CUSTOMER: ["OPEN", "RESOLVED"],
  PENDING_INTERNAL: ["OPEN"],
  ESCALATED: ["OPEN"],
  RESOLVED: ["CLOSED"],
  REOPENED: ["OPEN"],
  CLOSED: [],
};

export const ACTIVE_STATUSES: TicketStatus[] = ["NEW", "OPEN", "PENDING_CUSTOMER", "PENDING_INTERNAL", "ESCALATED", "REOPENED"];

export const SUPPORT_ROLES: StaffRole[] = ["SUPPORT_AGENT", "SUPPORT_SPECIALIST", "SUPPORT_SUPERVISOR"];
export const APPROVER_ROLES: StaffRole[] = ["SUPPORT_SUPERVISOR", "SUPER_ADMIN"];

/** Refund an agent can issue without approval, spec 8.1 (SP1 Rs 2,000, SP2 Rs 10,000). */
const LIMITS: [StaffRole, number, string][] = [
  ["SUPER_ADMIN", 5_000_000, "Admin"],
  ["SUPPORT_SUPERVISOR", 5_000_000, "Supervisor"],
  ["SUPPORT_SPECIALIST", 1_000_000, "L2"],
  ["SUPPORT_AGENT", 200_000, "L1"],
];

export function agentLevel(roles: string[]) {
  const hit = LIMITS.find(([role]) => roles.includes(role));
  return { limitPaise: hit?.[1] ?? 0, level: hit?.[2] ?? "Staff" };
}

/** Priority a customer's new ticket starts with, by category (spec 11.11 P2 for delivery and payment problems). */
export const PRIORITY_FOR: Record<string, TicketPriority> = {
  Delivery: "HIGH",
  Payment: "HIGH",
  "Product quality": "HIGH",
  "Return and refund": "NORMAL",
  Account: "NORMAL",
  Other: "LOW",
};

export const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
