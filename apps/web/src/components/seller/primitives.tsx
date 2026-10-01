import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Building2, Clock, PackageOpen, Truck, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";
import { CHANNEL_LABEL, slaFor, type Channel } from "./shared";

/* Server-safe building blocks shared by every Seller Hub page. */

const channelIcon: Record<Channel, LucideIcon> = { fulfilled: Warehouse, ship: Truck, flex: Building2, self: PackageOpen };
const channelTone: Record<Channel, Tone> = { fulfilled: "brand", ship: "neutral", flex: "info", self: "neutral" };

/** Fulfilment channel as a quiet pill with an icon (never a status colour). */
export function ChannelBadge({ channel, size = "sm", className }: { channel: Channel; size?: "sm" | "md"; className?: string }) {
  return (
    <Badge tone={channelTone[channel]} icon={channelIcon[channel]} size={size} className={className}>
      {CHANNEL_LABEL[channel]}
    </Badge>
  );
}

/** Identifiers (order, AWB, SKU, BSIN, UTR) in the mono face. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[13px] tracking-tight", className)}>{children}</span>;
}

const slaText: Record<Tone, string> = {
  neutral: "text-ink-600",
  info: "text-info-700",
  brand: "text-brand-700",
  success: "text-success-700",
  warning: "text-warning-700",
  danger: "text-danger-700",
  accent: "text-accent-700",
};

/** Countdown to a deadline; warning under `warnHours`, danger once overdue. Words carry the meaning, colour supports it. */
export function SlaText({ dueAt, warnHours, className }: { dueAt: string; warnHours?: number; className?: string }) {
  const sla = slaFor(dueAt, warnHours);
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium tabular-nums", slaText[sla.tone], className)}>
      <Clock size={13} strokeWidth={2} aria-hidden="true" />
      {sla.label}
    </span>
  );
}

/** Label and amount rows for fee breakdowns and statements. Negative values are deductions. */
export function AmountRows({
  rows,
  total,
  className,
  paise = false,
}: {
  rows: { label: ReactNode; value: number; hint?: ReactNode; muted?: boolean }[];
  total?: { label: ReactNode; value: number; hint?: ReactNode };
  className?: string;
  paise?: boolean;
}) {
  return (
    <dl className={cn("text-[13px]", className)}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-1.5">
          <dt className={cn("min-w-0", r.muted ? "text-ink-500" : "text-ink-600")}>
            {r.label}
            {r.hint && <span className="ml-1.5 text-xs text-ink-500">{r.hint}</span>}
          </dt>
          <dd className={cn("shrink-0 tabular-nums", r.value < 0 ? "text-ink-700" : "text-ink-900", r.muted && "text-ink-500")}>
            {r.value < 0 ? "-" : ""}
            {formatINR(Math.abs(r.value), { paise })}
          </dd>
        </div>
      ))}
      {total && (
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-medium text-ink-900">
            {total.label}
            {total.hint && <span className="mt-0.5 block text-xs font-normal text-ink-500">{total.hint}</span>}
          </dt>
          <dd className="shrink-0 text-[15px] font-semibold text-ink-900 tabular-nums">
            {total.value < 0 ? "-" : ""}
            {formatINR(Math.abs(total.value), { paise })}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Signed rupee amount for table cells: deductions in ink with a minus sign. */
export function Amount({ value, className, paise, plus }: { value: number; className?: string; paise?: boolean; plus?: boolean }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {value < 0 ? "-" : plus && value > 0 ? "+" : ""}
      {formatINR(Math.abs(value), { paise })}
    </span>
  );
}

const calloutTone: Record<Tone, string> = {
  neutral: "border-line bg-ink-50/70 text-ink-700",
  info: "border-info-100 bg-info-50/70 text-info-700",
  brand: "border-brand-100 bg-brand-50/60 text-brand-800",
  success: "border-success-100 bg-success-50/70 text-success-700",
  warning: "border-warning-100 bg-warning-50/80 text-warning-700",
  danger: "border-danger-100 bg-danger-50/70 text-danger-700",
  accent: "border-accent-100 bg-accent-50 text-accent-800",
};

/** Tinted note for policy reminders, warnings and next steps. */
export function Callout({
  tone = "neutral",
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", calloutTone[tone], className)}>
      {Icon && <Icon size={17} strokeWidth={1.9} className="mt-px shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5" : "", "text-ink-700")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** One metric inside a summary strip: label, value and an optional hint. */
export function MiniStat({ label, value, hint, tone, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[12px] font-medium text-ink-500">{label}</p>
      <p className={cn("mt-1 truncate text-[20px] leading-tight font-semibold tracking-tight text-ink-900 tabular-nums", tone && slaText[tone])}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** A card-width strip of MiniStats separated by hairlines; wraps to two columns on small screens. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-card md:grid-cols-4",
        "[&>*]:bg-surface [&>*]:px-5 [&>*]:py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Small "product thumbnail + title + meta" cell used in tables. Image is passed as a node so callers pick the size. */
export function ProductCell({ image, title, meta, href, className }: { image: ReactNode; title: string; meta?: ReactNode; href?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {image}
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="block max-w-[18rem] truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
            {title}
          </Link>
        ) : (
          <p className="max-w-[18rem] truncate text-[13px] font-medium text-ink-900">{title}</p>
        )}
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">{meta}</div>}
      </div>
    </div>
  );
}

/** Value against a target with a pass or fail word, for health and tier gates. */
export function TargetMeter({
  value,
  target,
  comparator,
  max,
  className,
}: {
  value: number;
  target: number;
  comparator: "under" | "over";
  max?: number;
  className?: string;
}) {
  const ok = comparator === "under" ? value < target : value >= target;
  const scale = max ?? Math.max(target * 2, value * 1.15);
  const pct = Math.min(100, (value / scale) * 100);
  const tpct = Math.min(100, (target / scale) * 100);
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-ink-100", className)} role="img" aria-label={`${ok ? "On target" : "Off target"}: ${value} against a target ${comparator} ${target}`}>
      <div className={cn("h-full rounded-full", ok ? "bg-success-500" : "bg-danger-500")} style={{ width: `${pct}%` }} />
      <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink-700" style={{ left: `calc(${tpct}% - 1px)` }} aria-hidden="true" />
    </div>
  );
}

/** Label/value pairs laid out as a definition grid for detail pages. */
export function InfoGrid({ items, columns = 2, className }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-ink-500">{it.label}</dt>
          <dd className="mt-1 text-sm text-ink-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small uppercase-free group label inside cards. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs font-medium text-ink-500", className)}>{children}</p>;
}
