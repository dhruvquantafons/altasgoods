"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Loader2, MessageSquarePlus } from "lucide-react";
import { openTicketForCustomer } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/interactive";
import { CATEGORIES } from "./meta";

type Category = (typeof CATEGORIES)[number];
type Snapshot = { total: number; paymentLabel: string; cod: boolean; items: { id: string; title: string; price: number; quantity: number }[] };

/** Opens a real ticket for a customer (a phone call, an order lookup) and goes to it. */
export function NewTicketButton({
  customerName,
  customerRef,
  orderId,
  orderSnapshot,
  label = "New ticket",
  variant = "primary",
  size = "md",
  defaultCategory = "Other",
  defaultSubject,
  defaultBody = "",
}: {
  customerName: string;
  customerRef?: string;
  orderId?: string;
  orderSnapshot?: Snapshot;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  defaultCategory?: Category;
  defaultSubject?: string;
  defaultBody?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject ?? (orderId ? `Order ${orderId}` : ""));
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [channel, setChannel] = useState<"PHONE" | "EMAIL" | "CHAT" | "APP">("PHONE");
  const [body, setBody] = useState(defaultBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const r = await openTicketForCustomer({ subject: subject.trim(), category, channel, customerName, customerRef, orderId, orderSnapshot, body: body.trim() });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.push(`/support/tickets/${r.data.id}`);
  }

  return (
    <>
      <Button variant={variant} size={size} icon={label === "New ticket" || label === "Create ticket" ? MessageSquarePlus : undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`New ticket for ${customerName}`}
        description={orderId ? `Linked to order ${orderId}. It opens assigned to you.` : "It opens assigned to you."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || subject.trim().length < 5 || body.trim().length < 5} onClick={create}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Create ticket
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
              {error}
            </p>
          )}
          <Field label="Subject" htmlFor="nt-subject" required>
            <Input id="nt-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="nt-category">
              <Select id="nt-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contact channel" htmlFor="nt-channel">
              <Select id="nt-channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="CHAT">Chat</option>
                <option value="APP">App</option>
              </Select>
            </Field>
          </div>
          <Field label="What the customer reported" htmlFor="nt-body" required hint="Saved as an internal note on the ticket">
            <Textarea id="nt-body" value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/** Shows a masked contact in full on request. */
export function RevealContact({ phone, email }: { phone: string; email: string }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    <span className="rounded-lg border border-line bg-white px-3 py-2 font-mono text-[13px] text-ink-800">
      {phone}, {email}
    </span>
  ) : (
    <Button variant="secondary" icon={Eye} onClick={() => setShown(true)}>
      Reveal contact
    </Button>
  );
}
