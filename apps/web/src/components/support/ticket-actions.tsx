"use client";

import { useState } from "react";
import { CircleCheck, CircleX, IndianRupee, RefreshCcw, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Radio, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

/* ------------------------- Status and priority ------------------------ */

export function TicketControls({
  status,
  priority,
  assignee,
  statuses,
  priorities,
  agents,
}: {
  status: string;
  priority: string;
  assignee?: string;
  statuses: { value: string; label: string }[];
  priorities: { value: string; label: string }[];
  agents: { value: string; label: string }[];
}) {
  const [s, setS] = useState(status);
  const [p, setP] = useState(priority);
  const [a, setA] = useState(assignee ?? "");
  const dirty = s !== status || p !== priority || a !== (assignee ?? "");
  const { show, node } = useToast();
  return (
    <div className="flex flex-col gap-3">
      <Field label="Status" htmlFor="t-status">
        <Select id="t-status" selectSize="sm" value={s} onChange={(e) => setS(e.target.value)}>
          {statuses.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Priority" htmlFor="t-priority">
        <Select id="t-priority" selectSize="sm" value={p} onChange={(e) => setP(e.target.value)}>
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
      <Button
        size="sm"
        variant={dirty ? "primary" : "secondary"}
        disabled={!dirty}
        onClick={() => show(`Ticket updated: ${statuses.find((o) => o.value === s)?.label}, ${priorities.find((o) => o.value === p)?.label}${a ? `, assigned to ${a}` : ""}. Logged to the audit trail.`)}
      >
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
  seller: string;
}

export interface GuaranteeCheck {
  label: string;
  ok: boolean;
}

type Dialog = "refund" | "replacement" | "seller" | "guarantee" | null;

export function TicketActions({
  ticketId,
  order,
  limit,
  level,
  supervisor,
  guarantee,
  customerFirstName,
}: {
  ticketId: string;
  order?: ActionOrder;
  limit: number;
  level: string;
  supervisor: string;
  guarantee: GuaranteeCheck[];
  customerFirstName: string;
}) {
  const [open, setOpen] = useState<Dialog>(null);
  const [amount, setAmount] = useState(String(order?.items[0] ? order.items[0].price * order.items[0].quantity : 0));
  const [dest, setDest] = useState<"source" | "credits">("credits");
  const [claim, setClaim] = useState("not_delivered");
  const [sellerMsg, setSellerMsg] = useState(
    `Customer ${customerFirstName} reports an issue with order ${order?.id ?? ""}. Please review the attached ticket ${ticketId} and respond with a resolution or evidence.`,
  );
  const { show, node } = useToast();
  const close = () => setOpen(null);

  const amt = Number(amount) || 0;
  const over = amt > limit;
  const invalid = amt <= 0 || (order ? amt > order.total : true);
  const eligible = guarantee.every((g) => g.ok);

  const actions = [
    { key: "refund" as const, label: "Issue refund", hint: `${level} limit ${formatINR(limit)}`, icon: IndianRupee },
    { key: "replacement" as const, label: "Create replacement", hint: "One replacement per item", icon: RefreshCcw },
    { key: "seller" as const, label: "Escalate to seller", hint: "48 hour response", icon: Store },
    { key: "guarantee" as const, label: "File BluBuy Guarantee claim", hint: eligible ? "Eligible" : "Check eligibility", icon: ShieldCheck },
  ];

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {actions.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              disabled={!order}
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
                  disabled={invalid}
                  onClick={() => {
                    close();
                    show(
                      over
                        ? `Refund of ${formatINR(amt)} sent to ${supervisor} for approval (on hold)`
                        : `Refund of ${formatINR(amt)} initiated to ${dest === "credits" ? "BluBuy Credits" : order.cod ? "the verified bank account" : order.paymentLabel}`,
                    );
                  }}
                >
                  {over ? "Send for approval" : "Issue refund"}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field label="Amount" htmlFor="rf-amount" hint={`Order total ${formatINR(order.total)}. Your ${level} limit is ${formatINR(limit)} per ticket.`} error={amt > order.total ? "Amount is more than the order total" : undefined}>
                <Input id="rf-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} suffix="INR" />
              </Field>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-700">Refund to</legend>
                <div className="flex flex-col gap-2.5">
                  <Radio name="dest" checked={dest === "credits"} onChange={() => setDest("credits")} label="BluBuy Credits" description="Under 2 hours. Usable on the next order." />
                  <Radio
                    name="dest"
                    checked={dest === "source"}
                    onChange={() => setDest("source")}
                    label={order.cod ? "Bank account or UPI ID" : `Original method, ${order.paymentLabel}`}
                    description={order.cod ? "Verified by penny drop, 1 to 2 business days" : order.paymentLabel.includes("UPI") ? "1 to 2 business days" : "3 to 5 business days"}
                  />
                </div>
              </fieldset>
              <Field label="Reason" htmlFor="rf-reason">
                <Select id="rf-reason" defaultValue="damaged">
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
                  Above your {formatINR(limit)} limit. The refund is created on hold and {supervisor} approves it. You cannot approve your own request.
                </p>
              )}
            </div>
          </Modal>

          <Modal
            open={open === "replacement"}
            onClose={close}
            title="Create replacement"
            description="Ships after doorstep QC passes, or right away for BluBuy Plus members with a low risk score."
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    close();
                    show(`Replacement created for order ${order.id}. Pickup of the original item is scheduled.`);
                  }}
                >
                  Create replacement
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field label="Item" htmlFor="rp-item">
                <Select id="rp-item">
                  {order.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title.length > 60 ? `${it.title.slice(0, 60)}...` : it.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason" htmlFor="rp-reason">
                <Select id="rp-reason" defaultValue="damaged">
                  <option value="damaged">Damaged in transit</option>
                  <option value="defective">Defective</option>
                  <option value="wrong">Wrong item or colour</option>
                  <option value="missing">Missing parts</option>
                </Select>
              </Field>
              <Checkbox defaultChecked label="Collect the original item when the replacement is delivered" description="Exchange in one visit with doorstep QC." />
              <p className="rounded-lg border border-line bg-ink-50 px-3 py-2.5 text-[13px] text-ink-600">Only one replacement per original item. A second issue on a replacement is refund only.</p>
            </div>
          </Modal>

          <Modal
            open={open === "seller"}
            onClose={close}
            title="Escalate to seller"
            description={`${order.seller} must reply within 48 hours. The ticket moves to Pending internal until they respond.`}
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={sellerMsg.trim().length < 20}
                  onClick={() => {
                    close();
                    show(`Escalated to ${order.seller}. Response due in 48 hours.`);
                  }}
                >
                  Send to seller
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <Field label="Issue" htmlFor="es-issue">
                <Select id="es-issue" defaultValue="product">
                  <option value="product">Product quality or wrong item</option>
                  <option value="cancel">Seller cancellation</option>
                  <option value="invoice">Invoice or GST request</option>
                  <option value="warranty">Warranty or installation</option>
                </Select>
              </Field>
              <Field label="Message to seller" htmlFor="es-msg" hint="Customer contact details are never shared with the seller.">
                <Textarea id="es-msg" value={sellerMsg} onChange={(e) => setSellerMsg(e.target.value)} />
              </Field>
            </div>
          </Modal>

          <Modal
            open={open === "guarantee"}
            onClose={close}
            title="File a BluBuy Guarantee claim"
            description="The seller has 72 hours to respond; no response auto-grants the claim. BluBuy decides within 7 days."
            footer={
              <>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button
                  disabled={!eligible}
                  onClick={() => {
                    close();
                    show(`Guarantee claim filed for order ${order.id}. Seller notified.`);
                  }}
                >
                  File claim
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
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
                  {[
                    ["not_delivered", "Not delivered"],
                    ["damaged", "Damaged or defective"],
                    ["wrong", "Wrong item"],
                    ["different", "Materially different"],
                  ].map(([v, l]) => (
                    <Radio key={v} name="claim" checked={claim === v} onChange={() => setClaim(v!)} label={l} />
                  ))}
                </div>
              </fieldset>
              {!eligible && <p className="text-[13px] text-danger-700">Not eligible yet. Ask the customer to contact the seller or open a return, then file after 48 hours.</p>}
            </div>
          </Modal>
        </>
      )}
      {node}
    </>
  );
}
