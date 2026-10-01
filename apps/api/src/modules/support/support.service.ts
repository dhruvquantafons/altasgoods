import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ApiError, conflict, forbidden, notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, FILE_STORE } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import {
  orderItems,
  orders,
  sellers,
  supportActions,
  supportAttachments,
  supportEvents,
  supportMessages,
  supportTickets,
  users,
  type Attachment,
  type OrderSnapshot,
  type TicketStatus,
} from "../../db/schema.js";
import { PaymentsService } from "../commerce/payments/payments.service.js";
import { sniffMime, type FileStore } from "../files/file-store.js";
import { ACTIVE_STATUSES, AGENT_TRANSITIONS, agentLevel, APPROVER_ROLES, PRIORITY_FOR, rupees, statusLabel, SUPPORT_ROLES } from "./support.rules.js";
import type { actionBody, createTicketBody, listQuery, messageBody, staffCreateBody } from "./support.schemas.js";
import type { z } from "zod";

type Ticket = typeof supportTickets.$inferSelect;
type Staff = { id: string; name: string; roles: string[] };

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const METHOD_LABEL: Record<string, string> = { UPI: "UPI", CARD: "Credit or debit card", NETBANKING: "Net banking", EMI: "EMI", PAY_LATER: "Pay Later", COD: "Cash on delivery" };
const MB = 1024 * 1024;

/** Care Desk tickets (spec 9.4, 11.11): queue, conversation, audit trail and order actions. */
@Injectable()
export class SupportService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  /* ------------------------------ People ------------------------------ */

  async staff(userId: string): Promise<Staff> {
    const [u] = await this.db.select({ id: users.id, name: users.name, phone: users.phone, roles: users.staffRoles }).from(users).where(eq(users.id, userId));
    if (!u) throw notFound("User");
    return { id: u.id, name: u.name ?? u.phone, roles: u.roles };
  }

  /** Everyone who can be assigned tickets. */
  async agents() {
    const rows = await this.db
      .select({ id: users.id, name: users.name, phone: users.phone, roles: users.staffRoles })
      .from(users)
      .where(sql`${users.staffRoles} && ${sql.raw(`array[${[...SUPPORT_ROLES, "SUPER_ADMIN"].map((r) => `'${r}'`).join(",")}]::text[]`)}`)
      .orderBy(asc(users.name));
    return rows.map((r) => ({ id: r.id, name: r.name ?? r.phone, level: agentLevel(r.roles).level }));
  }

  /* ------------------------------- Queue ------------------------------- */

  private viewWhere(view: string, me: string): SQL | undefined {
    const active = inArray(supportTickets.status, ACTIVE_STATUSES);
    switch (view) {
      case "open":
        return active;
      case "mine":
        return and(active, eq(supportTickets.assigneeId, me));
      case "unassigned":
        return and(active, isNull(supportTickets.assigneeId));
      case "escalated":
        return eq(supportTickets.status, "ESCALATED");
      case "awaiting":
        return eq(supportTickets.status, "PENDING_CUSTOMER");
      case "resolved":
        return inArray(supportTickets.status, ["RESOLVED", "CLOSED"]);
      default:
        return undefined;
    }
  }

  async list(me: string, q: z.infer<typeof listQuery>) {
    const filters: SQL[] = [];
    if (q.q) {
      const like = `%${q.q}%`;
      filters.push(or(ilike(supportTickets.id, like), ilike(supportTickets.subject, like), ilike(supportTickets.customerName, like), ilike(supportTickets.orderId, like))!);
    }
    if (q.priority) filters.push(eq(supportTickets.priority, q.priority));
    if (q.category) filters.push(eq(supportTickets.category, q.category as Ticket["category"]));
    if (q.channel) filters.push(eq(supportTickets.channel, q.channel));
    if (q.customerRef) filters.push(eq(supportTickets.customerRef, q.customerRef));
    if (q.orderId) filters.push(eq(supportTickets.orderId, q.orderId));
    const view = this.viewWhere(q.view, me);
    const where = and(...filters, ...(view ? [view] : []));

    const assignee = alias(users, "assignee");
    const rows = await this.db
      .select({ t: supportTickets, assigneeName: sql<string | null>`coalesce(${assignee.name}, ${assignee.phone})` })
      .from(supportTickets)
      .leftJoin(assignee, eq(assignee.id, supportTickets.assigneeId))
      .where(where)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(q.pageSize);

    const last = rows.length
      ? await this.db
          .selectDistinctOn([supportMessages.ticketId], { ticketId: supportMessages.ticketId, kind: supportMessages.kind, author: supportMessages.author, body: supportMessages.body, at: supportMessages.at })
          .from(supportMessages)
          .where(and(inArray(supportMessages.ticketId, rows.map((r) => r.t.id)), inArray(supportMessages.kind, ["CUSTOMER", "AGENT"])))
          .orderBy(supportMessages.ticketId, desc(supportMessages.at))
      : [];
    const lastBy = new Map(last.map((m) => [m.ticketId, m]));

    const base = and(...filters);
    const count = async (v: string) => {
      const w = this.viewWhere(v, me);
      const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(and(base, ...(w ? [w] : [])));
      return r?.n ?? 0;
    };
    const [open, mine, unassigned, escalated, awaiting, resolved] = await Promise.all(["open", "mine", "unassigned", "escalated", "awaiting", "resolved"].map(count));

    return {
      items: rows.map(({ t, assigneeName }) => {
        const m = lastBy.get(t.id);
        return { ...this.summary(t, assigneeName), lastMessage: m ? { kind: m.kind, author: m.author, body: m.body, at: m.at.toISOString() } : null };
      }),
      total: rows.length,
      counts: { open, mine, unassigned, escalated, awaiting, resolved },
    };
  }

  private summary(t: Ticket, assigneeName: string | null) {
    return {
      id: t.id,
      subject: t.subject,
      category: t.category,
      channel: t.channel,
      priority: t.priority,
      status: t.status,
      customerName: t.customerName,
      customerRef: t.customerRef,
      orderId: t.orderId,
      assignee: t.assigneeId ? { id: t.assigneeId, name: assigneeName ?? "Agent" } : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      firstResponseAt: iso(t.firstResponseAt),
      lastCustomerAt: iso(t.lastCustomerAt),
      resolvedAt: iso(t.resolvedAt),
    };
  }

  /* ------------------------------ Detail ------------------------------ */

  private async load(id: string, tx: Tx = this.db, lock = false) {
    const q = tx.select().from(supportTickets).where(eq(supportTickets.id, id));
    const [t] = lock ? await q.for("update") : await q;
    if (!t) throw notFound("Ticket");
    return t;
  }

  async detail(me: Staff, id: string) {
    const t = await this.load(id);
    const [messages, events, actions, [assignee]] = await Promise.all([
      this.db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)).orderBy(asc(supportMessages.at), asc(supportMessages.id)),
      this.db.select().from(supportEvents).where(eq(supportEvents.ticketId, id)).orderBy(asc(supportEvents.at), asc(supportEvents.id)),
      this.db.select().from(supportActions).where(eq(supportActions.ticketId, id)).orderBy(asc(supportActions.createdAt)),
      t.assigneeId ? this.db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, t.assigneeId)) : Promise.resolve([]),
    ]);
    const lastPublic = [...messages].reverse().find((m) => m.kind === "CUSTOMER" || m.kind === "AGENT");
    const { level, limitPaise } = agentLevel(me.roles);
    const approver = me.roles.some((r) => (APPROVER_ROLES as string[]).includes(r));
    return {
      ...this.summary(t, assignee ? (assignee.name ?? assignee.phone) : null),
      lastMessage: lastPublic ? { kind: lastPublic.kind, author: lastPublic.author, body: lastPublic.body, at: lastPublic.at.toISOString() } : null,
      orderSnapshot: t.orderSnapshot ?? null,
      messages: messages.map((m) => ({ id: m.id, kind: m.kind, author: m.author, body: m.body, attachments: m.attachments, at: m.at.toISOString() })),
      events: events.map((e) => ({ type: e.type, fromValue: e.fromValue, toValue: e.toValue, actor: e.actor, at: e.at.toISOString() })),
      actions: actions.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        orderId: a.orderId,
        amountPaise: a.amountPaise,
        details: a.details,
        createdBy: a.createdBy,
        createdById: a.createdById,
        decidedBy: a.decidedBy,
        decidedAt: iso(a.decidedAt),
        createdAt: a.createdAt.toISOString(),
        canApprove: a.status === "PENDING_APPROVAL" && approver && a.createdById !== me.id,
      })),
      allowedStatuses: AGENT_TRANSITIONS[t.status],
      you: { id: me.id, name: me.name, level, refundLimitPaise: limitPaise },
    };
  }

  /* ------------------------------ Changes ----------------------------- */

  private async event(tx: Tx, ticketId: string, type: (typeof supportEvents.$inferInsert)["type"], fromValue: string | null, toValue: string | null, actor: Staff | { id: string | null; name: string }) {
    await tx.insert(supportEvents).values({ ticketId, type, fromValue, toValue, actor: actor.name, actorId: actor.id, at: this.clock.now() });
  }

  /** A line in the conversation from BluBuy: public ones reach the customer, the rest are internal. */
  private async system(tx: Tx, ticketId: string, body: string, isPublic = false) {
    await tx.insert(supportMessages).values({ ticketId, kind: isPublic ? "SYSTEM" : "NOTE", author: "BluBuy", body, at: this.clock.now() });
  }

  /** Moves toward a status, going through Open first when the spec requires it. */
  private async routeTo(tx: Tx, t: Ticket, to: TicketStatus, actor: Staff) {
    if (t.status === to) return t;
    if (AGENT_TRANSITIONS[t.status].includes(to)) return this.moveTo(tx, t, to, actor);
    const opened = t.status === "NEW" || t.status === "REOPENED" ? await this.pickUp(tx, t, actor) : AGENT_TRANSITIONS[t.status].includes("OPEN") ? await this.moveTo(tx, t, "OPEN", actor) : t;
    return opened.status !== t.status && AGENT_TRANSITIONS[opened.status].includes(to) ? this.moveTo(tx, opened, to, actor) : opened;
  }

  /** Moves a ticket, validating the move against spec 11.11. */
  private async moveTo(tx: Tx, t: Ticket, to: TicketStatus, actor: Staff) {
    if (t.status === to) return t;
    if (!AGENT_TRANSITIONS[t.status].includes(to)) throw conflict("INVALID_TRANSITION", `A ticket that is ${statusLabel(t.status).toLowerCase()} cannot move to ${statusLabel(to).toLowerCase()}`);
    const now = this.clock.now();
    const [next] = await tx
      .update(supportTickets)
      .set({ status: to, updatedAt: now, ...(to === "RESOLVED" ? { resolvedAt: now } : {}), ...(to === "OPEN" ? { resolvedAt: null } : {}) })
      .where(eq(supportTickets.id, t.id))
      .returning();
    await this.event(tx, t.id, "STATUS", t.status, to, actor);
    return next!;
  }

  /** Puts a NEW or REOPENED ticket in someone's hands. */
  private async pickUp(tx: Tx, t: Ticket, actor: Staff) {
    if (t.status !== "NEW" && t.status !== "REOPENED") return t;
    let next = t;
    if (!next.assigneeId) {
      [next] = (await tx.update(supportTickets).set({ assigneeId: actor.id, updatedAt: this.clock.now() }).where(eq(supportTickets.id, t.id)).returning()) as [Ticket];
      await this.event(tx, t.id, "ASSIGNEE", null, actor.name, actor);
    }
    return this.moveTo(tx, next, "OPEN", actor);
  }

  async update(me: Staff, id: string, input: { status?: TicketStatus; priority?: Ticket["priority"]; assigneeId?: string | null }) {
    await this.db.transaction(async (tx) => {
      let t = await this.load(id, tx, true);
      if (input.priority && input.priority !== t.priority) {
        await tx.update(supportTickets).set({ priority: input.priority, updatedAt: this.clock.now() }).where(eq(supportTickets.id, id));
        await this.event(tx, id, "PRIORITY", t.priority, input.priority, me);
      }
      if (input.assigneeId !== undefined && input.assigneeId !== t.assigneeId) {
        const name = input.assigneeId ? await this.assigneeName(tx, input.assigneeId) : null;
        const old = t.assigneeId ? await this.assigneeName(tx, t.assigneeId) : null;
        [t] = (await tx.update(supportTickets).set({ assigneeId: input.assigneeId, updatedAt: this.clock.now() }).where(eq(supportTickets.id, id)).returning()) as [Ticket];
        await this.event(tx, id, "ASSIGNEE", old, name, me);
        // spec 11.11: assignment opens a new or reopened ticket
        if (input.assigneeId && (t.status === "NEW" || t.status === "REOPENED") && !input.status) t = await this.moveTo(tx, t, "OPEN", me);
      }
      if (input.status && input.status !== t.status) {
        const reached = await this.routeTo(tx, t, input.status, me);
        if (reached.status !== input.status) await this.moveTo(tx, reached, input.status, me);
      }
    });
    return this.detail(me, id);
  }

  private async assigneeName(tx: Tx, userId: string) {
    const [u] = await tx.select({ name: users.name, phone: users.phone, roles: users.staffRoles }).from(users).where(eq(users.id, userId));
    if (!u || !u.roles.some((r) => (SUPPORT_ROLES as string[]).includes(r) || r === "SUPER_ADMIN")) throw unprocessable("NOT_AN_AGENT", "Tickets can only be assigned to Care Desk agents");
    return u.name ?? u.phone;
  }

  async bulkAssign(me: Staff, ids: string[], assigneeId: string | null) {
    let updated = 0;
    for (const id of [...new Set(ids)]) {
      await this.update(me, id, { assigneeId });
      updated++;
    }
    return { updated };
  }

  /** A reply to the customer or an internal note. */
  async message(me: Staff, id: string, input: z.infer<typeof messageBody>) {
    await this.db.transaction(async (tx) => {
      let t = await this.load(id, tx, true);
      if (t.status === "CLOSED") throw conflict("TICKET_CLOSED", "This ticket is closed. A new contact from the customer opens a linked ticket.");
      const attachments = await this.claimAttachments(tx, id, input.attachmentIds);
      const now = this.clock.now();
      if (input.kind === "REPLY") t = await this.pickUp(tx, t, me);
      await tx.insert(supportMessages).values({ ticketId: id, kind: input.kind === "REPLY" ? "AGENT" : "NOTE", author: me.name, authorId: me.id, body: input.body, attachments, at: now });
      [t] = (await tx
        .update(supportTickets)
        .set({ updatedAt: now, ...(input.kind === "REPLY" && !t.firstResponseAt ? { firstResponseAt: now } : {}) })
        .where(eq(supportTickets.id, id))
        .returning()) as [Ticket];
      // a reply on a resolved ticket keeps it resolved; otherwise apply the agent's choice
      if (input.kind === "REPLY" && input.statusAfter && t.status !== "RESOLVED") await this.routeTo(tx, t, input.statusAfter, me);
    });
    return this.detail(me, id);
  }

  /* ------------------------------ Actions ----------------------------- */

  /** Refund, replacement, seller escalation or Guarantee claim, recorded on the ticket. */
  async act(me: Staff, id: string, input: z.infer<typeof actionBody>) {
    await this.db.transaction(async (tx) => {
      let t = await this.load(id, tx, true);
      if (!t.orderId || !t.orderSnapshot) throw conflict("NO_ORDER", "Link an order to this ticket first");
      if (t.status === "CLOSED") throw conflict("TICKET_CLOSED", "This ticket is closed");
      const order = t.orderSnapshot;
      const now = this.clock.now();
      const base = { ticketId: id, kind: input.kind, orderId: t.orderId, createdBy: me.name, createdById: me.id, createdAt: now };
      let note: string;

      if (input.kind === "REFUND") {
        if (input.amountPaise > Math.round(order.total * 100)) throw unprocessable("AMOUNT_TOO_LARGE", "The refund is more than the order total");
        const { limitPaise } = agentLevel(me.roles);
        const needsApproval = input.amountPaise > limitPaise;
        const [action] = await tx
          .insert(supportActions)
          .values({ ...base, status: needsApproval ? "PENDING_APPROVAL" : "INITIATED", amountPaise: input.amountPaise, details: { destination: input.destination, reason: input.reason } })
          .returning();
        if (needsApproval) note = `Refund of ${rupees(input.amountPaise)} requested by ${me.name}, above their ${rupees(limitPaise)} limit. Waiting for supervisor approval.`;
        else {
          await this.executeRefund(tx, action!, t);
          note = `Refund of ${rupees(input.amountPaise)} initiated by ${me.name}.`;
        }
      } else if (input.kind === "REPLACEMENT") {
        const item = order.items.find((i) => i.id === input.itemId);
        if (!item) throw unprocessable("ITEM_UNKNOWN", "Choose an item from this order");
        const done = await tx.select({ id: supportActions.id }).from(supportActions).where(and(eq(supportActions.kind, "REPLACEMENT"), eq(supportActions.orderId, t.orderId), sql`${supportActions.details}->>'itemId' = ${input.itemId}`));
        if (done.length) throw conflict("ALREADY_REPLACED", "This item was already replaced once. A second issue on a replacement is refund only.");
        await tx.insert(supportActions).values({ ...base, status: "CREATED", details: { itemId: input.itemId, itemTitle: item.title, reason: input.reason, collectOriginal: input.collectOriginal } });
        note = `Replacement created for ${item.title} by ${me.name}.`;
        await this.system(tx, id, `A replacement for ${item.title} is on its way.${input.collectOriginal ? " Please keep the original item ready; we collect it when the replacement is delivered." : ""}`, true);
      } else if (input.kind === "SELLER_ESCALATION") {
        const due = new Date(now.getTime() + 48 * 3600_000);
        await tx.insert(supportActions).values({ ...base, status: "AWAITING_SELLER", details: { seller: order.seller, issue: input.issue, message: input.message, dueAt: due.toISOString() } });
        note = `Escalated to ${order.seller} by ${me.name}. Response due by ${due.toISOString()}.`;
        await this.system(tx, id, "We have asked the seller to look into this and will update you within 48 hours.", true);
        t = await this.routeTo(tx, t, "PENDING_INTERNAL", me);
      } else {
        const due = new Date(now.getTime() + 72 * 3600_000);
        // spec 11.13: SUBMITTED, then AWAITING_SELLER_RESPONSE once the seller is notified
        await tx.insert(supportActions).values({ ...base, status: "AWAITING_SELLER_RESPONSE", details: { claimType: input.claimType, seller: order.seller, sellerResponseDueAt: due.toISOString() } });
        note = `BluBuy Guarantee claim filed by ${me.name} (${input.claimType.replace(/_/g, " ")}). ${order.seller} has 72 hours to respond.`;
        await this.system(tx, id, "We have filed a BluBuy Guarantee claim for you. The seller has 72 hours to respond, and we decide within 7 days.", true);
        t = await this.routeTo(tx, t, "PENDING_INTERNAL", me);
      }
      await this.event(tx, id, "ACTION", null, input.kind, me);
      await this.system(tx, id, note);
      await tx.update(supportTickets).set({ updatedAt: now }).where(eq(supportTickets.id, id));
    });
    return this.detail(me, id);
  }

  /**
   * Online payments of orders in this database are refunded through the
   * payment provider straight away. Refunds to BluBuy Credits, to a bank
   * account for cash on delivery, and for imported history stay INITIATED
   * for Finance.
   */
  private async executeRefund(tx: Tx, action: typeof supportActions.$inferSelect, t: Ticket) {
    const destination = (action.details as { destination?: string }).destination;
    const [order] = await tx.select({ id: orders.id, method: orders.paymentMethod }).from(orders).where(eq(orders.id, t.orderId!));
    const to = destination === "CREDITS" ? "BluBuy Credits" : t.orderSnapshot?.cod ? "your bank account" : t.orderSnapshot?.paymentLabel ?? "your payment method";
    if (destination === "SOURCE" && order && order.method !== "COD") {
      const refund = await this.payments.refundToSource(tx, order.id, action.amountPaise!, `Care Desk ticket ${t.id}`);
      await tx.update(supportActions).set({ status: refund.status === "COMPLETED" ? "COMPLETED" : "PROCESSING", details: { ...action.details, refundId: refund.id } }).where(eq(supportActions.id, action.id));
    }
    await this.system(tx, t.id, `We have initiated a refund of ${rupees(action.amountPaise ?? 0)} to ${to}.`, true);
  }

  async decide(me: Staff, actionId: string, approve: boolean, note?: string) {
    const ticketId = await this.db.transaction(async (tx) => {
      const [a] = await tx.select().from(supportActions).where(eq(supportActions.id, actionId)).for("update");
      if (!a) throw notFound("Action");
      if (a.status !== "PENDING_APPROVAL") throw conflict("NOT_PENDING", "This action is not waiting for approval");
      if (!me.roles.some((r) => (APPROVER_ROLES as string[]).includes(r))) throw forbidden("Only a Care Desk supervisor can approve this");
      if (a.createdById === me.id) throw forbidden("You cannot approve your own request");
      const now = this.clock.now();
      const [next] = await tx
        .update(supportActions)
        .set({ status: approve ? "INITIATED" : "REJECTED", decidedBy: me.name, decidedById: me.id, decidedAt: now, details: { ...a.details, ...(note ? { decisionNote: note } : {}) } })
        .where(eq(supportActions.id, actionId))
        .returning();
      const t = await this.load(a.ticketId, tx, true);
      if (approve) await this.executeRefund(tx, next!, t);
      await tx.update(supportTickets).set({ updatedAt: now }).where(eq(supportTickets.id, t.id));
      await this.event(tx, a.ticketId, "APPROVAL", "PENDING_APPROVAL", approve ? "APPROVED" : "REJECTED", me);
      await this.system(tx, a.ticketId, `Refund of ${rupees(a.amountPaise ?? 0)} ${approve ? "approved" : "rejected"} by ${me.name}${note ? `: ${note}` : ""}.`);
      return a.ticketId;
    });
    return this.detail(me, ticketId);
  }

  /* ---------------------------- Attachments --------------------------- */

  async attach(ticketId: string, uploader: { id: string }, file: { originalname: string; buffer: Buffer; size: number } | undefined): Promise<Attachment> {
    await this.load(ticketId);
    if (!file?.buffer?.length) throw unprocessable("FILE_REQUIRED", "Choose a file to attach");
    if (file.size > 4 * MB) throw new ApiError(413, "FILE_TOO_LARGE", "Attachments can be up to 4 MB");
    const mime = sniffMime(file.buffer);
    if (!mime) throw unprocessable("FILE_TYPE", "Attach a PDF, PNG or JPG file");
    const fileId = await this.files.put(file.buffer, mime);
    const id = randomUUID();
    const name = basename(file.originalname || "attachment").replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "attachment";
    await this.db.insert(supportAttachments).values({ id, ticketId, fileId, name, mimeType: mime, sizeBytes: file.size, uploadedById: uploader.id });
    return { id, name, mimeType: mime, sizeBytes: file.size };
  }

  private async claimAttachments(tx: Tx, ticketId: string, ids: string[]): Promise<Attachment[]> {
    if (!ids.length) return [];
    const rows = await tx.select().from(supportAttachments).where(and(eq(supportAttachments.ticketId, ticketId), inArray(supportAttachments.id, ids)));
    if (rows.length !== new Set(ids).size) throw unprocessable("ATTACHMENT_UNKNOWN", "An attachment does not belong to this ticket");
    return rows.map((r) => ({ id: r.id, name: r.name, mimeType: r.mimeType, sizeBytes: r.sizeBytes }));
  }

  async attachmentFile(id: string, owner?: { userId: string }) {
    const [a] = await this.db
      .select({ fileId: supportAttachments.fileId, name: supportAttachments.name, mimeType: supportAttachments.mimeType, userId: supportTickets.userId })
      .from(supportAttachments)
      .innerJoin(supportTickets, eq(supportTickets.id, supportAttachments.ticketId))
      .where(eq(supportAttachments.id, id));
    if (!a || (owner && a.userId !== owner.userId)) throw notFound("Attachment");
    if (owner) {
      // customers only get files that sit on messages they can see, never on internal notes
      const [visible] = await this.db
        .select({ id: supportMessages.id })
        .from(supportMessages)
        .where(and(sql`${supportMessages.attachments} @> ${JSON.stringify([{ id }])}::jsonb`, inArray(supportMessages.kind, ["CUSTOMER", "AGENT", "SYSTEM"])))
        .limit(1);
      if (!visible) throw notFound("Attachment");
    }
    const file = await this.files.get(a.fileId);
    if (!file) throw notFound("Attachment");
    return { content: file.content, mimeType: a.mimeType, fileName: a.name };
  }

  /* ---------------------------- Customers ----------------------------- */

  /** Order details for a ticket raised on a real order. */
  private async snapshotFor(tx: Tx, orderId: string, userId: string): Promise<OrderSnapshot> {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
    if (!order) throw notFound("Order");
    const items = await tx
      .select({ id: orderItems.id, title: orderItems.title, price: orderItems.unitPricePaise, quantity: orderItems.qty, seller: sellers.displayName })
      .from(orderItems)
      .innerJoin(sellers, eq(sellers.id, orderItems.sellerId))
      .where(eq(orderItems.orderId, orderId));
    return {
      total: order.totalPaise / 100,
      paymentLabel: METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod,
      cod: order.paymentMethod === "COD",
      seller: [...new Set(items.map((i) => i.seller))].join(", "),
      items: items.map((i) => ({ id: i.id, title: i.title, price: i.price / 100, quantity: i.quantity })),
    };
  }

  async createForCustomer(userId: string, input: z.infer<typeof createTicketBody>) {
    const id = await this.db.transaction(async (tx) => {
      const [u] = await tx.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, userId));
      const snapshot = input.orderId ? await this.snapshotFor(tx, input.orderId, userId) : null;
      const [{ n }] = (await tx.execute<{ n: number }>(sql`select nextval('support_ticket_seq')::int as n`)).rows as [{ n: number }];
      const id = `TK-${n}`;
      const now = this.clock.now();
      const name = u?.name ?? u?.phone ?? "Customer";
      await tx.insert(supportTickets).values({
        id,
        subject: input.subject,
        category: input.category,
        channel: input.channel,
        priority: PRIORITY_FOR[input.category] ?? "NORMAL",
        status: "NEW",
        customerName: name,
        userId,
        orderId: input.orderId ?? null,
        orderSnapshot: snapshot,
        lastCustomerAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(supportMessages).values({ ticketId: id, kind: "CUSTOMER", author: name, authorId: userId, body: input.body, at: now });
      await tx.insert(supportEvents).values({ ticketId: id, type: "CREATED", toValue: "NEW", actor: name, actorId: userId, at: now });
      return id;
    });
    return this.customerTicket(userId, id);
  }

  /** A ticket an agent opens for a customer; it starts with them as the owner. */
  async createForStaff(me: Staff, input: z.infer<typeof staffCreateBody>) {
    const id = await this.db.transaction(async (tx) => {
      const [dbOrder] = input.orderId ? await tx.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.id, input.orderId)) : [];
      const snapshot = dbOrder ? await this.snapshotFor(tx, dbOrder.id, dbOrder.userId) : (input.orderSnapshot ?? null);
      const [{ n }] = (await tx.execute<{ n: number }>(sql`select nextval('support_ticket_seq')::int as n`)).rows as [{ n: number }];
      const id = `TK-${n}`;
      const now = this.clock.now();
      await tx.insert(supportTickets).values({
        id,
        subject: input.subject,
        category: input.category,
        channel: input.channel,
        priority: input.priority ?? PRIORITY_FOR[input.category] ?? "NORMAL",
        status: "OPEN",
        customerName: input.customerName,
        customerRef: input.customerRef ?? null,
        userId: dbOrder?.userId ?? null,
        orderId: input.orderId ?? null,
        orderSnapshot: snapshot,
        assigneeId: me.id,
        lastCustomerAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(supportMessages).values({ ticketId: id, kind: "NOTE", author: me.name, authorId: me.id, body: `Opened by ${me.name} (${input.channel.toLowerCase()}): ${input.body}`, at: now });
      await tx.insert(supportEvents).values([
        { ticketId: id, type: "CREATED", toValue: "OPEN", actor: me.name, actorId: me.id, at: now },
        { ticketId: id, type: "ASSIGNEE", toValue: me.name, actor: me.name, actorId: me.id, at: now },
      ]);
      return id;
    });
    return this.detail(me, id);
  }

  async customerTickets(userId: string) {
    const rows = await this.db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.updatedAt));
    return Promise.all(rows.map((r) => this.customerTicket(userId, r.id)));
  }

  async customerTicket(userId: string, id: string) {
    const t = await this.load(id);
    if (t.userId !== userId) throw notFound("Ticket");
    const messages = await this.db
      .select()
      .from(supportMessages)
      .where(and(eq(supportMessages.ticketId, id), inArray(supportMessages.kind, ["CUSTOMER", "AGENT", "SYSTEM"])))
      .orderBy(asc(supportMessages.at), asc(supportMessages.id));
    return {
      id: t.id,
      subject: t.subject,
      category: t.category,
      channel: t.channel,
      status: t.status,
      orderId: t.orderId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      canReply: t.status !== "CLOSED",
      // internal notes (NOTE) are never selected
      messages: messages.map((m) => ({ id: m.id, kind: m.kind as "CUSTOMER" | "AGENT" | "SYSTEM", author: m.kind === "AGENT" ? `${m.author.split(" ")[0]} from BluBuy` : m.author, body: m.body, attachments: m.attachments, at: m.at.toISOString() })),
    };
  }

  /** A customer reply: waiting tickets come back to the agent, resolved ones reopen (spec 11.11). */
  async customerReply(userId: string, id: string, body: string, attachmentIds: string[]) {
    await this.db.transaction(async (tx) => {
      const t = await this.load(id, tx, true);
      if (t.userId !== userId) throw notFound("Ticket");
      if (t.status === "CLOSED") throw conflict("TICKET_CLOSED", "This conversation is closed. Start a new one and we will link them.");
      const attachments = await this.claimAttachments(tx, id, attachmentIds);
      const now = this.clock.now();
      await tx.insert(supportMessages).values({ ticketId: id, kind: "CUSTOMER", author: t.customerName, authorId: userId, body, attachments, at: now });
      const to: TicketStatus | null = t.status === "PENDING_CUSTOMER" ? "OPEN" : t.status === "RESOLVED" ? "REOPENED" : null;
      await tx
        .update(supportTickets)
        .set({ lastCustomerAt: now, updatedAt: now, ...(to ? { status: to } : {}), ...(to === "REOPENED" ? { resolvedAt: null } : {}) })
        .where(eq(supportTickets.id, id));
      if (to) await this.event(tx, id, "STATUS", t.status, to, { id: userId, name: t.customerName });
    });
    return this.customerTicket(userId, id);
  }
}
