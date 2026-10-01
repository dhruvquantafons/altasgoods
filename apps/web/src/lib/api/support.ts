import "server-only";
import { cache } from "react";
import { PRIORITY_POLICY, type TicketSla } from "@/lib/mock/ops-extra";
import type { TicketPriority, TicketStatus as UiStatus } from "@/lib/status";
import type { Ticket } from "@/lib/types";
import { UI_TICKET_STATUS } from "@/lib/support-status";
import { api, unwrap } from "./server";
import type { ApiTicketStatus, TicketDetail, TicketSummary } from "./types";

export { UI_TICKET_STATUS };
export const API_TICKET_STATUS = Object.fromEntries(Object.entries(UI_TICKET_STATUS).map(([k, v]) => [v, k])) as Record<UiStatus, ApiTicketStatus>;

const ACTIVE: UiStatus[] = ["open", "in_progress", "awaiting_customer", "pending_internal", "escalated", "reopened"];
export const isActiveTicket = (t: { status: UiStatus }) => ACTIVE.includes(t.status);

/** A ticket in the shape the Care Desk screens use, plus what the API adds. */
export type CareTicket = Omit<Ticket, "status" | "messages"> & {
  status: UiStatus;
  assigneeId?: string;
  customerRef?: string;
  firstResponseAt?: string;
  lastCustomerAt?: string;
  lastMessage?: { kind: string; author: string; body: string; at: string };
  messages: Ticket["messages"];
};

export function toCareTicket(s: TicketSummary): CareTicket {
  const priority = s.priority.toLowerCase() as TicketPriority;
  const base = Date.parse(s.lastCustomerAt ?? s.createdAt);
  return {
    id: s.id,
    subject: s.subject,
    customerName: s.customerName,
    customerRef: s.customerRef ?? undefined,
    orderId: s.orderId ?? undefined,
    category: s.category as Ticket["category"],
    channel: s.channel.toLowerCase() as Ticket["channel"],
    priority,
    status: UI_TICKET_STATUS[s.status],
    assignee: s.assignee?.name,
    assigneeId: s.assignee?.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    slaDueAt: new Date(base + PRIORITY_POLICY[priority].firstResponseMins * 60_000).toISOString(),
    firstResponseAt: s.firstResponseAt ?? undefined,
    lastCustomerAt: s.lastCustomerAt ?? undefined,
    lastMessage: s.lastMessage ?? undefined,
    messages: [],
  };
}

/**
 * SLA against the real clock (spec 11.11): the next reply is due a priority's
 * response time after the customer's latest message; it is met once an agent
 * has answered, and paused while waiting on the customer or the team.
 */
export function slaOf(t: CareTicket, now = Date.now()): TicketSla {
  const p = PRIORITY_POLICY[t.priority];
  const created = Date.parse(t.createdAt);
  const resolutionDue = created + p.resolutionHours * 3600_000;
  const lastCustomer = t.lastCustomerAt ? Date.parse(t.lastCustomerAt) : created;
  const due = lastCustomer + p.firstResponseMins * 60_000;
  const minsLeft = Math.round((due - now) / 60_000);
  const answered = t.lastMessage?.kind === "AGENT" && Date.parse(t.lastMessage.at) >= lastCustomer;
  const paused = t.status === "awaiting_customer" || t.status === "pending_internal";
  const active = isActiveTicket(t);
  const state: TicketSla["state"] = !active || answered ? "met" : paused ? "paused" : minsLeft < 0 ? "breached" : minsLeft < 60 ? "at_risk" : "on_track";
  return {
    code: p.code,
    dueAt: new Date(due).toISOString(),
    minsLeft,
    resolutionDueAt: new Date(resolutionDue).toISOString(),
    resolutionBreached: active && now > resolutionDue,
    firstResponseDueAt: new Date(created + p.firstResponseMins * 60_000).toISOString(),
    respondedAt: t.firstResponseAt,
    paused,
    state,
  };
}

type Query = { view?: "open" | "mine" | "unassigned" | "escalated" | "awaiting" | "resolved" | "all"; q?: string; priority?: string; category?: string; channel?: string; customerRef?: string; orderId?: string };

/** Tickets from the API, with the queue counts. Cached per request and query. */
export const loadTickets = cache(async (key: string) => {
  const query = JSON.parse(key) as Query;
  const r = unwrap(
    await (await api()).GET("/v1/support/tickets", {
      params: {
        query: {
          view: query.view ?? "all",
          q: query.q || undefined,
          priority: (query.priority?.toUpperCase() || undefined) as "LOW" | "NORMAL" | "HIGH" | "URGENT" | undefined,
          category: query.category || undefined,
          channel: (query.channel?.toUpperCase() || undefined) as "CHAT" | "EMAIL" | "PHONE" | "APP" | undefined,
          customerRef: query.customerRef || undefined,
          orderId: query.orderId || undefined,
          pageSize: 300,
        },
      },
    }),
  );
  return { tickets: r.items.map(toCareTicket), counts: r.counts };
});

export const tickets = (q: Query = {}) => loadTickets(JSON.stringify(q));

export async function loadTicket(id: string): Promise<{ ticket: CareTicket; detail: TicketDetail }> {
  const detail = unwrap(await (await api()).GET("/v1/support/tickets/{id}", { params: { path: { id } } }), { notFoundOn404: true });
  return { ticket: { ...toCareTicket(detail), lastMessage: detail.lastMessage ?? undefined }, detail };
}

/** The time live data is judged against (kept out of render bodies). */
export const currentTime = () => Date.now();

export const loadAgents = cache(async () => unwrap(await (await api()).GET("/v1/support/agents")));
