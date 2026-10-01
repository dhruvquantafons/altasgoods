"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Banknote,
  Check,
  ChevronRight,
  FileText,
  Heart,
  Lock,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  Store,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react";
import { cn, formatINR, formatNumber } from "@/lib/utils";
import { useCart, usePincode, useWishlist } from "./cart-context";
import { AddToCartButton, BuyNowButton } from "./cart-buttons";
import { CutoffNote, DealTimer, useClock } from "./countdown";
import { COD_LIMIT, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE, formatPromise, isValidPincode, lookupPincode, promiseDays, promiseLabel } from "./delivery";
import type { CartOffer } from "./types";

/* -------------------------------- Context -------------------------------- */

export interface PdpVariant {
  name: string;
  /** preselected value (the variant named in the listing title) */
  default?: string;
  values: { label: string; swatch?: string; available: boolean; price?: number }[];
}

export interface PdpData {
  id: string;
  slug: string;
  title: string;
  brand: string;
  variants: PdpVariant[];
  offer: CartOffer;
  otherOffers: number;
  plus: boolean;
  large: boolean;
  policyShort: string;
  warranty: string;
  deal?: { endsAt: string; claimedPct: number; kind: "deal_of_the_day" | "flash" };
}

interface PdpState {
  data: PdpData;
  selected: Record<string, string>;
  select: (name: string, value: string) => void;
  qty: number;
  setQty: (n: number) => void;
  price: number;
  variantLabel?: string;
}

const PdpContext = createContext<PdpState | null>(null);

function usePdp() {
  const ctx = useContext(PdpContext);
  if (!ctx) throw new Error("usePdp must be used inside <PdpProvider>");
  return ctx;
}

export function PdpProvider({ data, children }: { data: PdpData; children: ReactNode }) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.variants.map((v) => [v.name, v.default ?? v.values.find((x) => x.available)?.label ?? ""])),
  );
  const [qty, setQty] = useState(1);
  const priced = data.variants.flatMap((v) => v.values.filter((x) => x.price !== undefined && selected[v.name] === x.label));
  const price = priced[0]?.price ?? data.offer.price;
  const variantLabel = data.variants.length ? data.variants.map((v) => selected[v.name]).filter(Boolean).join(", ") : undefined;
  const maxQty = Math.max(1, Math.min(10, data.offer.stock));
  return (
    <PdpContext.Provider
      value={{
        data,
        selected,
        select: (name, value) => setSelected((s) => ({ ...s, [name]: value })),
        qty,
        setQty: (n) => setQty(Math.max(1, Math.min(maxQty, n))),
        price,
        variantLabel,
      }}
    >
      {children}
    </PdpContext.Provider>
  );
}

/* ------------------------------ Price + variants ------------------------- */

export function LivePrice({ mrp }: { mrp: number }) {
  const { price } = usePdp();
  const off = mrp > price ? Math.floor(((mrp - price) / mrp) * 100) : 0;
  const save = mrp - price;
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="sr-only">
          Price {formatINR(price)}. M.R.P. {formatINR(mrp)}. {off}% off.
        </span>
        <span aria-hidden="true" className="font-display text-[34px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">
          {formatINR(price)}
        </span>
        {off > 0 && (
          <span aria-hidden="true" className="text-[15px] font-semibold text-success-700">
            {off}% off
          </span>
        )}
      </p>
      {off > 0 && (
        <p className="mt-1.5 text-sm text-ink-500" aria-hidden="true">
          M.R.P. <span className="line-through tabular-nums">{formatINR(mrp)}</span>
          {save >= 100 && <span className="ml-2 font-medium text-success-700">You save {formatINR(save)}</span>}
        </p>
      )}
      <p className="mt-1 text-[13px] text-ink-500">Inclusive of all taxes</p>
    </div>
  );
}

export function VariantPicker() {
  const { data, selected, select } = usePdp();
  if (!data.variants.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {data.variants.map((v) => {
        const isSwatch = v.values.some((x) => x.swatch);
        return (
          <fieldset key={v.name}>
            <legend className="text-sm text-ink-600">
              {v.name}: <span className="font-semibold text-ink-900">{selected[v.name]}</span>
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {v.values.map((x) => {
                const on = selected[v.name] === x.label;
                if (isSwatch)
                  return (
                    <button
                      key={x.label}
                      type="button"
                      disabled={!x.available}
                      aria-pressed={on}
                      aria-label={`${x.label}${x.available ? "" : ", out of stock"}`}
                      title={x.label}
                      onClick={() => select(v.name, x.label)}
                      className={cn(
                        "relative flex size-10 items-center justify-center rounded-full ring-offset-2 transition-shadow",
                        on ? "ring-2 ring-ink-900" : "ring-1 ring-line-strong hover:ring-ink-400",
                        !x.available && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span className="size-8 rounded-full ring-1 ring-ink-900/10 ring-inset" style={{ background: x.swatch }} />
                      {!x.available && <span className="absolute h-px w-11 rotate-45 bg-ink-500" aria-hidden="true" />}
                    </button>
                  );
                return (
                  <button
                    key={x.label}
                    type="button"
                    disabled={!x.available}
                    aria-pressed={on}
                    onClick={() => select(v.name, x.label)}
                    className={cn(
                      "flex min-w-14 flex-col items-center justify-center rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                      on ? "border-ink-900 bg-ink-900 text-white" : "border-line-strong text-ink-800 hover:border-ink-500",
                      !x.available && "cursor-not-allowed border-dashed text-ink-400 line-through hover:border-line-strong",
                    )}
                  >
                    {x.label}
                    {x.price !== undefined && <span className={cn("mt-0.5 text-[11px] font-normal tabular-nums", on ? "text-white/75" : "text-ink-500")}>{formatINR(x.price)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/* -------------------------------- Delivery ------------------------------- */

function DeliveryModule() {
  const { data, price, qty } = usePdp();
  const { pincode, setPincode } = usePincode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const now = useClock();
  const info = lookupPincode(pincode);
  const o = data.offer;
  const days = promiseDays(o.deliveryDays, info, now);
  const free = data.plus || price * qty >= FREE_DELIVERY_THRESHOLD;
  const oneDay = data.plus && o.fulfilledBy === "blubuy" && info?.zone === "metro" && days > 1;
  const codReason = !o.codAvailable
    ? "Pay on delivery is not offered for this item"
    : !(info?.codAvailable ?? false)
      ? `Pay on delivery is not available for ${pincode}`
      : price * qty > COD_LIMIT
        ? `Pay on delivery is available for orders up to ${formatINR(COD_LIMIT)}`
        : null;
  const cod = !codReason;

  const submit = () => {
    if (!isValidPincode(draft)) return setError("Enter a valid 6 digit pincode");
    setPincode(draft);
    setEditing(false);
    setError(null);
  };

  return (
    <div className="rounded-xl bg-ink-50 p-4">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="flex min-w-0 items-center gap-1.5 text-ink-700">
          <MapPin size={15} className="shrink-0 text-ink-500" aria-hidden="true" />
          <span className="truncate">
            Deliver to <span className="font-semibold text-ink-900">{info?.city ?? "India"} {pincode}</span>
          </span>
        </span>
        <button type="button" onClick={() => setEditing((e) => !e)} className="shrink-0 font-semibold text-brand-700 hover:underline" aria-expanded={editing}>
          {editing ? "Cancel" : "Change"}
        </button>
      </div>
      {editing && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="pdp-pin" className="sr-only">
            Pincode
          </label>
          <input
            id="pdp-pin"
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter pincode"
            aria-invalid={!!error}
            aria-describedby={error ? "pdp-pin-err" : undefined}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-lg bg-ink-900 px-4 text-sm font-medium text-white hover:bg-ink-800">
            Check
          </button>
        </form>
      )}
      {error && (
        <p id="pdp-pin-err" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}

      {info && !info.serviceable ? (
        <div className="mt-3 rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink-700">
          <p className="font-semibold text-ink-900">Not deliverable to {pincode} yet</p>
          <p className="mt-0.5 text-ink-500">Try another pincode or save this item to your wishlist and we will let you know.</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <li className="flex gap-2.5">
            <Truck size={16} className="mt-px shrink-0 text-ink-600" aria-hidden="true" />
            <span className="text-ink-700">
              <span className="font-semibold text-ink-900">
                {free ? "Free delivery" : `${formatINR(DELIVERY_FEE)} delivery`} {days <= 1 ? promiseLabel(days) : `by ${formatPromise(new Date(now + days * 86400_000))}`}
              </span>{" "}
              <CutoffNote />
              {free && data.plus && <span className="ml-1 rounded bg-brand-50 px-1.5 py-px text-[11px] font-semibold text-brand-700">Plus</span>}
              {info && info.zone === "special" && <span className="block text-ink-500">Remote area, allow a little extra time</span>}
            </span>
          </li>
          {oneDay && (
            <li className="flex gap-2.5">
              <PackageCheck size={16} className="mt-px shrink-0 text-ink-600" aria-hidden="true" />
              <span className="text-ink-700">
                Fastest: <span className="font-semibold text-ink-900">tomorrow</span> with Plus one-day delivery
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <Banknote size={16} className="mt-px shrink-0 text-ink-600" aria-hidden="true" />
            <span className="text-ink-700">{cod ? "Pay on delivery available, cash or UPI at the door" : codReason}</span>
          </li>
          {price >= 10000 && (
            <li className="flex gap-2.5">
              <Lock size={16} className="mt-px shrink-0 text-ink-600" aria-hidden="true" />
              <span className="text-ink-700">BluBuy Secure Delivery: share a one-time code at the door</span>
            </li>
          )}
          {data.large && (
            <li className="flex gap-2.5">
              <Wrench size={16} className="mt-px shrink-0 text-ink-600" aria-hidden="true" />
              <span className="text-ink-700">Scheduled delivery slot and free installation in select cities</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------- Buy box ------------------------------- */

function QtyStepper() {
  const { qty, setQty, data } = usePdp();
  const max = Math.max(1, Math.min(10, data.offer.stock));
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-ink-600" id="pdp-qty-label">
        Quantity
      </span>
      <div className="flex h-10 items-center rounded-lg border border-line-strong" role="group" aria-labelledby="pdp-qty-label">
        <button type="button" onClick={() => setQty(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity" className="flex size-10 items-center justify-center text-ink-700 disabled:text-ink-300">
          <Minus size={15} aria-hidden="true" />
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {qty}
        </span>
        <button type="button" onClick={() => setQty(qty + 1)} disabled={qty >= max} aria-label="Increase quantity" className="flex size-10 items-center justify-center text-ink-700 disabled:text-ink-300">
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      {qty >= max && max < 10 && <span className="text-xs text-ink-500">Max {max} per order</span>}
    </div>
  );
}

export function BuyBox() {
  const { data, price, qty, variantLabel } = usePdp();
  const { has, toggle } = useWishlist();
  const { notify } = useCart();
  const o = data.offer;
  const inStock = o.stock > 0;
  const saved = has(data.id);
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="sr-only">Buying options</p>
      <p className="font-display text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(price * qty)}</p>
      {qty > 1 && <p className="mt-1 text-xs text-ink-500">{formatINR(price)} each</p>}
      {data.deal && (
        <div className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-[13px] text-accent-900 ring-1 ring-accent-100 ring-inset">
          <p className="flex items-center justify-between gap-2 font-semibold">
            {data.deal.kind === "flash" ? "Blu Flash Deal" : "Blu Deal of the Day"}
            <DealTimer endsAt={data.deal.endsAt} compact />
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent-100" aria-hidden="true">
            <div className="h-full rounded-full bg-accent-600" style={{ width: `${data.deal.claimedPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-accent-800">{data.deal.claimedPct}% claimed</p>
        </div>
      )}

      <div className="mt-4">
        <DeliveryModule />
      </div>

      <p className={cn("mt-4 text-sm font-semibold", !inStock ? "text-danger-700" : o.stock <= 8 ? "text-warning-700" : "text-success-700")}>
        {!inStock ? "Currently unavailable" : o.stock <= 8 ? `Only ${o.stock} left in stock` : "In stock"}
      </p>

      {inStock && (
        <div className="mt-3">
          <QtyStepper />
        </div>
      )}

      <div id="buy-actions" className="mt-4 flex flex-col gap-2.5">
        <AddToCartButton productId={data.id} sellerId={o.sellerId} variant={variantLabel} qty={qty} disabled={!inStock} size="lg" style="primary" className="w-full" />
        <BuyNowButton productId={data.id} sellerId={o.sellerId} variant={variantLabel} qty={qty} disabled={!inStock} className="w-full" />
      </div>

      <button
        type="button"
        onClick={() => {
          toggle(data.id);
          notify(saved ? { message: "Removed from wishlist" } : { message: "Saved to your wishlist", action: { label: "View", href: "/account/wishlist" } });
        }}
        aria-pressed={saved}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
      >
        <Heart size={16} className={saved ? "fill-danger-500 text-danger-500" : ""} aria-hidden="true" />
        {saved ? "Saved to wishlist" : "Save to wishlist"}
      </button>

      <dl className="mt-3 flex flex-col gap-2.5 border-t border-line pt-4 text-[13px]">
        <div className="flex items-start gap-2.5">
          <dt className="sr-only">Seller</dt>
          <Store size={15} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
          <dd className="min-w-0 text-ink-700">
            Sold by{" "}
            <Link href={`/store/${o.sellerSlug}`} className="font-semibold text-brand-700 hover:underline">
              {o.sellerName}
            </Link>
            <span className="mt-0.5 block text-xs text-ink-500">
              {o.sellerRating.toFixed(1)} seller rating, {formatNumber(o.sellerRatingCount)} ratings, {o.sellerCity}
            </span>
          </dd>
        </div>
        <div className="flex items-start gap-2.5">
          <dt className="sr-only">Fulfilment</dt>
          {o.assured ? (
            <BadgeCheck size={15} className="mt-px shrink-0 text-brand-600" aria-hidden="true" />
          ) : (
            <PackageCheck size={15} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
          )}
          <dd className="text-ink-700">
            {o.fulfilledBy === "blubuy" ? "Ships from a BluBuy fulfilment centre" : `Ships from the seller in ${o.sellerCity}`}
            {o.assured && <span className="block text-xs font-medium text-brand-700">BluBuy Assured: extra quality checks</span>}
          </dd>
        </div>
        <div className="flex items-start gap-2.5">
          <dt className="sr-only">Returns</dt>
          <Undo2 size={15} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
          <dd className="text-ink-700">
            <Link href="#returns" className="hover:underline">
              {data.policyShort}
            </Link>
          </dd>
        </div>
        <div className="flex items-start gap-2.5">
          <dt className="sr-only">Invoice</dt>
          <FileText size={15} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
          <dd className="text-ink-700">GST invoice available</dd>
        </div>
        <div className="flex items-start gap-2.5">
          <dt className="sr-only">Payments</dt>
          <ShieldCheck size={15} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
          <dd className="text-ink-700">Secure transaction, no extra fees at checkout</dd>
        </div>
      </dl>
      {data.otherOffers > 0 && (
        <Link
          href="#other-sellers"
          className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[13px] font-medium text-ink-800 transition-colors hover:border-ink-300"
        >
          Other sellers on BluBuy ({data.otherOffers})
          <ChevronRight size={16} className="text-ink-400" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* --------------------------- Mobile sticky buy bar ------------------------ */

export function MobileBuyBar() {
  const { data, price, qty, variantLabel } = usePdp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.getElementById("buy-actions");
        // show once the inline Add to cart / Buy now buttons have scrolled above the viewport
        setShow(!!el && el.getBoundingClientRect().bottom < 0);
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  const inStock = data.offer.stock > 0;
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(16_24_40/0.18)] backdrop-blur transition-transform duration-200 lg:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="mb-2 flex items-baseline justify-between text-xs text-ink-500">
        <span className="truncate pr-3">{data.title}</span>
        <span className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(price * qty)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <AddToCartButton productId={data.id} sellerId={data.offer.sellerId} variant={variantLabel} qty={qty} disabled={!inStock} size="lg" style="outline" className="h-11 w-full" />
        <BuyNowButton productId={data.id} sellerId={data.offer.sellerId} variant={variantLabel} qty={qty} disabled={!inStock} className="h-11 w-full" />
      </div>
    </div>
  );
}

/* ------------------------ Coupon clip (opt-in, not pre-ticked) ------------- */

export function CouponClip({ code, description }: { code: string; description: string }) {
  const { coupon, applyCoupon, notify } = useCart();
  const on = coupon === code;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-success-500/60 bg-success-50/50 px-3.5 py-3 text-[13px]">
      <input
        type="checkbox"
        checked={on}
        onChange={() => {
          applyCoupon(on ? null : code);
          notify({ message: on ? "Coupon removed" : `Coupon ${code} will apply in your cart` });
        }}
        className="mt-0.5 size-4 shrink-0 accent-brand-600"
      />
      <span className="text-ink-700">
        <span className="font-semibold text-success-700">{on ? "Coupon clipped" : "Clip coupon"}</span> {description}
        <span className="mt-0.5 block font-mono text-xs text-ink-500">{code}</span>
      </span>
      {on && <Check size={16} className="ml-auto text-success-700" aria-hidden="true" />}
    </label>
  );
}
