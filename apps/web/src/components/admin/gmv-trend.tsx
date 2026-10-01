"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import { cn, formatCompact } from "@/lib/utils";

export interface TrendPoint {
  label: string;
  gmv: number;
  orders: number;
}

const PRESETS = [
  { key: "7", label: "7 days", n: 7 },
  { key: "30", label: "30 days", n: 30 },
  { key: "90", label: "90 days", n: 90 },
] as const;

const METRICS = [
  { key: "gmv", label: "GMV" },
  { key: "orders", label: "Orders" },
] as const;

function Segmented<K extends string>({ items, value, onChange, label }: { items: readonly { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          role="radio"
          aria-checked={value === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            "h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
            value === it.key ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * GMV or orders over completed days with range presets. One series and one
 * y axis; the total and change against the previous equal period sit above.
 */
export function GmvTrend({ points }: { points: TrendPoint[] }) {
  const [range, setRange] = useState<(typeof PRESETS)[number]["key"]>("30");
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("gmv");
  const n = Math.min(points.length, PRESETS.find((p) => p.key === range)!.n);
  const data = points.slice(-n);
  const prev = points.length >= n * 2 ? points.slice(-n * 2, -n) : null;
  const total = data.reduce((a, d) => a + d[metric], 0);
  const prevTotal = prev?.reduce((a, d) => a + d[metric], 0);
  const delta = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : undefined;
  const label = metric === "gmv" ? "GMV" : "Orders";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4">
        <div>
          <p className="text-[26px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatCompact(total, metric === "gmv")}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
            <span>
              {label}, last {n === points.length ? `${n} completed days` : `${n} days`}
            </span>
            {delta !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", delta >= 0 ? "text-success-700" : "text-danger-700")}>
                  {delta >= 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </span>
                <span>vs previous {n} days</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented items={METRICS} value={metric} onChange={setMetric} label="Metric" />
          <Segmented items={PRESETS} value={range} onChange={setRange} label="Date range" />
        </div>
      </div>
      <div className="px-5 pt-4 pb-5">
        <AreaChart
          key={`${metric}-${range}`}
          data={data.map((d) => ({ label: d.label, value: d[metric] }))}
          series={[{ key: "value", label }]}
          format={metric === "gmv" ? "inrCompact" : "compact"}
          height={300}
          ariaLabel={`${label} per day, last ${n} completed days`}
        />
      </div>
    </div>
  );
}
