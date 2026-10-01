"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { formatTick, formatValue, niceTicks, numeric, SERIES_COLORS, xLabelIndexes, type ValueFormat } from "./format";
import { useWidth } from "./use-width";

export interface ChartSeries {
  key: string;
  label: string;
  /** index into the categorical palette; defaults to the series position */
  slot?: number;
}

export interface ChartDatum {
  /** x axis label, already formatted (e.g. "28 Sep") */
  label: string;
  /** a missing or null value draws a gap, so a series can stop at the last completed period */
  [key: string]: number | string | null | undefined;
}

/**
 * Line / area chart for change over time. One y axis only, thin 2px lines,
 * a 10% wash under each line, crosshair tooltip that lists every series.
 * Missing values break the line instead of dropping to zero.
 */
export function AreaChart({
  data,
  series,
  height = 260,
  format = "number",
  area = true,
  className,
  ariaLabel,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  height?: number;
  format?: ValueFormat;
  area?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  const pad = { top: 14, right: 14, bottom: 28, left: 48 };
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => numeric(d[s.key]) ?? 0)));
  const ticks = niceTicks(max, 4);
  const top = ticks.at(-1)!;
  const n = data.length;
  const x = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / top) * ih;
  const colorOf = (s: ChartSeries, i: number) => SERIES_COLORS[s.slot ?? i] ?? SERIES_COLORS[0]!;

  const maxLabels = Math.max(2, Math.floor(iw / 72));
  const labelStep = Math.max(1, Math.ceil(n / maxLabels));
  const shownLabels = xLabelIndexes(n, labelStep, iw);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === "Escape") setHover(null);
  }

  const tipLeft = hover !== null ? x(hover) : 0;
  const flip = tipLeft > width * 0.62;

  return (
    <div className={cn("relative w-full", className)}>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-600">
              <span className="h-0.5 w-3 rounded-full" style={{ background: colorOf(s, i) }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative w-full min-w-0" style={{ minHeight: height }}>
        {measured !== null && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel ?? `Chart of ${series.map((s) => s.label).join(", ")}`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded-md"
          >
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`${gid}-g${i}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(s, i)} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={colorOf(s, i)} stopOpacity={0.01} />
                </linearGradient>
              ))}
            </defs>

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

            {data.map((d, i) =>
              shownLabels.has(i) ? (
                <text
                  key={d.label + i}
                  x={x(i)}
                  y={height - 8}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  className="fill-ink-400 text-[11px]"
                >
                  {d.label}
                </text>
              ) : null,
            )}

            {series.map((s, si) => {
              // split into contiguous runs so gaps stay gaps
              const runs: [number, number][][] = [];
              let run: [number, number][] = [];
              data.forEach((d, i) => {
                const v = numeric(d[s.key]);
                if (v === null) {
                  if (run.length) runs.push(run);
                  run = [];
                } else run.push([x(i), y(v)]);
              });
              if (run.length) runs.push(run);
              const toPath = (r: [number, number][]) => r.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
              const last = runs.at(-1)?.at(-1);
              return (
                <g key={s.key}>
                  {area &&
                    runs.map((r, ri) =>
                      r.length > 1 ? (
                        <path key={ri} d={`${toPath(r)}L${r.at(-1)![0].toFixed(1)},${y(0)}L${r[0]![0].toFixed(1)},${y(0)}Z`} fill={`url(#${gid}-g${si})`} />
                      ) : null,
                    )}
                  {runs.map((r, ri) => (
                    <path key={ri} d={toPath(r)} fill="none" stroke={colorOf(s, si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                  {last && hover === null && <circle cx={last[0]} cy={last[1]} r={4} fill={colorOf(s, si)} stroke="var(--color-surface)" strokeWidth={2} />}
                </g>
              );
            })}

            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--color-ink-300)" strokeWidth={1} shapeRendering="crispEdges" />
                {series.map((s, si) => {
                  const v = numeric(data[hover]?.[s.key]);
                  return v === null ? null : (
                    <circle key={s.key} cx={x(hover)} cy={y(v)} r={4.5} fill={colorOf(s, si)} stroke="var(--color-surface)" strokeWidth={2} />
                  );
                })}
              </g>
            )}

            <rect x={pad.left} y={pad.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}

        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-pop backdrop-blur-sm animate-fade-in"
            style={{
              top: pad.top,
              left: flip ? undefined : tipLeft + 14,
              right: flip ? width - tipLeft + 14 : undefined,
            }}
          >
            <p className="mb-1.5 text-[11px] font-medium text-ink-500">{data[hover].label}</p>
            <div className="flex flex-col gap-1">
              {series.map((s, si) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-2.5 rounded-full" style={{ background: colorOf(s, si) }} aria-hidden="true" />
                  <span className="text-[13px] font-semibold text-ink-900 tabular-nums">
                    {numeric(data[hover]![s.key]) === null ? "No data yet" : formatValue(numeric(data[hover]![s.key])!, format)}
                  </span>
                  <span className="text-xs text-ink-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{ariaLabel ?? "Chart data"}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{numeric(d[s.key]) === null ? "No data" : formatValue(numeric(d[s.key])!, format)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
