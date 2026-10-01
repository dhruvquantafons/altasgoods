import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/charts/static";
import { cn } from "@/lib/utils";

export interface Kpi {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  /** neutral delta: shown in ink without a good or bad judgement */
  neutral?: boolean;
  hint?: ReactNode;
  trend?: number[];
  href?: string;
}

const layouts: Record<number, string> = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

/**
 * A row of KPIs inside one card, separated by hairlines (Stripe style). Denser
 * than a row of StatCards, so six metrics fit on a laptop screen.
 */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  const n = items.length;
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-card", className)}>
      <div className={cn("grid gap-px", layouts[n] ?? "grid-cols-2 lg:grid-cols-4")}>
        {items.map((k, i) => {
          const good = k.delta === undefined ? true : k.delta >= 0 === (k.upIsGood ?? true);
          const span = n === 5 && i === 4 ? "col-span-2 lg:col-span-1" : "";
          const body = (
            <>
              <p className="truncate text-[13px] font-medium text-ink-500">{k.label}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="min-w-0 truncate text-[22px] leading-tight font-semibold tracking-tight text-ink-900 tabular-nums sm:text-2xl">{k.value}</p>
                {k.trend && <Sparkline values={k.trend} width={52} height={22} tone={good ? "brand" : "danger"} className="mb-1 hidden shrink-0 sm:block" />}
              </div>
              {(k.delta !== undefined || k.hint) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                  {k.delta !== undefined && (
                    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", k.neutral ? "text-ink-600" : good ? "text-success-700" : "text-danger-700")}>
                      {k.delta >= 0 ? <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" /> : <ArrowDownRight size={13} strokeWidth={2.2} aria-hidden="true" />}
                      {k.delta >= 0 ? "+" : ""}
                      {k.delta.toFixed(1)}%
                    </span>
                  )}
                  {k.deltaLabel && <span className="text-ink-500">{k.deltaLabel}</span>}
                  {k.hint && <span className="text-ink-500">{k.hint}</span>}
                </p>
              )}
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className={cn("block bg-surface px-5 py-4 transition-colors hover:bg-ink-25", span)}>
              {body}
            </Link>
          ) : (
            <div key={k.label} className={cn("bg-surface px-5 py-4", span)}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
