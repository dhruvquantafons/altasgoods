"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeIndianRupee, MapPinPen, RotateCw, Undo2 } from "lucide-react";
import { addOrderNote, createOrderRefund, markRefundPaid, markReturnRefundPaid, retryRefund, updateOrderAddress, type OrderAddressInput } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input, Radio, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { paise, rupeeInputToPaise } from "@/lib/api/format";
import type { AdminOrder, AdminRefund, OrderNote } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils";

/** A UTR or UPI reference, as the API accepts it. */
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,59}$/;
const referenceError = (v: string) => (REFERENCE.test(v.trim()) ? null : "Enter the UTR or UPI reference, 4 to 60 letters or digits");

/* --------------------------------- Refund --------------------------------- */

/** "Refund" on the order page: a goodwill refund to the payment method, or a record of a payout the store already made. */
export function OrderRefund({ order }: { order: Pick<AdminOrder, "id" | "paymentMethod" | "refundLimit" | "items"> }) {
  const router = useRouter();
  const toast = useToast();
  const { source, maxPaise } = order.refundLimit;
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"SOURCE" | "MANUAL">(source ? "SOURCE" : "MANUAL");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [line, setLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountPaise = rupeeInputToPaise(amount);
  const amountError = amount && (amountPaise === null ? "Enter an amount in rupees, such as 499 or 499.50" : amountPaise > maxPaise ? `At most ${paise(maxPaise)} is left to refund` : null);
  const refError = method === "MANUAL" && reference ? referenceError(reference) : null;
  const ready = amountPaise !== null && amountPaise <= maxPaise && reason.trim().length >= 3 && (method === "SOURCE" || (reference && !refError));

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    if (!ready || amountPaise === null) return;
    setBusy(true);
    setError(null);
    const r = await createOrderRefund(order.id, { amountPaise, reason: reason.trim(), method, reference: reference.trim() || undefined, orderItemId: line || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    setAmount("");
    setReason("");
    setReference("");
    toast.show(method === "SOURCE" ? "Refund started. It goes back to the customer's payment method." : "Manual refund recorded.");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" icon={Undo2} disabled={maxPaise <= 0} title={maxPaise <= 0 ? "Nothing is left to refund on this order" : undefined} onClick={() => setOpen(true)}>
        Refund
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Refund this order"
        description={`Up to ${paise(maxPaise)} can be refunded${order.paymentMethod === "COD" ? ": what was collected on delivery and not yet refunded" : ""}.`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy || !ready} onClick={submit}>
              {method === "SOURCE" ? "Refund" : "Record refund"}
              {amountPaise && amountPaise <= maxPaise ? ` ${paise(amountPaise)}` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-2.5">
            <legend className="mb-1.5 text-[13px] font-medium text-ink-700">How</legend>
            <Radio
              name="refund-method"
              checked={method === "SOURCE"}
              disabled={!source}
              onChange={() => setMethod("SOURCE")}
              label="To the original payment method"
              description={source ? "Sent through the payment gateway. Banks usually take 5 to 7 working days." : "Only for orders paid online"}
            />
            <Radio
              name="refund-method"
              checked={method === "MANUAL"}
              onChange={() => setMethod("MANUAL")}
              label="Already paid by UPI or bank transfer"
              description="Records money the store sent itself, with its reference. Nothing goes through the gateway."
            />
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount in rupees" htmlFor="refund-amount" required error={amountError || undefined} hint={`Up to ${paise(maxPaise)}`}>
              <Input id="refund-amount" inputMode="decimal" placeholder="499" value={amount} aria-invalid={!!amountError} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="For" htmlFor="refund-line">
              <Select id="refund-line" value={line} onChange={(e) => setLine(e.target.value)}>
                <option value="">The whole order</option>
                {order.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {method === "MANUAL" && (
            <Field label="UTR or UPI reference" htmlFor="refund-reference" required error={refError || undefined} hint="From the bank or UPI app you paid with">
              <Input id="refund-reference" value={reference} maxLength={60} aria-invalid={!!refError} onChange={(e) => setReference(e.target.value)} />
            </Field>
          )}
          <Field label="Reason" htmlFor="refund-reason" required hint="For the team. The customer sees it as a refund from AltasGoods.">
            <Textarea id="refund-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <p className="text-[13px] text-danger-600">{error}</p>}
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

/* ---------------------------- Refund row actions --------------------------- */

/**
 * Retry for a refund the gateway failed or could not confirm, and Mark paid
 * for a manual refund waiting for its payout. Shown only to roles that may act.
 */
export function RefundActions({ refund }: { refund: Pick<AdminRefund, "id" | "orderId" | "amountPaise" | "status"> & { method: "SOURCE" | "MANUAL" } }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"retry" | "paid" | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const retryable = refund.method === "SOURCE" && (refund.status === "FAILED" || refund.status === "NEEDS_ATTENTION");
  const payable = refund.method === "MANUAL" && refund.status === "PENDING";
  if (!retryable && !payable) return null;
  const refError = reference ? referenceError(reference) : null;

  function close() {
    setDialog(null);
    setError(null);
  }

  async function run(call: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setBusy(true);
    setError(null);
    const r = await call();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDialog(null);
    setReference("");
    toast.show(done);
    router.refresh();
  }

  return (
    <>
      {retryable && (
        <Button size="xs" variant="soft" icon={RotateCw} onClick={() => setDialog("retry")}>
          Retry
        </Button>
      )}
      {payable && (
        <Button size="xs" variant="soft" icon={BadgeIndianRupee} onClick={() => setDialog("paid")}>
          Mark paid
        </Button>
      )}
      <Modal
        open={dialog === "retry"}
        onClose={close}
        title={`Send the ${paise(refund.amountPaise)} refund again`}
        description="It goes to the gateway again under the same receipt, so it is never paid twice."
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => run(() => retryRefund(refund.id, refund.orderId), "Sent to the gateway again.")}>
              Retry refund
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] leading-relaxed text-ink-700">
          <p>First look this refund up in the payment gateway&apos;s dashboard, by the order or the payment.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>If the gateway shows no refund, or one that is processed or pending, retry: it is recorded as the gateway has it.</li>
            <li>
              If the gateway shows this refund as <strong>failed</strong>, retrying will not help, because the gateway reports the same failed refund again. Issue a new refund from the order page instead.
            </li>
          </ul>
          {error && <p className="text-danger-600">{error}</p>}
        </div>
      </Modal>
      <Modal
        open={dialog === "paid"}
        onClose={close}
        title={`Record the ${paise(refund.amountPaise)} payout`}
        description="Pay the customer by UPI or bank transfer first, then record the payment's reference here."
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button disabled={busy || !reference || !!refError} onClick={() => run(() => markRefundPaid(refund.id, refund.orderId, reference.trim()), "Payout recorded. The refund is complete.")}>
              Mark paid
            </Button>
          </>
        }
      >
        <Field label="UTR or UPI reference" htmlFor={`paid-${refund.id}`} required error={refError || error || undefined}>
          <Input id={`paid-${refund.id}`} value={reference} maxLength={60} aria-invalid={!!refError} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </>
  );
}

/** "Mark refund paid" on a return whose bank (UPI) refund waits for the store's payout. */
export function ReturnRefundPaid({ id, amountPaise, upi }: { id: string; amountPaise: number; upi: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refError = reference ? referenceError(reference) : null;

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await markReturnRefundPaid(id, reference.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.show("Payout recorded. The refund is complete.");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" icon={BadgeIndianRupee} onClick={() => setOpen(true)}>
        Mark refund paid
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record the ${paise(amountPaise)} payout`}
        description={upi ? `Send ${paise(amountPaise)} to ${upi} by UPI first, then record the payment's reference here.` : "Pay the customer first, then record the payment's reference here."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !reference || !!refError} onClick={submit}>
              Mark paid
            </Button>
          </>
        }
      >
        <Field label="UTR or UPI reference" htmlFor={`return-paid-${id}`} required error={refError || error || undefined}>
          <Input id={`return-paid-${id}`} value={reference} maxLength={60} aria-invalid={!!refError} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </>
  );
}

/* --------------------------------- Address -------------------------------- */

type AddressForm = Omit<OrderAddressInput, "line2" | "landmark"> & { line2: string; landmark: string };
const ADDRESS_FIELDS: { key: keyof AddressForm; label: string; required?: boolean; wide?: boolean; inputMode?: "numeric" | "tel" }[] = [
  { key: "name", label: "Name", required: true },
  { key: "phone", label: "Mobile number", required: true, inputMode: "tel" },
  { key: "line1", label: "House, building and street", required: true, wide: true },
  { key: "line2", label: "Area or locality", wide: true },
  { key: "landmark", label: "Landmark" },
  { key: "pincode", label: "Pincode", required: true, inputMode: "numeric" },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State", required: true },
];

/** "Edit address" while the courier does not have the parcel yet. The API checks the pincode and shows why it refuses. */
export function OrderAddressEdit({ orderId, address }: { orderId: string; address: AdminOrder["address"] & { type?: string } }) {
  const router = useRouter();
  const toast = useToast();
  const initial: AddressForm = {
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    landmark: address.landmark ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    type: address.type === "WORK" || address.type === "OTHER" ? address.type : "HOME",
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddressForm>(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    const r = await updateOrderAddress(orderId, form);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setFields(r.fields ?? {});
      return;
    }
    setOpen(false);
    toast.show("Delivery address changed.");
    router.refresh();
  }

  return (
    <>
      <Button
        size="xs"
        variant="ghost"
        icon={MapPinPen}
        onClick={() => {
          setForm(initial);
          setFields({});
          setError(null);
          setOpen(true);
        }}
      >
        Edit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change the delivery address"
        description="Possible until the parcel is booked with the courier. The customer's saved addresses are not changed."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={submit}>
              Save address
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {ADDRESS_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`addr-${f.key}`} required={f.required} error={fields[f.key]} className={f.wide ? "sm:col-span-2" : undefined}>
              <Input id={`addr-${f.key}`} inputMode={f.inputMode} value={form[f.key]} aria-invalid={!!fields[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </Field>
          ))}
          <Field label="Address type" htmlFor="addr-type">
            <Select id="addr-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AddressForm["type"] })}>
              <option value="HOME">Home</option>
              <option value="WORK">Work</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
        </div>
        {error && !Object.keys(fields).length && <p className="mt-4 text-[13px] text-danger-600">{error}</p>}
      </Modal>
      {toast.node}
    </>
  );
}

/* ---------------------------------- Notes --------------------------------- */

/** Internal notes on an order: staff read them here, and customers never see them. */
export function OrderNotes({ orderId, notes, edit }: { orderId: string; notes: OrderNote[]; edit: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    const r = await addOrderNote(orderId, body.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <p className="text-[13px] text-ink-500">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="text-[13px]">
              <p className="whitespace-pre-line text-ink-800">{n.body}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {n.authorName}, {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <div className="space-y-2 border-t border-line pt-4">
          <Field label="Add a note" htmlFor="order-note" error={error || undefined}>
            <Textarea id="order-note" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Button size="sm" variant="secondary" disabled={busy || !body.trim()} onClick={add}>
            Add note
          </Button>
        </div>
      )}
    </div>
  );
}
