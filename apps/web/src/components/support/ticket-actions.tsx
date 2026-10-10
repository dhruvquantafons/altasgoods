"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CircleCheck, CircleX, IndianRupee, Loader2, RefreshCcw, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { decideTicketAction, runTicketAction, updateTicket } from "@/app/actions/support";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Radio, Select } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { TicketAction, TicketDetail } from "@/lib/api/types";
import { cn, formatINR } from "@/lib/utils";

/* ------------------------- Status and priority ------------------------ */

/** Status, priority and assignee. Only the moves spec 11.11 allows from here are offered. */
export function TicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  statuses,
  priorities,
  agents,
}: {
  ticketId: string;
  status: TicketDetail["status"];
  priority: TicketDetail["priority"];
  assigneeId?: string;
  statuses: { value: TicketDetail["status"]; label: string }[];
  priorities: { value: TicketDetail["priority"]; label: string }[];
  agents: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [a, setA] = useState(assigneeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = s !== status || p !== priority || a !== (assigneeId ?? "");
  const { show, node } = useToast();

  async function save() {
    setBusy(true);
    setError(null);
    const r = await updateTicket(ticketId, {
      ...(s !== status ? { status: s } : {}),
      ...(p !== priority ? { priority: p } : {}),
      ...(a !== (assigneeId ?? "") ? { assigneeId: a || null } : {}),
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setS(r.data.status);
    setP(r.data.priority);
    setA(r.data.assignee?.id ?? "");
    show("Ticket updated and logged to the audit trail");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Status" htmlFor="t-status" hint={statuses.length === 1 ? "No further moves from here" : undefined}>
        <Select id="t-status" selectSize="sm" value={s} onChange={(e) => setS(e.target.value as TicketDetail["status"])}>
          {statuses.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="t-priority">
        <Select id="t-priority" selectSize="sm" value={p} onChange={(e) => setP(e.target.value as TicketDetail["priority"])}>
          {priorities.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assignee" htmlFor="t-assignee">
        <Select id="t-assignee" selectSize="sm" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Unassigned</option>
          {agents.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {error && (
        <p role="alert" className="text-xs text-danger-700">
          {error}
        </p>
      )}
      <Button size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty || busy} onClick={save}>
        {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        Save changes
      </Button>
      {node}
    </div>
  );
}

/* ------------------------------ Actions ------------------------------ */

export interface ActionOrder {
  id: string;
  total: number;
  paymentLabel: string;
  cod: boolean;
  items: { id: string; title: string; price: number; quantity: number }[];
}

export interface GuaranteeCheck {
  label: string;
  ok: boolean;
}

type Dialog = "refund" | "replacement" | "guarantee" | null;

const ACTION_LABEL: Record<TicketAction["kind"], string> = {
  REFUND: "Refund",
  REPLACEMENT: "Replacement",
  GUARANTEE_CLAIM: "Guarantee claim",
};
const ACTION_STATUS: Record<string, { label: string; tone: "info" | "success" | "warning" | "danger" | "neutral" }> = {
  INITIATED: { label: "Initiated", tone: "info" },
  PROCESSING: { label: "Processing", tone: "info" },
  COMPLETED: { label: "Refunded", tone: "success" },
  PENDING_APPROVAL: { label: "Awaiting approval", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CREATED: { label: "Created", tone: "success" },
  UNDER_REVIEW: { label: "Under review", tone: "warning" },
};

export function TicketActions({
  ticketId,
  order,
  limit,
  level,
  guarantee,
  history,
  closed,
}: {
  ticketId: string;
  order?: ActionOrder;
  limit: number;
  level: string;
  guarantee: GuaranteeCheck[];
  history: TicketAction[];
  closed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Dialog>(null);
  const [amount, setAmount] = useState(String(order?.items[0] ? order.items[0].price * order.items[0].quantity : 0));
  const [dest, setDest] = useState<"SOURCE" | "CREDITS">("CREDITS");
  const [reason, setReason] = useState<"damaged" | "not_delivered" | "wrong" | "late" | "goodwill">("damaged");
  const [itemId, setItemId] = useState(order?.items[0]?.id ?? "");
  const [replaceReason, setReplaceReason] = useState<"damaged" | "defective" | "wrong" | "missing">("damaged");
  const [collect, setCollect] = useState(true);
  const [claim, setClaim] = useState<"not_delivered" | "damaged" | "wrong" | "different">("not_delivered");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show, node } = useToast();
  const close = () => {
    setOpen(null);
    setError(null);
  };

  const amt = Number(amount) || 0;
  const over = amt > limit;
  const invalid = amt <= 0 || (order ? amt > order.total : true);
  const eligible = guarantee.every((g) => g.ok);
  const replaced = new Set(history.filter((h) => h.kind === "REPLACEMENT").map((h) => String(h.details.itemId)));

  async function run(input: Parameters<typeof runTicketAction>[1], toast: string) {
    setBusy(true);
    setError(null);
    const r = await runTicketAction(ticketId, input);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    close();
    show(toast);
    router.refresh();
  }

  async function decide(a: TicketAction, approve: boolean) {
    setBusy(true);
    const r = await decideTicketAction(ticketId, a.id, approve);
    setBusy(false);
    if (!r.ok) return show(r.error);
    show(approve ? "Refund approved and initiated" : "Refund request rejected");
    router.refresh();
  }

  const actions = [
    { key: "refund" as const, label: "Issue refund", hint: `${level} limit ${formatINR(limit)}`, icon: IndianRupee },
    { key: "replacement" as const, label: "Create replacement", hint: "One replacement per item", icon: RefreshCcw },
    { key: "guarantee" as const, label: "File AltasGoods Guarantee claim", hint: eligible ? "Eligible" : "Check eligibility", icon: ShieldCheck },
  ];

  const errorNote = error && (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
      <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      {error}
    </p>
  );

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {actions.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              disabled={!order || closed}
              onClick={() => setOpen(a.key)}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-ink-50 disabled:opacity-50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                <a.icon size={16} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink-900">{a.label}</span>
                <span className="block truncate text-xs text-ink-500">{a.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!order && <p className="mt-2 text-xs text-ink-500">Link an order to this ticket to unlock order actions.</p>}
      {closed && order && <p className="mt-2 text-xs text-ink-500">This ticket is closed.</p>}

      {history.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold tracking-[0.05em] text-ink-500 uppercase">On this ticket</p>
          <ul className="flex flex-col gap-2.5">
            {history.map((h) => {
              const st = ACTION_STATUS[h.status] ?? { label: h.status.toLowerCase().replace(/_/g, " "), tone: "neutral" as const };
              return (
                <li key={h.id} className="rounded-lg border border-line px-3 py-2.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink-900">
                      {ACTION_LABEL[h.kind]}
                      {h.amountPaise != null && <span className="font-normal text-ink-600"> {formatINR(h.amountPaise / 100)}</span>}
                    </span>
                    <Badge size="sm" tone={st.tone}>
                      {st.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    By {h.createdBy}
                    {h.decidedBy ? `, ${h.status === "REJECTED" ? "rejected" : "approved"} by ${h.decidedBy}` : ""}
                  </p>
                  {h.canApprove && (
                    <div className="mt-2 flex gap-2">
                      <Button size="xs" icon={Check} disabled={busy} onClick={() => decide(h, true)}>
                        Approve
                      </Button>
                      <Button size="xs" variant="ghost" icon={X} className="text-danger-700 hover:bg-danger-50" disabled={busy} onClick={() => decide(h, false)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {order && (
        <>
          <Modal
            open={open === "refund"}
            onClose={close}
            title="Issue refund"
            description={`Order ${order.id}, paid by ${order.paymentLabel}. Refunds post to the ledger with this ticket as the reason.`}
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={invalid || busy}
                  onClick={() =>
                    run(
                      { kind: "REFUND", amountPaise: Math.round(amt * 100), destination: dest, reason },
                      over ? `Refund of ${formatINR(amt)} sent for supervisor approval` : `Refund of ${formatINR(amt)} initiated to ${dest === "CREDITS" ? "AltasGoods Credits" : order.cod ? "the verified bank account" : order.paymentLabel}`,
                    )
                  }
                >
                  {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  {over ? "Send for approval" : "Issue refund"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {errorNote}
              <Field label="Amount" htmlFor="rf-amount" hint={`Order total ${formatINR(order.total)}. Your ${level} limit is ${formatINR(limit)} per ticket.`} error={amt > order.total ? "Amount is more than the order total" : undefined}>
                <Input id="rf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} suffix="INR" />
              </Field>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-700">Refund to</legend>
                <div className="flex flex-col gap-2.5">
                  <Radio name="dest" checked={dest === "CREDITS"} onChange={() => setDest("CREDITS")} label="AltasGoods Credits" description="Under 2 hours. Usable on the next order." />
                  <Radio
                    name="dest"
                    checked={dest === "SOURCE"}
                    onChange={() => setDest("SOURCE")}
                    label={order.cod ? "Bank account or UPI ID" : `Original method, ${order.paymentLabel}`}
                    description={order.cod ? "Verified by penny drop, 1 to 2 business days" : order.paymentLabel.includes("UPI") ? "1 to 2 business days" : "3 to 5 business days"}
                  />
                </div>
              </fieldset>
              <Field label="Reason" htmlFor="rf-reason">
                <Select id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                  <option value="damaged">Damaged or defective item</option>
                  <option value="not_delivered">Not delivered</option>
                  <option value="wrong">Wrong item</option>
                  <option value="late">Late delivery goodwill</option>
                  <option value="goodwill">Goodwill</option>
                </Select>
              </Field>
              {over && (
                <p className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2.5 text-[13px] text-warning-700">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Above your {formatINR(limit)} limit. The refund is created on hold for a Care Desk supervisor to approve. You cannot approve your own request.
                </p>
              )}
            </div>
          </Modal>

          <Modal
            open={open === "replacement"}
            onClose={close}
            title="Create replacement"
            description="Ships after doorstep QC passes, or right away for AltasGoods Plus members with a low risk score."
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={busy || !itemId || replaced.has(itemId)}
                  onClick={() => run({ kind: "REPLACEMENT", itemId, reason: replaceReason, collectOriginal: collect }, `Replacement created for order ${order.id}${collect ? ". Pickup of the original item is scheduled." : "."}`)}
                >
                  Create replacement
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {errorNote}
              <Field label="Item" htmlFor="rp-item" error={replaced.has(itemId) ? "Already replaced once. A second issue on a replacement is refund only." : undefined}>
                <Select id="rp-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                  {order.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title.length > 60 ? `${it.title.slice(0, 60)}...` : it.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason" htmlFor="rp-reason">
                <Select id="rp-reason" value={replaceReason} onChange={(e) => setReplaceReason(e.target.value as typeof replaceReason)}>
                  <option value="damaged">Damaged in transit</option>
                  <option value="defective">Defective</option>
                  <option value="wrong">Wrong item or colour</option>
                  <option value="missing">Missing parts</option>
                </Select>
              </Field>
              <Checkbox checked={collect} onChange={(e) => setCollect(e.target.checked)} label="Collect the original item when the replacement is delivered" description="Exchange in one visit with doorstep QC." />
              <p className="rounded-lg border border-line bg-ink-50 px-3 py-2.5 text-[13px] text-ink-600">Only one replacement per original item. A second issue on a replacement is refund only.</p>
            </div>
          </Modal>

          <Modal
            open={open === "guarantee"}
            onClose={close}
            title="File an AltasGoods Guarantee claim"
            description="The customer is told at once, and AltasGoods decides within 7 days."
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button disabled={!eligible || busy} onClick={() => run({ kind: "GUARANTEE_CLAIM", claimType: claim }, `Guarantee claim filed for order ${order.id}. Decision due within 7 days.`)}>
                  File claim
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {errorNote}
              <ul className="flex flex-col gap-2 rounded-xl border border-line p-3.5">
                {guarantee.map((g) => (
                  <li key={g.label} className="flex items-start gap-2 text-[13px]">
                    {g.ok ? <CircleCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <CircleX size={16} className="mt-px shrink-0 text-danger-600" aria-hidden="true" />}
                    <span className={cn(g.ok ? "text-ink-800" : "text-danger-700")}>{g.label}</span>
                  </li>
                ))}
              </ul>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-700">Claim type</legend>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["not_delivered", "Not delivered"],
                      ["damaged", "Damaged or defective"],
                      ["wrong", "Wrong item"],
                      ["different", "Materially different"],
                    ] as const
                  ).map(([v, l]) => (
                    <Radio key={v} name="claim" checked={claim === v} onChange={() => setClaim(v)} label={l} />
                  ))}
                </div>
              </fieldset>
              {!eligible && <p className="text-[13px] text-danger-700">Not eligible yet. Ask the customer to open a return first, then file after 48 hours.</p>}
            </div>
          </Modal>
        </>
      )}
      {node}
    </>
  );
}
