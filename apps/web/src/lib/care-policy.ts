import type { TicketPriority } from "@/lib/status";

/**
 * Care Desk settings: reply and resolution targets by priority, and the saved
 * replies agents insert into a conversation. Edit these to match the store's
 * policies; they are not customer data.
 */

export interface PriorityPolicy {
  code: "P1" | "P2" | "P3" | "P4";
  firstResponseMins: number;
  resolutionHours: number;
}

/** Ticket targets by priority (P1 to P4). */
export const PRIORITY_POLICY: Record<TicketPriority, PriorityPolicy> = {
  urgent: { code: "P1", firstResponseMins: 15, resolutionHours: 24 },
  high: { code: "P2", firstResponseMins: 60, resolutionHours: 48 },
  normal: { code: "P3", firstResponseMins: 240, resolutionHours: 72 },
  low: { code: "P4", firstResponseMins: 1440, resolutionHours: 168 },
};

export interface TicketSla {
  code: PriorityPolicy["code"];
  /** next reply due (first response or reply to the latest customer message) */
  dueAt: string;
  /** minutes until the next reply is due; negative once breached */
  minsLeft: number;
  resolutionDueAt: string;
  resolutionBreached: boolean;
  firstResponseDueAt: string;
  respondedAt?: string;
  paused: boolean;
  state: "breached" | "at_risk" | "on_track" | "paused" | "met";
}

export interface Macro {
  id: string;
  title: string;
  category: "Delivery" | "Payment" | "Product quality" | "Return and refund" | "Account" | "Other" | "General";
  body: string;
}

/** Saved replies. {first_name} and {order_id} are filled in from the ticket. */
export const MACROS: Macro[] = [
  {
    id: "delay",
    title: "Delivery running late",
    category: "Delivery",
    body: "Hi {first_name}, I am sorry your order {order_id} is taking longer than promised. I have checked with our courier partner and will keep this ticket open until it is delivered, updating you as soon as it moves.",
  },
  {
    id: "not-received",
    title: "Marked delivered, not received",
    category: "Delivery",
    body: "Hi {first_name}, thank you for letting us know. I have raised a delivery investigation for order {order_id} with our courier partner. If the parcel is not found, we will arrange a refund or a replacement.",
  },
  {
    id: "refund-timeline",
    title: "Refund timeline",
    category: "Return and refund",
    body: "Hi {first_name}, the refund for order {order_id} has been started and goes back to the way you paid. UPI refunds usually arrive in 1 to 2 business days and card refunds in 5 to 7 business days, depending on your bank.",
  },
  {
    id: "damage-photos",
    title: "Ask for photos of a damaged item",
    category: "Product quality",
    body: "Hi {first_name}, I am sorry the item arrived damaged. Could you reply with 2 or 3 photos of the product and the outer box, including the shipping label? That lets us sort out order {order_id} straight away.",
  },
  {
    id: "payment-not-placed",
    title: "Payment taken, order not placed",
    category: "Payment",
    body: "Hi {first_name}, I can see the payment went through but the order could not be confirmed. The amount is refunded automatically to the same account, usually within 1 to 2 business days. No action is needed from you.",
  },
  {
    id: "password-reset",
    title: "Cannot sign in",
    category: "Account",
    body: "Hi {first_name}, you can set a new password from the sign in page: choose Forgot password, enter the email on your account, and we will email you a 6 digit code. Please check your spam folder if it does not arrive within a minute.",
  },
  {
    id: "escalated",
    title: "Escalated to a specialist",
    category: "General",
    body: "Hi {first_name}, I have passed your request to a specialist who can look into it in more detail. You will hear from us on this ticket, and you do not need to contact us again.",
  },
  {
    id: "closing",
    title: "Closing the ticket",
    category: "General",
    body: "Hi {first_name}, I am glad we could sort this out. I am marking this ticket as resolved. If anything else comes up, reply here and it will reopen.",
  },
];
