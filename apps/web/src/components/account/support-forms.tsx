"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Headset, Paperclip, Send, ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

export interface SupportOrder {
  id: string;
  label: string;
}

function useAutoOpen(flag: boolean | undefined, open: () => void) {
  useEffect(() => {
    if (!flag) return;
    const id = requestAnimationFrame(open);
    return () => cancelAnimationFrame(id);
    // open is stable enough for a one-time auto open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag]);
}

const CATEGORIES = ["Delivery", "Return and refund", "Payment", "Product quality", "Account", "Seller dispute", "Other"];

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
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(defaultOrderId ?? orders[0]?.id ?? "");
  const [category, setCategory] = useState(defaultCategory ?? "Delivery");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState(0);
  const [contact, setContact] = useState<"chat" | "call" | "email">("email");
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);
  useAutoOpen(autoOpen, () => setOpen(true));
  const err = body.trim().length < 15 ? "Describe the problem in a sentence or two." : "";
  return (
    <>
      <Button variant={variant} icon={Ticket} className={className} onClick={() => setOpen(true)}>
        Raise a ticket
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(false);
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
              <Button
                icon={Send}
                onClick={() => {
                  setTouched(true);
                  if (!err) setDone(true);
                }}
              >
                Submit
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-ink-900">
              Ticket <span className="font-mono">TK-60431</span> is open
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-ink-600">
              {contact === "call" ? "We will call you back within 2 hours." : contact === "chat" ? "An agent will message you in the app shortly." : "We will reply by email within 4 hours."} You can follow it under My tickets.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Select id="tk-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="What happened?" htmlFor="tk-body" error={touched && err ? err : undefined} className="sm:col-span-2">
              <Textarea id="tk-body" className="min-h-28" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder="For example, the package shows delivered but I have not received it." />
            </Field>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => setFiles((f) => Math.min(5, f + 1))}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline"
              >
                <Paperclip size={14} aria-hidden="true" />
                Attach photos or documents
              </button>
              {files > 0 && <span className="ml-2 text-xs text-ink-500">{files} attached</span>}
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
  { key: "not_received", label: "Item not received", note: "Available 3 days after the latest promised date. No need to contact the seller first." },
  { key: "not_as_described", label: "Item damaged, defective or different", note: "Contact the seller or open a return first, then wait 48 hours." },
  { key: "refund_not_issued", label: "Refund not issued", note: "If a refund has not arrived 2 days after the seller received your return." },
];

/** File a BluBuy Guarantee claim (spec 10.10). */
export function GuaranteeClaimButton({ orders, defaultOrderId, autoOpen, className }: { orders: SupportOrder[]; defaultOrderId?: string; autoOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(defaultOrderId ?? orders[0]?.id ?? "");
  const [reason, setReason] = useState(CLAIM_REASONS[0]!.key);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  useAutoOpen(autoOpen, () => setOpen(true));
  return (
    <>
      <Button variant="secondary" icon={ShieldCheck} className={className} onClick={() => setOpen(true)}>
        File a claim
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(false);
        }}
        size="lg"
        title={done ? "Claim filed" : "File a BluBuy Guarantee claim"}
        description={done ? undefined : "For orders from any seller, within 90 days of the latest promised delivery date."}
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={body.trim().length < 15 || !orderId} onClick={() => setDone(true)}>
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
              Claim GC-11204 is with the seller
            </p>
            <p>The seller has 72 hours to respond with a refund or evidence. If they do not, we grant the claim automatically. Either way, BluBuy decides within 7 days and refunds you directly if it goes your way.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
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
            <Field label="Tell us what happened" htmlFor="gc-body" hint="Include what the seller said, if you contacted them">
              <Textarea id="gc-body" className="min-h-24" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Start a chat with BluBuy Care (bot first, then an agent). */
export function ChatButton({ autoOpen, orderLabel, className, variant = "primary" }: { autoOpen?: boolean; orderLabel?: string; className?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  useAutoOpen(autoOpen, () => setOpen(true));
  return (
    <>
      <Button variant={variant} icon={Headset} className={className} onClick={() => setOpen(true)}>
        Chat with us
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} side="right" title="BluBuy Care" description="Usually replies in under a minute">
        <div className="flex min-h-full flex-col gap-3">
          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-ink-100 px-3.5 py-2.5 text-[13.5px] text-ink-800">
            Hi Ananya. {orderLabel ? `I can see your order ${orderLabel}. ` : ""}What can I help you with today?
          </div>
          <div className="flex flex-wrap gap-2">
            {["Where is my order?", "Return an item", "Refund status", "Talk to an agent"].map((q) => (
              <button key={q} type="button" onClick={() => setSent((s) => [...s, q])} className="h-8 rounded-full border border-brand-200 px-3 text-[13px] font-medium text-brand-700 hover:bg-brand-50">
                {q}
              </button>
            ))}
          </div>
          {sent.map((s, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2.5 text-[13.5px] text-white">{s}</div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-ink-100 px-3.5 py-2.5 text-[13.5px] text-ink-800">
                Thanks. I am connecting you with an agent who can see your recent orders. Average wait is under a minute.
              </div>
            </div>
          ))}
          <form
            className="mt-auto flex items-center gap-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!msg.trim()) return;
              setSent((s) => [...s, msg.trim()]);
              setMsg("");
            }}
          >
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Type a message"
              aria-label="Message"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
            <Button type="submit" size="icon" icon={Send} aria-label="Send message" />
          </form>
        </div>
      </Modal>
    </>
  );
}
