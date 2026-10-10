"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { uiItemStatus, uiPaymentMethod } from "@/lib/api/format";
import type { AdminItem, ApiOrderItemStatus } from "@/lib/api/types";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { cn, formatDateShort, formatDateTime, formatINR } from "@/lib/utils";
import { LineActions } from "./line-actions";

/** What store staff may do from each open status (the API enforces the same rules). */
const STAFF_ALLOWED: Partial<Record<ApiOrderItemStatus, ApiOrderItemStatus[]>> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PACKED", "CANCELLED"],
  PACKED: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["CANCELLED"],
};

/** The fulfilment queue: one row per order line, with bulk actions for lines in the same status. */
export function QueueTable({ items, now }: { items: AdminItem[]; now: number }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actionable = items.filter((i) => STAFF_ALLOWED[i.status]);
  const chosen = items.filter((i) => selected.has(i.id));
  const statuses = new Set(chosen.map((i) => i.status));
  const shared = statuses.size === 1 ? chosen[0]!.status : null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChosen = actionable.length > 0 && actionable.every((i) => selected.has(i.id));

  return (
    <>
      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50/60 px-5 py-2.5 text-[13px]">
          <span className="font-medium text-ink-800">{chosen.length} selected</span>
          {shared ? (
            <LineActions key={[...selected].join()} itemIds={chosen.map((i) => i.id)} status={shared} allowed={STAFF_ALLOWED[shared] ?? []} size="xs" />
          ) : (
            <span className="text-ink-500">Select lines in the same status to act on them together.</span>
          )}
          <button className="ml-auto text-brand-700 hover:underline" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      <TableContainer>
        <Table>
          <THead className="border-t-0">
            <TR>
              <TH className="w-10">
                <Checkbox
                  aria-label="Select every open line"
                  checked={allChosen}
                  disabled={!actionable.length}
                  onChange={() => setSelected(allChosen ? new Set() : new Set(actionable.map((i) => i.id)))}
                />
              </TH>
              <TH>Item</TH>
              <TH className="hidden md:table-cell">Order</TH>
              <TH className="hidden lg:table-cell">Ship to</TH>
              <TH align="right">Value</TH>
              <TH className="hidden sm:table-cell">Status</TH>
              <TH className="hidden lg:table-cell">Dispatch by</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((i) => {
              const late = !!i.dispatchBy && STAFF_ALLOWED[i.status] && Date.parse(i.dispatchBy) < now;
              return (
                <TR key={i.id}>
                  <TD>
                    <Checkbox aria-label={`Select ${i.title}`} checked={selected.has(i.id)} disabled={!STAFF_ALLOWED[i.status]} onChange={() => toggle(i.id)} />
                  </TD>
                  <TD>
                    <div className="flex max-w-[320px] items-center gap-2.5">
                      <ProductImage src={i.image} alt="" size={38} rounded="md" />
                      <span className="min-w-0">
                        <Link href={`/admin/orders/${i.orderId}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
                          {i.title}
                        </Link>
                        <span className="block text-xs text-ink-500">
                          Qty {i.qty}
                          {i.variant ? `, ${i.variant}` : ""}
                        </span>
                        <span className="mt-1 block sm:hidden">
                          <StatusBadge meta={ORDER_STATUS[uiItemStatus(i.status)]} size="sm" />
                        </span>
                      </span>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <Link href={`/admin/orders/${i.orderId}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                      {i.orderId}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {formatDateTime(i.placedAt)}, {PAYMENT_METHOD[uiPaymentMethod(i.paymentMethod)]}
                    </p>
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <p className="text-[13px] text-ink-800">{i.shipTo.name}</p>
                    <p className="text-xs text-ink-500">
                      {i.shipTo.city} {i.shipTo.pincode}
                    </p>
                  </TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {formatINR((i.unitPricePaise * i.qty) / 100)}
                  </TD>
                  <TD className="hidden sm:table-cell">
                    <StatusBadge meta={ORDER_STATUS[uiItemStatus(i.status)]} size="sm" />
                    {i.awb && <p className="mt-1 font-mono text-[11px] text-ink-500">{i.awb}</p>}
                  </TD>
                  <TD className={cn("hidden text-[13px] lg:table-cell", late ? "font-medium text-danger-700" : "text-ink-600")}>
                    {i.dispatchBy ? formatDateShort(i.dispatchBy) : "None"}
                    {late && <span className="block text-xs font-normal">Overdue</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
    </>
  );
}
