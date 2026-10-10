/**
 * Adapters from API shapes to the plain shapes the storefront components were
 * built around, so screens switch data source without being rewritten.
 * Rupee fields in those shapes are whole rupees; the API speaks paise.
 */
import type { AddressLite } from "@/components/store/types";
import type { Address } from "./types";
import type { PlacedOrder } from "@/components/store/types";
import { formatPromise } from "@/components/store/delivery";
import { PAYMENT_METHOD } from "@/lib/status";
import type { Order } from "./types";

export function toAddressLite(a: Address): AddressLite {
  return {
    id: a.id,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? undefined,
    landmark: a.landmark ?? undefined,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    type: a.type.toLowerCase() as AddressLite["type"],
    isDefault: a.isDefault,
  };
}


const METHOD_KEYS = { UPI: "upi", CARD: "card", NETBANKING: "netbanking", EMI: "emi", PAY_LATER: "paylater", COD: "cod" } as const;
export const methodLabel = (m: Order["paymentMethod"]) => PAYMENT_METHOD[METHOD_KEYS[m]];

/** A placed order in the shape the confirmation screen renders. */
export function toPlacedOrder(order: Order, isPlus: boolean): PlacedOrder {
  const spent = (order.subtotalPaise - order.couponDiscountPaise) / 100;
  return {
    id: order.id,
    placedAt: new Date(order.placedAt).getTime(),
    items: order.items.map((i) => ({
      title: i.title,
      image: i.image,
      qty: i.qty,
      price: i.unitPricePaise / 100,
      variant: i.variant || undefined,
      slug: i.productId.replace(/^p-/, ""),
    })),
    delivery: {
      date: formatPromise(order.items.reduce((d, i) => (i.promisedBy > d ? i.promisedBy : d), order.items[0]?.promisedBy ?? order.placedAt)),
      option: "Standard",
    },
    address: { id: "order-address", ...order.address, line2: order.address.line2 ?? undefined, landmark: order.address.landmark ?? undefined, type: order.address.type.toLowerCase() as "home" | "work" | "other" },
    paymentLabel: methodLabel(order.paymentMethod),
    payable: order.totalPaise / 100,
    savings: (order.mrpTotalPaise - order.subtotalPaise + order.couponDiscountPaise) / 100,
    coinsEarned: Math.min(100, Math.floor(spent / 100) * (isPlus ? 2 : 1)),
    cod: order.paymentMethod === "COD",
  };
}
