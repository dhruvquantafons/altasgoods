import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { env, isProduction } from "../../config/env.js";
import type { Db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { ApiError, conflict, notFound } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, EMAIL_PROVIDER, REDIS } from "../../common/tokens.js";
import type { EmailProvider } from "./email.provider.js";
import { emailVerificationEmail, passwordChangedEmail, passwordResetEmail } from "./emails.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import { TokensService, type Grants } from "./tokens.service.js";

const CODE_TTL_SECONDS = 10 * 60;
const CODE_MAX_ATTEMPTS = 5;
const CODE_REQUESTS_PER_WINDOW = 5;
const WINDOW_SECONDS = 15 * 60;
const RESEND_AFTER_SECONDS = 30;
const LOGIN_FAILURES_PER_WINDOW = 10;

const hashCode = (challengeId: string, code: string) => createHash("sha256").update(`${challengeId}:${code}:${env().JWT_SECRET}`).digest("hex");
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const sameEmail = (email: string) => sql`lower(${users.email}) = ${normalizeEmail(email)}`;

const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_, a: string, mid: string, d: string) => `${a}${"*".repeat(Math.min(mid.length, 6))}${d}`);

const isUniqueViolation = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505";

type Meta = { userAgent?: string; ip?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger("Auth");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(TokensService) private readonly tokens: TokensService,
  ) {}

  /** Counts a request against a 15 minute window and refuses once it is over the limit. */
  private async limit(key: string, max: number, message: string, code = "RATE_LIMITED") {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
    if (count > max) throw new ApiError(429, code, message);
  }

  private async session(userId: string, meta: Meta, isNewUser: boolean) {
    const pair = await this.tokens.issue(userId, await this.grants(userId), meta);
    return { ...pair, user: await this.me(userId), isNewUser };
  }

  /** Creates a shopper account. Staff accounts are made with the admin:create script. */
  async signup(input: { name: string; email: string; password: string }, meta: Meta) {
    const email = normalizeEmail(input.email);
    const taken = () => conflict("EMAIL_TAKEN", "An account with this email already exists. Sign in, or reset your password.");
    const [existing] = await this.db.select({ id: users.id }).from(users).where(sameEmail(email));
    if (existing) throw taken();
    const passwordHash = await hashPassword(input.password);
    const [user] = await this.db
      .insert(users)
      .values({ email, name: input.name, passwordHash })
      .returning({ id: users.id })
      .catch((e: unknown) => {
        throw isUniqueViolation(e) ? taken() : e;
      });
    return this.session(user!.id, meta, true);
  }

  async login(input: { email: string; password: string }, meta: Meta) {
    const email = normalizeEmail(input.email);
    const failures = `login:fail:${email}`;
    if (Number(await this.redis.get(failures)) >= LOGIN_FAILURES_PER_WINDOW) {
      throw new ApiError(429, "LOGIN_RATE_LIMITED", "Too many attempts. Please wait 15 minutes, or reset your password.");
    }
    const [user] = await this.db.select().from(users).where(sameEmail(email));
    // an unknown email costs a full hash too, so timing does not reveal which emails have accounts
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await decoyHash()));
    if (!user || !user.passwordHash || !ok) {
      const count = await this.redis.incr(failures);
      if (count === 1) await this.redis.expire(failures, WINDOW_SECONDS);
      throw new ApiError(401, "INVALID_CREDENTIALS", "That email and password do not match. Try again, or reset your password.");
    }
    if (user.status === "BLOCKED") throw new ApiError(403, "ACCOUNT_BLOCKED", "This account is blocked. Contact AltasGoods support.");
    await this.redis.del(failures);
    return this.session(user.id, meta, false);
  }

  /**
   * Emails a code to reset the password. Answers the same whether or not the
   * email has an account, so the form cannot be used to find out who shops here.
   */
  async requestPasswordReset(rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    await this.limit(`pwreset:req:${email}`, CODE_REQUESTS_PER_WINDOW, "Too many codes requested. Please try again in 15 minutes.", "OTP_RATE_LIMITED");
    const response = {
      email: maskEmail(email),
      expiresAt: new Date(this.clock.now().getTime() + CODE_TTL_SECONDS * 1000).toISOString(),
      resendAfterSeconds: RESEND_AFTER_SECONDS,
    };
    const [user] = await this.db.select({ id: users.id, status: users.status }).from(users).where(sameEmail(email));
    if (!user || user.status === "BLOCKED") return response;

    const code = newCode();
    await this.redis.set(`pwreset:${user.id}`, JSON.stringify({ hash: hashCode(`reset:${user.id}`, code), attempts: 0 }), "EX", CODE_TTL_SECONDS);
    await this.email.send(passwordResetEmail(email, code, CODE_TTL_SECONDS / 60));
    return { ...response, ...(isProduction() ? {} : { devCode: code }) };
  }

  /** Checks the emailed code, sets the new password, signs out every other device and signs this one in. */
  async resetPassword(input: { email: string; code: string; password: string }, meta: Meta) {
    const expired = () => new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    const [user] = await this.db.select({ id: users.id, email: users.email, status: users.status }).from(users).where(sameEmail(input.email));
    if (!user) throw expired();
    const key = `pwreset:${user.id}`;
    const raw = await this.redis.get(key);
    if (!raw) throw expired();
    const pending = JSON.parse(raw) as { hash: string; attempts: number };
    if (pending.attempts >= CODE_MAX_ATTEMPTS) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");
    const expected = Buffer.from(pending.hash, "hex");
    const given = Buffer.from(hashCode(`reset:${user.id}`, input.code), "hex");
    if (!timingSafeEqual(expected, given)) {
      await this.redis.set(key, JSON.stringify({ ...pending, attempts: pending.attempts + 1 }), "KEEPTTL");
      const left = CODE_MAX_ATTEMPTS - pending.attempts - 1;
      throw new ApiError(400, "OTP_INCORRECT", left > 0 ? `That code is not right. ${left} attempts left.` : "Too many wrong attempts. Request a new code.");
    }
    if (user.status === "BLOCKED") throw new ApiError(403, "ACCOUNT_BLOCKED", "This account is blocked. Contact AltasGoods support.");
    await this.redis.del(key, `login:fail:${normalizeEmail(user.email)}`);
    // the code proves the address is theirs
    await this.db.update(users).set({ passwordHash: await hashPassword(input.password), emailVerifiedAt: this.clock.now() }).where(eq(users.id, user.id));
    await this.tokens.revokeAll(user.id);
    await this.email.send(passwordChangedEmail(user.email)).catch((e: Error) => this.logger.warn(`Password changed notice not sent: ${e.message}`));
    return this.session(user.id, meta, false);
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
      email: user.email,
      name: user.name,
      phone: user.phone,
      emailVerified: !!user.emailVerifiedAt,
      staffRoles: user.staffRoles,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /** Changes the password with the current one, and signs out every other device. */
  async changePassword(userId: string, sessionId: string, input: { currentPassword: string; newPassword: string }) {
    const [user] = await this.db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
    if (!user) throw notFound("User");
    const failures = `login:fail:${normalizeEmail(user.email)}`;
    if (Number(await this.redis.get(failures)) >= LOGIN_FAILURES_PER_WINDOW) {
      throw new ApiError(429, "LOGIN_RATE_LIMITED", "Too many attempts. Please wait 15 minutes, or reset your password.");
    }
    if (!user.passwordHash || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      const count = await this.redis.incr(failures);
      if (count === 1) await this.redis.expire(failures, WINDOW_SECONDS);
      throw new ApiError(400, "PASSWORD_INCORRECT", "Your current password is not right. If you have forgotten it, sign out and use Forgot password.");
    }
    await this.db.update(users).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(users.id, userId));
    await this.tokens.revokeOthers(userId, sessionId);
    await this.email.send(passwordChangedEmail(user.email)).catch((e: Error) => this.logger.warn(`Password changed notice not sent: ${e.message}`));
  }

  signOutOthers(userId: string, sessionId: string) {
    return this.tokens.revokeOthers(userId, sessionId);
  }

  /** Name and contact number. The sign in email changes only through the verified flow below. */
  async updateMe(userId: string, patch: { name?: string; phone?: string | null }) {
    if (Object.keys(patch).length) await this.db.update(users).set(patch).where(eq(users.id, userId));
    return this.me(userId);
  }

  /** Sends a code to confirm an email address (the current one, or a new sign in email). One pending code per user. */
  async requestEmailOtp(userId: string, rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    await this.limit(`email-otp:req:${userId}`, CODE_REQUESTS_PER_WINDOW, "Too many codes requested. Please try again in 15 minutes.", "OTP_RATE_LIMITED");
    await this.assertEmailFree(userId, email);

    const code = newCode();
    const challengeId = `${userId}:${email}`;
    await this.redis.set(`email-otp:${userId}`, JSON.stringify({ email, hash: hashCode(challengeId, code), attempts: 0 }), "EX", CODE_TTL_SECONDS);
    await this.email.send(emailVerificationEmail(email, code, CODE_TTL_SECONDS / 60));
    return {
      email: maskEmail(email),
      expiresAt: new Date(this.clock.now().getTime() + CODE_TTL_SECONDS * 1000).toISOString(),
      resendAfterSeconds: RESEND_AFTER_SECONDS,
      ...(isProduction() ? {} : { devCode: code }),
    };
  }

  async verifyEmailOtp(userId: string, code: string) {
    const key = `email-otp:${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    const pending = JSON.parse(raw) as { email: string; hash: string; attempts: number };
    if (pending.attempts >= CODE_MAX_ATTEMPTS) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");
    const expected = Buffer.from(pending.hash, "hex");
    const given = Buffer.from(hashCode(`${userId}:${pending.email}`, code), "hex");
    if (!timingSafeEqual(expected, given)) {
      await this.redis.set(key, JSON.stringify({ ...pending, attempts: pending.attempts + 1 }), "KEEPTTL");
      const left = CODE_MAX_ATTEMPTS - pending.attempts - 1;
      throw new ApiError(400, "OTP_INCORRECT", left > 0 ? `That code is not right. ${left} attempts left.` : "Too many wrong attempts. Request a new code.");
    }
    await this.redis.del(key);
    await this.assertEmailFree(userId, pending.email);
    await this.db
      .update(users)
      .set({ email: pending.email, emailVerifiedAt: this.clock.now() })
      .where(eq(users.id, userId))
      .catch((e: unknown) => {
        throw isUniqueViolation(e) ? conflict("EMAIL_TAKEN", "Another account already uses this email.") : e;
      });
    return this.me(userId);
  }

  private async assertEmailFree(userId: string, email: string) {
    const [other] = await this.db.select({ id: users.id }).from(users).where(and(sameEmail(email), ne(users.id, userId)));
    if (other) throw conflict("EMAIL_TAKEN", "Another account already uses this email.");
  }
}
