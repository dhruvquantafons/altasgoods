/**
 * Pure, client-safe storefront helpers: delivery promise dates, pincode
 * serviceability and Indian date formats. No mock imports here so client
 * components can use them without pulling the data layer into the bundle.
 */
export const IST = "Asia/Kolkata";

/** Orders confirmed before 14:00 local time count as day 0 (spec 10.3). */
export const ORDER_CUTOFF_HOUR = 14;

const promiseFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST });
const longFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST });
const dayMonthFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST });
const dayMonthYearFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });

/** "Sat, 3 Oct" for delivery promises. */
export function formatPromise(d: Date | string | number) {
  return promiseFmt.format(new Date(d));
}
/** "Saturday, 3 October" */
export function formatPromiseLong(d: Date | string | number) {
  return longFmt.format(new Date(d));
}
/** "11:59 pm" */
export function formatTime(d: Date | string | number) {
  return timeFmt.format(new Date(d)).replace("AM", "am").replace("PM", "pm");
}
/** "3 Oct" */
export function formatDayMonth(d: Date | string | number) {
  return dayMonthFmt.format(new Date(d));
}
/** "3 Oct 2026" */
export function formatDayMonthYear(d: Date | string | number) {
  return dayMonthYearFmt.format(new Date(d));
}

/** A delivery date `days` after `nowMs`. */
export function daysFromNow(days: number, nowMs: number) {
  return new Date(nowMs + days * 86400_000);
}

/** Relative label used in promise lines: "Tomorrow", "Sat, 3 Oct". */
export function promiseLabel(days: number, nowMs: number) {
  if (days <= 1) return "tomorrow";
  return formatPromise(daysFromNow(days, nowMs));
}

/* ------------------------------ Pincodes ------------------------------ */

/** What the store says about delivering to a pincode; answered by the API (see pincode-lookup.ts). */
export interface PincodeInfo {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  /** extra days the store adds to the usual promise here */
  extraDays: number;
  /** the courier's own estimate in days, when it gave one */
  etaDays: number | null;
}

/** States and union territories, for addresses the pincode lookup cannot place. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const DEFAULT_PINCODE = "560087";

/** Six digits, not starting with 0: the same rule the API applies. */
export function isValidPincode(pin: string) {
  return /^[1-9]\d{5}$/.test(pin);
}

/** Days until delivery for an offer to a pincode, honouring the 14:00 cutoff. */
export function promiseDays(baseDays: number, info: PincodeInfo | null, nowMs: number) {
  const hourIst = new Date(nowMs + 5.5 * 3600_000).getUTCHours();
  const afterCutoff = hourIst >= ORDER_CUTOFF_HOUR ? 1 : 0;
  // the area's extra days, or the courier's estimate when that is longer
  return Math.max(1, Math.max(baseDays + (info?.extraDays ?? 0), info?.etaDays ?? 0) + afterCutoff);
}

/** Milliseconds left before today's dispatch cutoff, or 0 when it has passed. */
export function msToCutoff(nowMs: number) {
  const ist = new Date(nowMs + 5.5 * 3600_000);
  const cutoff = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), ORDER_CUTOFF_HOUR) - 5.5 * 3600_000;
  return Math.max(0, cutoff - nowMs);
}

/* ------------------------------ Durations ----------------------------- */

export function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02:14:09" under a day, "3d 04h 12m" beyond. */
export function formatCountdown(ms: number) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** "3 hrs 29 mins" for cutoff messages. */
export function formatHoursMinutes(ms: number) {
  const { days, hours, minutes } = splitDuration(ms);
  const h = days * 24 + hours;
  if (h === 0) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${minutes} min${minutes === 1 ? "" : "s"}`;
}

export { pad };
