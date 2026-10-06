/**
 * Small pure helpers shared by AltasGoods Control pages. No mock imports here so
 * client components can use them without bundling the data layer.
 */
import { NOW } from "@/lib/utils";

export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param. */
export function sp(params: SearchParams, key: string) {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Builds a URL keeping the current params and applying a patch (undefined or "" removes a key). */
export function hrefWith(path: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v !== undefined && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export function pctChange(a: number, b: number) {
  return b ? ((a - b) / b) * 100 : 0;
}

/** Minutes between NOW and a timestamp; positive when the time is in the future. */
export function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - NOW.getTime()) / 60_000);
}

/** "3 h", "2 d", "45 min" for a duration in minutes. */
export function durationLabel(mins: number) {
  const m = Math.abs(mins);
  if (m < 60) return `${m} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}

/** Age of a timestamp: "5 h", "3 d". */
export function ageLabel(iso: string) {
  return durationLabel(-minutesUntil(iso));
}

export function paginate<T>(items: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: items.slice((p - 1) * size, p * size), page: p, pages, total: items.length, from: items.length ? (p - 1) * size + 1 : 0, to: Math.min(p * size, items.length) };
}
