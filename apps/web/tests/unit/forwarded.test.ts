import { describe, expect, it } from "vitest";
import { forwardingHeaders } from "@/lib/api/forwarded";

describe("forwardingHeaders", () => {
  it("passes on the forwarded chain as Next sees it, so the API picks the right hop", () => {
    const h = new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7", "user-agent": "Mozilla/5.0 Firefox" });
    expect(forwardingHeaders(h)).toEqual({ "x-forwarded-for": "198.51.100.1, 203.0.113.7", "user-agent": "Mozilla/5.0 Firefox" });
  });

  it("falls back to X-Real-IP", () => {
    expect(forwardingHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toEqual({ "x-forwarded-for": "203.0.113.7" });
  });

  it("tidies the chain and keeps only its nearest hops", () => {
    const long = Array.from({ length: 40 }, (_, i) => `10.0.0.${i}`).join(",");
    const out = forwardingHeaders(new Headers({ "x-forwarded-for": ` ,${long}, ` }))["x-forwarded-for"]!.split(", ");
    expect(out).toHaveLength(20);
    expect(out.at(-1)).toBe("10.0.0.39");
  });

  it("sends nothing it does not know", () => {
    expect(forwardingHeaders(new Headers())).toEqual({});
  });
});
