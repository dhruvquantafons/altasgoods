import { BadgeCheck, Star } from "lucide-react";
import { cn, formatINR, formatNumber } from "@/lib/utils";

/** Discount rounded down, shown only when at least 1% (spec 15.2). */
export function percentOff(price: number, mrp: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.floor(((mrp - price) / mrp) * 100);
}

/**
 * Storefront price row: selling price, struck M.R.P. and "% off" in green.
 * Local variant of ui/Price: rounds the discount down and keeps the "M.R.P."
 * label outside the strike-through.
 */
export function PriceRow({
  price,
  mrp,
  size = "md",
  mrpLabel = false,
  className,
}: {
  price: number;
  mrp: number;
  size?: "sm" | "md" | "lg" | "xl";
  mrpLabel?: boolean;
  className?: string;
}) {
  const off = percentOff(price, mrp);
  const main = { sm: "text-[15px]", md: "text-lg", lg: "text-2xl", xl: "text-[34px] leading-none" }[size];
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className="sr-only">
        Price {formatINR(price)}.{off > 0 ? ` M.R.P. ${formatINR(mrp)}. ${off}% off.` : ""}
      </span>
      <span aria-hidden="true" className={cn("font-semibold tracking-tight text-ink-900 tabular-nums", main)}>
        {formatINR(price)}
      </span>
      {off > 0 && (
        <span aria-hidden="true" className={cn("text-ink-500 tabular-nums", size === "xl" || size === "lg" ? "text-sm" : "text-[13px]")}>
          {mrpLabel && "M.R.P. "}
          <span className="line-through">{formatINR(mrp)}</span>
        </span>
      )}
      {off > 0 && (
        <span aria-hidden="true" className={cn("font-semibold text-success-700", size === "xl" || size === "lg" ? "text-[15px]" : "text-[13px]")}>
          {off}% off
        </span>
      )}
    </p>
  );
}

/** Compact green rating chip plus count. Omitted entirely when there are no ratings. */
export function RatingChip({ rating, count, className }: { rating: number; count: number; className?: string }) {
  if (!count) return null;
  const tone = rating >= 4 ? "bg-success-700" : rating >= 3 ? "bg-accent-700" : "bg-danger-600";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="sr-only">
        Rated {rating.toFixed(1)} out of 5 from {formatNumber(count)} ratings
      </span>
      <span aria-hidden="true" className={cn("inline-flex h-5 items-center gap-0.5 rounded-md px-1.5 text-xs font-semibold text-white tabular-nums", tone)}>
        {rating.toFixed(1)}
        <Star size={10} fill="currentColor" strokeWidth={0} />
      </span>
      <span aria-hidden="true" className="text-xs text-ink-500 tabular-nums">
        ({formatNumber(count)})
      </span>
    </span>
  );
}

export function AssuredMark({ className, label = "Assured" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700", className)} title="AltasGoods Assured: quality checked, faster delivery, easy returns">
      <BadgeCheck size={14} strokeWidth={2} className="fill-brand-50" aria-hidden="true" />
      <span>
        <span className="sr-only">AltasGoods </span>
        {label}
      </span>
    </span>
  );
}
