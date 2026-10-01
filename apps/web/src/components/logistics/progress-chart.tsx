"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatTick, formatValue, niceTicks } from "@/components/charts/format";
import { useWidth } from "@/components/charts/use-width";
import { cn } from "@/lib/utils";

export interface ProgressPoint {
  label: string;
  /** null where the period has not completed yet, so the line simply stops */
  today: number | null;
  yesterday: number;
  plan: number;
}

/**
 * Cumulative progress against plan. The shared AreaChart treats missing values
 * as zero, so this variant lets the "today" series stop at the last completed
 * hour instead of dropping to the axis. One y axis, three series: today (brand),
 * yesterday (quiet ink) and plan (dashed target line).
 */
export function ProgressChart({ data, height = 260, ariaLabel }: { data: ProgressPoint[]; height?: number; ariaLabel: string }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 16, right: 18, bottom: 28, left: 44 };
  const iw = Math.max(10, width - pad.left - pad.right);
  const ih = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.today ?? 0, d.yesterday, d.plan]));
  const ticks = niceTicks(max, 4);
  const top = ticks.at(-1)!;
  const n = data.length;
  const x = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.top + ih - (v / top) * ih;
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));

  const path = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${i === 0 || vals[i - 1] === null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join("");

  const todayVals = data.map((d) => d.today);
  const lastToday = todayVals.reduce<number>((acc, v, i) => (v === null ? acc : i), -1);
  const todayLine = path(todayVals);
  const todayArea = lastToday > 0 ? `${todayLine}L${x(lastToday).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";

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
  const flip = tipLeft > width * 0.6;
  const hp = hover !== null ? data[hover] : undefined;

  return (
    <div className="relative w-full overflow-hidden">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-[var(--color-chart-1)]" aria-hidden="true" />
          Today, completed hours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-ink-300" aria-hidden="true" />
          Yesterday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="2" aria-hidden="true">
            <line x1="0" x2="14" y1="1" y2="1" stroke="var(--color-ink-500)" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          Plan
        </span>
      </div>
      <div ref={ref} className="relative w-full min-w-0" style={{ minHeight: height }}>
        {measured !== null && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="block overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            <defs>
              <linearGradient id="hub-today-wash" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.01} />
              </linearGradient>
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
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % step === 0 || i === n - 1 ? (
                <text
                  key={d.label}
                  x={x(i)}
                  y={height - 8}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  className="fill-ink-400 text-[11px]"
                >
                  {d.label}
                </text>
              ) : null,
            )}

            <path
              d={path(data.map((d) => d.yesterday))}
              fill="none"
              stroke="var(--color-ink-300)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path d={path(data.map((d) => d.plan))} fill="none" stroke="var(--color-ink-500)" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
            {todayArea && <path d={todayArea} fill="url(#hub-today-wash)" />}
            <path d={todayLine} fill="none" stroke="var(--color-chart-1)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {lastToday >= 0 && hover === null && (
              <>
                <circle cx={x(lastToday)} cy={y(todayVals[lastToday]!)} r={4.5} fill="var(--color-chart-1)" stroke="var(--color-surface)" strokeWidth={2} />
                <text x={x(lastToday) - 8} y={y(todayVals[lastToday]!) - 10} textAnchor="end" className="fill-ink-900 text-[12px] font-semibold tabular-nums">
                  {formatValue(todayVals[lastToday]!)}
                </text>
              </>
            )}

            {hover !== null && hp && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--color-ink-300)" strokeWidth={1} shapeRendering="crispEdges" />
                <circle cx={x(hover)} cy={y(hp.plan)} r={4} fill="var(--color-surface)" stroke="var(--color-ink-500)" strokeWidth={1.5} />
                <circle cx={x(hover)} cy={y(hp.yesterday)} r={4} fill="var(--color-ink-300)" stroke="var(--color-surface)" strokeWidth={2} />
                {hp.today !== null && (
                  <circle cx={x(hover)} cy={y(hp.today)} r={4.5} fill="var(--color-chart-1)" stroke="var(--color-surface)" strokeWidth={2} />
                )}
              </g>
            )}
            <rect x={pad.left} y={pad.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}

        {hover !== null && hp && (
          <div
            className="pointer-events-none absolute z-10 min-w-40 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-pop backdrop-blur-sm animate-fade-in"
            style={{ top: pad.top, left: flip ? undefined : tipLeft + 14, right: flip ? width - tipLeft + 14 : undefined }}
          >
            <p className="mb-1.5 text-[11px] font-medium text-ink-500">Delivered by {hp.label}</p>
            <div className="flex flex-col gap-1 text-[13px]">
              <Row swatch="bg-[var(--color-chart-1)]" label="Today" value={hp.today === null ? "Not yet" : formatValue(hp.today)} />
              <Row swatch="bg-ink-300" label="Yesterday" value={formatValue(hp.yesterday)} />
              <Row swatch="bg-ink-500" label="Plan" value={formatValue(hp.plan)} />
            </div>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Today</th>
            <th scope="col">Yesterday</th>
            <th scope="col">Plan</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.today ?? "Not yet"}</td>
              <td>{d.yesterday}</td>
              <td>{d.plan}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-0.5 w-2.5 rounded-full", swatch)} aria-hidden="true" />
      <span className="font-semibold text-ink-900 tabular-nums">{value}</span>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}
