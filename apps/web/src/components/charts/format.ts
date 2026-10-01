import { formatCompact, formatINR, formatNumber } from "@/lib/utils";

/**
 * Value formats are passed to charts as strings (not functions) so server
 * components can render client charts without crossing the boundary with a function.
 */
export type ValueFormat = "number" | "compact" | "inr" | "inrCompact" | "percent";

export function formatValue(v: number, fmt: ValueFormat = "number") {
  switch (fmt) {
    case "compact":
      return formatCompact(v);
    case "inr":
      return formatINR(v);
    case "inrCompact":
      return formatCompact(v, true);
    case "percent":
      return `${Math.round(v * 10) / 10}%`;
    default:
      return formatNumber(Math.round(v));
  }
}

/** Axis ticks use compact notation so labels stay short. */
export function formatTick(v: number, fmt: ValueFormat = "number") {
  if (fmt === "inr" || fmt === "inrCompact") return formatCompact(v, true);
  if (fmt === "percent") return `${Math.round(v)}%`;
  return formatCompact(v);
}

/** Rounds a max value up to a clean axis maximum and returns evenly spaced ticks. */
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/**
 * Evenly spaced x label positions that always include the last point. When
 * `plotWidth` is given, a regular label too close to the end label is dropped
 * so the two never collide.
 */
export function xLabelIndexes(n: number, step: number, plotWidth?: number) {
  const shown = new Set<number>();
  for (let i = 0; i < n; i += step) shown.add(i);
  if (n > 1 && !shown.has(n - 1)) {
    const lastRegular = n - 1 - ((n - 1) % step);
    const gapPx = plotWidth ? ((n - 1 - lastRegular) / (n - 1)) * plotWidth : Infinity;
    if (lastRegular !== 0 && (n - 1 - lastRegular < step * 0.6 || gapPx < 78)) shown.delete(lastRegular);
    shown.add(n - 1);
  }
  return shown;
}

/** A finite number, or null for gaps (missing, null or non-numeric values). */
export function numeric(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Categorical slots in the validated order. Assign in order, never cycle past 8. */
export const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];
