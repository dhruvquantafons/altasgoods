import { describe, expect, it } from "vitest";
import { COD_LIMIT, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, formatCountdown, formatHoursMinutes, isValidPincode, lookupPincode, msToCutoff, promiseDays } from "@/components/store/delivery";
import { bestBankOffer, computeTotals, couponBlocker, lineKey, priceLines } from "@/components/store/pricing";
import type { BankOffer, CartCatalog, CartLine, CartOffer, CouponLite } from "@/components/store/types";

const offer = (sellerId: string, price: number, mrp: number): CartOffer => ({
  sellerId,
  sellerName: sellerId,
  sellerSlug: sellerId,
  sellerRating: 4.5,
  sellerRatingCount: 100,
  sellerCity: "Mumbai",
  price,
  mrp,
  stock: 10,
  deliveryDays: 2,
  fulfilledBy: "seller",
  codAvailable: true,
  returnWindowDays: 7,
  assured: false,
});
const product = (id: string, offers: CartOffer[], subcategory = "Headphones") => ({
  id,
  slug: id,
  title: id,
  brand: "Auralis",
  image: "",
  category: "Electronics",
  categorySlug: "electronics",
  subcategory,
  rating: 4,
  ratingCount: 10,
  featuredSellerId: offers[0]!.sellerId,
  offers,
  large: false,
});
const catalog: CartCatalog = {
  pods: product("pods", [offer("s-a", 4999, 8999), offer("s-b", 5199, 8999)]),
  cable: product("cable", [offer("s-b", 299, 499)], "Cables"),
};
const line = (productId: string, sellerId: string, qty = 1): CartLine => ({ key: lineKey(productId, sellerId), productId, sellerId, qty });
const coupon = (c: Partial<CouponLite>): CouponLite => ({ code: "SAVE", description: "", type: "percent", value: 10, minOrder: 0, endsAt: "2027-01-01", fundedBy: "blubuy", ...c });

describe("cart totals", () => {
  it("prices each line from the chosen seller's offer", () => {
    const [p] = priceLines([line("pods", "s-b", 2)], catalog);
    expect(p).toMatchObject({ unitPrice: 5199, lineTotal: 10398, lineMrp: 17998 });
    expect(priceLines([line("missing", "s-a")], catalog)).toEqual([]);
  });

  it("charges delivery per seller below the free delivery threshold, and never for Plus", () => {
    const lines = [line("pods", "s-a"), line("cable", "s-b")];
    const t = computeTotals(lines, catalog, { couponCode: null, coupons: [], plus: false });
    expect(299).toBeLessThan(FREE_DELIVERY_THRESHOLD);
    expect(t.groups).toHaveLength(2);
    expect(t.delivery).toBe(DELIVERY_FEE);
    expect(t.total).toBe(4999 + 299 + DELIVERY_FEE);
    expect(t.savings).toBe(8999 + 499 - 4999 - 299);
    expect(computeTotals(lines, catalog, { couponCode: null, coupons: [], plus: true }).delivery).toBe(0);
  });

  it("applies a coupon only when it is eligible, capped at its maximum", () => {
    const lines = [line("pods", "s-a")];
    const capped = computeTotals(lines, catalog, { couponCode: "SAVE", coupons: [coupon({ maxDiscount: 300 })], plus: false });
    expect(capped.couponDiscount).toBe(300);
    const blocked = computeTotals(lines, catalog, { couponCode: "SAVE", coupons: [coupon({ minOrder: 10000 })], plus: false });
    expect(blocked.couponDiscount).toBe(0);
    expect(blocked.couponNote).toMatch(/Add items worth/);
  });

  it("explains why a coupon cannot apply", () => {
    const priced = priceLines([line("pods", "s-a")], catalog);
    expect(couponBlocker(coupon({ plusOnly: true }), priced, { plus: false })).toMatch(/Plus/);
    expect(couponBlocker(coupon({ upiOnly: true }), priced, { plus: false, method: "card" })).toMatch(/UPI/);
    expect(couponBlocker(coupon({}), priced, { plus: false })).toBeNull();
  });

  it("picks the single best instant bank offer for the method", () => {
    const offers: BankOffer[] = [
      { id: "a", kind: "Bank offer", title: "", detail: "", minOrder: 1000, percent: 10, cap: 750, method: "card" },
      { id: "b", kind: "Bank offer", title: "", detail: "", minOrder: 1000, flat: 500, method: "card" },
      { id: "c", kind: "Cashback", title: "", detail: "", minOrder: 0, flat: 5000, method: "card" },
    ];
    expect(bestBankOffer(offers, 10000, "card")).toMatchObject({ offer: { id: "a" }, value: 750 });
    expect(bestBankOffer(offers, 4000, "card")).toMatchObject({ offer: { id: "b" }, value: 500 });
    expect(bestBankOffer(offers, 10000, "upi")).toBeNull();
  });
});

describe("delivery promise", () => {
  it("validates and looks up pincodes", () => {
    expect(isValidPincode("560087")).toBe(true);
    expect(isValidPincode("060087")).toBe(false);
    expect(lookupPincode("682551")?.serviceable).toBe(false);
    expect(lookupPincode("12345")).toBeNull();
  });

  it("adds a day after the 2 PM IST cutoff", () => {
    const before = Date.parse("2026-10-01T13:00:00+05:30");
    const after = Date.parse("2026-10-01T15:00:00+05:30");
    const info = lookupPincode("560087");
    expect(promiseDays(2, info, after)).toBe(promiseDays(2, info, before) + 1);
    expect(msToCutoff(before)).toBe(3600_000);
    expect(msToCutoff(after)).toBe(0);
    expect(COD_LIMIT).toBe(50000);
  });

  it("formats countdowns", () => {
    expect(formatCountdown(2 * 3600_000 + 14 * 60_000 + 9_000)).toBe("02:14:09");
    expect(formatCountdown(3 * 86_400_000 + 4 * 3600_000)).toBe("3d 04h 00m");
    expect(formatHoursMinutes(3 * 3600_000 + 29 * 60_000)).toBe("3 hrs 29 mins");
  });
});
