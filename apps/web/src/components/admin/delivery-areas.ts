/** The Delivery areas textareas: one entry per line, parsed into the lists the API stores. */

export interface DeliveryAreas {
  blocked: string[];
  noCod: string[];
  extraDays: { prefix: string; days: number }[];
}

export interface AreasText {
  blocked: string;
  noCod: string;
  extraDays: string;
}

export type AreaErrors = Partial<Record<keyof AreasText, string>>;

const ENTRY = /^\d{2,6}$/;
const MAX_DAYS = 15;
const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, parts: raw.split(/[\s,;]+/).filter(Boolean) }))
    .filter((l) => l.parts.length);

export function areasToText(a: DeliveryAreas): AreasText {
  return { blocked: a.blocked.join("\n"), noCod: a.noCod.join("\n"), extraDays: a.extraDays.map((e) => `${e.prefix} ${e.days}`).join("\n") };
}

/** Parses the three textareas. Each list reports its first problem, with the line it is on. */
export function parseAreas(text: AreasText): { ok: true; areas: DeliveryAreas } | { ok: false; errors: AreaErrors } {
  const errors: AreaErrors = {};
  const entries = (field: "blocked" | "noCod") => {
    const out: string[] = [];
    for (const { line, parts } of lines(text[field])) {
      for (const p of parts) {
        if (!ENTRY.test(p)) {
          errors[field] ??= `Line ${line}: "${p}" is not a 6 digit pincode or a 2 to 5 digit prefix`;
        } else if (!out.includes(p)) out.push(p);
      }
    }
    return out;
  };
  const blocked = entries("blocked");
  const noCod = entries("noCod");

  const extraDays: DeliveryAreas["extraDays"] = [];
  for (const { line, parts } of lines(text.extraDays)) {
    const [prefix, days, ...rest] = parts;
    if (!prefix || !ENTRY.test(prefix)) errors.extraDays ??= `Line ${line}: "${prefix}" is not a 6 digit pincode or a 2 to 5 digit prefix`;
    else if (days === undefined || rest.length || !/^\d{1,2}$/.test(days) || Number(days) > MAX_DAYS) errors.extraDays ??= `Line ${line}: write the prefix, a space and the extra days (0 to ${MAX_DAYS}), like "6825 3"`;
    else {
      const at = extraDays.findIndex((e) => e.prefix === prefix);
      if (at >= 0) extraDays[at] = { prefix, days: Number(days) };
      else extraDays.push({ prefix, days: Number(days) });
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, areas: { blocked, noCod, extraDays } };
}
