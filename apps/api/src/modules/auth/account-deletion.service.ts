import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { ApiError, conflict } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, FILE_STORE } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import {
  addresses,
  auditEvents,
  cartItems,
  customerUploads,
  offers,
  orderItems,
  orders,
  refunds,
  returnEvents,
  returns,
  sessions,
  supportActions,
  supportEvents,
  supportMessages,
  supportTickets,
  users,
  wishlistItems,
  type OrderItemStatus,
  type ReturnStatus,
} from "../../db/schema.js";
import type { FileStore } from "../files/file-store.js";
import { TokensService } from "./tokens.service.js";

const DAY = 86_400_000;
export const DELETED_NAME = "Deleted customer";
export const deletedEmail = (userId: string) => `deleted+${userId}@invalid.altasgoods`;

/** Lines the store still has to deliver, collect or settle. */
const IN_FLIGHT: OrderItemStatus[] = ["NEW", "ACCEPTED", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "CANCELLATION_REQUESTED", "RTO_IN_TRANSIT", "RETURN_REQUESTED", "RETURN_IN_PROGRESS"];
/** A return that has ended, one way or another. */
const RETURN_ENDED: ReturnStatus[] = ["REJECTED", "COMPLETED", "CANCELLED", "LOST"];

/** The contact details of an address snapshot are replaced; where it went (pincode, city, state) stays for tax and logistics records. */
/** A UPI id (name@bank) or an email address inside free text. */
const HANDLE = "[A-Za-z0-9_.+-]+@[A-Za-z0-9_.-]+";
const MASK = JSON.stringify({ name: "Deleted", phone: "Deleted", line1: "Deleted", line2: null, landmark: null });

/**
 * Self-serve account deletion. The account is anonymised in place rather than
 * erased, because orders and returns must stay for tax records and reviews
 * stay (shown as Anonymous):
 * - the user row loses its name, email, phone and password, and becomes DELETED;
 * - addresses, cart, wishlist, sessions and uploaded files are dropped;
 * - the contact details on order and return addresses, a return's refund UPI id
 *   (also where a return timeline line or a payout note quotes it) and the
 *   customer's name on support tickets are masked. A payout's reference (the
 *   bank's UTR) stays: it is the store's record, not the customer's.
 * Support message bodies stay, for dispute history. Pending background jobs hold
 * only ids (refunds), but a job that emails the customer must skip a DELETED user.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger("AccountDeletion");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  /**
   * An order or return that is still going, or money still to be paid out.
   * A delivered line stays open for the return window of its offer (at least
   * 7 days, as in Returns); after that it counts as closed even if nothing
   * has moved it to CLOSED, since no job does that yet.
   */
  async hasOpenWork(userId: string, db: Tx = this.db) {
    const now = this.clock.now().getTime();
    const lines = await db
      .select({ status: orderItems.status, deliveredAt: orderItems.deliveredAt, window: offers.returnWindowDays, orderStatus: orders.status, paymentDueBy: orders.paymentDueBy })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(offers, eq(offers.id, orderItems.offerId))
      .where(eq(orders.userId, userId));
    const openLine = lines.some((l) => {
      if (IN_FLIGHT.includes(l.status)) return true;
      // an unpaid order can still be paid until its window ends
      if (l.status === "PENDING") return l.orderStatus === "PAYMENT_PENDING" && (!l.paymentDueBy || l.paymentDueBy.getTime() > now);
      if (l.status === "DELIVERED") return !l.deliveredAt || now <= l.deliveredAt.getTime() + Math.max(l.window, 7) * DAY;
      return false;
    });
    if (openLine) return true;

    const [openReturn] = await db
      .select({ id: returns.id })
      .from(returns)
      // refund INITIATED: a bank refund still waiting to be paid to the UPI id on the return
      .where(and(eq(returns.userId, userId), sql`(${returns.status} not in (${sql.join(RETURN_ENDED.map((s) => sql`${s}`), sql`, `)}) or ${returns.refundStatus} = 'INITIATED')`))
      .limit(1);
    if (openReturn) return true;

    const mine = db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
    const [unpaidRefund] = await db.select({ id: refunds.id }).from(refunds).where(and(inArray(refunds.orderId, mine), inArray(refunds.status, ["PENDING", "PROCESSING", "NEEDS_ATTENTION"]))).limit(1);
    if (unpaidRefund) return true;
    const tickets = db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.userId, userId));
    const [waiting] = await db
      .select({ id: supportActions.id })
      .from(supportActions)
      .where(and(inArray(supportActions.ticketId, tickets), eq(supportActions.status, "PENDING_APPROVAL")))
      .limit(1);
    return !!waiting;
  }

  /** Anonymises the account; the caller has already checked who is asking and their password. */
  async delete(userId: string) {
    const fileIds = await this.db.transaction(async (tx) => {
      const [user] = await tx.select({ status: users.status, staff: users.staffRoles, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).for("update");
      if (!user || user.status === "DELETED") throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
      if (user.staff.length) throw conflict("STAFF_ACCOUNT", "Ask a Super Admin to remove your staff access first.");
      // checked inside the transaction, with the user row locked
      if (await this.hasOpenWork(userId, tx)) throw conflict("OPEN_ORDERS", "You have an order or return in progress. You can delete your account once it is finished.");

      const myOrders = tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
      const myReturns = tx.select({ id: returns.id }).from(returns).where(eq(returns.userId, userId));
      const myTickets = tx.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.userId, userId));

      await tx.update(orders).set({ address: sql`${orders.address} || ${MASK}::jsonb` }).where(eq(orders.userId, userId));
      await tx
        .update(returns)
        .set({ address: sql`${returns.address} || ${MASK}::jsonb`, refundUpi: sql`case when ${returns.refundUpi} is null then null else 'Deleted' end` })
        .where(eq(returns.userId, userId));
      // a timeline line or a payout note may quote the UPI id (or an email): any name@handle token goes
      await tx
        .update(returnEvents)
        .set({ note: sql`regexp_replace(${returnEvents.note}, ${HANDLE}, 'Deleted', 'g')` })
        .where(and(inArray(returnEvents.returnId, myReturns), sql`${returnEvents.note} like '%@%'`));
      await tx
        .update(refunds)
        .set({ note: sql`regexp_replace(${refunds.note}, ${HANDLE}, 'Deleted', 'g')` })
        .where(and(inArray(refunds.orderId, myOrders), sql`${refunds.note} like '%@%'`));

      await tx.update(supportTickets).set({ customerName: DELETED_NAME }).where(eq(supportTickets.userId, userId));
      await tx.update(supportMessages).set({ author: DELETED_NAME }).where(or(eq(supportMessages.authorId, userId), and(inArray(supportMessages.ticketId, myTickets), eq(supportMessages.kind, "CUSTOMER"))));
      // the timeline of their tickets names whoever acted: for the customer, their own name or email
      await tx.update(supportEvents).set({ actor: DELETED_NAME }).where(or(eq(supportEvents.actorId, userId), and(inArray(supportEvents.ticketId, myTickets), sql`${supportEvents.actor} in (${user.name ?? ""}, ${user.email})`)));

      // earlier block and unblock entries quote the customer's name or email; the action and time stay
      const scrub = (text: string) => [user.email, user.name].reduce<string>((t, v) => (v ? t.split(v).join(DELETED_NAME) : t), text);
      const entries = await tx.select({ id: auditEvents.id, summary: auditEvents.summary, changes: auditEvents.changes }).from(auditEvents).where(and(eq(auditEvents.entityType, "customer"), eq(auditEvents.entityId, userId)));
      for (const e of entries) {
        await tx
          .update(auditEvents)
          .set({ summary: scrub(e.summary), changes: e.changes ? (JSON.parse(scrub(JSON.stringify(e.changes))) as typeof e.changes) : null })
          .where(eq(auditEvents.id, e.id));
      }
      await tx.update(supportActions).set({ details: sql`${supportActions.details} - 'upi'` }).where(inArray(supportActions.ticketId, myTickets));

      const uploads = await tx.delete(customerUploads).where(eq(customerUploads.userId, userId)).returning({ fileId: customerUploads.fileId });
      await tx.delete(addresses).where(eq(addresses.userId, userId));
      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      await tx.delete(wishlistItems).where(eq(wishlistItems.userId, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));

      const now = this.clock.now();
      await tx
        .update(users)
        .set({
          name: DELETED_NAME,
          email: deletedEmail(userId),
          phone: null,
          // not a scrypt hash, so no password can ever match it
          passwordHash: `deleted$${randomBytes(24).toString("base64url")}`,
          emailVerifiedAt: null,
          status: "DELETED",
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
      await tx.insert(auditEvents).values({ actorId: userId, actorName: DELETED_NAME, action: "account.delete", entityType: "user", entityId: userId, summary: "Customer deleted their account" });
      return uploads.map((u) => u.fileId);
    });

    // access tokens already handed out stop working at once
    await this.tokens.revokeAll(userId);
    // the rows are gone; make sure the bytes are too (matters once files live outside the database)
    for (const id of fileIds) await this.files.remove(id).catch((e: Error) => this.logger.warn(`Uploaded file ${id} not removed: ${e.message}`));
  }
}
