/** GST rates are kept in basis points (1800 = 18%); staff type and read percentages. No floats: both directions work on digits. */

/** The usual GST slabs, in basis points. Anything else is a custom rate. */
export const GST_SLABS = [0, 25, 300, 500, 1200, 1800, 2800] as const;
export const GST_MAX_BP = 4000;

/** "18", "18%", "0.25" or "12.5" as basis points; null when it is not a percentage with up to 2 decimals from 0 to 40. */
export function percentToBp(input: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(input.trim().replace(/%$/, "").trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bp <= GST_MAX_BP ? bp : null;
}

/** Basis points as the percentage staff read: 1800 is "18", 25 is "0.25", 1250 is "12.5". */
export function bpToPercent(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** "18%" or "0.25%" for display. */
export const gstLabel = (bp: number) => `${bpToPercent(bp)}%`;

/** An HSN code is 4, 6 or 8 digits. */
export const isHsn = (v: string) => /^(\d{4}|\d{6}|\d{8})$/.test(v);
