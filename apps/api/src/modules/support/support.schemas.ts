import { z } from "zod";
import { TICKET_ACTION_KINDS, TICKET_CATEGORIES, TICKET_CHANNELS, TICKET_PRIORITIES, TICKET_STATUSES } from "../../db/schema.js";

const status = z.enum(TICKET_STATUSES);
const priority = z.enum(TICKET_PRIORITIES);
const attachment = z.object({ id: z.uuid(), name: z.string(), mimeType: z.string(), sizeBytes: z.number().int() });
const person = z.object({ id: z.uuid(), name: z.string() });

export const listQuery = z.object({
  view: z.enum(["open", "mine", "unassigned", "escalated", "awaiting", "resolved", "all"]).default("open"),
  q: z.string().trim().max(80).optional(),
  priority: priority.optional(),
  category: z.string().max(40).optional(),
  channel: z.enum(TICKET_CHANNELS).optional(),
  customerRef: z.string().max(40).optional(),
  orderId: z.string().max(40).optional(),
  pageSize: z.coerce.number().int().min(1).max(300).default(200),
});

export const updateBody = z
  .object({ status: status.optional(), priority: priority.optional(), assigneeId: z.uuid().nullable().optional() })
  .refine((b) => b.status !== undefined || b.priority !== undefined || b.assigneeId !== undefined, "Change at least one field");

export const bulkAssignBody = z.object({ ids: z.array(z.string().max(20)).min(1).max(100), assigneeId: z.uuid().nullable() });

export const messageBody = z.object({
  kind: z.enum(["REPLY", "NOTE"]),
  body: z.string().trim().min(1).max(5000),
  statusAfter: z.enum(["PENDING_CUSTOMER", "OPEN", "RESOLVED"]).optional().describe("Status after a reply"),
  attachmentIds: z.array(z.uuid()).max(5).default([]),
});

export const actionBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("REFUND"),
    amountPaise: z.number().int().positive(),
    destination: z.enum(["SOURCE", "CREDITS"]),
    reason: z.enum(["damaged", "not_delivered", "wrong", "late", "goodwill"]),
  }),
  z.object({ kind: z.literal("REPLACEMENT"), itemId: z.string().min(1).max(60), reason: z.enum(["damaged", "defective", "wrong", "missing"]), collectOriginal: z.boolean() }),
  z.object({ kind: z.literal("GUARANTEE_CLAIM"), claimType: z.enum(["not_delivered", "damaged", "wrong", "different"]) }),
]);

export const decisionBody = z.object({ note: z.string().trim().max(500).optional() });

export const createTicketBody = z.object({
  subject: z.string().trim().min(5).max(120),
  category: z.enum(TICKET_CATEGORIES),
  orderId: z.string().max(40).optional(),
  body: z.string().trim().min(5).max(5000),
  channel: z.enum(TICKET_CHANNELS).default("CHAT"),
});

const snapshotSchema = z.object({
  total: z.number().nonnegative(),
  paymentLabel: z.string().max(60),
  cod: z.boolean(),
  items: z.array(z.object({ id: z.string().max(60), title: z.string().max(200), price: z.number().nonnegative(), quantity: z.number().int().positive() })).max(30),
});

/** An agent opens a ticket for a customer (phone call, order lookup, customer profile). */
export const staffCreateBody = z.object({
  subject: z.string().trim().min(5).max(120),
  category: z.enum(TICKET_CATEGORIES),
  channel: z.enum(TICKET_CHANNELS).default("PHONE"),
  priority: priority.optional(),
  customerName: z.string().trim().min(2).max(80),
  customerRef: z.string().max(40).optional(),
  orderId: z.string().max(40).optional(),
  orderSnapshot: snapshotSchema.optional().describe("For orders from the imported history; orders in this database are looked up"),
  body: z.string().trim().min(5).max(5000).describe("What the customer reported, in the agent's words"),
});

export const customerReplyBody = z.object({ body: z.string().trim().min(1).max(5000), attachmentIds: z.array(z.uuid()).max(5).default([]) });

const messageSchema = z.object({ id: z.number().int(), kind: z.enum(["CUSTOMER", "AGENT", "SYSTEM", "NOTE"]), author: z.string(), body: z.string(), attachments: z.array(attachment), at: z.iso.datetime() });

export const ticketSummary = z.object({
  id: z.string(),
  subject: z.string(),
  category: z.string(),
  channel: z.enum(TICKET_CHANNELS),
  priority,
  status,
  customerName: z.string(),
  customerRef: z.string().nullable(),
  orderId: z.string().nullable(),
  assignee: person.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  firstResponseAt: z.iso.datetime().nullable(),
  lastCustomerAt: z.iso.datetime().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  lastMessage: z.object({ kind: z.string(), author: z.string(), body: z.string(), at: z.iso.datetime() }).nullable(),
});

export const ticketList = z.object({
  items: z.array(ticketSummary),
  total: z.number().int(),
  counts: z.object({ open: z.number().int(), mine: z.number().int(), unassigned: z.number().int(), escalated: z.number().int(), awaiting: z.number().int(), resolved: z.number().int() }),
});

const actionSchema = z.object({
  id: z.uuid(),
  kind: z.enum(TICKET_ACTION_KINDS),
  status: z.string(),
  orderId: z.string().nullable(),
  amountPaise: z.number().int().nullable(),
  details: z.record(z.string(), z.unknown()),
  createdBy: z.string(),
  createdById: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  canApprove: z.boolean(),
});

export const ticketDetail = ticketSummary.extend({
  orderSnapshot: z
    .object({
      total: z.number(),
      paymentLabel: z.string(),
      cod: z.boolean(),
      items: z.array(z.object({ id: z.string(), title: z.string(), price: z.number(), quantity: z.number() })),
    })
    .nullable(),
  messages: z.array(messageSchema),
  events: z.array(z.object({ type: z.string(), fromValue: z.string().nullable(), toValue: z.string().nullable(), actor: z.string(), at: z.iso.datetime() })),
  actions: z.array(actionSchema),
  allowedStatuses: z.array(status).describe("Statuses this agent can move the ticket to now"),
  you: z.object({ id: z.uuid(), name: z.string(), level: z.string(), refundLimitPaise: z.number().int() }),
});

export const agentsSchema = z.array(z.object({ id: z.uuid(), name: z.string(), level: z.string() }));
export const attachmentSchema = attachment;

export const customerTicket = z.object({
  id: z.string(),
  subject: z.string(),
  category: z.string(),
  channel: z.enum(TICKET_CHANNELS),
  status,
  orderId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  canReply: z.boolean(),
  messages: z.array(messageSchema.omit({ kind: true }).extend({ kind: z.enum(["CUSTOMER", "AGENT", "SYSTEM"]) })),
});
