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

/** "2026-03-02 00:30": a moment as India's wall clock shows it, for exports. Empty when there is no date. */
export function istDateTime(d: Date | null | undefined) {
  if (!d) return "";
  const p = istParts(d);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month + 1)}-${two(p.day)} ${two(p.hour)}:${two(p.minute)}`;
}

/** The instant an IST calendar day ("2026-03-02") begins. Throws for a date that does not exist. */
export function istDayStart(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Not a date: ${ymd}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) throw new Error(`Not a date: ${ymd}`);
  return new Date(t.getTime() - IST_OFFSET_MS);
}
