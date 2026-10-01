import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, DEMO_SELLER, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe("OTP sign in", () => {
  it("creates an account on first sign in and returns tokens", async () => {
    const { session } = await signIn(t.http, "7000000001", "Test Shopper");
    expect(session.isNewUser).toBe(true);
    expect(session.user).toMatchObject({ phone: "+917000000001", name: "Test Shopper", sellers: [] });
    expect(session.expiresIn).toBe(900);
  });

  it("rejects invalid numbers and wrong codes, and locks after five attempts", async () => {
    await t.http.post("/v1/auth/otp").send({ phone: "12345" }).expect(422);
    const otp = await t.http.post("/v1/auth/otp").send({ phone: "7000000002" }).expect(200);
    for (let i = 0; i < 5; i++) {
      const r = await t.http.post("/v1/auth/otp/verify").send({ challengeId: otp.body.challengeId, code: "000000" === otp.body.devCode ? "111111" : "000000" });
      expect(r.status).toBe(400);
    }
    const locked = await t.http.post("/v1/auth/otp/verify").send({ challengeId: otp.body.challengeId, code: otp.body.devCode });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("OTP_LOCKED");
  });

  it("rate limits code requests per number", async () => {
    for (let i = 0; i < 5; i++) await t.http.post("/v1/auth/otp").send({ phone: "7000000003" }).expect(200);
    const r = await t.http.post("/v1/auth/otp").send({ phone: "7000000003" });
    expect(r.status).toBe(429);
  });

  it("includes seller memberships for seller owners", async () => {
    const { session } = await signIn(t.http, DEMO_SELLER);
    expect(session.user.sellers).toEqual([expect.objectContaining({ id: "s-apex", displayName: "Apex Retail", role: "OWNER" })]);
  });
});

describe("sessions", () => {
  it("requires a token for protected routes", async () => {
    const r = await t.http.get("/v1/me").expect(401);
    expect(r.headers["content-type"]).toContain("application/problem+json");
    expect(r.body.code).toBe("UNAUTHENTICATED");
  });

  it("rotates refresh tokens and revokes everything when an old one is reused", async () => {
    const { session } = await signIn(t.http, "7000000004");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(session.refreshToken);

    // replaying the original token looks like theft
    const reuse = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(reuse.body.code).toBe("REFRESH_REUSED");
    // and the rotated token was revoked along with every other session
    await t.http.post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it("logs out by revoking the refresh token", async () => {
    const { session } = await signIn(t.http, "7000000005");
    await t.http.post("/v1/auth/logout").send({ refreshToken: session.refreshToken }).expect(204);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
  });
});
