import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { conflict, notFound, unprocessable } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { orderItems, orderNotes, orders, refunds, users, type AddressSnapshot, type OrderItemStatus } from "../../db/schema.js";
import type { adminRefundBody, orderAddressBody } from "./commerce.schemas.js";
import { PaymentsService } from "./payments/payments.service.js";
import { RefundsService } from "./payments/refunds.service.js";
import { ServiceabilityService } from "./serviceability.service.js";
import { OrderWorkflow } from "./workflow.service.js";

type RefundRow = typeof refunds.$inferSelect;
type Address = z.infer<typeof orderAddressBody>;

/** Line statuses before the parcel is booked with the courier. */
const BEFORE_BOOKING: OrderItemStatus[] = ["PENDING", "NEW", "ACCEPTED", "PACKED"];

/** An order's address can change until the courier has it: no line ready to ship or later, and no AWB. */
export const addressEditable = (items: { status: OrderItemStatus; awb: string | null }[]) =>
  items.some((i) => i.status !== "CANCELLED") && items.every((i) => !i.awb && (i.status === "CANCELLED" || BEFORE_BOOKING.includes(i.status)));

/** A refund as staff see it: its true status, method and payout reference. */
export const refundView = (r: RefundRow) => ({
  id: r.id,
  orderId: r.orderId,
  orderItemId: r.orderItemId,
  amountPaise: r.amountPaise,
  status: r.status,
  method: r.method,
  reason: r.reason,
  reference: r.reference,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
  completedAt: r.completedAt ? r.completedAt.toISOString() : null,
});

export const ADDRESS_FIELDS = ["name", "phone", "line1", "line2", "landmark", "city", "state", "pincode", "type"] as const;
const oneLine = (a: AddressSnapshot) => [a.name, a.line1, a.line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`, a.phone].filter(Boolean).join(", ");

/** What staff change on an order beyond its lines: refunds, the delivery address, and internal notes. */
@Injectable()
export class OrderAdminService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(RefundsService) private readonly refunds: RefundsService,
    @Inject(ServiceabilityService) private readonly serviceability: ServiceabilityService,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
  ) {}

  /* ------------------------------ Refunds ------------------------------ */

  /**
   * A refund issued from the order page. SOURCE goes through the refund job to
   * the gateway; MANUAL records money already sent by UPI or bank transfer.
   * Both are capped under the order lock (see PaymentsService).
   */
  async refund(actorId: string, orderId: string, body: z.infer<typeof adminRefundBody>) {
    if (body.method === "MANUAL" && !body.reference) throw unprocessable("REFERENCE_REQUIRED", "Enter the UTR or UPI reference of the payment you made");
    const row = await this.db.transaction(async (tx) => {
      if (body.orderItemId) {
        const [item] = await tx.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.id, body.orderItemId), eq(orderItems.orderId, orderId)));
        if (!item) throw notFound("Order item");
      }
      const extra = { orderItemId: body.orderItemId ?? null, createdBy: actorId, note: body.note || null };
      return body.method === "SOURCE"
        ? this.payments.refundToSource(tx, orderId, body.amountPaise, body.reason, extra)
        : this.payments.refundManually(tx, orderId, { amountPaise: body.amountPaise, reason: body.reason, reference: body.reference, paid: true, ...extra });
    });
    return refundView(row);
  }

  /** Sends a failed refund, or one that needs attention, to the gateway again under the same receipt. */
  async retry(refundId: string) {
    return refundView(await this.refunds.retry(refundId));
  }

  /** Records the payout of a manual refund that was waiting for one. */
  async markPaid(refundId: string, reference: string, note?: string) {
    return refundView(await this.db.transaction((tx) => this.refunds.markPaid(tx, refundId, reference, note)));
  }

  /* ------------------------------ Address ------------------------------ */

  /**
   * Corrects the delivery address while the courier does not have the parcel
   * yet. A new pincode must be one we deliver to (and take cash at, for cash
   * on delivery). Leaves an internal note so the order page shows the change.
   */
  async updateAddress(actor: { id: string }, orderId: string, body: Address) {
    const [current] = await this.db.select({ address: orders.address, paymentMethod: orders.paymentMethod }).from(orders).where(eq(orders.id, orderId));
    if (!current) throw notFound("Order");
    // asked before the lock: it may call the courier
    if (body.pincode !== current.address.pincode) {
      const area = await this.serviceability.check(body.pincode);
      if (!area.serviceable) throw unprocessable("PINCODE_UNSERVICEABLE", `We do not deliver to ${body.pincode} yet`);
      if (current.paymentMethod === "COD" && !area.codAvailable) throw unprocessable("COD_UNAVAILABLE", `Cash on delivery is not available at ${body.pincode}, and this order is paid on delivery`);
    }
    const next: AddressSnapshot = {
      name: body.name,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2 || null,
      landmark: body.landmark || null,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      type: body.type,
    };
    const before = await this.db.transaction(async (tx) => {
      const { order, items } = await this.workflow.lockOrder(tx, orderId);
      if (!addressEditable(items)) throw conflict("ADDRESS_LOCKED", "Already handed to the courier");
      await tx.update(orders).set({ address: next }).where(eq(orders.id, orderId));
      if (oneLine(order.address) !== oneLine(next)) {
        await tx.insert(orderNotes).values({ orderId, authorId: actor.id, authorName: await this.nameOf(actor.id), body: `Changed the delivery address from "${oneLine(order.address)}" to "${oneLine(next)}".` });
      }
      return order.address;
    });
    return { before, after: next };
  }

  /* ------------------------------- Notes ------------------------------- */

  async notes(orderId: string) {
    await this.exists(orderId);
    const rows = await this.db.select().from(orderNotes).where(eq(orderNotes.orderId, orderId)).orderBy(desc(orderNotes.createdAt), desc(orderNotes.id));
    return rows.map((n) => ({ id: n.id, authorId: n.authorId, authorName: n.authorName, body: n.body, createdAt: n.createdAt.toISOString() }));
  }

  async addNote(actor: { id: string }, orderId: string, body: string) {
    await this.exists(orderId);
    const [n] = await this.db.insert(orderNotes).values({ orderId, authorId: actor.id, authorName: await this.nameOf(actor.id), body }).returning();
    return { id: n!.id, authorId: n!.authorId, authorName: n!.authorName, body: n!.body, createdAt: n!.createdAt.toISOString() };
  }

  private async exists(orderId: string) {
    const [o] = await this.db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId));
    if (!o) throw notFound("Order");
  }

  private async nameOf(userId: string) {
    const [u] = await this.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId));
    return u?.name ?? u?.email ?? "Staff";
  }
}
