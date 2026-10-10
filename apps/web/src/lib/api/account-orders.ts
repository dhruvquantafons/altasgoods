import "server-only";
import type { Address, Order as UiOrder, OrderEvent, OrderItem as UiOrderItem } from "@/lib/types";
import type { OrderStatus as UiStatus } from "@/lib/status";
import { STORE_ID, uiItemStatus, uiPaymentMethod, uiPaymentStatus } from "./format";
import { loadMyReturns, toAccountReturn } from "./returns";
import { api, unwrap } from "./server";
import type { Order } from "./types";

const EVENT_LABEL: Record<string, string> = {
  PAYMENT_PENDING: "Order placed, awaiting payment",
  PAYMENT_FAILED: "Payment did not go through",
  CONFIRMED: "Order confirmed",
  NEW: "Payment received, order sent to the seller",
  ACCEPTED: "Seller confirmed your order",
  PACKED: "Item packed and invoice generated",
  READY_TO_SHIP: "Ready to ship, handed to AltasGoods Logistics",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  ABANDONED: "Payment window ended, order released",
  RTO_IN_TRANSIT: "Returning to the seller",
  RTO_RECEIVED: "Returned to the seller",
};

/** Order header status for the customer UI: the most advanced state of its items. */
function headerStatus(o: Order): UiStatus {
  if (o.status === "PAYMENT_PENDING" || o.status === "PAYMENT_FAILED") return "pending_payment";
  if (o.status === "ABANDONED" || o.status === "CANCELLED") return "cancelled";
  const active = o.items.filter((i) => i.status !== "CANCELLED");
  const rank: UiStatus[] = ["placed", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "delivered", "return_requested", "returned"];
  const statuses = active.map((i) => uiItemStatus(i.status));
  return statuses.reduce<UiStatus>((lo, s) => (rank.indexOf(s) < rank.indexOf(lo) ? s : lo), statuses[0] ?? "placed");
}

/** An API order in the shape the account screens were built around. */
export function toUiOrder(o: Order): UiOrder {
  const address: Address = { id: "order-address", ...o.address, line2: o.address.line2 ?? undefined, landmark: o.address.landmark ?? undefined, type: o.address.type.toLowerCase() as Address["type"] };
  const items: UiOrderItem[] = o.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    title: i.title,
    image: i.image,
    variant: i.variant || undefined,
    sellerId: STORE_ID,
    quantity: i.qty,
    price: i.unitPricePaise / 100,
    mrp: i.mrpPaise / 100,
    status: uiItemStatus(i.status),
  }));
  // order level events plus the first item's journey, de-duplicated by status
  const firstItem = o.items[0]?.id;
  const seen = new Set<string>();
  const timeline: OrderEvent[] = o.events
    .filter((e) => !e.orderItemId || e.orderItemId === firstItem)
    .filter((e) => !(e.toStatus === "NEW" && o.paymentMethod === "COD"))
    .filter((e) => (seen.has(e.toStatus) ? false : (seen.add(e.toStatus), true)))
    .map((e) => ({ status: (e.orderItemId ? uiItemStatus(e.toStatus as Order["items"][number]["status"]) : e.toStatus.toLowerCase()) as UiStatus, label: EVENT_LABEL[e.toStatus] ?? e.toStatus.toLowerCase().replace(/_/g, " "), at: e.at, note: e.note ?? undefined }));
  const promised = o.items.reduce((d, i) => (i.promisedBy > d ? i.promisedBy : d), o.items[0]?.promisedBy ?? o.placedAt);
  const delivered = o.items.map((i) => i.deliveredAt).filter((d): d is string => !!d).sort().at(-1);
  return {
    id: o.id,
    customerId: "me",
    customerName: o.address.name,
    placedAt: o.placedAt,
    items,
    status: headerStatus(o),
    payment: { method: uiPaymentMethod(o.paymentMethod), status: uiPaymentStatus(o.paymentStatus), txnId: o.payments[0]?.id.slice(0, 12).toUpperCase() ?? "" },
    address,
    subtotal: o.subtotalPaise / 100,
    discount: o.couponDiscountPaise / 100,
    couponCode: o.couponCode ?? undefined,
    shippingFee: o.deliveryFeePaise / 100,
    platformFee: 0,
    total: o.totalPaise / 100,
    promisedBy: promised,
    deliveredAt: delivered,
    timeline,
    channel: "web",
  };
}

/** Every order of the signed-in shopper, newest first, with full detail. */
export async function loadMyOrders() {
  const client = await api();
  const list = unwrap(await client.GET("/v1/me/orders", { params: { query: { pageSize: 50 } } }));
  const details = await Promise.all(list.items.map((o) => client.GET("/v1/me/orders/{id}", { params: { path: { id: o.id } } }).then((r) => r.data)));
  return details.filter((d): d is Order => !!d);
}

/** The shopper's orders in the account screens' shape, each with its returns. */
export async function loadAccountOrders() {
  const [raw, { returns }] = await Promise.all([loadMyOrders(), loadMyReturns()]);
  return raw.map((o) => withReturns(toUiOrder(o), returns));
}

export async function loadAccountOrder(id: string) {
  const [raw, { returns }] = await Promise.all([loadMyOrder(id), loadMyReturns()]);
  return { raw, order: withReturns(toUiOrder(raw), returns) };
}

function withReturns(order: UiOrder, returns: Awaited<ReturnType<typeof loadMyReturns>>["returns"]): UiOrder {
  return { ...order, returns: returns.filter((r) => r.orderId === order.id).map((r) => toAccountReturn(r, "your original payment method")) };
}

export async function loadMyOrder(id: string) {
  return unwrap(await (await api()).GET("/v1/me/orders/{id}", { params: { path: { id } } }), { notFoundOn404: true });
}
