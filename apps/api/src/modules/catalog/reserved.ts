/**
 * Rows the catalog keeps for archived products whose category or brand was deleted.
 * They are created when first needed (and by the seed), shown to admins only, and never deleted.
 */
export const RESERVED_CATEGORY = { id: "cat-uncategorised", slug: "uncategorised", name: "Uncategorised" } as const;
export const RESERVED_BRAND = { id: "br-unbranded", slug: "unbranded", name: "Unbranded" } as const;
