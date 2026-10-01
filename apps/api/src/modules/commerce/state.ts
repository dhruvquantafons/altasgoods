/**
 * Order item state machine (spec 11.2) and order header derivation (spec 11.1).
 * Every status change in the API goes through assertTransition.
 */
import type { Actor, OrderItemStatus, OrderStatus } from "../../db/schema.js";
import { conflict } from "../../common/errors.js";

type Rule = { to: OrderItemStatus; actors: Actor[] };

export const ITEM_TRANSITIONS: Partial<Record<OrderItemStatus, Rule[]>> = {
  PENDING: [
    { to: "NEW", actors: ["PAYMENT", "SYSTEM"] },
    { to: "CANCELLED", actors: ["PAYMENT", "SYSTEM", "CUSTOMER"] },
  ],
  NEW: [
    { to: "ACCEPTED", actors: ["SELLER", "SYSTEM"] },
    { to: "CANCELLED", actors: ["SELLER", "CUSTOMER", "STAFF"] },
  ],
  ACCEPTED: [
    { to: "PACKED", actors: ["SELLER"] },
    { to: "CANCELLED", actors: ["SELLER", "CUSTOMER", "STAFF"] },
  ],
  PACKED: [
    { to: "READY_TO_SHIP", actors: ["SELLER"] },
    { to: "CANCELLED", actors: ["SELLER", "CUSTOMER", "STAFF"] },
  ],
  READY_TO_SHIP: [
    { to: "SHIPPED", actors: ["LOGISTICS"] },
    { to: "CANCELLED", actors: ["SELLER", "CUSTOMER", "STAFF"] },
  ],
  SHIPPED: [
    { to: "OUT_FOR_DELIVERY", actors: ["LOGISTICS"] },
    { to: "RTO_IN_TRANSIT", actors: ["LOGISTICS"] },
    { to: "LOST", actors: ["LOGISTICS", "STAFF"] },
  ],
  OUT_FOR_DELIVERY: [
    { to: "DELIVERED", actors: ["LOGISTICS"] },
    { to: "SHIPPED", actors: ["LOGISTICS"] },
    { to: "RTO_IN_TRANSIT", actors: ["LOGISTICS"] },
  ],
  RTO_IN_TRANSIT: [{ to: "RTO_RECEIVED", actors: ["LOGISTICS", "SELLER"] }],
  DELIVERED: [
    { to: "RETURN_REQUESTED", actors: ["CUSTOMER", "STAFF"] },
    { to: "CLOSED", actors: ["SYSTEM"] },
  ],
  // spec 11.3: a withdrawn or rejected return puts the line back to delivered
  RETURN_REQUESTED: [
    { to: "RETURN_IN_PROGRESS", actors: ["LOGISTICS", "SYSTEM"] },
    { to: "DELIVERED", actors: ["CUSTOMER", "SELLER", "SYSTEM", "STAFF"] },
  ],
  RETURN_IN_PROGRESS: [
    { to: "RETURNED", actors: ["SELLER", "SYSTEM", "STAFF"] },
    { to: "REPLACED", actors: ["SELLER", "SYSTEM", "STAFF"] },
    { to: "DELIVERED", actors: ["SYSTEM", "STAFF"] },
  ],
};

/** Customer facing cancellation is allowed until the parcel leaves with BluBuy Logistics. */
export const CUSTOMER_CANCELLABLE: OrderItemStatus[] = ["NEW", "ACCEPTED", "PACKED", "READY_TO_SHIP"];

export function canTransition(from: OrderItemStatus, to: OrderItemStatus, actor: Actor) {
  return (ITEM_TRANSITIONS[from] ?? []).some((r) => r.to === to && r.actors.includes(actor));
}

export function assertTransition(from: OrderItemStatus, to: OrderItemStatus, actor: Actor) {
  if (!canTransition(from, to, actor)) {
    throw conflict("INVALID_TRANSITION", `An item that is ${label(from)} cannot be moved to ${label(to)}`);
  }
}

const label = (s: string) => s.toLowerCase().replace(/_/g, " ");

const INACTIVE: OrderItemStatus[] = ["CANCELLED", "RTO_IN_TRANSIT", "RTO_RECEIVED", "LOST"];
const DELIVERED_LIKE: OrderItemStatus[] = ["DELIVERED", "RETURN_REQUESTED", "RETURN_IN_PROGRESS", "RETURNED", "REPLACED", "CLOSED"];
const SHIPPED_LIKE: OrderItemStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", ...DELIVERED_LIKE];

/** Order header status from its items (spec 11.1), given the current header status. */
export function deriveOrderStatus(current: OrderStatus, items: { status: OrderItemStatus }[]): OrderStatus {
  if (items.every((i) => i.status === "PENDING")) return current;
  const active = items.filter((i) => !INACTIVE.includes(i.status));
  if (active.length === 0) return current === "PAYMENT_PENDING" || current === "PAYMENT_FAILED" || current === "ABANDONED" ? "ABANDONED" : "CANCELLED";
  if (active.every((i) => DELIVERED_LIKE.includes(i.status))) return active.every((i) => i.status === "CLOSED") ? "CLOSED" : "DELIVERED";
  if (active.some((i) => DELIVERED_LIKE.includes(i.status))) return "PARTIALLY_DELIVERED";
  if (active.every((i) => SHIPPED_LIKE.includes(i.status))) return "SHIPPED";
  if (active.some((i) => SHIPPED_LIKE.includes(i.status))) return "PARTIALLY_SHIPPED";
  if (active.some((i) => i.status === "PACKED" || i.status === "READY_TO_SHIP")) return "IN_PROGRESS";
  return "CONFIRMED";
}
