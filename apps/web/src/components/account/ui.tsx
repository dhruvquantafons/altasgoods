import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Price, RatingPill } from "@/components/ui/misc";
import type { Product } from "@/lib/types";
import type { Tone } from "@/lib/status";
import { cn, formatCompact } from "@/lib/utils";
import { TRACK_STEPS } from "./lib";

/** Account section card: white surface, hairline border, optional header row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn("px-5 pt-4 pb-5 sm:px-6", !(title || action) && "pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small "View all" style link used in section headers. */
export function MoreLink({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
      {children}
      <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Product card for recommendation and recently viewed rails. */
export function ProductTile({ product, note, className }: { product: Product; note?: string; className?: string }) {
  return (
    <Link href={`/p/${product.slug}`} className={cn("group block min-w-0", className)}>
      <div className="overflow-hidden rounded-xl">
        <ProductImage src={product.image} alt={product.title} rounded="xl" sizes="(min-width: 1280px) 170px, (min-width: 640px) 25vw, 42vw" className="transition-transform duration-300 group-hover:scale-[1.02]" />
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] leading-snug font-medium text-ink-800 group-hover:text-brand-700">{product.title}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <RatingPill value={product.rating} />
        <span className="text-xs text-ink-500">({formatCompact(product.ratingCount)})</span>
      </div>
      <Price price={product.price} mrp={product.mrp} size="sm" className="mt-1.5" />
      {note && <p className="mt-1 truncate text-xs text-ink-500">{note}</p>}
    </Link>
  );
}

/** Horizontal scroller on small screens, grid on large screens. */
export function ProductRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-1 scrollbar-none sm:-mx-6 sm:px-6",
        "[&>*]:w-[42%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[28%] md:[&>*]:w-[22%] xl:grid xl:grid-cols-6 xl:overflow-visible xl:[&>*]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Five segment tracking meter for compact rows (Ordered to Delivered). */
export function TrackMeter({ current, className }: { current: number; className?: string }) {
  const reached = Math.min(current, TRACK_STEPS.length);
  const label = current >= TRACK_STEPS.length ? "Delivered" : TRACK_STEPS[Math.max(0, current - 1)];
  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-1" role="img" aria-label={`Progress: ${label}, step ${reached} of ${TRACK_STEPS.length}`}>
        {TRACK_STEPS.map((s, i) => (
          <span key={s} className={cn("h-1.5 flex-1 rounded-full", i < reached ? (current >= TRACK_STEPS.length ? "bg-success-500" : "bg-brand-500") : "bg-ink-100")} />
        ))}
      </div>
      <div className="mt-1.5 hidden justify-between text-[11px] text-ink-500 sm:flex" aria-hidden="true">
        <span>Ordered</span>
        <span>Delivered</span>
      </div>
    </div>
  );
}

/** Label and value rows (price breakdowns, summaries). */
export function KeyValue({ label, value, strong, tone, className }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "success" | "muted"; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 text-[13.5px]", strong && "text-[15px]", className)}>
      <dt className={cn(strong ? "font-semibold text-ink-900" : "text-ink-600")}>{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "font-semibold text-ink-900" : "font-medium text-ink-900",
          tone === "success" && "text-success-700",
          tone === "muted" && "text-ink-500",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const tileTone: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  info: "bg-info-50 text-info-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  accent: "bg-accent-50 text-accent-700",
};

/** Round icon chip used in lists. */
export function IconDot({ icon: Icon, tone = "neutral", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full", tileTone[tone], className)}>
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

/** Vertical event list where future steps are hollow (returns, tickets). */
export function StepList({ items, className }: { items: { label: string; at?: string; note?: string; done: boolean }[]; className?: string }) {
  const lastDone = items.map((i) => i.done).lastIndexOf(true);
  return (
    <ol className={cn("relative", className)}>
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 && (
            <span className={cn("absolute top-5 left-[9px] h-[calc(100%-12px)] w-px", i < lastDone ? "bg-brand-300" : "bg-line-strong")} aria-hidden="true" />
          )}
          <span
            className={cn(
              "relative mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full",
              it.done ? (i === lastDone ? "bg-brand-600 text-white ring-4 ring-brand-50" : "bg-brand-100 text-brand-700") : "border border-dashed border-ink-300 bg-white",
            )}
            aria-hidden="true"
          >
            {it.done && <Check size={11} strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[13.5px] leading-5", it.done ? "font-medium text-ink-900" : "text-ink-500")}>{it.label}</p>
            {(it.at || it.note) && (
              <p className="mt-0.5 text-xs text-ink-500">
                {it.at}
                {it.at && it.note ? " · " : ""}
                {it.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Soft inline notice (info, success, warning, danger). */
export function Notice({ tone = "info", icon: Icon, title, children, action, className }: { tone?: Tone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const styles: Record<Tone, string> = {
    neutral: "border-line bg-ink-50 text-ink-700",
    info: "border-info-100 bg-info-50 text-info-700",
    brand: "border-brand-100 bg-brand-50 text-brand-800",
    success: "border-success-100 bg-success-50 text-success-700",
    warning: "border-warning-100 bg-warning-50 text-warning-700",
    danger: "border-danger-100 bg-danger-50 text-danger-700",
    accent: "border-accent-100 bg-accent-50 text-accent-800",
  };
  return (
    <div className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-[13px]", styles[tone], className)}>
      {Icon && <Icon size={17} strokeWidth={1.9} aria-hidden="true" className="mt-px shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-ink-700")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
