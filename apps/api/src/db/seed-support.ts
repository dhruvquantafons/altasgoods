/**
 * Care Desk history: the care team as staff accounts, and the web demo's
 * tickets with their conversations, moved forward in time so they are as
 * fresh relative to now as they were relative to the demo clock.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Db } from "./client.js";
import { DEMO_CUSTOMER_PHONE, DEMO_SUPERVISOR_PHONE, careAgentPhone } from "./demo.js";
import * as t from "./schema.js";

const WEB_MOCK = new URL("../../../web/src/lib/mock/", import.meta.url);
const WEB_LIB = new URL("../../../web/src/lib/", import.meta.url);

interface MockTicket {
  id: string;
  subject: string;
  customerName: string;
  orderId?: string;
  category: t.TicketCategory;
  channel: "chat" | "email" | "phone" | "app";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "awaiting_customer" | "escalated" | "resolved" | "closed";
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}
interface MockThreadEntry { kind: "customer" | "agent" | "system" | "note"; author: string; body: string; at: string }
interface MockOrder { id: string; total: number; payment: { method: string }; items: { id: string; title: string; price: number; quantity: number; sellerId: string }[] }

const STATUS: Record<MockTicket["status"], t.TicketStatus> = {
  open: "NEW",
  in_progress: "OPEN",
  awaiting_customer: "PENDING_CUSTOMER",
  escalated: "ESCALATED",
  resolved: "RESOLVED",
  closed: "CLOSED",
};

export async function seedSupport(db: Db, owners: { phone: string; id: string }[]) {
  const load = (base: URL, f: string) => import(pathToFileURL(fileURLToPath(new URL(f, base))).href);
  const [ops, engagement, orderMod, _logistics, people, status, utils] = await Promise.all([
    load(WEB_MOCK, "ops-extra.ts"),
    load(WEB_MOCK, "engagement.ts"),
    load(WEB_MOCK, "orders.ts"),
    load(WEB_MOCK, "logistics.ts"),
    load(WEB_MOCK, "people.ts"),
    load(WEB_LIB, "status.ts"),
    load(WEB_LIB, "utils.ts"),
  ]);
  const careAgents = ops.careAgents as { name: string; fullName: string; level: "L1" | "L2" | "Supervisor" }[];
  const supervisor = ops.SUPERVISOR as { name: string };
  const tickets = engagement.tickets as MockTicket[];
  const ticketThread = ops.ticketThread as (x: MockTicket) => MockThreadEntry[];
  const ticketCustomer = ops.ticketCustomer as (x: MockTicket) => { id: string; name: string } | undefined;
  const getOrder = orderMod.getOrder as (id: string) => MockOrder | undefined;
  const customers = people.customers as { id: string; name: string }[];
  const paymentLabel = status.PAYMENT_METHOD as Record<string, string>;
  const demoNow = (utils.NOW as Date).getTime();
  const shift = Date.now() - demoNow;
  const at = (iso: string) => new Date(new Date(iso).getTime() + shift);

  // the care team signs in like any other staff member
  const agentRows = await db
    .insert(t.users)
    .values([
      ...careAgents.map((a, i) => ({
        phone: careAgentPhone(i),
        name: a.fullName,
        email: `${a.fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@altasgoods.in`,
        emailVerifiedAt: new Date(),
        staffRoles: [a.level === "L2" ? "SUPPORT_SPECIALIST" : "SUPPORT_AGENT"] as t.StaffRole[],
      })),
      { phone: DEMO_SUPERVISOR_PHONE, name: supervisor.name, email: "arvind.menon@altasgoods.in", emailVerifiedAt: new Date(), staffRoles: ["SUPPORT_SUPERVISOR"] as t.StaffRole[] },
    ])
    .returning({ id: t.users.id, name: t.users.name });
  const agentId = new Map(careAgents.map((a, i) => [a.name, agentRows[i]!.id]));

  // the demo shopper's tickets belong to her account, so she sees them in My Account
  const demoUser = owners.find((o) => o.phone === DEMO_CUSTOMER_PHONE);
  const demoName = customers[0]?.name;

  for (const mt of tickets) {
    const thread = ticketThread(mt);
    const order = mt.orderId ? getOrder(mt.orderId) : undefined;
    const customer = ticketCustomer(mt);
    const firstAgent = thread.find((m) => m.kind === "agent");
    const lastCustomer = [...thread].reverse().find((m) => m.kind === "customer");
    const st = STATUS[mt.status] === "NEW" && mt.assignee ? "OPEN" : STATUS[mt.status];
    await db.insert(t.supportTickets).values({
      id: mt.id,
      subject: mt.subject,
      // the demo data has seller disputes, which a single store files under Other
      category: ((mt.category as string) === "Seller dispute" ? "Other" : mt.category) as t.TicketCategory,
      channel: mt.channel.toUpperCase() as t.TicketChannel,
      priority: mt.priority.toUpperCase() as t.TicketPriority,
      status: st,
      customerName: mt.customerName,
      customerRef: customer?.id ?? null,
      userId: demoUser && mt.customerName === demoName ? demoUser.id : null,
      orderId: mt.orderId ?? null,
      orderSnapshot: order
        ? {
            total: order.total,
            paymentLabel: paymentLabel[order.payment.method] ?? order.payment.method,
            cod: order.payment.method === "cod",
            items: order.items.map((i) => ({ id: i.id, title: i.title, price: i.price, quantity: i.quantity })),
          }
        : null,
      assigneeId: mt.assignee ? (agentId.get(mt.assignee) ?? null) : null,
      firstResponseAt: firstAgent ? at(firstAgent.at) : null,
      lastCustomerAt: lastCustomer ? at(lastCustomer.at) : null,
      resolvedAt: st === "RESOLVED" || st === "CLOSED" ? at(mt.updatedAt) : null,
      createdAt: at(mt.createdAt),
      updatedAt: at(thread.at(-1)?.at ?? mt.updatedAt),
    });
    await db.insert(t.supportMessages).values(
      thread.map((m) => ({ ticketId: mt.id, kind: m.kind.toUpperCase() as "CUSTOMER" | "AGENT" | "SYSTEM" | "NOTE", author: m.author, body: m.body, at: at(m.at) })),
    );
    await db.insert(t.supportEvents).values({ ticketId: mt.id, type: "CREATED", toValue: st, actor: mt.customerName, at: at(mt.createdAt) });
  }
  return { tickets: tickets.length, agents: agentRows.length };
}
