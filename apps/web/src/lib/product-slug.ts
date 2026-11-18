/** The store address of a product: /p/<slug>. Mirrors the API's rule, which stays the real check. */
export const SLUG_MIN = 3;
export const SLUG_MAX = 80;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What is wrong with a product slug, in words for the admin, or null when it is fine. */
export function slugProblem(value: string): string | null {
  if (value.length < SLUG_MIN) return `Use at least ${SLUG_MIN} characters`;
  if (value.length > SLUG_MAX) return `Use at most ${SLUG_MAX} characters`;
  if (!SLUG_RE.test(value)) return "Use lowercase letters, numbers and single hyphens, with no hyphen at the start or end";
  return null;
}

/** "Linen Cushion Covers (Set of 2)" to "linen-cushion-covers-set-of-2", as the API makes slugs from titles. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "item"
  );
}
