/** IST helpers. India has no daylight saving, so a fixed +05:30 offset is exact. */
const IST_OFFSET_MS = 330 * 60_000;

/** Calendar parts of a date as seen in India. */
export function istParts(d: Date) {
  const x = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth(), day: x.getUTCDate(), hour: x.getUTCHours(), minute: x.getUTCMinutes(), weekday: x.getUTCDay() };
}

/** The instant of a given IST wall-clock time, `days` calendar days after `d`. */
export function istAt(d: Date, days: number, hour: number, minute = 0) {
  const p = istParts(d);
  return new Date(Date.UTC(p.year, p.month, p.day + days, hour, minute) - IST_OFFSET_MS);
}

/** "260930" style date stamp in IST, used in public order numbers. */
export function istStamp(d: Date) {
  const p = istParts(d);
  return `${String(p.year).slice(2)}${String(p.month + 1).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
}
