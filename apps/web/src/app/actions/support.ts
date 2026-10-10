"use server";

import { revalidatePath } from "next/cache";
import { api, authHeader } from "@/lib/api/server";
import { apiUrl } from "@/lib/api/session";
import type { CustomerTicket, TicketDetail } from "@/lib/api/types";

/** Care Desk and customer help actions. The API checks roles and ownership on every call. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
type Attachment = { id: string; name: string; mimeType: string; sizeBytes: number };
type ActionInput =
  | { kind: "REFUND"; amountPaise: number; destination: "SOURCE" | "CREDITS"; reason: "damaged" | "not_delivered" | "wrong" | "late" | "goodwill" }
  | { kind: "REPLACEMENT"; itemId: string; reason: "damaged" | "defective" | "wrong" | "missing"; collectOriginal: boolean }
  | { kind: "GUARANTEE_CLAIM"; claimType: "not_delivered" | "damaged" | "wrong" | "different" };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};
const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment." };

async function call<T>(fn: () => Promise<{ data?: T; error?: unknown }>, fallback: string, paths: string[] = []): Promise<Result<T>> {
  try {
    const r = await fn();
    if (r.data === undefined) return fail(r.error, fallback);
    for (const p of paths) revalidatePath(p);
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

const staffPaths = (id: string) => [`/support/tickets/${id}`, "/support/tickets", "/support"];
const path = (id: string) => ({ params: { path: { id } } });

export async function updateTicket(id: string, change: { status?: TicketDetail["status"]; priority?: TicketDetail["priority"]; assigneeId?: string | null }): Promise<Result<TicketDetail>> {
  return call(async () => (await api()).PATCH("/v1/support/tickets/{id}", { ...path(id), body: change }), "Could not update the ticket", staffPaths(id));
}

export async function assignTickets(ids: string[], assigneeId: string | null): Promise<Result<{ updated: number }>> {
  return call(async () => (await api()).POST("/v1/support/tickets/assign", { body: { ids, assigneeId } }), "Could not assign the tickets", ["/support/tickets", "/support"]);
}

export async function sendTicketMessage(id: string, input: { kind: "REPLY" | "NOTE"; body: string; statusAfter?: "PENDING_CUSTOMER" | "OPEN" | "RESOLVED"; attachmentIds: string[] }): Promise<Result<TicketDetail>> {
  return call(async () => (await api()).POST("/v1/support/tickets/{id}/messages", { ...path(id), body: input }), "Could not send", staffPaths(id));
}

export async function runTicketAction(id: string, input: ActionInput): Promise<Result<TicketDetail>> {
  return call(async () => (await api()).POST("/v1/support/tickets/{id}/actions", { ...path(id), body: input }), "Could not complete the action", staffPaths(id));
}

export async function decideTicketAction(ticketId: string, actionId: string, approve: boolean, note?: string): Promise<Result<TicketDetail>> {
  return call(
    async () => (await api()).POST(approve ? "/v1/support/actions/{id}/approve" : "/v1/support/actions/{id}/reject", { ...path(actionId), body: { note: note || undefined } }),
    approve ? "Could not approve" : "Could not reject",
    staffPaths(ticketId),
  );
}

export async function openTicketForCustomer(input: {
  subject: string;
  category: "Delivery" | "Return and refund" | "Payment" | "Product quality" | "Account" | "Other";
  channel: "CHAT" | "EMAIL" | "PHONE" | "APP";
  customerName: string;
  customerRef?: string;
  orderId?: string;
  orderSnapshot?: { total: number; paymentLabel: string; cod: boolean; items: { id: string; title: string; price: number; quantity: number }[] };
  body: string;
}): Promise<Result<TicketDetail>> {
  return call(async () => (await api()).POST("/v1/support/tickets", { body: input }), "Could not open the ticket", ["/support/tickets", "/support"]);
}

/** Uploads one file to a ticket; the form carries `file`. Staff or the ticket's customer. */
export async function uploadTicketAttachment(id: string, form: FormData, asCustomer = false): Promise<Result<Attachment>> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a file to attach" };
  const body = new FormData();
  body.set("file", file, file.name);
  try {
    const r = await fetch(`${apiUrl()}/v1/${asCustomer ? "me/support" : "support"}/tickets/${encodeURIComponent(id)}/attachments`, { method: "POST", headers: await authHeader(), body, cache: "no-store" });
    const json = await r.json().catch(() => null);
    return r.ok ? { ok: true, data: json as Attachment } : fail(json, r.status === 413 ? "That file is too large" : "Could not attach this file");
  } catch {
    return offline;
  }
}

/* ------------------------------ Customers ----------------------------- */

export async function startConversation(input: { subject: string; category: "Delivery" | "Return and refund" | "Payment" | "Product quality" | "Account" | "Other"; orderId?: string; body: string; channel?: "CHAT" | "PHONE" }): Promise<Result<CustomerTicket>> {
  return call(async () => (await api()).POST("/v1/me/support/tickets", { body: { ...input, channel: input.channel ?? "CHAT" } }), "Could not start the conversation", ["/account/support"]);
}

export async function loadConversation(id: string): Promise<Result<CustomerTicket>> {
  return call(async () => (await api()).GET("/v1/me/support/tickets/{id}", path(id)), "Could not load the conversation");
}

export async function replyToConversation(id: string, body: string, attachmentIds: string[] = []): Promise<Result<CustomerTicket>> {
  return call(async () => (await api()).POST("/v1/me/support/tickets/{id}/messages", { ...path(id), body: { body, attachmentIds } }), "Could not send your message", ["/account/support"]);
}
