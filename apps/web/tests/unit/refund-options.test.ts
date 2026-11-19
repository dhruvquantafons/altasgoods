import { describe, expect, it } from "vitest";
import { refundOptionsFor } from "@/components/account/lib";
import type { Order } from "@/lib/types";

const orderPaidBy = (method: string) => ({ payment: { method } }) as unknown as Order;

describe("refundOptionsFor", () => {
  it("offers only the original payment method, never AltasGoods Credits", () => {
    for (const method of ["upi", "card", "netbanking", "emi", "paylater", "wallet", "giftcard", "cod"]) {
      const options = refundOptionsFor(orderPaidBy(method));
      expect(options.map((o) => o.key)).toEqual(["original"]);
      expect(JSON.stringify(options)).not.toMatch(/credits/i);
    }
  });
});
