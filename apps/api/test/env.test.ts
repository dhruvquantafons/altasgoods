import { describe, expect, it } from "vitest";
import { devToolsEnabled, parseEnv } from "../src/config/env.js";

const base = { JWT_SECRET: "x".repeat(32), PAYMENTS_WEBHOOK_SECRET: "y".repeat(16) };

describe("NODE_ENV", () => {
  it("is required, with no default", () => {
    expect(() => parseEnv({ ...base })).toThrow(/NODE_ENV/);
  });
  it("rejects values it does not know", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });
  it("accepts development", () => {
    expect(parseEnv({ ...base, NODE_ENV: "development" }).NODE_ENV).toBe("development");
  });
  it("enables dev tools only in development", () => {
    expect(devToolsEnabled()).toBe(false); // vitest runs as NODE_ENV=test
  });
});

describe("TRUST_PROXY", () => {
  const trust = (value?: string) => parseEnv({ ...base, NODE_ENV: "development", TRUST_PROXY: value }).TRUST_PROXY;
  it("defaults to loopback", () => {
    expect(trust()).toEqual(["loopback"]);
  });
  it("reads the forms Express accepts", () => {
    expect(trust("true")).toBe(true);
    expect(trust("false")).toBe(false);
    expect(trust("2")).toBe(2);
    expect(trust("loopback, 10.0.0.0/8,192.168.1.7, fd00::/8, 172.16.0.0/255.240.0.0")).toEqual(["loopback", "10.0.0.0/8", "192.168.1.7", "fd00::/8", "172.16.0.0/255.240.0.0"]);
  });
  it("refuses what Express would not understand", () => {
    for (const bad of ["yes", "10.0.0.0/33", "10.0.0", "loopback,", "fd00::/129", "-1"]) expect(() => trust(bad), bad).toThrow(/TRUST_PROXY/);
  });
});
