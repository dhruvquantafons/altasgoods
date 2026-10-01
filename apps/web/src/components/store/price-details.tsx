import type { ReactNode } from "react";
import { cn, formatINR } from "@/lib/utils";
import type { Totals } from "./pricing";

/**
 * The one price breakdown used in cart and checkout: M.R.P. total, discount,
 * coupon, delivery, any payment adjustments, total and savings. Every amount
 * the customer pays is visible here before payment.
 */
export function PriceDetails({
  totals,
  extra = [],
  totalLabel = "Total amount",
  footer,
  className,
  plus,
}: {
  totals: Totals;
  extra?: { label: string; value: number; note?: string }[];
  totalLabel?: string;
  footer?: ReactNode;
  className?: string;
  plus?: boolean;
}) {
  const extraOff = extra.reduce((a, e) => a + e.value, 0);
  const payable = Math.max(0, totals.total - extraOff);
  const savings = totals.savings + extraOff;
  return (
    <section aria-label="Price details" className={cn("rounded-2xl border border-line bg-white", className)}>
      <h2 className="border-b border-line px-5 py-3.5 text-xs font-semibold tracking-wider text-ink-500 uppercase">Price details</h2>
      <dl className="flex flex-col gap-3 px-5 py-4 text-sm">
        <Row label={`Price (${totals.itemCount} item${totals.itemCount === 1 ? "" : "s"})`} value={formatINR(totals.mrpTotal)} hint="Sum of M.R.P." />
        {totals.mrpDiscount > 0 && <Row label="Discount on M.R.P." value={`-${formatINR(totals.mrpDiscount)}`} green />}
        {totals.coupon && (
          <Row
            label={`Coupon ${totals.coupon.code}`}
            value={totals.couponDiscount ? `-${formatINR(totals.couponDiscount)}` : "Not applied"}
            green={totals.couponDiscount > 0}
            hint={totals.couponNote ?? undefined}
          />
        )}
        <Row
          label="Delivery charges"
          value={totals.delivery === 0 ? "Free" : formatINR(totals.delivery)}
          green={totals.delivery === 0}
          hint={totals.delivery === 0 ? (plus ? "BluBuy Plus benefit" : undefined) : `₹40 per seller shipment under ₹499`}
        />
        {extra.map((e) => (
          <Row key={e.label} label={e.label} value={`-${formatINR(e.value)}`} green hint={e.note} />
        ))}
      </dl>
      <dl className="mx-5 flex items-baseline justify-between border-t border-dashed border-line-strong py-4">
        <dt className="text-base font-semibold text-ink-900">{totalLabel}</dt>
        <dd className="font-display text-xl font-semibold text-ink-900 tabular-nums">{formatINR(payable)}</dd>
      </dl>
      {savings > 0 && (
        <p className="mx-5 mb-4 rounded-lg bg-success-50 px-3 py-2 text-[13px] font-semibold text-success-700">You will save {formatINR(savings)} on this order</p>
      )}
      <p className="mx-5 mb-4 text-xs leading-relaxed text-ink-500">Prices include GST. BluBuy adds no payment handling or cash on delivery charges.</p>
      {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
    </section>
  );
}

function Row({ label, value, green, hint }: { label: string; value: string; green?: boolean; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-700">
        {label}
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </dt>
      <dd className={cn("shrink-0 tabular-nums", green ? "font-medium text-success-700" : "text-ink-900")}>{value}</dd>
    </div>
  );
}
