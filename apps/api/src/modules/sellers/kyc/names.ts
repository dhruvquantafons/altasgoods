/**
 * Name matching for KYC: GST legal name against the PAN holder, and the
 * business against the name a bank returns on a penny drop. Legal suffixes
 * and punctuation are ignored, so "Sahyadri Home Essentials LLP" matches
 * "SAHYADRI HOME ESSENTIALS".
 */
const NOISE = new Set(["M", "S", "MS", "MESSRS", "THE", "AND", "CO", "COMPANY", "PRIVATE", "PVT", "LIMITED", "LTD", "LLP", "OPC"]);

export function nameTokens(name: string) {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !NOISE.has(t));
}

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
  return out;
}

function dice(a: Map<string, number>, b: Map<string, number>) {
  let common = 0;
  let total = 0;
  for (const [k, n] of a) {
    common += Math.min(n, b.get(k) ?? 0);
    total += n;
  }
  for (const n of b.values()) total += n;
  return total ? (2 * common) / total : 0;
}

/** 0 to 100. Token overlap weighted with character similarity, which tolerates small spelling differences. */
export function nameMatchScore(a: string, b: string) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 100;
  const setA = [...new Set(ta)];
  const setB = [...new Set(tb)];
  // tokens match when equal or nearly so (ESSENTIAL and ESSENTIALS)
  const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && dice(bigrams(x), bigrams(y)) >= 0.8);
  const shared = setA.filter((x) => setB.some((y) => same(x, y))).length;
  const tokenScore = (2 * shared) / (setA.length + setB.length);
  const charScore = dice(bigrams(ta.join("")), bigrams(tb.join("")));
  return Math.round(100 * (0.5 * tokenScore + 0.5 * charScore));
}

export const MATCH_VERIFIED = 85;
export const MATCH_PARTIAL = 60;

export const matchResult = (score: number) => (score >= MATCH_VERIFIED ? "VERIFIED" : score >= MATCH_PARTIAL ? "PARTIAL" : "FAILED") as "VERIFIED" | "PARTIAL" | "FAILED";
