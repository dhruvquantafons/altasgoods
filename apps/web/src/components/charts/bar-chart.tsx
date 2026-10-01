"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChartDatum, ChartSeries } from "./area-chart";
import { formatTick, formatValue, niceTicks, SERIES_COLORS, xLabelIndexes, type ValueFormat } from "./format";
import { useWidth } from "./use-width";

/** Column path with a 4px rounded data-end and a square baseline. */
function column(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Vertical column chart for magnitude by period or category. Supports grouped
 * series; columns are capped at 24px with a 2px surface gap between neighbours.
 * `emphasis` highlights one column (e.g. today) and quiets the rest.
 */
export function BarChart({
  data,
  series,
  height = 240,
  format = "number",
  emphasis,
  className,
  ariaLabel,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  height?: number;
  format?: ValueFormat;
  emphasis?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 8, bottom: 28, left: 48 };
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const n = Math.max(1, data.length);
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const ticks = niceTicks(max, 4);
  const top = ticks.at(-1)!;
  const band = iw / n;
  const groupW = Math.min(band * 0.72, 24 * series.length + 2 * (series.length - 1));
  const barW = (groupW - 2 * (series.length - 1)) / series.length;
  const y = (v: number) => pad.top + ih - (v / top) * ih;
  const colorOf = (s: ChartSeries, i: number) => SERIES_COLORS[s.slot ?? i] ?? SERIES_COLORS[0]!;
  const shownLabels = xLabelIndexes(n, Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56)))), iw);

  const tipX = hover !== null ? pad.left + band * hover + band / 2 : 0;
  const flip = tipX > width * 0.62;

  return (
    <div className={cn("relative w-full", className)}>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
              <span className="size-2.5 rounded-[3px]" style={{ background: colorOf(s, i) }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative w-full min-w-0" style={{ minHeight: height }}>
        {measured !== null && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel ?? "Bar chart"} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={pad.left + iw}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--color-chart-axis)" : "var(--color-chart-grid)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[11px] tabular-nums">
                  {formatTick(t, format)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const gx = pad.left + band * i + (band - groupW) / 2;
              const quiet = (hover !== null && hover !== i) || (hover === null && emphasis !== undefined && emphasis !== i);
              return (
                <g
                  key={d.label + i}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${d.label}: ${series.map((s) => `${s.label} ${formatValue(Number(d[s.key]) || 0, format)}`).join(", ")}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  <rect x={pad.left + band * i} y={pad.top} width={band} height={ih} fill="transparent" />
                  {series.map((s, si) => {
                    const v = Number(d[s.key]) || 0;
                    const h = (v / top) * ih;
                    return (
                      <path
                        key={s.key}
                        d={column(gx + si * (barW + 2), y(v), barW, h)}
                        fill={colorOf(s, si)}
                        opacity={quiet ? 0.38 : 1}
                        className="transition-opacity duration-150"
                      />
                    );
                  })}
                  {shownLabels.has(i) && (
                    <text x={pad.left + band * i + band / 2} y={height - 8} textAnchor="middle" className="fill-ink-400 text-[11px]">
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute z-10 min-w-32 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-pop backdrop-blur-sm animate-fade-in"
            style={{ top: pad.top, left: flip ? undefined : tipX + 16, right: flip ? width - tipX + 16 : undefined }}
          >
            <p className="mb-1.5 text-[11px] font-medium text-ink-500">{data[hover].label}</p>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="h-0.5 w-2.5 rounded-full" style={{ background: colorOf(s, si) }} aria-hidden="true" />
                <span className="text-[13px] font-semibold text-ink-900 tabular-nums">{formatValue(Number(data[hover]![s.key]) || 0, format)}</span>
                <span className="text-xs text-ink-500">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
