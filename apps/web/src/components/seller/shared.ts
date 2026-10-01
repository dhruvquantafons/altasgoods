/**
 * Client-safe Seller Hub helpers (no mock data imports), so client components
 * can format channels and SLA countdowns without pulling the data layer into
 * the browser bundle.
 */
import type { Tone } from "@/lib/status";
import { NOW } from "@/lib/utils";

export type Channel = "fulfilled" | "ship" | "flex" | "self";

export const CHANNEL_LABEL: Record<Channel, string> = {
  fulfilled: "BluBuy Fulfilled",
  ship: "BluBuy Ship",
  flex: "BluBuy Flex",
  self: "Self Ship",
};

/** "7 h 30 min", "1 d 7 h", "45 min". */
export function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

/** Countdown relative to `now` (the sample clock unless given): neutral, warning under `warnHours`, danger once overdue. */
export function slaFor(dueAt: string | Date, warnHours = 8, now: number = NOW.getTime()): { label: string; tone: Tone; overdue: boolean } {
  const ms = new Date(dueAt).getTime() - now;
  if (ms < 0) return { label: `Overdue by ${formatDuration(ms)}`, tone: "danger", overdue: true };
  return { label: `${formatDuration(ms)} left`, tone: ms < warnHours * 3600_000 ? "warning" : "neutral", overdue: false };
}
