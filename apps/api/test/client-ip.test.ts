import { describe, expect, it } from "vitest";
import { clientKey } from "../src/modules/auth/client-ip.js";

describe("clientKey", () => {
  it("keeps IPv4 addresses, also when seen over IPv6", () => {
    expect(clientKey("203.0.113.9")).toBe("203.0.113.9");
    expect(clientKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });
  it("groups IPv6 by its /64, however it is written", () => {
    expect(clientKey("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:0db8:0001:0002:ffff:0:0:9")).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientKey("::1")).toBe("0:0:0:0::/64");
    expect(clientKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(clientKey("1::2:3:4:5:6.7.8.9")).toBe("1:0:2:3::/64");
  });
  it("counts anything else together", () => {
    expect(clientKey(undefined)).toBe("unknown");
    expect(clientKey("not-an-ip")).toBe("unknown");
  });
});
