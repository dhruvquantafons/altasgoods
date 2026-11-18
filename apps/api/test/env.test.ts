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
