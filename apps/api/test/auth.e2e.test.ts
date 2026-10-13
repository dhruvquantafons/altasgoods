import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EMAIL_PROVIDER } from "../src/common/tokens.js";
import type { EmailMessage, EmailProvider } from "../src/modules/auth/email.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

/** Keeps every email the app sends, so tests can read the codes in them. */
class OutboxEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
  codeFor(to: string) {
    const last = this.sent.filter((m) => m.to === to).at(-1);
    return last?.text.match(/\b\d{6}\b/)?.[0];
  }
}

const outbox = new OutboxEmailProvider();
let t: TestContext;
beforeAll(async () => {
  t = await createTestApp([{ provide: EMAIL_PROVIDER, useValue: outbox }]);
});
afterAll(() => t.close());
beforeEach(() => {
  outbox.sent = [];
});

describe("sign up", () => {
  it("creates a shopper account and signs it in", async () => {
    const { session } = await signUp(t.http, "New.Shopper@Example.com", "New Shopper");
    expect(session.isNewUser).toBe(true);
    expect(session.user).toMatchObject({ email: "new.shopper@example.com", name: "New Shopper", phone: null, emailVerified: false, staffRoles: [] });
    expect(session.expiresIn).toBe(900);
    // and the password works from then on, whatever the case of the email
    await signIn(t.http, "NEW.SHOPPER@example.com", "a-long-password");
  });

  it("refuses a taken email, a short password and a bad address", async () => {
    const taken = await t.http.post("/v1/auth/signup").send({ name: "Copy Cat", email: DEMO_CUSTOMER.toUpperCase(), password: "a-long-password" }).expect(409);
    expect(taken.body.code).toBe("EMAIL_TAKEN");
    await t.http.post("/v1/auth/signup").send({ name: "Short Pass", email: "short@example.com", password: "1234567" }).expect(422);
    await t.http.post("/v1/auth/signup").send({ name: "Bad Email", email: "not-an-email", password: "a-long-password" }).expect(422);
  });
});

describe("sign in", () => {
  it("rejects a wrong password and an unknown email with the same answer", async () => {
    const wrong = await t.http.post("/v1/auth/login").send({ email: DEMO_CUSTOMER, password: "not-the-password" }).expect(401);
    const unknown = await t.http.post("/v1/auth/login").send({ email: "nobody@example.com", password: "not-the-password" }).expect(401);
    expect(wrong.body.code).toBe("INVALID_CREDENTIALS");
    expect(unknown.body).toMatchObject({ code: wrong.body.code, detail: wrong.body.detail });
  });

  it("locks an email after ten wrong passwords", async () => {
    await signUp(t.http, "guessed@example.com");
    for (let i = 0; i < 10; i++) await t.http.post("/v1/auth/login").send({ email: "guessed@example.com", password: "wrong-password" }).expect(401);
    const locked = await t.http.post("/v1/auth/login").send({ email: "guessed@example.com", password: "a-long-password" }).expect(429);
    expect(locked.body.code).toBe("LOGIN_RATE_LIMITED");
  });

  it("includes staff roles for store staff", async () => {
    const { session } = await signIn(t.http, DEMO_STAFF);
    expect(session.user.staffRoles).toEqual(["SUPER_ADMIN"]);
  });
});

describe("forgot password", () => {
  it("emails a code, sets the new password, and signs out every other device", async () => {
    const { session: old } = await signUp(t.http, "forgetful@example.com", "Forgetful", "first-password");
    const r = await t.http.post("/v1/auth/password/forgot").send({ email: "Forgetful@example.com" }).expect(200);
    expect(r.body.email).toBe("f******@example.com");
    const code = outbox.codeFor("forgetful@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(outbox.sent[0]!.html).toContain(code);

    const reset = await t.http.post("/v1/auth/password/reset").send({ email: "forgetful@example.com", code, password: "second-password" }).expect(200);
    expect(reset.body.user).toMatchObject({ email: "forgetful@example.com", emailVerified: true });
    // a "password changed" notice follows the code
    expect(outbox.sent.map((m) => m.subject)).toContain("Your AltasGoods password was changed");

    await t.http.post("/v1/auth/login").send({ email: "forgetful@example.com", password: "first-password" }).expect(401);
    await signIn(t.http, "forgetful@example.com", "second-password");
    // the session from before the reset is over, access token included
    await t.http.post("/v1/auth/refresh").send({ refreshToken: old.refreshToken }).expect(401);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${old.accessToken}` }).expect(401);
    // and the code works once
    await t.http.post("/v1/auth/password/reset").send({ email: "forgetful@example.com", code, password: "third-password" }).expect(400);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    const r = await t.http.post("/v1/auth/password/forgot").send({ email: "ghost@example.com" }).expect(200);
    expect(r.body.email).toBe("g****@example.com");
    expect(r.body).not.toHaveProperty("devCode");
    expect(outbox.sent).toHaveLength(0);
  });

  it("locks the code after five wrong tries and rate limits requests", async () => {
    await signUp(t.http, "unlucky@example.com");
    await t.http.post("/v1/auth/password/forgot").send({ email: "unlucky@example.com" }).expect(200);
    const code = outbox.codeFor("unlucky@example.com")!;
    const wrongCode = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await t.http.post("/v1/auth/password/reset").send({ email: "unlucky@example.com", code: wrongCode, password: "new-password-1" }).expect(400);
    const locked = await t.http.post("/v1/auth/password/reset").send({ email: "unlucky@example.com", code, password: "new-password-1" }).expect(429);
    expect(locked.body.code).toBe("OTP_LOCKED");

    for (let i = 0; i < 4; i++) await t.http.post("/v1/auth/password/forgot").send({ email: "unlucky@example.com" }).expect(200);
    const limited = await t.http.post("/v1/auth/password/forgot").send({ email: "unlucky@example.com" }).expect(429);
    expect(limited.body.code).toBe("OTP_RATE_LIMITED");
  });
});

describe("profile", () => {
  it("changes the sign in email only after the new address is confirmed", async () => {
    const { auth } = await signUp(t.http, "mover@example.com");
    await t.http.post("/v1/me/email/otp").set(auth).send({ email: DEMO_CUSTOMER }).expect(409);
    await t.http.post("/v1/me/email/otp").set(auth).send({ email: "moved@example.com" }).expect(200);
    await t.http.post("/v1/me/email/verify").set(auth).send({ code: outbox.codeFor("moved@example.com") }).expect(200);
    await signIn(t.http, "moved@example.com", "a-long-password");
    await t.http.post("/v1/auth/login").send({ email: "mover@example.com", password: "a-long-password" }).expect(401);
  });

  it("keeps an optional contact number", async () => {
    const { auth } = await signUp(t.http, "caller@example.com");
    const set = await t.http.patch("/v1/me").set(auth).send({ phone: "98450 11111" }).expect(200);
    expect(set.body.phone).toBe("+919845011111");
    await t.http.patch("/v1/me").set(auth).send({ phone: "12345" }).expect(422);
    const cleared = await t.http.patch("/v1/me").set(auth).send({ phone: "" }).expect(200);
    expect(cleared.body.phone).toBeNull();
  });
});

describe("change password", () => {
  it("needs the current password, keeps this device and signs out the others", async () => {
    const { session: other } = await signUp(t.http, "changer@example.com", "Changer", "old-password-1");
    const { auth, session: here } = await signIn(t.http, "changer@example.com", "old-password-1");
    const wrong = await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "nope", newPassword: "new-password-1" }).expect(400);
    expect(wrong.body.code).toBe("PASSWORD_INCORRECT");
    await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "old-password-1", newPassword: "short" }).expect(422);

    await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "old-password-1", newPassword: "new-password-1" }).expect(204);
    expect(outbox.sent.map((m) => m.subject)).toContain("Your AltasGoods password was changed");
    await t.http.get("/v1/me").set(auth).expect(200);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: here.refreshToken }).expect(200);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${other.accessToken}` }).expect(401);
    await signIn(t.http, "changer@example.com", "new-password-1");
  });

  it("signs out every other device on request", async () => {
    const { session: other } = await signUp(t.http, "tidy@example.com");
    const { auth } = await signIn(t.http, "tidy@example.com", "a-long-password");
    await t.http.post("/v1/me/sessions/sign-out-others").set(auth).expect(204);
    await t.http.get("/v1/me").set(auth).expect(200);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: other.refreshToken }).expect(401);
  });
});

describe("sessions", () => {
  it("requires a token for protected routes", async () => {
    const r = await t.http.get("/v1/me").expect(401);
    expect(r.headers["content-type"]).toContain("application/problem+json");
    expect(r.body.code).toBe("UNAUTHENTICATED");
  });

  it("rotates refresh tokens and revokes everything when an old one is reused", async () => {
    const { session } = await signUp(t.http, "rotator@example.com");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(first.body.refreshToken).not.toBe(session.refreshToken);

    // replaying the original token looks like theft
    const reuse = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(reuse.body.code).toBe("REFRESH_REUSED");
    // and the rotated token was revoked along with every other session
    await t.http.post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it("logs out by revoking the refresh token", async () => {
    const { session } = await signUp(t.http, "leaver@example.com");
    await t.http.post("/v1/auth/logout").send({ refreshToken: session.refreshToken }).expect(204);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
  });
});
