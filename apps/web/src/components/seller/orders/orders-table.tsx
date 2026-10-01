"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Ban, Check, ClipboardList, PackageSearch, Printer, Truck, X } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ORDER_STATUS, type OrderStatus } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";
import { ChannelBadge, Mono, SlaText } from "../primitives";
import type { Channel } from "../shared";

export type OrderStageKey = "new" | "to_pack" | "ready" | "shipped" | "delivered" | "cancelled" | "returns";

export interface OrderRow {
  lineId: string;
  orderId: string;
  title: string;
  image: string;
  sku: string;
  variant?: string;
  quantity: number;
  total: number;
  payment: string;
  cod: boolean;
  channel: Channel;
  fc?: string;
  status: OrderStatus;
  buyer: string;
  city: string;
  pincode: string;
  placed: string;
  /** deadline used for the SLA column (accept by or dispatch by) */
  dueAt?: string;
  dueLabel?: string;
  /** secondary date text, e.g. "Promised Sat, 3 Oct" */
  dateText?: string;
  dateHint?: string;
  awb?: string;
}

type Action = "confirm" | "labels" | "manifest" | "pickup" | "cancel";

const ACTIONS: Record<OrderStageKey, Action[]> = {
  new: ["confirm", "cancel"],
  to_pack: ["labels", "cancel"],
  ready: ["manifest", "pickup", "labels", "cancel"],
  shipped: ["labels"],
  delivered: ["labels"],
  cancelled: [],
  returns: [],
};

/** Which statuses each bulk action applies to (seller-packed lines only). */
const ELIGIBLE: Record<Action, OrderStatus[]> = {
  confirm: ["placed"],
  labels: ["confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "delivered"],
  manifest: ["packed", "ready_to_ship"],
  pickup: ["packed", "ready_to_ship"],
  cancel: ["placed", "confirmed", "packed", "ready_to_ship"],
};

const CANCEL_REASONS = ["Item out of stock at the pickup location", "Pricing error on the listing", "Item damaged during packing", "Cannot ship to this pincode"];

const DATE_HEADER: Record<OrderStageKey, string> = {
  new: "Confirm by",
  to_pack: "Dispatch by",
  ready: "Dispatch by",
  shipped: "Promised delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returns: "Return",
};

export function OrdersTable({ rows, stage, toolbar, emptyHint }: { rows: OrderRow[]; stage: OrderStageKey; toolbar: ReactNode; emptyHint: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const [slot, setSlot] = useState("today");
  const toast = useToast();

  const statusOf = (r: OrderRow) => overrides[r.lineId] ?? r.status;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.lineId));
  const someSelected = selected.size > 0;
  const chosen = useMemo(() => rows.filter((r) => selected.has(r.lineId)), [rows, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function partition(action: Action) {
    const eligible = chosen.filter((r) => r.channel !== "fulfilled" && ELIGIBLE[action].includes(statusOf(r)));
    const fulfilled = chosen.filter((r) => r.channel === "fulfilled").length;
    return { eligible, fulfilled, skipped: chosen.length - eligible.length };
  }

  function skippedNote(fulfilled: number, skipped: number) {
    if (!skipped) return "";
    if (fulfilled === skipped) return ` ${fulfilled} BluBuy Fulfilled ${fulfilled === 1 ? "order was" : "orders were"} skipped: the fulfilment centre handles ${fulfilled === 1 ? "it" : "them"}.`;
    return ` ${skipped} skipped as not eligible.`;
  }

  function apply(action: Action, to?: OrderStatus, extra = "") {
    const { eligible, fulfilled, skipped } = partition(action);
    const n = eligible.length;
    if (to) setOverrides((prev) => ({ ...prev, ...Object.fromEntries(eligible.map((r) => [r.lineId, to])) }));
    const plural = (w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const msg: Record<Action, string> = {
      confirm: `${plural("order")} confirmed. Dispatch by dates are locked in.`,
      labels: `Labels and invoices for ${plural("order")} downloaded as one PDF (4 x 6 in).`,
      manifest: `Manifest MF-BOM-261001-04 created with ${plural("package")}.`,
      pickup: `Pickup requested for ${plural("package")}${extra}.`,
      cancel: `${plural("order")} cancelled. Customers are refunded automatically.`,
    };
    toast.show(n ? msg[action] + skippedNote(fulfilled, skipped) : `No eligible orders selected.${skippedNote(fulfilled, skipped)}`);
    setSelected(new Set());
  }

  const actions = ACTIONS[stage];

  const bulkBar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-brand-50/60 px-5 py-3">
      <p className="text-[13px] font-semibold text-ink-900">
        {selected.size} selected
        {!allSelected && (
          <button type="button" onClick={() => setSelected(new Set(rows.map((r) => r.lineId)))} className="ml-2 font-medium text-brand-700 hover:underline">
            Select all {rows.length}
          </button>
        )}
      </p>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        {actions.includes("confirm") && (
          <Button size="sm" icon={Check} onClick={() => apply("confirm", "confirmed")}>
            Confirm
          </Button>
        )}
        {actions.includes("pickup") && (
          <Button size="sm" icon={Truck} onClick={() => setPickupOpen(true)}>
            Request pickup
          </Button>
        )}
        {actions.includes("labels") && (
          <Button size="sm" variant={stage === "to_pack" ? "primary" : "secondary"} icon={Printer} onClick={() => apply("labels", stage === "to_pack" ? "packed" : undefined)}>
            Print labels and invoices
          </Button>
        )}
        {actions.includes("manifest") && (
          <Button size="sm" variant="secondary" icon={ClipboardList} onClick={() => apply("manifest", "ready_to_ship")}>
            Generate manifest
          </Button>
        )}
        {actions.includes("cancel") && (
          <Button size="sm" variant="ghost" icon={Ban} className="text-danger-700 hover:bg-danger-50" onClick={() => setCancelOpen(true)}>
            Cancel
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
          <X size={16} />
        </Button>
      </div>
    </div>
  );

  const selectable = actions.length > 0;

  return (
    <>
      <div className="border-b border-line">{someSelected ? bulkBar : toolbar}</div>
      {rows.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No orders here" description={emptyHint} />
      ) : (
        <TableContainer>
          <Table className="min-w-[1040px]">
            <THead className="border-t-0">
              <TR className="hover:bg-transparent">
                {selectable && (
                  <TH className="w-10 pr-0">
                    <Checkbox
                      aria-label="Select all orders on this page"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.lineId)))}
                    />
                  </TH>
                )}
                <TH>Order</TH>
                <TH>Product</TH>
                <TH>Ship to</TH>
                <TH align="right">Amount</TH>
                <TH>Channel</TH>
                <TH>Status</TH>
                <TH>{DATE_HEADER[stage]}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const status = statusOf(r);
                const changed = overrides[r.lineId] !== undefined;
                const isSel = selected.has(r.lineId);
                return (
                  <TR key={r.lineId} className={cn(isSel && "bg-brand-50/50 hover:bg-brand-50/70", changed && !isSel && "bg-success-50/40")}>
                    {selectable && (
                      <TD className="w-10 pr-0">
                        <Checkbox aria-label={`Select ${r.lineId}`} checked={isSel} onChange={() => toggle(r.lineId)} />
                      </TD>
                    )}
                    <TD>
                      <Link href={`/seller/orders/${r.orderId}`} className="text-brand-700 hover:underline">
                        <Mono className="font-medium">{r.lineId}</Mono>
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">{r.placed}</p>
                    </TD>
                    <TD>
                      <div className="flex max-w-[14rem] items-center gap-3 xl:max-w-[14.5rem] 2xl:max-w-[19rem]">
                        <ProductImage src={r.image} alt="" size={40} rounded="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-900">{r.title}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-500">
                            <span className="font-mono">{r.sku}</span>
                            {r.variant ? `, ${r.variant}` : ""}
                            {r.quantity > 1 ? `, qty ${r.quantity}` : ", qty 1"}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <p className="text-[13px] text-ink-800">{r.buyer}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {r.city} {r.pincode}
                      </p>
                    </TD>
                    <TD align="right">
                      <p className="font-medium text-ink-900">{formatINR(r.total)}</p>
                      <p className={cn("mt-0.5 text-xs", r.cod ? "font-medium text-warning-700" : "text-ink-500")}>{r.payment}</p>
                    </TD>
                    <TD>
                      <ChannelBadge channel={r.channel} />
                      {r.fc && <p className="mt-1 font-mono text-[11px] text-ink-500">{r.fc}</p>}
                    </TD>
                    <TD>
                      <StatusBadge meta={ORDER_STATUS[status]} size="sm" />
                    </TD>
                    <TD>
                      {r.dueAt && !changed ? (
                        <>
                          <SlaText dueAt={r.dueAt} warnHours={stage === "new" ? 4 : 8} />
                          <p className="mt-0.5 text-xs text-ink-500">{r.dueLabel}</p>
                        </>
                      ) : r.dueAt && changed ? (
                        <p className="text-[13px] text-ink-600">{status === "cancelled" ? "Cancelled just now" : r.dueLabel}</p>
                      ) : (
                        <>
                          <p className="text-[13px] text-ink-800">{r.dateText ?? "Not applicable"}</p>
                          {r.dateHint && <p className="mt-0.5 max-w-[14rem] truncate text-xs text-ink-500">{r.dateHint}</p>}
                        </>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${selected.size} ${selected.size === 1 ? "order" : "orders"}`}
        description="Seller cancellations count toward your pre-fulfilment cancel rate."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Keep orders
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCancelOpen(false);
                apply("cancel", "cancelled");
              }}
            >
              Cancel orders
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason" htmlFor="cancel-reason" required>
            <Select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {CANCEL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Note for BluBuy (optional)" htmlFor="cancel-note">
            <Textarea id="cancel-note" placeholder="Add details that help the support team" className="min-h-20" />
          </Field>
          <p className="rounded-lg bg-warning-50 px-3 py-2.5 text-[13px] text-warning-700">
            A ₹60 penalty applies per cancelled item (1% of price above ₹10,000, capped at ₹1,000). BluBuy Fulfilled orders cannot be cancelled here.
          </p>
        </div>
      </Modal>

      <Modal
        open={pickupOpen}
        onClose={() => setPickupOpen(false)}
        title="Request a pickup"
        description="BluBuy Logistics collects packages marked ready to ship from your default pickup address."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickupOpen(false)}>
              Not now
            </Button>
            <Button
              icon={Truck}
              onClick={() => {
                setPickupOpen(false);
                apply("pickup", "ready_to_ship", slot === "today" ? " today, 4:00 to 6:00 PM" : " tomorrow, 11:00 AM to 1:00 PM");
              }}
            >
              Request pickup
            </Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[13px] font-medium text-ink-700">Pickup slot</legend>
          {[
            { key: "today", label: "Today, 4:00 to 6:00 PM", hint: "Recommended: meets the dispatch by date for every selected order" },
            { key: "tomorrow", label: "Tomorrow, 11:00 AM to 1:00 PM", hint: "Orders due today will be dispatched late" },
          ].map((s) => (
            <label key={s.key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3", slot === s.key ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
              <input type="radio" name="slot" checked={slot === s.key} onChange={() => setSlot(s.key)} className="mt-1 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium text-ink-900">{s.label}</span>
                <span className="block text-xs text-ink-500">{s.hint}</span>
              </span>
            </label>
          ))}
          <p className="mt-2 text-xs text-ink-500">Pickup from Andheri warehouse, Unit 14, Marol Industrial Estate, Mumbai 400072. Keep labels facing up for scanning.</p>
        </fieldset>
      </Modal>
      {toast.node}
    </>
  );
}
