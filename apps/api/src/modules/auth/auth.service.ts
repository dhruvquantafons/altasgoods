import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import { env, isProduction } from "../../config/env.js";
import type { Db } from "../../db/client.js";
import { otpChallenges, users } from "../../db/schema.js";
import { ApiError, notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, EMAIL_PROVIDER, REDIS, SMS_PROVIDER } from "../../common/tokens.js";
import { maskPhone, normalizePhone } from "./phone.js";
import type { EmailProvider, SmsProvider } from "./sms.provider.js";
import { TokensService, type Grants } from "./tokens.service.js";

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUESTS_PER_WINDOW = 5;
const OTP_WINDOW_SECONDS = 15 * 60;
const RESEND_AFTER_SECONDS = 30;

const EMAIL_OTP_TTL_SECONDS = 10 * 60;

const hashCode = (challengeId: string, code: string) => createHash("sha256").update(`${challengeId}:${code}:${env().JWT_SECRET}`).digest("hex");

const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_, a: string, mid: string, d: string) => `${a}${"*".repeat(Math.min(mid.length, 6))}${d}`);

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw unprocessable("PHONE_INVALID", "Enter a valid 10 digit Indian mobile number");

    const key = `otp:req:${phone}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, OTP_WINDOW_SECONDS);
    if (count > OTP_REQUESTS_PER_WINDOW) throw new ApiError(429, "OTP_RATE_LIMITED", "Too many codes requested. Please try again in 15 minutes.");

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(this.clock.now().getTime() + OTP_TTL_MS);
    const [challenge] = await this.db.insert(otpChallenges).values({ phone, codeHash: "pending", expiresAt }).returning({ id: otpChallenges.id });
    await this.db.update(otpChallenges).set({ codeHash: hashCode(challenge!.id, code) }).where(eq(otpChallenges.id, challenge!.id));
    await this.sms.sendOtp(phone, code);

    return {
      challengeId: challenge!.id,
      phone: maskPhone(phone),
      expiresAt: expiresAt.toISOString(),
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      ...(isProduction() ? {} : { devCode: code }),
    };
  }

  async verifyOtp(input: { challengeId: string; code: string; name?: string }, meta: { userAgent?: string; ip?: string }) {
    const now = this.clock.now();
    const [challenge] = await this.db
      .select()
      .from(otpChallenges)
      .where(and(eq(otpChallenges.id, input.challengeId), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, now)));
    if (!challenge) throw new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");

    const expected = Buffer.from(challenge.codeHash, "hex");
    const given = Buffer.from(hashCode(challenge.id, input.code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      await this.db.update(otpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(otpChallenges.id, challenge.id));
      const left = OTP_MAX_ATTEMPTS - challenge.attempts - 1;
      throw new ApiError(400, "OTP_INCORRECT", left > 0 ? `That code is not right. ${left} attempts left.` : "Too many wrong attempts. Request a new code.");
    }
    await this.db.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));

    let [user] = await this.db.select().from(users).where(eq(users.phone, challenge.phone));
    const isNewUser = !user;
    if (!user) [user] = await this.db.insert(users).values({ phone: challenge.phone, name: input.name ?? null }).returning();
    if (user!.status === "BLOCKED") throw new ApiError(403, "ACCOUNT_BLOCKED", "This account is blocked. Contact AltasGoods support.");

    const pair = await this.tokens.issue(user!.id, await this.grants(user!.id), meta);
    return { ...pair, user: await this.me(user!.id), isNewUser };
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }) {
    const { userId: _userId, ...pair } = await this.tokens.rotate(refreshToken, (id) => this.grants(id), meta);
    return pair;
  }

  logout(refreshToken: string) {
    return this.tokens.revoke(refreshToken);
  }

  /** Staff roles, as carried in the access token. */
  async grants(userId: string): Promise<Grants> {
    const [user] = await this.db.select({ staff: users.staffRoles }).from(users).where(eq(users.id, userId));
    return { staff: user?.staff ?? [] };
  }

  async me(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw notFound("User");
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      staffRoles: user.staffRoles,
    };
  }

  async updateMe(userId: string, patch: { name?: string; email?: string }) {
    const [current] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    // a changed email has to be verified again
    const emailChanged = patch.email !== undefined && patch.email.toLowerCase() !== current?.email?.toLowerCase();
    await this.db
      .update(users)
      .set({ ...patch, ...(patch.email ? { email: patch.email.toLowerCase() } : {}), ...(emailChanged ? { emailVerifiedAt: null } : {}) })
      .where(eq(users.id, userId));
    return this.me(userId);
  }

  /** Sends a code to confirm an email address. One pending code per user. */
  async requestEmailOtp(userId: string, rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const rate = `email-otp:req:${userId}`;
    const count = await this.redis.incr(rate);
    if (count === 1) await this.redis.expire(rate, OTP_WINDOW_SECONDS);
    if (count > OTP_REQUESTS_PER_WINDOW) throw new ApiError(429, "OTP_RATE_LIMITED", "Too many codes requested. Please try again in 15 minutes.");

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const challengeId = `${userId}:${email}`;
    await this.redis.set(`email-otp:${userId}`, JSON.stringify({ email, hash: hashCode(challengeId, code), attempts: 0 }), "EX", EMAIL_OTP_TTL_SECONDS);
    await this.email.sendOtp(email, code);
    return {
      email: maskEmail(email),
      expiresAt: new Date(this.clock.now().getTime() + EMAIL_OTP_TTL_SECONDS * 1000).toISOString(),
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      ...(isProduction() ? {} : { devCode: code }),
    };
  }

  async verifyEmailOtp(userId: string, code: string) {
    const key = `email-otp:${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    const pending = JSON.parse(raw) as { email: string; hash: string; attempts: number };
    if (pending.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");
    const expected = Buffer.from(pending.hash, "hex");
    const given = Buffer.from(hashCode(`${userId}:${pending.email}`, code), "hex");
    if (!timingSafeEqual(expected, given)) {
      await this.redis.set(key, JSON.stringify({ ...pending, attempts: pending.attempts + 1 }), "KEEPTTL");
      const left = OTP_MAX_ATTEMPTS - pending.attempts - 1;
      throw new ApiError(400, "OTP_INCORRECT", left > 0 ? `That code is not right. ${left} attempts left.` : "Too many wrong attempts. Request a new code.");
    }
    await this.redis.del(key);
    await this.db.update(users).set({ email: pending.email, emailVerifiedAt: this.clock.now() }).where(eq(users.id, userId));
    return this.me(userId);
  }
}
