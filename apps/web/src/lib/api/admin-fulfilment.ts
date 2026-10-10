import "server-only";
import { cache } from "react";
import { api, unwrap } from "./server";
import { formatDateShort } from "@/lib/utils";
import type { ApiOrderItemStatus, ApiReturnStatus, ReturnRequest } from "./types";

/** One page of order lines for the store's fulfilment queue, with per-status counts. */
export async function loadAdminItems(query: { status?: ApiOrderItemStatus[]; q?: string; page?: number; pageSize?: number }) {
  const client = await api();
  return unwrap(
    await client.GET("/v1/admin/order-items", {
      params: { query: { status: query.status?.length ? query.status.join(",") : undefined, q: query.q || undefined, page: query.page ?? 1, pageSize: query.pageSize ?? 25 } },
    }),
  );
}

export const loadAdminOrder = cache(async (id: string) => unwrap(await (await api()).GET("/v1/admin/orders/{id}", { params: { path: { id } } }), { notFoundOn404: true }));

export async function loadAdminReturns(status?: ApiReturnStatus[]) {
  return unwrap(await (await api()).GET("/v1/admin/returns", { params: { query: { status: status?.length ? status.join(",") : undefined } } }));
}

export const loadAdminReturn = cache(async (id: string) => unwrap(await (await api()).GET("/v1/admin/returns/{id}", { params: { path: { id } } }), { notFoundOn404: true }));

/** What the store does next on a return. */
export function nextStep(r: ReturnRequest) {
  switch (r.status) {
    case "PENDING_REVIEW":
      return "Outside the return window: approve or reject";
    case "RECEIVED":
      return "Check the item";
    case "QC_FAILED":
      return "Failed check: settle with the customer";
    case "PICKUP_SCHEDULED":
      return r.pickupDate ? `Pickup on ${formatDateShort(`${r.pickupDate}T12:00:00+05:30`)}` : "Pickup booked";
    case "PICKUP_FAILED":
      return "Pickup failed, rebooking";
    case "PICKED_UP":
    case "IN_TRANSIT":
      return "On the way back";
    default:
      return null;
  }
}
