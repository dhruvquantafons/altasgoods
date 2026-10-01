"use client";

import { useSyncExternalStore } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCountdown, formatHoursMinutes, formatPromise, formatTime, msToCutoff, NOW_MS, pad, splitDuration } from "./delivery";

/* ---------------------------------------------------------------------------
 * One shared ticking clock for every timer on the page. All mock data (deal
 * end times, cutoffs, promise dates) is anchored to the fixed mock NOW, so the
 * clock starts at NOW on the server and during hydration (markup matches) and
 * then runs forward in real seconds. With a live API this returns server time,
 * and end times come from the server, so a reload never extends a deal.
 * ------------------------------------------------------------------------- */

let current = NOW_MS;
let timer: ReturnType<typeof setInterval> | undefined;
const subs = new Set<() => void>();
let loadedAt = 0;

function realNow() {
  if (!loadedAt) loadedAt = Date.now();
  return NOW_MS + (Date.now() - loadedAt);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) {
    const tick = () => {
      current = realNow();
      subs.forEach((f) => f());
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useClock() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => NOW_MS,
  );
}

/* ------------------------------- Widgets -------------------------------- */

/** Inline deal timer: "Ends in 02:14:09", then "Deal ended". aria-live off, static accessible end time. */
export function DealTimer({ endsAt, className, label = "Ends in", compact = false }: { endsAt: string; className?: string; label?: string; compact?: boolean }) {
  const now = useClock();
  const left = new Date(endsAt).getTime() - now;
  const ended = left <= 0;
  const accessible = `Deal ends ${formatPromise(endsAt)} at ${formatTime(endsAt)}`;
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)} aria-live="off">
      <Timer size={compact ? 13 : 14} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{ended ? "Deal ended" : accessible}</span>
      <span aria-hidden="true">{ended ? "Deal ended" : `${label} ${formatCountdown(left)}`}</span>
    </span>
  );
}

/** Big segmented countdown for the sale event. */
export function SaleCountdown({ endsAt, tone = "dark", size = "lg" }: { endsAt: string; tone?: "dark" | "light"; size?: "md" | "lg" }) {
  const now = useClock();
  const left = new Date(endsAt).getTime() - now;
  const { days, hours, minutes, seconds } = splitDuration(left);
  const parts = [
    { v: days, l: "Days" },
    { v: hours, l: "Hours" },
    { v: minutes, l: "Mins" },
    { v: seconds, l: "Secs" },
  ];
  return (
    <div className="flex items-stretch gap-2" aria-live="off">
      <span className="sr-only">
        Sale ends {formatPromise(endsAt)} at {formatTime(endsAt)}
      </span>
      {parts.map((p) => (
        <div
          key={p.l}
          aria-hidden="true"
          className={cn(
            "flex flex-col items-center justify-center rounded-xl tabular-nums",
            size === "lg" ? "min-w-16 px-3 py-2.5" : "min-w-12 px-2 py-1.5",
            tone === "dark" ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-white text-ink-900 ring-1 ring-line",
          )}
        >
          <span className={cn("font-display leading-none font-semibold", size === "lg" ? "text-[26px]" : "text-lg")}>{pad(Math.max(0, p.v))}</span>
          <span className={cn("mt-1 text-[11px] font-medium", tone === "dark" ? "text-white/70" : "text-ink-500")}>{p.l}</span>
        </div>
      ))}
    </div>
  );
}

/** "Order within 3 hrs 29 mins" for the dispatch cutoff, hidden once it passes. */
export function CutoffNote({ className }: { className?: string }) {
  const now = useClock();
  const left = msToCutoff(now);
  if (left <= 0) return null;
  return <span className={className}>if ordered within {formatHoursMinutes(left)}</span>;
}
