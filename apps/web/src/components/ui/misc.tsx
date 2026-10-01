import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Star } from "lucide-react";
import type { Tone } from "@/lib/status";
import { cn, discountPercent, formatINR, initials } from "@/lib/utils";

/* ------------------------------- Avatar ------------------------------- */

const avatarHues = ["bg-brand-100 text-brand-800", "bg-accent-100 text-accent-800", "bg-success-100 text-success-700", "bg-info-100 text-info-700", "bg-danger-100 text-danger-700", "bg-ink-200 text-ink-800"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const hue = avatarHues[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarHues.length];
  const s = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-[13px]", lg: "size-12 text-base" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", s, hue, className)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/* ------------------------------ Progress ------------------------------ */

const barTone: Record<Tone, string> = {
  neutral: "bg-ink-400",
  info: "bg-info-500",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  accent: "bg-accent-500",
};
const trackTone: Record<Tone, string> = {
  neutral: "bg-ink-100",
  info: "bg-info-100",
  brand: "bg-brand-100",
  success: "bg-success-100",
  warning: "bg-warning-100",
  danger: "bg-danger-100",
  accent: "bg-accent-100",
};

/** Meter: the fill carries the state, the track is a lighter step of the same hue. */
export function Progress({
  value,
  max = 100,
  tone = "brand",
  size = "md",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2", trackTone[tone], className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", barTone[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ----------------------------- Empty state ---------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-ink-50 text-ink-500">
        <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------- Rating ------------------------------ */

/** Compact pill used on product cards: "4.4 star" on a green chip. */
export function RatingPill({ value, className }: { value: number; className?: string }) {
  // 700 steps keep white text above 4.5:1
  const tone = value >= 4 ? "bg-success-700" : value >= 3 ? "bg-accent-700" : "bg-danger-700";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-white", tone, className)}>
      {value.toFixed(1)}
      <Star size={11} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <span className="sr-only">out of 5 stars</span>
    </span>
  );
}

/** Row of five stars with partial fill. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-flex" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-ink-200" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-accent-400" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------- Price ------------------------------- */

/** Indian price display: selling price, struck M.R.P. and percent off. */
export function Price({
  price,
  mrp,
  size = "md",
  className,
  showMrpLabel = false,
}: {
  price: number;
  mrp?: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showMrpLabel?: boolean;
}) {
  const off = mrp ? discountPercent(price, mrp) : 0;
  const main = { sm: "text-[15px]", md: "text-lg", lg: "text-2xl", xl: "text-[32px] leading-none" }[size];
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {off > 0 && size === "xl" && <span className="text-2xl font-light text-danger-600">-{off}%</span>}
      <span className={cn("font-semibold tracking-tight text-ink-900 tabular-nums", main)}>{formatINR(price)}</span>
      {off > 0 && (
        <>
          <span className="text-[13px] text-ink-500 tabular-nums">
            {showMrpLabel && <span>M.R.P. </span>}
            <span className="line-through">{formatINR(mrp!)}</span>
          </span>
          {size !== "xl" && <span className="text-[13px] font-semibold text-success-700">{off}% off</span>}
        </>
      )}
    </div>
  );
}

/* ------------------------------ Kbd / Dot ----------------------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-white px-1 font-sans text-[11px] font-medium text-ink-500">
      {children}
    </kbd>
  );
}

/* ------------------------------- Stepper ------------------------------ */

export interface Step {
  label: string;
  description?: string;
}

/** Horizontal progress steps for checkout, onboarding and order tracking. */
export function Stepper({ steps, current, className }: { steps: Step[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", done || active ? "bg-brand-500" : "bg-ink-200")}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-white",
                done ? "bg-brand-600 text-white" : active ? "bg-white text-brand-700 ring-brand-100 border-2 border-brand-600" : "bg-ink-100 text-ink-500",
              )}
            >
              {done ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("mt-2 px-1 text-xs font-medium", done || active ? "text-ink-900" : "text-ink-500")}>{s.label}</span>
            {s.description && <span className="mt-0.5 hidden px-1 text-[11px] text-ink-500 sm:block">{s.description}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------- Timeline ----------------------------- */

export interface TimelineItem {
  title: ReactNode;
  time?: string;
  description?: ReactNode;
  tone?: Tone;
  done?: boolean;
}

/** Vertical event list for order tracking, audit trails and ticket history. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((it, i) => (
        <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute top-5 left-[7px] h-full w-px bg-line-strong" aria-hidden="true" />}
          <span
            className={cn(
              "relative mt-1 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1",
              it.done === false ? "bg-white ring-line-strong" : it.tone ? `${barTone[it.tone]} ring-transparent` : "bg-brand-600 ring-transparent",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className={cn("text-sm font-medium", it.done === false ? "text-ink-400" : "text-ink-900")}>{it.title}</p>
              {it.time && <p className="text-xs text-ink-500 tabular-nums">{it.time}</p>}
            </div>
            {it.description && <div className="mt-0.5 text-[13px] text-ink-500">{it.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------- Info list ------------------------------ */

/** Two-column label/value list used in detail panels. */
export function DescriptionList({ items, className, columns = 1 }: { items: { label: string; value: ReactNode }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-ink-500">{it.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-ink-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ Icon tile ----------------------------- */

const tileTone: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  info: "bg-info-50 text-info-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  accent: "bg-accent-50 text-accent-600",
};

export function IconTile({ icon: Icon, tone = "brand", size = "md", className }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-8 rounded-lg", md: "size-10 rounded-xl", lg: "size-12 rounded-2xl" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", s, tileTone[tone], className)}>
      <Icon size={size === "sm" ? 16 : size === "lg" ? 22 : 19} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
