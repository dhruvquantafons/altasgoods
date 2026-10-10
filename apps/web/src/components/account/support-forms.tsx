"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, Headset, Loader2, Paperclip, PhoneCall, Send, ShieldCheck, Ticket, X } from "lucide-react";
import { loadConversation, replyToConversation, startConversation, uploadTicketAttachment } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/interactive";
import type { CustomerTicket } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Customer help: tickets, chat, Guarantee claims and call-backs are all real
 * conversations with AltasGoods Care, answered from Care Desk.
 */

export interface SupportOrder {
  id: string;
  label: string;
}

type Category = "Delivery" | "Return and refund" | "Payment" | "Product quality" | "Account" | "Other";
const CATEGORIES: Category[] = ["Delivery", "Return and refund", "Payment", "Product quality", "Account", "Other"];
const MB = 1024 * 1024;

function useAutoOpen(flag: boolean | undefined, open: () => void) {
  useEffect(() => {
    if (!flag) return;
    const id = requestAnimationFrame(open);
    return () => cancelAnimationFrame(id);
    // open is stable enough for a one-time auto open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
}

const subjectFrom = (body: string, fallback: string) => {
  const first = body.trim().split(/[.\n]/)[0]!.trim();
  return (first.length >= 5 ? first : fallback).slice(0, 110);
};

/** Uploads files to a new conversation and sends them as one message. */
async function sendFiles(ticketId: string, files: File[]) {
  if (!files.length) return null;
  const ids: string[] = [];
  for (const f of files) {
    const form = new FormData();
    form.set("file", f);
    const r = await uploadTicketAttachment(ticketId, form, true);
    if (!r.ok) return r.error;
    ids.push(r.data.id);
  }
  const r = await replyToConversation(ticketId, files.length === 1 ? "Attached a file" : `Attached ${files.length} files`, ids);
  return r.ok ? null : r.error;
}

function FilePicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg"
        className="sr-only"
        // the visible button below opens it; one control per action for screen readers
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])];
          e.target.value = "";
          if (picked.some((f) => f.size > 4 * MB)) return setError("Each file can be up to 4 MB");
          setError(null);
          setFiles([...files, ...picked].slice(0, 5));
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline">
        <Paperclip size={14} aria-hidden="true" />
        Attach photos or documents
      </button>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white py-1 pr-1 pl-2 text-xs text-ink-800">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 text-ink-400 hover:bg-ink-100">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
    </div>
  );
}

function Done({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
        <CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-ink-900">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-ink-600">{children}</p>
    </div>
  );
}

/** Raise a support ticket about an order or the account. */
export function RaiseTicketButton({
  orders,
  defaultOrderId,
  defaultCategory,
  autoOpen,
  variant = "secondary",
  className,
}: {
  orders: SupportOrder[];
  defaultOrderId?: string;
  defaultCategory?: string;
  autoOpen?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(defaultOrderId ?? "");
  const [category, setCategory] = useState<Category>((CATEGORIES as string[]).includes(defaultCategory ?? "") ? (defaultCategory as Category) : "Delivery");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [contact, setContact] = useState<"chat" | "call" | "email">("email");
  const [done, setDone] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAutoOpen(autoOpen, () => setOpen(true));
  const err = body.trim().length < 15 ? "Describe the problem in a sentence or two." : "";

  async function submit() {
    setTouched(true);
    if (err) return;
    setBusy(true);
    setError(null);
    const pref = contact === "call" ? "Please call me back." : contact === "chat" ? "Please reply in the app." : "Please reply by email.";
    const r = await startConversation({ subject: subjectFrom(body, `${category} question`), category, orderId: orderId || undefined, body: `${body.trim()}\n\n${pref}` });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    const fileError = await sendFiles(r.data.id, files);
    setBusy(false);
    if (fileError) setError(`Ticket ${r.data.id} is open, but a file did not upload: ${fileError}`);
    setDone(r.data.id);
    setBody("");
    setFiles([]);
    router.refresh();
  }

  return (
    <>
      <Button variant={variant} icon={Ticket} className={className} onClick={() => setOpen(true)}>
        Raise a ticket
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(null);
          setTouched(false);
        }}
        size="lg"
        title={done ? "Ticket raised" : "Raise a ticket"}
        description={done ? undefined : "Tell us what happened. Most tickets are answered within 4 hours."}
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button icon={busy ? undefined : Send} disabled={busy} onClick={submit}>
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Submit
              </Button>
            </>
          )
        }
      >
        {done ? (
          <Done title={`Ticket ${done} is open`}>
            {contact === "call" ? "We will call you back within 2 hours." : contact === "chat" ? "An agent will message you in the app shortly." : "We will reply by email within 4 hours."} You can follow it under My tickets.
          </Done>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700 sm:col-span-2">{error}</p>}
            <Field label="Order" htmlFor="tk-order">
              <Select id="tk-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">Not about an order</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic" htmlFor="tk-cat">
              <Select id="tk-cat" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="What happened?" htmlFor="tk-body" error={touched && err ? err : undefined} className="sm:col-span-2">
              <Textarea id="tk-body" className="min-h-28" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder="For example, the package shows delivered but I have not received it." />
            </Field>
            <div className="sm:col-span-2">
              <FilePicker files={files} setFiles={setFiles} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[13px] font-medium text-ink-700">How should we get back to you?</legend>
              <div className="flex flex-wrap gap-2">
                {(["email", "chat", "call"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={contact === c}
                    onClick={() => setContact(c)}
                    className={cn("h-9 rounded-full border px-3.5 text-[13px] font-medium", contact === c ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line-strong text-ink-700 hover:border-ink-400")}
                  >
                    {c === "email" ? "Email" : c === "chat" ? "In-app chat" : "Call me back"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </Modal>
    </>
  );
}

const CLAIM_REASONS = [
  { key: "not_received", label: "Item not received", note: "Available 3 days after the latest promised date. No need to contact us first." },
  { key: "not_as_described", label: "Item damaged, defective or different", note: "Open a return first, then wait 48 hours." },
  { key: "refund_not_issued", label: "Refund not issued", note: "If a refund has not arrived 2 days after we received your return." },
];

/** Ask AltasGoods to file a Guarantee claim (spec 10.10). Care Desk checks it and the store decides. */
export function GuaranteeClaimButton({ orders, defaultOrderId, autoOpen, className }: { orders: SupportOrder[]; defaultOrderId?: string; autoOpen?: boolean; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(defaultOrderId ?? orders[0]?.id ?? "");
  const [reason, setReason] = useState(CLAIM_REASONS[0]!.key);
  const [body, setBody] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAutoOpen(autoOpen, () => setOpen(true));

  async function file() {
    const r0 = CLAIM_REASONS.find((r) => r.key === reason)!;
    setBusy(true);
    setError(null);
    const r = await startConversation({
      subject: `AltasGoods Guarantee claim: ${r0.label.toLowerCase()}`,
      category: reason === "not_received" ? "Delivery" : reason === "refund_not_issued" ? "Payment" : "Product quality",
      orderId,
      body: `AltasGoods Guarantee claim (${r0.label}). ${body.trim()}`,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(r.data.id);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" icon={ShieldCheck} className={className} disabled={!orders.length} onClick={() => setOpen(true)}>
        File a claim
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(null);
        }}
        size="lg"
        title={done ? "Claim received" : "File an AltasGoods Guarantee claim"}
        description={done ? undefined : "For any order, within 90 days of the latest promised delivery date."}
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={body.trim().length < 15 || !orderId || busy} onClick={file}>
                {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                File claim
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col gap-3 text-sm text-ink-600">
            <p className="flex items-center gap-2 font-medium text-success-700">
              <CircleCheck size={18} aria-hidden="true" />
              Claim {done} is with AltasGoods Care
            </p>
            <p>An agent checks it and AltasGoods decides within 7 days and refunds you directly if it goes your way. Follow it under My tickets.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{error}</p>}
            <Field label="Order" htmlFor="gc-order">
              <Select id="gc-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-700">What went wrong?</legend>
              <div className="flex flex-col gap-2">
                {CLAIM_REASONS.map((r) => (
                  <label key={r.key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5", reason === r.key ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:border-line-strong")}>
                    <input type="radio" name="gc-reason" className="mt-0.5 size-4 accent-brand-600" checked={reason === r.key} onChange={() => setReason(r.key)} />
                    <span>
                      <span className="block text-[13.5px] font-medium text-ink-900">{r.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{r.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Tell us what happened" htmlFor="gc-body" hint="Include anything our team told you, if you contacted us">
              <Textarea id="gc-body" className="min-h-24" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

/** A live chat with AltasGoods Care: a CHAT conversation the agent answers from Care Desk. */
export function ChatButton({
  autoOpen,
  orderLabel,
  firstName,
  conversation,
  className,
  variant = "primary",
}: {
  autoOpen?: boolean;
  orderLabel?: string;
  firstName?: string;
  conversation?: CustomerTicket;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<CustomerTicket | undefined>(conversation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAutoOpen(autoOpen, () => setOpen(true));

  // agents answer from Care Desk; check for their replies while the chat is open
  useEffect(() => {
    if (!open || !chat) return;
    const t = setInterval(async () => {
      const r = await loadConversation(chat.id);
      if (r.ok) setChat(r.data);
    }, 8000);
    return () => clearInterval(t);
  }, [open, chat]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const r =
      chat && chat.canReply
        ? await replyToConversation(chat.id, text.trim())
        : await startConversation({ subject: subjectFrom(text, "Chat with AltasGoods Care"), category: "Other", orderId: orderLabel, body: text.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setChat(r.data);
    setMsg("");
  }

  return (
    <>
      <Button variant={variant} icon={Headset} className={className} onClick={() => setOpen(true)}>
        Chat with us
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} side="right" title="AltasGoods Care" description={chat ? `Conversation ${chat.id}` : "An agent picks up within a few minutes"}>
        <div className="flex min-h-full flex-col gap-3">
          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-ink-100 px-3.5 py-2.5 text-[13.5px] text-ink-800">
            Hi{firstName ? ` ${firstName}` : ""}. {orderLabel ? `I can see your order ${orderLabel}. ` : ""}What can I help you with today?
          </div>
          {!chat && (
            <div className="flex flex-wrap gap-2">
              {["Where is my order?", "Return an item", "Refund status", "Talk to an agent"].map((q) => (
                <button key={q} type="button" disabled={busy} onClick={() => send(q)} className="h-8 rounded-full border border-brand-200 px-3 text-[13px] font-medium text-brand-700 hover:bg-brand-50">
                  {q}
                </button>
              ))}
            </div>
          )}
          {chat?.messages.map((m) => (
            <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] whitespace-pre-line", m.kind === "CUSTOMER" ? "ml-auto rounded-tr-md bg-brand-600 text-white" : m.kind === "SYSTEM" ? "mx-auto bg-transparent text-center text-xs text-ink-500" : "rounded-tl-md bg-ink-100 text-ink-800")}>
              {m.kind === "AGENT" && <span className="mb-0.5 block text-xs font-semibold text-ink-600">{m.author}</span>}
              {m.body}
            </div>
          ))}
          {chat && chat.messages.every((m) => m.kind === "CUSTOMER") && <p className="text-xs text-ink-500">Thanks. An agent can see your message and will reply here. You can close this window; we keep the conversation under My tickets.</p>}
          {chat && !chat.canReply && <p className="text-xs text-ink-500">This conversation is closed. Send a message to start a new one.</p>}
          {error && <p className="text-xs text-danger-700">{error}</p>}
          <form
            className="mt-auto flex items-center gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(msg);
            }}
          >
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Type a message"
              aria-label="Message"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
            <Button type="submit" size="icon" icon={busy ? Loader2 : Send} disabled={busy || !msg.trim()} aria-label="Send message" />
          </form>
        </div>
      </Modal>
    </>
  );
}

/** Reply to one of my tickets (a reply also reopens a resolved one). */
export function TicketReplyButton({ ticketId, label, reopen }: { ticketId: string; label: string; reopen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await replyToConversation(ticketId, body.trim());
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    const fileError = await sendFiles(ticketId, files);
    setBusy(false);
    if (fileError) return setError(fileError);
    setOpen(false);
    setBody("");
    setFiles([]);
    router.refresh();
  }

  return (
    <>
      <Button size="xs" variant={reopen ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={reopen ? `Reopen ${ticketId}` : `Reply to ${ticketId}`}
        description={reopen ? "Tell us what is still wrong and the ticket goes back to the team." : "Your reply goes straight to the agent on this ticket."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button icon={busy ? undefined : Send} disabled={busy || body.trim().length < 2} onClick={send}>
              {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Send
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{error}</p>}
          <Field label="Message" htmlFor={`reply-${ticketId}`}>
            <Textarea id={`reply-${ticketId}`} className="min-h-24" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} />
          </Field>
          <FilePicker files={files} setFiles={setFiles} />
        </div>
      </Modal>
    </>
  );
}

/** Books a call-back: a phone conversation the Care Desk calls back on. */
export function CallBackButton({ phone, className }: { phone: string; className?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="ghost"
        icon={state === "busy" ? Loader2 : PhoneCall}
        className={className}
        disabled={state !== "idle"}
        onClick={async () => {
          setState("busy");
          const r = await startConversation({ subject: "Call-back requested", category: "Other", body: `Please call me back on ${phone}.`, channel: "PHONE" });
          if (!r.ok) {
            setState("idle");
            return setError(r.error);
          }
          setState("done");
          router.refresh();
        }}
      >
        {state === "done" ? "Call-back booked" : "Request a call-back"}
      </Button>
      {state === "done" && <p className="mt-1 text-center text-xs text-brand-100">We will call {phone} within 15 minutes.</p>}
      {error && <p className="mt-1 text-center text-xs text-danger-100">{error}</p>}
    </div>
  );
}
