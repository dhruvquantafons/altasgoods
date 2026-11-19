/** What "Buy again" learns about a product before it goes back in the cart. */
export type BuyAgainOutcome = "available" | "unavailable" | "out_of_stock" | "error";

/** From the product lookup: 404 is a product no longer on sale; no answer is not the same as gone. */
export function buyAgainOutcome(lookup: { status?: number; inStock?: boolean }): BuyAgainOutcome {
  if (lookup.status === 404) return "unavailable";
  if (lookup.status !== 200) return "error";
  return lookup.inStock ? "available" : "out_of_stock";
}

export function buyAgainMessage(title: string, outcome: Exclude<BuyAgainOutcome, "available">) {
  if (outcome === "unavailable") return `${title} is no longer available`;
  if (outcome === "out_of_stock") return `${title} is out of stock right now`;
  return "Could not check this item. Please try again in a moment.";
}
