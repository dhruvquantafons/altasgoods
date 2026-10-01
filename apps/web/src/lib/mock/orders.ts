import type { Address, Order, OrderEvent, OrderItem, Refund, ReturnRequest } from "../types";
import type { OrderStatus, PaymentMethod, PaymentStatus, RefundStatus, ReturnStatus } from "../status";
import { addDays, between, NOW, pick, seeded } from "../utils";
import { products } from "./catalog";
import { CURRENT_CUSTOMER, customerAddresses, customers } from "./people";

const rand = seeded(42);

const methods: [PaymentMethod, number][] = [
  ["upi", 0.46], ["card", 0.17], ["cod", 0.21], ["netbanking", 0.04], ["emi", 0.05], ["wallet", 0.04], ["paylater", 0.03],
];

function pickMethod(): PaymentMethod {
  let r = rand();
  for (const [m, w] of methods) {
    if ((r -= w) <= 0) return m;
  }
  return "upi";
}

const streets = ["MG Road", "Linking Road", "Anna Salai", "Park Street", "FC Road", "Banjara Hills Road No. 12", "Sector 29", "Civil Lines", "Indiranagar 100 Feet Road", "Koramangala 5th Block", "Salt Lake Sector V", "Bandra West"];

function statusForAge(ageDays: number): OrderStatus {
  const r = rand();
  if (ageDays < 0.15) return r < 0.08 ? "pending_payment" : r < 0.75 ? "placed" : "confirmed";
  if (ageDays < 0.6) return r < 0.08 ? "cancelled" : r < 0.4 ? "confirmed" : r < 0.75 ? "packed" : "ready_to_ship";
  if (ageDays < 1.5) return r < 0.06 ? "cancelled" : r < 0.35 ? "ready_to_ship" : r < 0.7 ? "shipped" : "in_transit";
  if (ageDays < 3.5) return r < 0.4 ? "in_transit" : r < 0.62 ? "out_for_delivery" : r < 0.72 ? "undelivered" : r < 0.97 ? "delivered" : "cancelled";
  if (r < 0.06) return "cancelled";
  if (r < 0.1) return "return_requested";
  if (r < 0.13) return "returned";
  if (r < 0.15) return "rto_in_transit";
  if (r < 0.16) return "returned_to_seller";
  return "delivered";
}

const flow: OrderStatus[] = ["placed", "confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "out_for_delivery", "delivered"];

const eventLabel: Partial<Record<OrderStatus, string>> = {
  pending_payment: "Order created, awaiting payment",
  placed: "Order placed",
  confirmed: "Seller confirmed your order",
  packed: "Item packed and invoice generated",
  ready_to_ship: "Ready to ship, handed to BluBuy Logistics pickup",
  shipped: "Shipped from seller warehouse",
  in_transit: "In transit, reached sort centre",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Order cancelled",
  undelivered: "Delivery attempt failed: customer not available",
  rto_in_transit: "Returning to seller after failed attempts",
  returned_to_seller: "Returned to seller",
  return_requested: "Return requested",
  returned: "Return completed, refund issued",
};

function buildTimeline(status: OrderStatus, placedAt: Date, city: string): OrderEvent[] {
  if (status === "pending_payment") return [{ status, label: eventLabel.pending_payment!, at: placedAt.toISOString() }];
  const raw: { status: OrderStatus; h: number; location?: string }[] = [];
  const hours = [0, 1.5, 6, 9, 20, 34, 52, 57];
  const locations = ["", "", "Seller warehouse", "Seller warehouse", "Origin hub", "Sort centre", `${city} delivery hub`, city];

  let lastIndex: number;
  if (status === "cancelled") lastIndex = Math.floor(rand() * 3);
  else if (["delivered", "return_requested", "returned"].includes(status)) lastIndex = flow.length - 1;
  else if (["undelivered", "rto_in_transit", "returned_to_seller"].includes(status)) lastIndex = flow.indexOf("out_for_delivery");
  else lastIndex = flow.indexOf(status);

  for (let i = 0; i <= lastIndex; i++) raw.push({ status: flow[i]!, h: hours[i]!, location: locations[i] || undefined });
  const tail = (s: OrderStatus, h: number) => raw.push({ status: s, h });
  if (status === "cancelled") tail("cancelled", hours[lastIndex]! + 2);
  if (status === "undelivered") tail("undelivered", 60);
  if (status === "rto_in_transit") { tail("undelivered", 60); tail("rto_in_transit", 100); }
  if (status === "returned_to_seller") { tail("undelivered", 60); tail("rto_in_transit", 100); tail("returned_to_seller", 170); }
  if (status === "return_requested") tail("return_requested", 120);
  if (status === "returned") { tail("return_requested", 110); tail("returned", 200); }

  // Young orders compress their history so no event lands after NOW.
  const ageHours = (NOW.getTime() - placedAt.getTime()) / 3600_000;
  const last = raw.at(-1)!.h || 1;
  const scale = last > ageHours * 0.92 ? (ageHours * 0.92) / last : 1;
  return raw.map((e) => ({
    status: e.status,
    label: eventLabel[e.status]!,
    at: new Date(placedAt.getTime() + e.h * scale * 3600_000).toISOString(),
    location: e.location,
  }));
}

function paymentStatusFor(method: PaymentMethod, status: OrderStatus): PaymentStatus {
  if (status === "pending_payment") return "pending";
  if (method === "cod") {
    if (status === "delivered" || status === "return_requested") return "cod_collected";
    if (status === "returned") return "refunded";
    return "cod_pending";
  }
  if (status === "cancelled" || status === "returned" || status === "returned_to_seller") return "refunded";
  if (status === "placed") return "authorized";
  return "captured";
}

function makeOrder(i: number): Order {
  const isMine = i % 8 === 0;
  const customer = isMine ? CURRENT_CUSTOMER : customers[1 + Math.floor(rand() * (customers.length - 1))]!;
  const ageDays = Math.pow(rand(), 2.1) * 42 + (i < 6 ? 0 : 0.02);
  const placedAt = new Date(NOW.getTime() - ageDays * 86400_000);
  const status = statusForAge(ageDays);
  const n = rand() < 0.68 ? 1 : rand() < 0.8 ? 2 : 3;
  const items: OrderItem[] = Array.from({ length: n }, (_, k) => {
    const p = products[Math.floor(rand() * products.length)]!;
    const offer = rand() < 0.75 ? p.offers[0]! : pick(rand, p.offers);
    const qty = p.price < 1500 && rand() < 0.3 ? 2 : 1;
    const variant = p.variants[0]?.values.find((v) => v.available)?.label;
    return {
      id: `${i}-${k}`,
      productId: p.id,
      title: p.title,
      image: p.image,
      variant,
      sellerId: offer.sellerId,
      quantity: qty,
      price: offer.price,
      mrp: offer.mrp,
      status,
    };
  });
  const subtotal = items.reduce((a, it) => a + it.price * it.quantity, 0);
  const useCoupon = rand() < 0.22;
  const discount = useCoupon ? Math.min(Math.round(subtotal * 0.1), 1500) : 0;
  const shippingFee = subtotal < 499 && !customer.plusMember ? 40 : 0;
  // No customer platform fee and no COD surcharge (see spec section 10.8).
  const platformFee = 0;
  const method = pickMethod();
  const address: Address = isMine
    ? customerAddresses[i % 16 === 0 ? 1 : 0]!
    : {
        id: `addr-o${i}`,
        name: customer.name,
        phone: customer.phone,
        line1: `${between(rand, 1, 480)}, ${pick(rand, streets)}`,
        city: customer.city,
        state: customer.state,
        pincode: String(between(rand, 110001, 799999)),
        type: "home",
      };
  const yymmdd = placedAt.toISOString().slice(2, 10).replace(/-/g, "");
  const deliveredEvent = ["delivered", "return_requested", "returned"].includes(status);
  const timeline = buildTimeline(status, placedAt, address.city);
  return {
    id: `BB-${yymmdd}-${String(between(rand, 10000, 99999))}`,
    customerId: customer.id,
    customerName: customer.name,
    placedAt: placedAt.toISOString(),
    items,
    status,
    payment: { method, status: paymentStatusFor(method, status), txnId: `TXN${between(rand, 100000000, 999999999)}` },
    address,
    subtotal,
    discount,
    couponCode: useCoupon ? pick(rand, ["BIGDAYS10", "BLUFIRST", "UPI150", "PLUS200"]) : undefined,
    shippingFee,
    platformFee,
    total: subtotal - discount + shippingFee + platformFee,
    promisedBy: addDays(placedAt, between(rand, 2, 5)).toISOString(),
    deliveredAt: deliveredEvent ? timeline.find((e) => e.status === "delivered")?.at : undefined,
    timeline,
    channel: rand() < 0.62 ? "android" : rand() < 0.5 ? "ios" : "web",
  };
}

export const orders: Order[] = Array.from({ length: 240 }, (_, i) => makeOrder(i)).sort(
  (a, b) => +new Date(b.placedAt) - +new Date(a.placedAt),
);

export function getOrder(id: string) {
  return orders.find((o) => o.id === id);
}

export const myOrders = orders.filter((o) => o.customerId === CURRENT_CUSTOMER.id);

/** Order lines that belong to one seller, flattened with their parent order. */
export function sellerOrderLines(sellerId: string) {
  return orders.flatMap((o) => o.items.filter((it) => it.sellerId === sellerId).map((item) => ({ order: o, item })));
}

/* ------------------------------ Returns ------------------------------ */

const returnReasons = [
  "Size too small", "Item damaged in transit", "Received a different item", "Quality not as expected",
  "Product not working", "Missing parts or accessories", "No longer needed", "Colour differs from image",
];

const returnFlow: ReturnStatus[] = ["requested", "approved", "pickup_scheduled", "picked_up", "received", "qc_passed", "refund_initiated", "completed"];

const rr = seeded(77);
const delivered = orders.filter((o) => ["delivered", "return_requested", "returned"].includes(o.status));

export const returns: ReturnRequest[] = delivered.slice(0, 34).map((o, i) => {
  const item = o.items[0]!;
  let status: ReturnStatus;
  if (o.status === "returned") status = "completed";
  else if (o.status === "return_requested") status = pick(rr, ["requested", "approved", "pickup_scheduled"] as ReturnStatus[]);
  else {
    const r = rr();
    status = r < 0.08 ? "rejected" : r < 0.13 ? "qc_failed" : r < 0.18 ? "replacement_shipped" : r < 0.22 ? "cancelled" : returnFlow[Math.floor(rr() * returnFlow.length)]!;
  }
  // a return is requested after delivery but never in the future
  const delivered = new Date(o.deliveredAt ?? o.placedAt);
  const room = Math.max(0, Math.floor((NOW.getTime() - delivered.getTime()) / 86400_000) - 1);
  const requestedAt = addDays(delivered, Math.min(between(rr, 1, 5), room));
  return {
    id: `RT-${String(30412 + i * 13)}`,
    orderId: o.id,
    itemId: item.id,
    productTitle: item.title,
    image: item.image,
    customerName: o.customerName,
    sellerId: item.sellerId,
    reason: pick(rr, returnReasons),
    type: status === "replacement_shipped" || rr() < 0.25 ? "replacement" : "refund",
    status,
    amount: item.price * item.quantity,
    requestedAt: requestedAt.toISOString(),
    updatedAt: new Date(Math.min(addDays(requestedAt, between(rr, 0, 4)).getTime(), NOW.getTime() - 3600_000)).toISOString(),
  };
});

/* ------------------------------ Refunds ------------------------------ */

export const refunds: Refund[] = [
  ...orders
    .filter((o) => o.status === "cancelled" && o.payment.method !== "cod")
    .map((o, i) => ({
      id: `RF-${80211 + i * 7}`,
      orderId: o.id,
      customerName: o.customerName,
      amount: o.total,
      method: o.payment.method,
      status: (i % 7 === 3 ? "processing" : "completed") as RefundStatus,
      initiatedAt: o.timeline.at(-1)!.at,
    })),
  ...returns
    .filter((r) => r.status === "refund_initiated" || r.status === "completed")
    .map((r, i) => ({
      id: `RF-${81502 + i * 11}`,
      orderId: r.orderId,
      returnId: r.id,
      customerName: r.customerName,
      amount: r.amount,
      method: (i % 3 === 0 ? "bluwallet" : "upi") as Refund["method"],
      status: (r.status === "completed" ? "completed" : i % 5 === 1 ? "failed" : "initiated") as RefundStatus,
      initiatedAt: r.updatedAt,
    })),
].sort((a, b) => +new Date(b.initiatedAt) - +new Date(a.initiatedAt));
