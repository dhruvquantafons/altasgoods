import { randomInt } from "node:crypto";
import { basename } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ApiError, conflict, notFound, unprocessable } from "../../../common/errors.js";
import type { Clock } from "../../../common/infra.module.js";
import { CLOCK, DB, FILE_STORE } from "../../../common/tokens.js";
import type { Db, Tx } from "../../../db/client.js";
import { addresses, customerUploads, offers, orderItems, orders, products, refunds, returnEvents, returns, users, type Actor, type ReturnStatus } from "../../../db/schema.js";
import { sniffMime, type FileStore } from "../../files/file-store.js";
import { PaymentsService } from "../payments/payments.service.js";
import { OrderWorkflow } from "../workflow.service.js";
import type { createReturnBody } from "./returns.schemas.js";
import type { z } from "zod";

type Return = typeof returns.$inferSelect;
const DAY = 86_400_000;
const INSTANT_REFUND_LIMIT_PAISE = 500_000;
/** Categories where refunds wait for the store's check (spec 10.6). */
const HIGH_RISK = ["cat-mobiles"];
const OPEN: ReturnStatus[] = ["REQUESTED", "PENDING_REVIEW", "APPROVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKUP_FAILED", "PICKED_UP", "IN_TRANSIT", "RECEIVED", "QC_PASSED", "QC_FAILED"];
const CUSTOMER_CANCELLABLE: ReturnStatus[] = ["REQUESTED", "PENDING_REVIEW", "APPROVED", "PICKUP_SCHEDULED"];
/** A pickup date (YYYY-MM-DD, a calendar day in India) as people read it, such as 3 Oct. */
const pickupDay = (date: string) => new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Spec 11.3 moves the platform makes for a return. */
const MOVES: Partial<Record<ReturnStatus, ReturnStatus[]>> = {
  REQUESTED: ["APPROVED", "PENDING_REVIEW", "REJECTED", "CANCELLED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PICKUP_SCHEDULED", "COMPLETED", "CANCELLED"],
  PICKUP_SCHEDULED: ["OUT_FOR_PICKUP", "CANCELLED"],
  OUT_FOR_PICKUP: ["PICKED_UP", "PICKUP_FAILED"],
  PICKUP_FAILED: ["PICKUP_SCHEDULED", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "LOST"],
  IN_TRANSIT: ["RECEIVED", "LOST"],
  RECEIVED: ["QC_PASSED", "QC_FAILED"],
  QC_PASSED: ["COMPLETED"],
  QC_FAILED: ["COMPLETED", "REJECTED"],
};

/** Customer returns (spec 2.7, 9.1.5, 11.3): request, pickup, the store's check and the resolution. */
@Injectable()
export class ReturnsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(OrderWorkflow) private readonly workflow: OrderWorkflow,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  /* ------------------------------ Moves ------------------------------- */

  private async move(tx: Tx, r: Return, to: ReturnStatus, actor: Actor, note: string | null, patch: Partial<Return> = {}) {
    if (!MOVES[r.status]?.includes(to)) throw conflict("INVALID_TRANSITION", `A return that is ${r.status.toLowerCase().replace(/_/g, " ")} cannot move to ${to.toLowerCase().replace(/_/g, " ")}`);
    const now = this.clock.now();
    const [next] = await tx
      .update(returns)
      .set({ ...patch, status: to, updatedAt: now })
      .where(and(eq(returns.id, r.id), eq(returns.status, r.status)))
      .returning();
    if (!next) throw conflict("STALE_RETURN", "This return changed meanwhile. Reload and try again.");
    await tx.insert(returnEvents).values({ returnId: r.id, fromStatus: r.status, toStatus: to, actor, note, at: now });
    return next;
  }

  private async lock(tx: Tx, id: string) {
    const [r] = await tx.select().from(returns).where(eq(returns.id, id)).for("update");
    if (!r) throw notFound("Return");
    return r;
  }

  /** Books the reverse pickup once a return is approved. */
  private async schedulePickup(tx: Tx, r: Return, actor: Actor) {
    const approved = r.status === "APPROVED" ? r : await this.move(tx, r, "APPROVED", actor, r.status === "PENDING_REVIEW" ? "Approved by the store" : "In-policy return, approved automatically");
    return this.move(tx, approved, "PICKUP_SCHEDULED", "SYSTEM", ["Pickup booked", approved.pickupDate && `for ${pickupDay(approved.pickupDate)}`].filter(Boolean).join(" ") + (approved.pickupSlot ? `, ${approved.pickupSlot}` : ""), { awb: approved.awb ?? `BBR${randomInt(1_000_000_000, 9_999_999_999)}` });
  }

  /** Refund (once) or replacement, and the order line follows. */
  private async resolve(tx: Tx, r: Return) {
    let next = r;
    if (r.resolution === "REFUND" && !r.refundStatus) {
      const [order] = await tx.select({ method: orders.paymentMethod, paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, r.orderId));
      if (r.refundTo === "SOURCE" && order && order.method !== "COD" && (order.paymentStatus === "CAPTURED" || order.paymentStatus === "PARTIALLY_REFUNDED")) {
        const refund = await this.payments.refundToSource(tx, r.orderId, r.refundAmountPaise, `Return ${r.id}`);
        [next] = (await tx.update(returns).set({ refundStatus: refund.status, refundId: refund.id }).where(eq(returns.id, r.id)).returning()) as [Return];
      } else {
        // BluBuy Credits and bank transfers for cash on delivery are paid by Finance
        [next] = (await tx.update(returns).set({ refundStatus: "INITIATED" }).where(eq(returns.id, r.id)).returning()) as [Return];
      }
    }
    return next;
  }

  private async finish(tx: Tx, r: Return, actor: Actor) {
    const resolved = await this.resolve(tx, r);
    const [item] = await tx.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, r.orderItemId));
    if (item?.status === "RETURN_IN_PROGRESS") {
      await this.workflow.transition(tx, { orderId: r.orderId, itemIds: [r.orderItemId], to: r.resolution === "REFUND" ? "RETURNED" : "REPLACED", actor, note: `Return ${r.id}` });
    }
    const note = r.resolution === "REFUND" ? "Refund issued" : r.resolution === "EXCHANGE" ? `Exchange in size ${r.exchangeSize} dispatched` : "Replacement dispatched";
    return this.move(tx, resolved, "COMPLETED", "SYSTEM", note);
  }

  /* ----------------------------- Customer ----------------------------- */

  async create(userId: string, input: z.infer<typeof createReturnBody>) {
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ item: orderItems, order: orders, window: offers.returnWindowDays, categoryId: products.categoryId })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .innerJoin(offers, eq(offers.id, orderItems.offerId))
        .innerJoin(products, eq(products.id, orderItems.productId))
        .where(and(eq(orderItems.id, input.orderItemId), eq(orders.userId, userId)));
      if (!row) throw notFound("Order item");
      const { item, order } = row;
      const open = await tx.select({ id: returns.id }).from(returns).where(and(eq(returns.orderItemId, item.id), inArray(returns.status, OPEN)));
      if (open.length) throw conflict("RETURN_EXISTS", `Return ${open[0]!.id} is already open for this item`);
      if (item.status !== "DELIVERED" || !item.deliveredAt) throw conflict("NOT_RETURNABLE", "Returns open once the item is delivered");
      if (input.qty > item.qty) throw unprocessable("QTY_TOO_LARGE", "You cannot return more than you bought");
      if (input.resolution === "EXCHANGE" && !input.exchangeSize) throw unprocessable("SIZE_REQUIRED", "Choose the size you want instead");
      if (input.resolution === "REFUND" && !input.refundTo) throw unprocessable("REFUND_TO_REQUIRED", "Choose where the refund goes");
      if (input.refundTo === "BANK" && !input.refundUpi) throw unprocessable("UPI_REQUIRED", "Enter the UPI ID for the refund");

      const now = this.clock.now();
      const windowEnds = item.deliveredAt.getTime() + Math.max(row.window, 7) * DAY;
      const inPolicy = now.getTime() <= windowEnds;
      // late claims for damage or a wrong item go to the store for review; late change of mind is closed (spec 11.3)
      if (!inPolicy && (input.fault === "CUSTOMER" || now.getTime() > item.deliveredAt.getTime() + 90 * DAY)) {
        throw new ApiError(422, "RETURN_WINDOW_CLOSED", `The return window closed on ${new Date(windowEnds).toISOString().slice(0, 10)}`);
      }
      const today = now.toISOString().slice(0, 10);
      if (input.pickupDate < today) throw unprocessable("PICKUP_DATE", "Choose a pickup date from today");

      const photos = input.photoIds.length
        ? await tx.select({ id: customerUploads.id, name: customerUploads.name }).from(customerUploads).where(and(eq(customerUploads.userId, userId), inArray(customerUploads.id, input.photoIds)))
        : [];
      if (photos.length !== input.photoIds.length) throw unprocessable("PHOTO_UNKNOWN", "A photo could not be found. Add it again.");

      let address = order.address;
      if (input.addressId) {
        const [a] = await tx.select().from(addresses).where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)));
        if (!a) throw notFound("Address");
        address = { name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state, pincode: a.pincode, type: a.type };
      }

      // the line's share of any coupon is not refunded twice
      const line = item.unitPricePaise * input.qty;
      const couponShare = order.subtotalPaise ? Math.round((order.couponDiscountPaise * line) / order.subtotalPaise) : 0;
      const amount = input.resolution === "REFUND" ? line - couponShare : 0;
      const instant = input.resolution === "REFUND" && amount <= INSTANT_REFUND_LIMIT_PAISE && !HIGH_RISK.includes(row.categoryId);

      const [{ n }] = (await tx.execute<{ n: number }>(sql`select nextval('return_seq')::int as n`)).rows as [{ n: number }];
      const [created] = await tx
        .insert(returns)
        .values({
          id: `RT-${n}`,
          orderId: order.id,
          orderItemId: item.id,
          userId,
          sellerId: item.sellerId,
          qty: input.qty,
          reasonCode: input.reasonCode,
          reasonLabel: input.reasonLabel,
          fault: input.fault,
          comments: input.comments ?? null,
          photos,
          resolution: input.resolution,
          exchangeSize: input.exchangeSize ?? null,
          refundTo: input.resolution === "REFUND" ? (input.refundTo ?? null) : null,
          refundUpi: input.refundTo === "BANK" ? (input.refundUpi ?? null) : null,
          refundAmountPaise: amount,
          instantRefund: instant,
          status: "REQUESTED",
          pickupDate: input.pickupDate,
          pickupSlot: input.pickupSlot,
          address,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await tx.insert(returnEvents).values({ returnId: created!.id, toStatus: "REQUESTED", actor: "CUSTOMER", note: input.reasonLabel, at: now });
      await this.workflow.transition(tx, { orderId: order.id, itemIds: [item.id], to: "RETURN_REQUESTED", actor: "CUSTOMER", actorId: userId, note: `Return ${created!.id}` });
      if (inPolicy) await this.schedulePickup(tx, created!, "SYSTEM");
      else await this.move(tx, created!, "PENDING_REVIEW", "SYSTEM", "Outside the return window, the store reviews within 48 hours");
      return created!.id;
    });
    return this.view(id);
  }

  async cancel(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      const r = await this.lock(tx, id);
      if (r.userId !== userId) throw notFound("Return");
      if (!CUSTOMER_CANCELLABLE.includes(r.status)) throw conflict("NOT_CANCELLABLE", "This return can no longer be cancelled; the pickup is under way");
      await this.move(tx, r, "CANCELLED", "CUSTOMER", "Cancelled by the customer");
      await this.workflow.transition(tx, { orderId: r.orderId, itemIds: [r.orderItemId], to: "DELIVERED", actor: "CUSTOMER", actorId: userId, note: `Return ${r.id} cancelled` });
    });
    return this.view(id);
  }

  /** A new pickup date or window, while the pickup has not happened. */
  async reschedule(userId: string, id: string, pickupDate: string, pickupSlot: string) {
    await this.db.transaction(async (tx) => {
      let r = await this.lock(tx, id);
      if (r.userId !== userId) throw notFound("Return");
      if (r.status !== "PICKUP_SCHEDULED" && r.status !== "PICKUP_FAILED") throw conflict("NOT_RESCHEDULABLE", "The pickup can only be moved before it happens");
      if (pickupDate < this.clock.now().toISOString().slice(0, 10)) throw unprocessable("PICKUP_DATE", "Choose a pickup date from today");
      if (r.status === "PICKUP_FAILED") r = await this.move(tx, r, "PICKUP_SCHEDULED", "CUSTOMER", `Pickup rebooked for ${pickupDate}, ${pickupSlot}`, { pickupDate, pickupSlot });
      else {
        await tx.update(returns).set({ pickupDate, pickupSlot, updatedAt: this.clock.now() }).where(eq(returns.id, id));
        await tx.insert(returnEvents).values({ returnId: id, fromStatus: r.status, toStatus: r.status, actor: "CUSTOMER", note: `Pickup moved to ${pickupDate}, ${pickupSlot}`, at: this.clock.now() });
      }
    });
    return this.view(id);
  }

  /** Every refund on the customer's orders: cancellations, returns and Care Desk refunds. */
  async refunds(userId: string) {
    const rows = await this.db
      .select({ f: refunds, method: orders.paymentMethod })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(eq(orders.userId, userId))
      .orderBy(desc(refunds.createdAt));
    const orderIds = [...new Set(rows.map((r) => r.f.orderId))];
    const items = orderIds.length ? await this.db.select({ id: orderItems.id, orderId: orderItems.orderId, title: orderItems.title, image: orderItems.image }).from(orderItems).where(inArray(orderItems.orderId, orderIds)) : [];
    return rows.map(({ f, method }) => {
      const returnId = /^Return (RT-\d+)/.exec(f.reason)?.[1] ?? null;
      const ticket = /^Care Desk ticket/.test(f.reason);
      const item = items.find((i) => i.id === f.orderItemId) ?? items.find((i) => i.orderId === f.orderId);
      const many = items.filter((i) => i.orderId === f.orderId).length;
      return {
        id: f.id,
        orderId: f.orderId,
        returnId,
        source: returnId ? ("RETURN" as const) : ticket ? ("SUPPORT" as const) : ("CANCELLATION" as const),
        title: item ? `${item.title}${!f.orderItemId && many > 1 ? ` and ${many - 1} more` : ""}` : f.orderId,
        image: item?.image ?? null,
        amountPaise: f.amountPaise,
        method,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
        completedAt: f.completedAt ? f.completedAt.toISOString() : null,
      };
    });
  }

  async mine(userId: string) {
    const rows = await this.db.select({ id: returns.id }).from(returns).where(eq(returns.userId, userId)).orderBy(desc(returns.createdAt));
    return Promise.all(rows.map((r) => this.view(r.id)));
  }

  async mineOne(userId: string, id: string) {
    const v = await this.view(id);
    if (v.userId !== userId) throw notFound("Return");
    return v;
  }

  /** A return photo, stored until it is attached to a return. */
  async upload(userId: string, file: { originalname: string; buffer: Buffer; size: number } | undefined) {
    if (!file?.buffer?.length) throw unprocessable("FILE_REQUIRED", "Choose a photo");
    if (file.size > 4 * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "Photos can be up to 4 MB");
    const mime = sniffMime(file.buffer);
    if (mime !== "image/png" && mime !== "image/jpeg") throw unprocessable("FILE_TYPE", "Add a PNG or JPG photo");
    const fileId = await this.files.put(file.buffer, mime);
    const name = basename(file.originalname || "photo").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "photo";
    const [row] = await this.db.insert(customerUploads).values({ userId, fileId, name, mimeType: mime, sizeBytes: file.size }).returning();
    return { id: row!.id, name: row!.name, mimeType: row!.mimeType, sizeBytes: row!.sizeBytes };
  }

  /** A return photo for its customer, or for store staff (no userId). */
  async photo(id: string, photoId: string, who: { userId?: string }) {
    const [r] = await this.db.select().from(returns).where(eq(returns.id, id));
    const allowed = r && (!who.userId || r.userId === who.userId);
    if (!r || !allowed || !r.photos.some((p) => p.id === photoId)) throw notFound("Photo");
    const [u] = await this.db.select().from(customerUploads).where(eq(customerUploads.id, photoId));
    const file = u ? await this.files.get(u.fileId) : null;
    if (!u || !file) throw notFound("Photo");
    return { content: file.content, mimeType: u.mimeType, fileName: u.name };
  }

  /* ------------------------------- Store ------------------------------- */

  async storeReturns(statuses?: string) {
    const wanted = statuses?.split(",").filter(Boolean) as ReturnStatus[] | undefined;
    const rows = await this.db
      .select({ id: returns.id })
      .from(returns)
      .where(wanted?.length ? inArray(returns.status, wanted) : undefined)
      .orderBy(desc(returns.updatedAt));
    return Promise.all(rows.map((r) => this.view(r.id)));
  }

  storeReturn(id: string) {
    return this.view(id);
  }

  /** Out-of-policy requests: the store approves (pickup is booked) or rejects with a reason. */
  async decide(id: string, approve: boolean, note?: string) {
    const actor: Actor = "STAFF";
    await this.db.transaction(async (tx) => {
      const r = await this.lock(tx, id);
      if (r.status !== "PENDING_REVIEW") throw conflict("NOT_PENDING", "This return is not waiting for your decision");
      if (approve) await this.schedulePickup(tx, { ...r, decisionNote: note ?? null }, actor);
      else {
        if (!note || note.length < 5) throw unprocessable("REASON_REQUIRED", "Give the customer a reason");
        await this.move(tx, r, "REJECTED", actor, note, { decisionNote: note });
        await this.workflow.transition(tx, { orderId: r.orderId, itemIds: [r.orderItemId], to: "DELIVERED", actor, note: `Return ${r.id} rejected` });
      }
    });
    return this.view(id);
  }

  /** The store grades the returned item (spec 11.3 RECEIVED to QC_PASSED or QC_FAILED). */
  async qc(id: string, pass: boolean, note?: string) {
    const actor: Actor = "STAFF";
    await this.db.transaction(async (tx) => {
      const r = await this.lock(tx, id);
      if (r.status !== "RECEIVED") throw conflict("NOT_RECEIVED", "Grade the item once it has been received");
      if (!pass && (!note || note.length < 5)) throw unprocessable("EVIDENCE_REQUIRED", "Describe what is wrong with the returned item");
      if (pass) {
        const passed = await this.move(tx, r, "QC_PASSED", actor, note ?? "Item checked and accepted", { qcNote: note ?? null });
        await this.finish(tx, passed, actor);
      } else {
        await this.move(tx, r, "QC_FAILED", actor, note!, { qcNote: note! });
      }
    });
    return this.view(id);
  }

  /* ---------------------------- Logistics ----------------------------- */

  /** Stands in for reverse pickup scans until the logistics integration (development only). */
  async advance(id: string, to: "OUT_FOR_PICKUP" | "PICKED_UP" | "PICKUP_FAILED" | "IN_TRANSIT" | "RECEIVED") {
    await this.db.transaction(async (tx) => {
      let r = await this.lock(tx, id);
      if (to === "OUT_FOR_PICKUP" && r.status === "PICKUP_FAILED") r = await this.move(tx, r, "PICKUP_SCHEDULED", "LOGISTICS", "Re-attempt booked");
      r = await this.move(tx, r, to, "LOGISTICS", null);
      if (to === "PICKED_UP") {
        await this.workflow.transition(tx, { orderId: r.orderId, itemIds: [r.orderItemId], to: "RETURN_IN_PROGRESS", actor: "LOGISTICS", note: `Return ${r.id} picked up` });
        // low value returns are refunded at the doorstep (spec 10.6)
        if (r.instantRefund) await this.resolve(tx, r);
      }
    });
    return this.view(id);
  }

  /* ------------------------------- View ------------------------------- */

  async view(id: string) {
    const [row] = await this.db
      .select({ r: returns, item: { title: orderItems.title, image: orderItems.image, variant: orderItems.variant, unitPricePaise: orderItems.unitPricePaise, productId: orderItems.productId }, customer: users.name })
      .from(returns)
      .innerJoin(orderItems, eq(orderItems.id, returns.orderItemId))
      .innerJoin(users, eq(users.id, returns.userId))
      .where(eq(returns.id, id));
    if (!row) throw notFound("Return");
    const events = await this.db.select().from(returnEvents).where(eq(returnEvents.returnId, id)).orderBy(returnEvents.at, returnEvents.id);
    const { r } = row;
    return {
      id: r.id,
      userId: r.userId,
      orderId: r.orderId,
      orderItemId: r.orderItemId,
      item: row.item,
      customerName: row.customer ?? r.address.name,
      qty: r.qty,
      reasonCode: r.reasonCode,
      reasonLabel: r.reasonLabel,
      fault: r.fault,
      comments: r.comments,
      photos: r.photos,
      resolution: r.resolution,
      exchangeSize: r.exchangeSize,
      refundTo: r.refundTo,
      refundAmountPaise: r.refundAmountPaise,
      instantRefund: r.instantRefund,
      refundStatus: r.refundStatus,
      status: r.status,
      pickupDate: r.pickupDate,
      pickupSlot: r.pickupSlot,
      address: { name: r.address.name, city: r.address.city, pincode: r.address.pincode, line1: r.address.line1 },
      awb: r.awb,
      qcNote: r.qcNote,
      decisionNote: r.decisionNote,
      cancellable: CUSTOMER_CANCELLABLE.includes(r.status),
      events: events.map((e) => ({ fromStatus: e.fromStatus, toStatus: e.toStatus, actor: e.actor, note: e.note, at: e.at.toISOString() })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
