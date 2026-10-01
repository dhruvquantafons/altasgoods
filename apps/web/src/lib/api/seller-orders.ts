import "server-only";
import { cache } from "react";
import { getProduct } from "@/lib/mock";
import { stageOf, type SellerLine } from "@/lib/mock/seller-extra";
import type { PaymentMethod as UiMethod } from "@/lib/status";
import { uiItemStatus } from "./format";
import { api, unwrap } from "./server";
import type { SellerItem, SellerItemList } from "./types";

const METHOD: Record<SellerItem["paymentMethod"], UiMethod> = { UPI: "upi", CARD: "card", NETBANKING: "netbanking", EMI: "emi", PAY_LATER: "paylater", COD: "cod" };

/**
 * An API order line in the shape Seller Hub's order screens were built around.
 * Every line is treated as seller shipped for now; automated BluBuy Fulfilled
 * processing arrives with the logistics phase.
 */
export function toSellerLine(i: SellerItem): SellerLine {
  const status = uiItemStatus(i.status);
  const product = getProduct(i.productId);
  return {
    // readable and stable reference for screens and labels; itemId is what the API takes
    lineId: `${i.orderId}-${i.id.slice(0, 4).toUpperCase()}`,
    orderId: i.orderId,
    itemId: i.id,
    productId: i.productId,
    title: i.title,
    image: i.image,
    variant: i.variant || undefined,
    sku: product?.sku ?? i.productId.toUpperCase(),
    bsin: "",
    quantity: i.qty,
    price: i.unitPricePaise / 100,
    mrp: i.unitPricePaise / 100,
    total: (i.unitPricePaise * i.qty) / 100,
    status,
    stage: stageOf(status),
    channel: "ship",
    placedAt: i.placedAt,
    handlingDays: 1,
    acceptBy: i.status === "NEW" ? (i.dispatchBy ?? undefined) : undefined,
    dispatchBy: i.dispatchBy ?? undefined,
    awb: i.awb ?? undefined,
    buyer: i.shipTo.name,
    buyerPhone: "",
    addressLine: "",
    city: i.shipTo.city,
    state: "",
    pincode: i.shipTo.pincode,
    payment: METHOD[i.paymentMethod],
    cod: i.paymentMethod === "COD",
    promisedBy: i.promisedBy,
  };
}

/** Every order line of the signed-in seller (all statuses), most urgent first. Shared by the layout and page in one request. */
export const loadSellerLines = cache(async () => {
  const client = await api();
  const items: SellerItem[] = [];
  let counts: SellerItemList["counts"] = {};
  for (let page = 1; page <= 5; page++) {
    const r = unwrap(await client.GET("/v1/seller/order-items", { params: { query: { page, pageSize: 60 } } }));
    items.push(...r.items);
    counts = r.counts;
    if (items.length >= r.total) break;
  }
  return { lines: items.map(toSellerLine), counts };
});

/** Lines waiting on the seller: to accept, to pack, or to hand over. */
export const pendingCount = (counts: SellerItemList["counts"]) =>
  (counts.NEW ?? 0) + (counts.ACCEPTED ?? 0) + (counts.PACKED ?? 0) + (counts.READY_TO_SHIP ?? 0);

export async function loadSellerOrder(id: string) {
  return unwrap(await (await api()).GET("/v1/seller/orders/{id}", { params: { path: { id } } }), { notFoundOn404: true });
}
