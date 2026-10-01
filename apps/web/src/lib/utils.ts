import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fixed "now" for the mock data so server and client renders always agree. */
export const NOW = new Date("2026-10-01T10:30:00+05:30");

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("en-IN");

/** Rupees with Indian digit grouping, e.g. 1,24,999 -> "₹1,24,999". */
export function formatINR(value: number, opts: { paise?: boolean } = {}) {
  return (opts.paise ? inrPaise : inr).format(value);
}

export function formatNumber(value: number) {
  return num.format(value);
}

/** Compact Indian notation: 1.2K, 4.5L (lakh), 3.1Cr (crore). */
export function formatCompact(value: number, currency = false) {
  const prefix = currency ? "₹" : "";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${prefix}${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}${prefix}${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}${prefix}${trim(abs / 1e3)}K`;
  return `${sign}${prefix}${Math.round(abs)}`;
}

function trim(n: number) {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function discountPercent(price: number, mrp: number) {
  if (!mrp || mrp <= price) return 0;
  // Always round down so the advertised discount is never overstated.
  return Math.floor(((mrp - price) / mrp) * 100);
}

// Every date renders in IST regardless of the server or browser time zone, so
// server and client output always match.
const TZ = "Asia/Kolkata";
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dateShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: TZ });

export function formatDate(d: string | Date) {
  return dateFmt.format(new Date(d));
}
export function formatDateShort(d: string | Date) {
  return dateShort.format(new Date(d));
}
export function formatDateTime(d: string | Date) {
  return dateTime.format(new Date(d));
}
/** "10:30 am" in IST. */
export function formatTime(d: string | Date) {
  return timeFmt.format(new Date(d));
}

/** Hour of the day (0 to 23) in IST, independent of the machine time zone. */
export function istHour(d: string | Date) {
  return Math.floor(istMinuteOfDay(d) / 60);
}

/** Minutes since IST midnight. */
export function istMinuteOfDay(d: string | Date) {
  const x = new Date(d);
  return (x.getUTCHours() * 60 + x.getUTCMinutes() + 330) % 1440;
}

/** "Friday, 3 Oct" style used for delivery promises. */
export function formatWeekday(d: string | Date) {
  return weekday.format(new Date(d));
}

export function addDays(d: Date | string, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** "5 min ago", "3 h ago", "2 d ago", relative to NOW. */
/** "3 h ago". The sample data is anchored to NOW; pass `now` for live data from the API. */
export function timeAgo(d: string | Date, now: number = NOW.getTime()) {
  const diff = (now - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(d);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deterministic PRNG (mulberry32) so generated mock data is stable across renders. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

export function between(rand: () => number, min: number, max: number) {
  return Math.floor(min + rand() * (max - min + 1));
}

export function sum<T>(arr: readonly T[], fn: (x: T) => number) {
  return arr.reduce((acc, x) => acc + fn(x), 0);
}
