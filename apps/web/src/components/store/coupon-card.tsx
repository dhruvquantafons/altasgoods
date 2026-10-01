"use client";

import { Check, Scissors } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { useCart } from "./cart-context";
import { formatDayMonth } from "./delivery";
import type { CouponLite } from "./types";

/** Collectable coupon: saved to the cart and applied at checkout if eligible. Never auto-applied. */
export function CouponCard({ coupon: c }: { coupon: CouponLite }) {
  const { coupon, applyCoupon, notify } = useCart();
  const on = coupon === c.code;
  return (
    <div className={cn("relative flex overflow-hidden rounded-2xl border bg-white", on ? "border-success-500/50" : "border-line")}>
      <div className={cn("flex w-24 shrink-0 flex-col items-center justify-center px-2 text-center", on ? "bg-success-50 text-success-700" : "bg-accent-50 text-accent-900")}>
        <span className="font-display text-xl leading-none font-semibold">{c.type === "percent" ? `${c.value}%` : formatINR(c.value)}</span>
        <span className="mt-1 text-[11px] font-semibold tracking-wide uppercase">off</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 border-l border-dashed border-line-strong p-4">
        <p className="text-sm font-medium text-ink-900">{c.description}</p>
        <p className="text-xs text-ink-500">
          {c.minOrder ? `Min order ${formatINR(c.minOrder)}` : "No minimum"}
          {c.maxDiscount ? `, up to ${formatINR(c.maxDiscount)}` : ""}. Valid till {formatDayMonth(c.endsAt)}.
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-xs font-semibold text-ink-800">{c.code}</span>
          <button
            type="button"
            onClick={() => {
              applyCoupon(on ? null : c.code);
              notify(on ? { message: "Coupon removed from cart" } : { message: `${c.code} saved to your cart`, action: { label: "View cart", href: "/cart" } });
            }}
            aria-pressed={on}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
              on ? "bg-success-50 text-success-700" : "bg-ink-900 text-white hover:bg-ink-800",
            )}
          >
            {on ? <Check size={14} aria-hidden="true" /> : <Scissors size={14} aria-hidden="true" />}
            {on ? "Collected" : "Collect"}
          </button>
        </div>
      </div>
    </div>
  );
}
