import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/static";

/**
 * KPI tile: label, value, signed delta vs a named period, optional sparkline.
 * Delta colour = direction x whether up is good.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs last period",
  upIsGood = true,
  icon: Icon,
  trend,
  href,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  icon?: LucideIcon;
  trend?: number[];
  href?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const good = delta === undefined ? true : delta >= 0 === upIsGood;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        {Icon && <Icon size={17} strokeWidth={1.8} className="text-ink-400" aria-hidden="true" />}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-[26px] leading-none font-semibold tracking-tight text-ink-900">{value}</p>
        {trend && <Sparkline values={trend} tone={good ? "brand" : "danger"} className="shrink-0" />}
      </div>
      {delta !== undefined && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-success-700" : "text-danger-700")}>
            {delta >= 0 ? <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" /> : <ArrowDownRight size={14} strokeWidth={2.2} aria-hidden="true" />}
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
          <span className="text-ink-500">{deltaLabel}</span>
        </p>
      )}
      {footer && <div className="mt-4 border-t border-line pt-3 text-xs text-ink-500">{footer}</div>}
    </>
  );
  const cls = cn("block rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card", href && "transition-shadow hover:shadow-raised", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
