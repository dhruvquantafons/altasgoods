import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { EMAIL_PROVIDER, REDIS } from "../src/common/tokens.js";
import { createDb } from "../src/db/client.js";
import { sessions, users } from "../src/db/schema.js";
import type { EmailMessage, EmailProvider } from "../src/modules/auth/email.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, testIp, type TestContext } from "./helpers.js";

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
const { db, pool } = createDb(env().TEST_DATABASE_URL);
let t: TestContext;
beforeAll(async () => {
  t = await createTestApp([{ provide: EMAIL_PROVIDER, useValue: outbox }]);
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(() => {
  outbox.sent = [];
});
afterEach(() => t.clock.reset());

/** The app's own Redis client (keys are prefixed for the test run). */
const redis = () => t.app.get<symbol, Redis>(REDIS);

/** A sign in attempt from a given client address (the app trusts X-Forwarded-For from loopback). */
const login = (email: string, password: string, ip: string) => t.http.post("/v1/auth/login").set("X-Forwarded-For", ip).send({ email, password });

describe("sign up", () => {
  it("creates a shopper account and signs it in", async () => {
    const { session } = await signUp(t.http, "New.Shopper@Example.com", "New Shopper");
    expect(session.isNewUser).toBe(true);
    expect(session.user).toMatchObject({ email: "new.shopper@example.com", name: "New Shopper", phone: null, emailVerified: false, staffRoles: [] });
    expect(session.expiresIn).toBe(900);
    // and the password works from then on, whatever the case of the email
    await signIn(t.http, "NEW.SHOPPER@example.com", "a-long-password");
  });

  it("allows ten sign ups an hour from one address", async () => {
    const ip = testIp();
    for (let i = 0; i < 10; i++) await signUp(t.http, `batch.${i}@example.com`, "Batch", "a-long-password", ip);
    const limited = await t.http.post("/v1/auth/signup").set("X-Forwarded-For", ip).send({ name: "One More", email: "batch.10@example.com", password: "a-long-password" }).expect(429);
    expect(limited.body.code).toBe("SIGNUP_RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(900);
    // someone else is not held up
    await signUp(t.http, "batch.10@example.com", "Batch", "a-long-password", testIp());
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

  it("locks an email after ten wrong passwords from one address, and only from that address", async () => {
    await signUp(t.http, "guessed@example.com");
    const attacker = testIp();
    for (let i = 0; i < 10; i++) await login("guessed@example.com", "wrong-password", attacker).expect(401);
    const locked = await login("guessed@example.com", "a-long-password", attacker).expect(429);
    expect(locked.body.code).toBe("LOGIN_RATE_LIMITED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(800);
    expect(Number(locked.headers["retry-after"])).toBeLessThanOrEqual(900);
    // the owner, somewhere else, still gets in
    await login("guessed@example.com", "a-long-password", testIp()).expect(200);
  });

  it("clears only the email and address that signed in", async () => {
    await signUp(t.http, "two.places@example.com");
    const [home, office] = [testIp(), testIp()];
    for (let i = 0; i < 9; i++) await login("two.places@example.com", "wrong-password", home).expect(401);
    for (let i = 0; i < 9; i++) await login("two.places@example.com", "wrong-password", office).expect(401);
    await login("two.places@example.com", "a-long-password", home).expect(200);
    // home starts over
    for (let i = 0; i < 9; i++) await login("two.places@example.com", "wrong-password", home).expect(401);
    // the office count was kept: one more wrong try locks it
    await login("two.places@example.com", "wrong-password", office).expect(401);
    await login("two.places@example.com", "a-long-password", office).expect(429);
  });

  it("stops one address after thirty wrong passwords across any emails, with the same answer for real and unknown ones", async () => {
    await signUp(t.http, "sprayed@example.com");
    const sprayer = testIp();
    for (let i = 0; i < 30; i++) await login(`nobody.${i}@example.com`, "wrong-password", sprayer).expect(401);
    const real = await login("sprayed@example.com", "a-long-password", sprayer).expect(429);
    const unknown = await login("nobody.else@example.com", "wrong-password", sprayer).expect(429);
    expect(real.body.code).toBe("LOGIN_RATE_LIMITED");
    expect(unknown.body).toMatchObject({ code: real.body.code, detail: real.body.detail });
    expect(Number(real.headers["retry-after"])).toBeGreaterThan(0);
    await login("sprayed@example.com", "a-long-password", testIp()).expect(200);
  });

  it("slows a guess spread over many addresses at a hundred an hour per email", { timeout: 60_000 }, async () => {
    await signUp(t.http, "much.wanted@example.com");
    for (let i = 0; i < 100; i++) await login("much.wanted@example.com", "wrong-password", testIp()).expect(401);
    const slowed = await login("much.wanted@example.com", "a-long-password", testIp()).expect(429);
    expect(slowed.body.code).toBe("LOGIN_RATE_LIMITED");
    expect(Number(slowed.headers["retry-after"])).toBeGreaterThan(900);
    expect(Number(slowed.headers["retry-after"])).toBeLessThanOrEqual(3600);
  });

  it("gives a limit key left without an expiry its window again", async () => {
    await signUp(t.http, "stuck.valve@example.com");
    const ip = testIp();
    // as if the process died between counting and setting the expiry
    await redis().set("login:fail:stuck.valve@example.com", "5");
    await redis().set(`login:fail-ip:${ip}`, "2");
    await redis().set(`signup:ip:${ip}`, "3");
    await redis().set(`pwreset:req:stuck.valve@example.com`, "1");
    // read only (a correct password counts nothing): healed on the check
    await login("stuck.valve@example.com", "a-long-password", ip).expect(200);
    expect(await redis().ttl("login:fail:stuck.valve@example.com")).toBeGreaterThan(3000);
    expect(await redis().ttl(`login:fail-ip:${ip}`)).toBeGreaterThan(800);
    // counted: healed as it counts
    await signUp(t.http, "stuck.signup@example.com", "Stuck", "a-long-password", ip);
    expect(await redis().ttl(`signup:ip:${ip}`)).toBeGreaterThan(3000);
    await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: "stuck.valve@example.com" }).expect(200);
    expect(await redis().ttl("pwreset:req:stuck.valve@example.com")).toBeGreaterThan(800);
  });

  it("lifts every sign in and sign up limit through the development reset", async () => {
    await signUp(t.http, "reset.limits@example.com");
    const ip = testIp();
    for (let i = 0; i < 10; i++) await login("reset.limits@example.com", "wrong-password", ip).expect(401);
    for (let i = 0; i < 20; i++) await login(`stranger.${i}@example.com`, "wrong-password", ip).expect(401);
    for (let i = 0; i < 10; i++) await signUp(t.http, `reset.batch.${i}@example.com`, "Batch", "a-long-password", ip);
    for (let i = 0; i < 20; i++) await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: `reset.ask.${i}@example.com` }).expect(200);
    await login("reset.limits@example.com", "a-long-password", ip).expect(429);
    await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: "reset.ask.20@example.com" }).expect(429);

    await t.http.post("/v1/dev/rate-limits/reset").expect(200);
    await login("reset.limits@example.com", "a-long-password", ip).expect(200);
    await signUp(t.http, "reset.batch.10@example.com", "Batch", "a-long-password", ip);
    await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: "reset.ask.20@example.com" }).expect(200);
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
    // dev codes are for development only, never test or production
    expect(r.body).not.toHaveProperty("devCode");
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
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("allows twenty code requests an hour from one address, across emails", async () => {
    const ip = testIp();
    for (let i = 0; i < 20; i++) await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: `asker.${i}@example.com` }).expect(200);
    const limited = await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", ip).send({ email: "asker.20@example.com" }).expect(429);
    expect(limited.body.code).toBe("OTP_RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(900);
    await t.http.post("/v1/auth/password/forgot").set("X-Forwarded-For", testIp()).send({ email: "asker.20@example.com" }).expect(200);
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

  it("locks wrong current passwords per account, apart from sign in attempts", async () => {
    const { auth } = await signUp(t.http, "fumbler@example.com");
    // wrong sign ins elsewhere do not stop a signed in owner changing their password
    for (let i = 0; i < 10; i++) await login("fumbler@example.com", "wrong-password", testIp()).expect(401);
    for (let i = 0; i < 10; i++) await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "nope-nope", newPassword: "new-password-1" }).expect(400);
    const locked = await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "a-long-password", newPassword: "new-password-1" }).expect(429);
    expect(locked.body.code).toBe("LOGIN_RATE_LIMITED");
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(800);
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

    // replaying the original token after the 30 second grace looks like theft
    t.clock.advance(31_000);
    const reuse = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(reuse.body.code).toBe("REFRESH_REUSED");
    // and the rotated token was revoked along with every other session
    await t.http.post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken }).expect(401);
  });

  it("ends the access tokens already handed out when a refresh token is reused", async () => {
    const { session } = await signUp(t.http, "replayed@example.com");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${first.body.accessToken}` }).expect(200);
    t.clock.advance(31_000);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    // the thief may hold the newest access token: it stops working at once, not 15 minutes later
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${first.body.accessToken}` }).expect(401);
  });

  it("answers concurrent refreshes of one token with the same new pair, signing nobody out", async () => {
    const { session } = await signUp(t.http, "parallel.tabs@example.com");
    // another device of the same shopper, which must stay signed in
    const { session: phone } = await signIn(t.http, "parallel.tabs@example.com", "a-long-password");
    let token = session.refreshToken as string;
    for (const callers of [2, 5]) {
      const answers = await Promise.all(Array.from({ length: callers }, () => t.http.post("/v1/auth/refresh").send({ refreshToken: token })));
      expect(answers.map((r) => r.status)).toEqual(Array(callers).fill(200));
      expect(new Set(answers.map((r) => r.body.refreshToken)).size).toBe(1);
      expect(new Set(answers.map((r) => r.body.accessToken)).size).toBe(1);
      expect(answers[0]!.body.refreshToken).not.toBe(token);
      token = answers[0]!.body.refreshToken;
    }
    // the new pair works, and the other device was left alone
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${(await t.http.post("/v1/auth/refresh").send({ refreshToken: token }).expect(200)).body.accessToken}` }).expect(200);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${phone.accessToken}` }).expect(200);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: phone.refreshToken }).expect(200);
  });

  it("gives a repeat of a just rotated token the same pair for 30 seconds", async () => {
    const { session } = await signUp(t.http, "slow.network@example.com");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    t.clock.advance(25_000);
    const again = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(again.body).toEqual(first.body);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${again.body.accessToken}` }).expect(200);
  });

  it("does not hand out the pair again once its session was signed out, and signs nobody else out", async () => {
    const { session } = await signUp(t.http, "quick.leaver@example.com");
    const { session: phone } = await signIn(t.http, "quick.leaver@example.com", "a-long-password");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    await t.http.post("/v1/auth/logout").send({ refreshToken: first.body.refreshToken }).expect(204);
    const late = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(late.body.code).toBe("REFRESH_INVALID");
    // a late request from the signed out tab is not theft: the phone stays signed in
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${phone.accessToken}` }).expect(200);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: phone.refreshToken }).expect(200);
  });

  it("follows a token rotated twice within the window to the live pair", async () => {
    const { session } = await signUp(t.http, "twice.rotated@example.com");
    const t1 = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    t.clock.advance(10_000);
    const t2 = await t.http.post("/v1/auth/refresh").send({ refreshToken: t1.body.refreshToken }).expect(200);
    t.clock.advance(10_000);
    const late = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(late.body).toEqual(t2.body);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${late.body.accessToken}` }).expect(200);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: t2.body.refreshToken }).expect(200);
  });

  it("refuses a repeat within the window that finds no cached answer, without signing anyone out", async () => {
    const { session } = await signUp(t.http, "lost.cache@example.com");
    const { session: phone } = await signIn(t.http, "lost.cache@example.com", "a-long-password");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    await redis().del(`refresh-grace:${createHash("sha256").update(session.refreshToken).digest("hex")}`);
    const late = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(late.body.code).toBe("REFRESH_INVALID");
    await t.http.post("/v1/auth/refresh").send({ refreshToken: first.body.refreshToken }).expect(200);
    await t.http.get("/v1/me").set({ Authorization: `Bearer ${phone.accessToken}` }).expect(200);
  });

  it("does not hand out the pair again to an account blocked meanwhile", async () => {
    const { session } = await signUp(t.http, "blocked.meanwhile@example.com");
    await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    await db.update(users).set({ status: "BLOCKED" }).where(eq(users.id, session.user.id));
    const r = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(r.body.code).toBe("REFRESH_INVALID");
  });

  it("carries a role change made meanwhile in the repeated answer", async () => {
    const { session } = await signUp(t.http, "promoted.meanwhile@example.com");
    const first = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    await db.update(users).set({ staffRoles: ["CATALOG_MANAGER"] }).where(eq(users.id, session.user.id));
    const again = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(again.body.refreshToken).toBe(first.body.refreshToken);
    const claims = JSON.parse(Buffer.from(again.body.accessToken.split(".")[1], "base64url").toString("utf8"));
    expect(claims.staff).toEqual(["CATALOG_MANAGER"]);
  });

  it("records the client the web server names on a refreshed session", async () => {
    const { session } = await signUp(t.http, "named.client@example.com");
    const r = await t.http
      .post("/v1/auth/refresh")
      .set({ "X-Forwarded-For": "198.51.100.23", "User-Agent": "Mozilla/5.0 (Android 15) Firefox/140" })
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    const sid = JSON.parse(Buffer.from(r.body.accessToken.split(".")[1], "base64url").toString("utf8")).sid;
    const [row] = await db.select({ ip: sessions.ip, userAgent: sessions.userAgent }).from(sessions).where(eq(sessions.id, sid));
    expect(row).toEqual({ ip: "198.51.100.23", userAgent: "Mozilla/5.0 (Android 15) Firefox/140" });
  });

  it("logs out by revoking the refresh token", async () => {
    const { session } = await signUp(t.http, "leaver@example.com");
    await t.http.post("/v1/auth/logout").send({ refreshToken: session.refreshToken }).expect(204);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
  });
});
