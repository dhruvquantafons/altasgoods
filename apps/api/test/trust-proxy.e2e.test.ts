import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, signUp, testIp, type TestContext } from "./helpers.js";

/** With TRUST_PROXY=false the app answers to the address it sees, whatever X-Forwarded-For claims. */
let t: TestContext;
beforeAll(async () => {
  t = await createTestApp([], { trustProxy: "false" });
});
afterAll(() => t.close());

describe("TRUST_PROXY=false", () => {
  it("ignores a spoofed X-Forwarded-For, so changing it does not dodge the lock", async () => {
    await signUp(t.http, "spoof.target@example.com");
    for (let i = 0; i < 10; i++) {
      await t.http.post("/v1/auth/login").set("X-Forwarded-For", testIp()).send({ email: "spoof.target@example.com", password: "wrong-password" }).expect(401);
    }
    const locked = await t.http.post("/v1/auth/login").set("X-Forwarded-For", testIp()).send({ email: "spoof.target@example.com", password: "a-long-password" }).expect(429);
    expect(locked.body.code).toBe("LOGIN_RATE_LIMITED");
  });
});
