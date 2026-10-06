"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BadgeCheck, Bookmark, Lock, Minus, Plus, ShoppingBag, Store, Tag, Trash2, Truck, X } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { MAX_QTY, useCart, usePincode } from "./cart-context";
import { daysFromNow, formatPromise, FREE_DELIVERY_THRESHOLD, lookupPincode, promiseDays } from "./delivery";
import { PriceDetails } from "./price-details";
import { computeTotals, couponBlocker, couponValue, priceLines, type PricedLine } from "./pricing";
import { percentOff } from "./price";
import type { CartCatalog, CouponLite } from "./types";

export function CartView({ catalog, coupons: all, plus, children }: { catalog: CartCatalog; coupons: CouponLite[]; plus: boolean; children?: ReactNode }) {
  const cart = useCart();
  const { pincode } = usePincode();
  const info = lookupPincode(pincode);
  // The cart cannot see order history, so a first-order coupon (BLUFIRST) was always blocked here, even on a first order.
  // Like UPI-only coupons, it can be applied in the cart; the checkout quote from the API decides and says so if it does not apply.
  const coupons = all.map((c) => (c.firstOrderOnly ? { ...c, firstOrderOnly: undefined, description: `${c.description}. Checked against your orders at checkout.` } : c));
  const totals = computeTotals(cart.active, catalog, { couponCode: cart.coupon, coupons, plus });
  const saved = priceLines(cart.saved, catalog);
  const empty = totals.lines.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 lg:text-[28px]">Your cart</h1>
          {!empty && (
            <p className="mt-1 text-sm text-ink-500">
              {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"} from {totals.groups.length} seller{totals.groups.length === 1 ? "" : "s"}, delivering to {info?.city}{" "}
              {pincode}
            </p>
          )}
        </div>
        {!empty && plus && (
          <p className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[13px] font-medium text-brand-700">
            <Truck size={15} aria-hidden="true" /> Free delivery on every order with AltasGoods Plus
          </p>
        )}
      </div>

      {empty ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-line px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-ink-50 text-ink-500 ring-1 ring-line">
            <ShoppingBag size={26} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink-900">Your cart is empty</h2>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            {saved.length ? "Items you saved for later are below. Move them back when you are ready." : "Explore the Big Days deals or pick up where you left off."}
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/deals" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              See today&apos;s deals
            </Link>
            <Link href="/account/wishlist" className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-800 hover:bg-ink-50">
              Open wishlist
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-5">
            {totals.groups.map((g) => {
              const days = promiseDays(g.deliveryDays, info);
              const short = FREE_DELIVERY_THRESHOLD - g.subtotal;
              return (
                <section key={g.sellerId} aria-label={`Items from ${g.sellerName}`} className="overflow-hidden rounded-2xl border border-line">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ink-25 px-4 py-3 sm:px-5">
                    <p className="flex items-center gap-2 text-[13px] text-ink-700">
                      <Store size={15} className="text-ink-500" aria-hidden="true" />
                      Sold by{" "}
                      <Link href={`/store/${g.sellerSlug}`} className="font-semibold text-ink-900 hover:underline">
                        {g.sellerName}
                      </Link>
                      {g.fulfilledBy === "blubuy" && (
                        <span className="hidden items-center gap-1 text-xs font-medium text-brand-700 sm:inline-flex">
                          <BadgeCheck size={13} aria-hidden="true" /> Fulfilled by AltasGoods
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-1.5 text-[13px] text-ink-700">
                      <Truck size={15} className="text-ink-500" aria-hidden="true" />
                      <span>
                        Delivery by <span className="font-semibold text-ink-900">{formatPromise(daysFromNow(days))}</span>
                        <span className="text-ink-500">{g.deliveryFee ? `, ${formatINR(g.deliveryFee)}` : ", free"}</span>
                      </span>
                    </p>
                  </header>
                  {!plus && short > 0 && (
                    <p className="border-b border-line bg-brand-50/50 px-5 py-2 text-xs text-brand-800">
                      Add {formatINR(short)} more from this seller for free delivery, or join AltasGoods Plus.
                    </p>
                  )}
                  <ul className="divide-y divide-line">
                    {g.lines.map((l) => (
                      <CartLineRow key={l.line.key} l={l} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <CouponBox coupons={coupons} lines={totals.lines} plus={plus} />
            <PriceDetails
              totals={totals}
              plus={plus}
              footer={
                <>
                  <Link
                    href="/checkout"
                    className="hidden h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white transition-colors hover:bg-brand-700 lg:flex"
                  >
                    Place order
                  </Link>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-500">
                    <Lock size={13} aria-hidden="true" /> Safe and secure payments. Easy returns.
                  </p>
                </>
              }
            />
          </aside>
        </div>
      )}

      {saved.length > 0 && (
        <section aria-labelledby="saved-heading" className="mt-12">
          <h2 id="saved-heading" className="text-lg font-semibold text-ink-900">
            Saved for later ({saved.length})
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((l) => (
              <li key={l.line.key} className="flex gap-4 rounded-2xl border border-line p-4">
                <Link href={`/p/${l.product.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                  <Image src={l.product.image} alt="" fill sizes="80px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${l.product.slug}`} className="line-clamp-2 text-sm text-ink-800 hover:text-ink-900">
                    {l.product.title}
                  </Link>
                  <p className="mt-1 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(l.unitPrice)}</p>
                  <div className="mt-2 flex gap-4 text-[13px] font-medium">
                    <button type="button" onClick={() => cart.moveToCart(l.line.key)} className="text-brand-700 hover:underline">
                      Move to cart
                    </button>
                    <button type="button" onClick={() => cart.remove(l.line.key)} className="text-ink-500 hover:text-ink-800">
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children}

      {/* Mobile sticky place-order bar */}
      {!empty && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(16_24_40/0.18)] backdrop-blur lg:hidden">
          <div>
            <p className="text-lg font-semibold text-ink-900 tabular-nums">{formatINR(totals.total)}</p>
            {totals.savings > 0 && <p className="text-xs font-medium text-success-700">You save {formatINR(totals.savings)}</p>}
          </div>
          <Link href="/checkout" className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white">
            Place order
          </Link>
        </div>
      )}
    </div>
  );
}

function CartLineRow({ l }: { l: PricedLine }) {
  const cart = useCart();
  const off = percentOff(l.unitPrice, l.unitMrp);
  const max = Math.max(1, Math.min(MAX_QTY, l.offer.stock));
  const oos = l.offer.stock === 0;
  return (
    <li className="flex gap-4 p-4 sm:gap-5 sm:p-5">
      <Link href={`/p/${l.product.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-ink-50 sm:size-28">
        <Image src={l.product.image} alt="" fill sizes="112px" className="object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-500">{l.product.brand}</p>
            <Link href={`/p/${l.product.slug}`} className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-ink-900 hover:underline">
              {l.product.title}
            </Link>
            {l.line.variant && <p className="mt-1 text-[13px] text-ink-500">{l.line.variant}</p>}
            <p className={cn("mt-1 text-xs font-medium", oos ? "text-danger-700" : l.offer.stock <= 8 ? "text-warning-700" : "text-success-700")}>
              {oos ? "Out of stock with this seller" : l.offer.stock <= 8 ? `Only ${l.offer.stock} left` : "In stock"}
              <span className="font-normal text-ink-500">, {l.offer.returnWindowDays ? `${l.offer.returnWindowDays} day returns` : "not returnable"}</span>
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-lg font-semibold text-ink-900 tabular-nums">{formatINR(l.lineTotal)}</p>
            {off > 0 && (
              <p className="text-[13px] tabular-nums">
                <span className="text-ink-500 line-through">{formatINR(l.lineMrp)}</span> <span className="font-semibold text-success-700">{off}% off</span>
              </p>
            )}
            {l.line.qty > 1 && <p className="text-xs text-ink-500">{formatINR(l.unitPrice)} each</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex h-9 items-center rounded-lg border border-line-strong" role="group" aria-label={`Quantity for ${l.product.title}`}>
            <button
              type="button"
              onClick={() => (l.line.qty <= 1 ? cart.remove(l.line.key) : cart.setQty(l.line.key, l.line.qty - 1))}
              aria-label={l.line.qty <= 1 ? "Remove item" : "Decrease quantity"}
              className="flex size-9 items-center justify-center text-ink-700"
            >
              {l.line.qty <= 1 ? <Trash2 size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {l.line.qty}
            </span>
            <button
              type="button"
              onClick={() => cart.setQty(l.line.key, l.line.qty + 1)}
              disabled={l.line.qty >= max}
              aria-label="Increase quantity"
              className="flex size-9 items-center justify-center text-ink-700 disabled:text-ink-300"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => cart.saveForLater(l.line.key)} className="flex items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900">
            <Bookmark size={14} aria-hidden="true" /> Save for later
          </button>
          <button type="button" onClick={() => cart.remove(l.line.key)} className="flex items-center gap-1.5 text-[13px] font-medium text-ink-700 hover:text-ink-900">
            <Trash2 size={14} aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function CouponBox({ coupons, lines, plus }: { coupons: CouponLite[]; lines: PricedLine[]; plus: boolean }) {
  const cart = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const applied = coupons.find((c) => c.code === cart.coupon);

  const apply = (raw: string) => {
    const c = coupons.find((x) => x.code === raw.trim().toUpperCase());
    if (!c) return setError("This code is not valid or has expired");
    const blocker = couponBlocker(c, lines, { plus });
    if (blocker && !c.upiOnly) return setError(blocker);
    cart.applyCoupon(c.code);
    setError(null);
    setCode("");
  };

  return (
    <section aria-labelledby="coupon-heading" className="rounded-2xl border border-line bg-white p-5">
      <h2 id="coupon-heading" className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Tag size={16} className="text-ink-500" aria-hidden="true" /> Coupons
      </h2>
      {applied ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-success-500/40 bg-success-50 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold text-success-700">{applied.code}</p>
            <p className="truncate text-xs text-ink-600">{applied.description}</p>
          </div>
          <button type="button" onClick={() => cart.applyCoupon(null)} aria-label={`Remove coupon ${applied.code}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-white">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply(code);
          }}
        >
          <label htmlFor="coupon-code" className="sr-only">
            Coupon code
          </label>
          <input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter coupon code"
            aria-invalid={!!error}
            aria-describedby={error ? "coupon-error" : undefined}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong px-3 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
          <button type="submit" disabled={!code.trim()} className="h-10 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:text-ink-400">
            Apply
          </button>
        </form>
      )}
      {error && (
        <p id="coupon-error" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {coupons
          .filter((c) => c.code !== cart.coupon)
          .map((c) => {
            const blocker = couponBlocker(c, lines, { plus });
            const value = couponValue(c, lines);
            return (
              <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-ink-900">{c.code}</span>
                    {!blocker && value > 0 && <span className="text-xs font-semibold text-success-700">Save {formatINR(value)}</span>}
                  </p>
                  <p className="text-xs text-ink-500">{blocker ?? c.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!!blocker && !c.upiOnly}
                  onClick={() => apply(c.code)}
                  className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline disabled:text-ink-400 disabled:no-underline"
                >
                  Apply
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
