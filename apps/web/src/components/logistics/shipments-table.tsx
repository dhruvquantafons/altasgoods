import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { CourierSimulator, TrackingRefresh } from "@/components/admin/fulfilment/line-actions";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { uiItemStatus } from "@/lib/api/format";
import type { AdminItem, ApiOrderItemStatus } from "@/lib/api/types";
import { ORDER_STATUS } from "@/lib/status";
import { cn, formatDateShort, formatDateTime } from "@/lib/utils";

/** Still with the courier: tracking can be refreshed, and the promised date can slip. */
const MOVING: ApiOrderItemStatus[] = ["READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "RTO_IN_TRANSIT"];

export const isLate = (i: AdminItem, now: number) => MOVING.includes(i.status) && i.status !== "RTO_IN_TRANSIT" && Date.parse(i.promisedBy) < now;

/** One row per parcel (an order line), with the courier's latest scan and what staff can do about it. */
export function ShipmentsTable({ items, now, simulated }: { items: AdminItem[]; now: number; simulated: boolean }) {
  return (
    <TableContainer>
      <Table>
        <THead className="border-t-0">
          <TR>
            <TH>Shipment</TH>
            <TH className="hidden lg:table-cell">Ship to</TH>
            <TH>Courier and AWB</TH>
            <TH className="hidden md:table-cell">Latest scan</TH>
            <TH className="hidden sm:table-cell">Promised</TH>
            <TH align="right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((i) => {
            const late = isLate(i, now);
            return (
              <TR key={i.id}>
                <TD>
                  <div className="flex max-w-[300px] items-center gap-2.5">
                    <ProductImage src={i.image} alt="" size={38} rounded="md" />
                    <span className="min-w-0">
                      <Link href={`/admin/orders/${i.orderId}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
                        {i.title}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                        <Link href={`/admin/orders/${i.orderId}`} className="font-mono text-brand-700 hover:underline">
                          {i.orderId}
                        </Link>
                        <StatusBadge meta={ORDER_STATUS[uiItemStatus(i.status)]} size="sm" />
                      </span>
                    </span>
                  </div>
                </TD>
                <TD className="hidden lg:table-cell">
                  <p className="text-[13px] text-ink-800">{i.shipTo.name}</p>
                  <p className="text-xs text-ink-500">
                    {i.shipTo.city} {i.shipTo.pincode}
                  </p>
                </TD>
                <TD>
                  <p className="text-[13px] text-ink-800">{i.courier ?? (simulated ? "Simulated courier" : "Courier")}</p>
                  {i.awb ? <p className="font-mono text-xs text-ink-500">{i.awb}</p> : <p className="text-xs text-ink-400">No AWB yet</p>}
                </TD>
                <TD className="hidden md:table-cell">
                  {i.trackingStatus ? (
                    <>
                      <p className="max-w-[220px] truncate text-[13px] text-ink-800" title={i.trackingStatus}>
                        {i.trackingStatus}
                      </p>
                      {i.trackedAt && <p className="text-xs text-ink-500">{formatDateTime(i.trackedAt)}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-ink-400">No scans yet</p>
                  )}
                </TD>
                <TD className="hidden sm:table-cell">
                  <p className={cn("text-[13px]", late ? "font-medium text-danger-700" : "text-ink-800")}>{formatDateShort(i.promisedBy)}</p>
                  {late && <p className="text-xs text-danger-600">Late</p>}
                </TD>
                <TD align="right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {i.labelUrl && (
                      <a href={i.labelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                        <FileText size={13} aria-hidden="true" /> Label
                      </a>
                    )}
                    {i.trackingUrl && (
                      <a href={i.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                        <ExternalLink size={13} aria-hidden="true" /> Track
                      </a>
                    )}
                    {MOVING.includes(i.status) &&
                      (simulated ? <CourierSimulator orderId={i.orderId} itemId={i.id} status={i.status} /> : i.awb && <TrackingRefresh orderId={i.orderId} itemId={i.id} />)}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableContainer>
  );
}
