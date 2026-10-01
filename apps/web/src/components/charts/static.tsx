import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatValue, SERIES_COLORS, type ValueFormat } from "./format";

/* ------------------------------ Sparkline ----------------------------- */

/**
 * Tiny trend line for stat tiles: the history in a quiet ink, the current
 * point in the brand accent. Decorative; the tile value carries the number.
 */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  className,
  tone = "brand",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "brand" | "success" | "danger";
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const last = pts.at(-1)!;
  const prev = pts.at(-2)!;
  const color = tone === "success" ? "var(--color-success-500)" : tone === "danger" ? "var(--color-danger-500)" : "var(--color-chart-1)";
  return (
    <svg width={width} height={height} className={cn("overflow-visible", className)} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--color-ink-300)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${prev[0]},${prev[1]}L${last[0]},${last[1]}`} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}

/* ------------------------------- Bar list ----------------------------- */

export interface BarListItem {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}

/**
 * Ranked horizontal bars (top categories, regions, products). One series, so
 * every bar wears slot 1; the label and value stay in ink.
 */
export function BarList({
  items,
  format = "number",
  className,
  showShare = false,
}: {
  items: BarListItem[];
  format?: ValueFormat;
  className?: string;
  showShare?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((it, i) => {
        const label = (
          <span className="truncate text-[13px] text-ink-700 group-hover:text-ink-900">
            {it.label}
            {it.hint && <span className="ml-1.5 text-ink-400">{it.hint}</span>}
          </span>
        );
        return (
          // labels can repeat (two sellers or products with the same name), so the index keeps keys unique
          <li key={`${it.label}-${i}`} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              {it.href ? <Link href={it.href}>{label}</Link> : label}
              <span className="shrink-0 text-[13px] font-medium text-ink-900 tabular-nums">
                {formatValue(it.value, format)}
                {showShare && <span className="ml-1.5 font-normal text-ink-400">{((it.value / total) * 100).toFixed(1)}%</span>}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-[var(--color-chart-1)]" style={{ width: `${(it.value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ Stacked bar --------------------------- */

/**
 * Part-to-whole in one horizontal bar (at most 6 segments). Segments are
 * separated by a 2px surface gap; the legend always carries label and share.
 */
export function StackedBar({
  segments,
  format = "percent",
  className,
}: {
  segments: { label: string; value: number }[];
  format?: ValueFormat;
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={cn("@container", className)}>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(1)}%`).join(", ")}>
        {segments.map((s, i) => (
          <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: SERIES_COLORS[i] }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 @md:grid-cols-2">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-ink-600">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-medium text-ink-900 tabular-nums">{format === "percent" ? `${((s.value / total) * 100).toFixed(1)}%` : formatValue(s.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- Funnel ------------------------------ */

/** Ordered stages; bars step down the brand ramp and show stage conversion. */
export function Funnel({ stages, className }: { stages: { stage: string; value: number }[]; className?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const ramp = ["var(--color-brand-700)", "var(--color-brand-600)", "var(--color-brand-500)", "var(--color-brand-400)", "var(--color-brand-300)"];
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {stages.map((s, i) => {
        const prev = stages[i - 1]?.value;
        return (
          <li key={s.stage}>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="text-ink-700">{s.stage}</span>
              <span className="tabular-nums">
                <span className="font-medium text-ink-900">{formatValue(s.value, "compact")}</span>
                {prev && <span className="ml-2 text-ink-400">{((s.value / prev) * 100).toFixed(1)}% of previous</span>}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-ink-100">
              <div className="h-full rounded-full" style={{ width: `${(s.value / max) * 100}%`, background: ramp[Math.min(i, ramp.length - 1)] }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
