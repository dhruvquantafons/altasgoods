"use server";

import { revalidatePath } from "next/cache";
import { api, publicApi } from "@/lib/api/server";
import type { Address, Order, PaymentDetail, PaymentMethod, Quote } from "@/lib/api/types";

/**
 * Storefront mutations. Each calls the AltasGoods API with the session cookie on
 * the server, so tokens never reach the browser.
 */

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const fail = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};
const offline = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };

/** A cart line as the storefront keeps it: product plus the chosen seller. */
export interface LineInput {
  productId: string;
  sellerId: string;
  qty: number;
  variant?: string;
  saved?: boolean;
}

/** UI payment keys to API payment methods. */
const METHODS: Record<string, PaymentMethod> = { upi: "UPI", card: "CARD", netbanking: "NETBANKING", emi: "EMI", paylater: "PAY_LATER", cod: "COD" };

/** Finds the API offer id for each product and seller pair. */
async function resolveOffers(lines: LineInput[]) {
  const client = publicApi();
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = await Promise.all(ids.map((id) => client.GET("/v1/products/{slug}", { params: { path: { slug: id } } }).then((r) => r.data)));
  const offerFor = new Map<string, string>();
  products.forEach((p) => p?.offers.forEach((o) => offerFor.set(`${p.id}|${o.seller.id}`, o.id)));
  const resolved = lines.flatMap((l) => {
    const offerId = offerFor.get(`${l.productId}|${l.sellerId}`);
    return offerId ? [{ offerId, qty: l.qty, variant: l.variant ?? "", savedForLater: !!l.saved }] : [];
  });
  return { resolved, missing: lines.length - resolved.length };
}

export async function quoteCheckout(input: { addressId: string; lines: LineInput[]; couponCode?: string | null; method?: string }): Promise<Result<Quote>> {
  try {
    const { resolved } = await resolveOffers(input.lines);
    if (!resolved.length) return { ok: false, error: "These items are no longer available", code: "UNAVAILABLE" };
    const r = await (await api()).POST("/v1/checkout/quote", {
      body: {
        addressId: input.addressId,
        couponCode: input.couponCode || undefined,
        paymentMethod: input.method ? METHODS[input.method] : undefined,
        lines: resolved.map(({ offerId, qty, variant }) => ({ offerId, qty, variant })),
      },
    });
    return r.data ? { ok: true, data: r.data } : fail(r.error, "Could not price your order");
  } catch {
    return offline;
  }
}

export async function placeOrder(input: {
  addressId: string;
  lines: LineInput[];
  couponCode?: string | null;
  method: string;
  idempotencyKey: string;
}): Promise<Result<{ orderId: string; paymentId: string; redirect: string }>> {
  try {
    const { resolved, missing } = await resolveOffers(input.lines);
    if (missing) return { ok: false, error: "Some items in your cart are no longer sold. Remove them and try again.", code: "UNAVAILABLE" };
    const r = await (await api()).POST("/v1/orders", {
      params: { header: { "idempotency-key": input.idempotencyKey } },
      body: {
        addressId: input.addressId,
        couponCode: input.couponCode || undefined,
        paymentMethod: METHODS[input.method] ?? "UPI",
        lines: resolved.map(({ offerId, qty, variant }) => ({ offerId, qty, variant })),
      },
    });
    if (!r.data) return fail(r.error, "We could not place your order");
    const { order, payment } = r.data;
    revalidatePath("/account/orders");
    return {
      ok: true,
      data: { orderId: order.id, paymentId: payment.id, redirect: payment.nextAction ? `/checkout/pay/${payment.id}` : `/order/confirmed?id=${order.id}` },
    };
  } catch {
    return offline;
  }
}

export async function createAddress(input: {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault?: boolean;
}): Promise<Result<Address>> {
  try {
    const r = await (await api()).POST("/v1/me/addresses", { body: { ...input, isDefault: input.isDefault ?? false } });
    return r.data ? { ok: true, data: r.data } : fail(r.error, "Could not save this address");
  } catch {
    return offline;
  }
}

/** Mirrors the browser cart to the signed-in account (best effort, for other devices and the app). */
export async function syncCart(lines: LineInput[]): Promise<Result<null>> {
  try {
    const { resolved } = await resolveOffers(lines);
    const r = await (await api()).PUT("/v1/cart", { body: { lines: resolved } });
    return r.response.ok ? { ok: true, data: null } : fail(r.error, "Could not save your cart");
  } catch {
    return offline;
  }
}

/** The signed-in account's cart, as storefront lines. */
export async function loadServerCart(): Promise<Result<LineInput[]>> {
  try {
    const r = await (await api()).GET("/v1/cart");
    if (!r.data) return fail(r.error, "Could not load your cart");
    return { ok: true, data: r.data.lines.map((l) => ({ productId: l.productId, sellerId: l.seller.id, qty: l.qty, variant: l.variant || undefined, saved: l.savedForLater })) };
  } catch {
    return offline;
  }
}

export async function completeSandboxPayment(paymentId: string, outcome: "SUCCESS" | "FAILURE"): Promise<Result<PaymentDetail>> {
  try {
    const r = await (await api()).POST("/v1/payments/{id}/sandbox/complete", { params: { path: { id: paymentId } }, body: { outcome } });
    if (!r.data) return fail(r.error, "The payment could not be completed");
    revalidatePath("/account/orders");
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}

export async function retryPayment(orderId: string): Promise<Result<{ paymentId: string }>> {
  try {
    const r = await (await api()).POST("/v1/me/orders/{id}/payments", { params: { path: { id: orderId } } });
    return r.data ? { ok: true, data: { paymentId: r.data.id } } : fail(r.error, "Could not restart the payment");
  } catch {
    return offline;
  }
}

export async function cancelOrder(orderId: string, reason: string, itemIds?: string[]): Promise<Result<Order>> {
  try {
    const r = await (await api()).POST("/v1/me/orders/{id}/cancel", { params: { path: { id: orderId } }, body: { reason, itemIds } });
    if (!r.data) return fail(r.error, "This order could not be cancelled");
    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/account/orders");
    return { ok: true, data: r.data };
  } catch {
    return offline;
  }
}
