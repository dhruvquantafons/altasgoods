import { describe, expect, it } from "vitest";
import { buyAgainMessage, buyAgainOutcome } from "@/lib/buy-again";

describe("buyAgainOutcome", () => {
  it("lets a product that is on sale and in stock go to the cart", () => {
    expect(buyAgainOutcome({ status: 200, inStock: true })).toBe("available");
  });
  it("treats a product that is gone (archived, hidden, deleted) as no longer available", () => {
    expect(buyAgainOutcome({ status: 404 })).toBe("unavailable");
  });
  it("tells an out of stock product apart", () => {
    expect(buyAgainOutcome({ status: 200, inStock: false })).toBe("out_of_stock");
  });
  it("does not claim a product is gone when the store could not be reached", () => {
    expect(buyAgainOutcome({ status: 500 })).toBe("error");
    expect(buyAgainOutcome({ status: undefined })).toBe("error");
  });
});

describe("buyAgainMessage", () => {
  it("names the product", () => {
    expect(buyAgainMessage("Studio Headphones", "unavailable")).toBe("Studio Headphones is no longer available");
    expect(buyAgainMessage("Studio Headphones", "out_of_stock")).toBe("Studio Headphones is out of stock right now");
    expect(buyAgainMessage("Studio Headphones", "error")).toMatch(/try again/i);
  });
});
