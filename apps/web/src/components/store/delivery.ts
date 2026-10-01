/**
 * Pure, client-safe storefront helpers: delivery promise dates, pincode
 * serviceability and Indian date formats. No mock imports here so client
 * components can use them without pulling the data layer into the bundle.
 */
import { NOW } from "@/lib/utils";

export const IST = "Asia/Kolkata";
export const NOW_MS = NOW.getTime();

/** Orders confirmed before 14:00 local time count as day 0 (spec 10.3). */
export const ORDER_CUTOFF_HOUR = 14;
/** Delivery is free above this per seller shipment for non-Plus customers (spec 10.15). */
export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 40;
/** Pay on delivery is not offered above this order value (spec 10.8). */
export const COD_LIMIT = 50000;

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

export function daysFromNow(days: number) {
  return new Date(NOW_MS + days * 86400_000);
}

/** Relative label used in promise lines: "Tomorrow", "Sat, 3 Oct". */
export function promiseLabel(days: number) {
  if (days <= 1) return "tomorrow";
  return formatPromise(daysFromNow(days));
}

/* ------------------------------ Pincodes ------------------------------ */

export type Zone = "metro" | "regional" | "national" | "special";

export interface PincodeInfo {
  pincode: string;
  city: string;
  state: string;
  zone: Zone;
  serviceable: boolean;
  /** extra transit days over the default (Bengaluru) promise */
  extraDays: number;
  codAvailable: boolean;
}

const PREFIXES: Record<string, [city: string, state: string, zone: Zone]> = {
  "560": ["Bengaluru", "Karnataka", "metro"],
  "400": ["Mumbai", "Maharashtra", "metro"],
  "110": ["New Delhi", "Delhi", "metro"],
  "500": ["Hyderabad", "Telangana", "metro"],
  "600": ["Chennai", "Tamil Nadu", "metro"],
  "411": ["Pune", "Maharashtra", "metro"],
  "700": ["Kolkata", "West Bengal", "metro"],
  "380": ["Ahmedabad", "Gujarat", "metro"],
  "122": ["Gurugram", "Haryana", "metro"],
  "201": ["Noida", "Uttar Pradesh", "metro"],
  "570": ["Mysuru", "Karnataka", "regional"],
  "641": ["Coimbatore", "Tamil Nadu", "regional"],
  "682": ["Kochi", "Kerala", "regional"],
  "695": ["Thiruvananthapuram", "Kerala", "regional"],
  "403": ["Panaji", "Goa", "regional"],
  "302": ["Jaipur", "Rajasthan", "national"],
  "226": ["Lucknow", "Uttar Pradesh", "national"],
  "160": ["Chandigarh", "Chandigarh", "national"],
  "452": ["Indore", "Madhya Pradesh", "national"],
  "751": ["Bhubaneswar", "Odisha", "national"],
  "800": ["Patna", "Bihar", "national"],
  "781": ["Guwahati", "Assam", "special"],
  "190": ["Srinagar", "Jammu and Kashmir", "special"],
  "194": ["Leh", "Ladakh", "special"],
  "744": ["Port Blair", "Andaman and Nicobar Islands", "special"],
};

const STATE_BY_FIRST_DIGIT: Record<string, string> = {
  "1": "Delhi NCR and North India",
  "2": "Uttar Pradesh and Uttarakhand",
  "3": "Rajasthan and Gujarat",
  "4": "Maharashtra and Central India",
  "5": "Andhra Pradesh, Telangana and Karnataka",
  "6": "Tamil Nadu and Kerala",
  "7": "East and North East India",
  "8": "Bihar and Jharkhand",
};

const EXTRA_DAYS: Record<Zone, number> = { metro: 0, regional: 1, national: 2, special: 5 };

export const DEFAULT_PINCODE = "560087";

export function isValidPincode(pin: string) {
  return /^[1-8]\d{5}$/.test(pin);
}

/** Mock serviceability lookup. Lakshadweep (6825xx) is not yet serviceable. */
export function lookupPincode(pin: string): PincodeInfo | null {
  if (!isValidPincode(pin)) return null;
  const known = PREFIXES[pin.slice(0, 3)];
  if (pin.startsWith("6825"))
    return { pincode: pin, city: "Lakshadweep", state: "Lakshadweep", zone: "special", serviceable: false, extraDays: 0, codAvailable: false };
  if (known) {
    const [city, state, zone] = known;
    return { pincode: pin, city, state, zone, serviceable: true, extraDays: EXTRA_DAYS[zone], codAvailable: zone !== "special" };
  }
  return {
    pincode: pin,
    city: STATE_BY_FIRST_DIGIT[pin[0]!] ?? "India",
    state: "",
    zone: "national",
    serviceable: true,
    extraDays: EXTRA_DAYS.national + 1,
    codAvailable: true,
  };
}

/** Days until delivery for an offer to a pincode, honouring the 14:00 cutoff. */
export function promiseDays(baseDays: number, info: PincodeInfo | null, nowMs = NOW_MS) {
  const hourIst = new Date(nowMs + 5.5 * 3600_000).getUTCHours();
  const afterCutoff = hourIst >= ORDER_CUTOFF_HOUR ? 1 : 0;
  return Math.max(1, baseDays + (info?.extraDays ?? 0) + afterCutoff);
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
