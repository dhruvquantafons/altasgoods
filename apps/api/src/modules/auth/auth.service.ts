import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { devToolsEnabled, env } from "../../config/env.js";
import type { Db, Tx } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { ApiError, conflict, notFound, RateLimitError } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB, EMAIL_PROVIDER, REDIS } from "../../common/tokens.js";
import type { EmailProvider } from "./email.provider.js";
import { emailVerificationEmail, passwordChangedEmail, passwordResetEmail } from "./emails.js";
import { clientKey } from "./client-ip.js";
import { InvitesService } from "./invites.service.js";
import { decoyHash, hashPassword, verifyPassword } from "./password.js";
import { TokensService, type Grants } from "./tokens.service.js";

const CODE_TTL_SECONDS = 10 * 60;
const CODE_MAX_ATTEMPTS = 5;
const CODE_REQUESTS_PER_WINDOW = 5;
const WINDOW_SECONDS = 15 * 60;
const HOUR_SECONDS = 3600;
const RESEND_AFTER_SECONDS = 30;
const PASSWORD_CHANGE_FAILURES_PER_WINDOW = 10;

/**
 * Wrong passwords are counted three ways, all checked before the password is:
 * - per email and client address (10 per 15 minutes): the lock a guesser hits,
 *   which leaves the owner, signing in from anywhere else, alone;
 * - per client address across emails (30 per 15 minutes): one address trying
 *   many accounts;
 * - per email from every address (100 per hour): a safety valve against a guess
 *   spread over many addresses. It is far above what an owner mistyping ever
 *   reaches, so casual abuse cannot lock them out, yet it keeps a distributed
 *   attack on one account to a crawl.
 * Unknown emails count the same as real ones, so the answers never reveal
 * which emails have accounts. A correct password clears only its own email and
 * address pair.
 */
const loginLimits = (email: string, ip: string) => [
  { key: `login:fail:${email}:${ip}`, max: 10, window: WINDOW_SECONDS },
  { key: `login:fail-ip:${ip}`, max: 30, window: WINDOW_SECONDS },
  { key: `login:fail:${email}`, max: 100, window: HOUR_SECONDS },
];
const SIGNUPS_PER_HOUR_PER_IP = 10;
const CODE_REQUESTS_PER_HOUR_PER_IP = 20;

/** INCR, then EXPIRE whenever the key has none (new, or left without one by a crash): atomic in Redis. */
const COUNT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if redis.call("TTL", KEYS[1]) < 0 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return count`;

/** GET for each key (KEYS[i], window ARGV[i]); a key that exists without an expiry gets its window. */
const PEEK_SCRIPT = `
local out = {}
for i, key in ipairs(KEYS) do
  local v = redis.call("GET", key)
  if v and redis.call("TTL", key) == -1 then redis.call("EXPIRE", key, ARGV[i]) end
  out[i] = v or false
end
return out`;

const waitMessage = (seconds: number) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
};

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
    @Inject(InvitesService) private readonly invites: InvitesService,
  ) {}

  /** Counts a request against a window (15 minutes unless given) and refuses once it is over the limit. */
  private async limit(key: string, max: number, message: string, code = "RATE_LIMITED", window = WINDOW_SECONDS) {
    const count = await this.count(key, window);
    if (count > max) throw new RateLimitError(code, message, await this.secondsLeft(key, window));
  }

  /** Adds one and makes sure the key expires, in one step, so a crash in between cannot leave a lock that never lifts. */
  private async count(key: string, window: number) {
    return Number(await this.redis.eval(COUNT_SCRIPT, 1, key, window));
  }

  private async secondsLeft(key: string, window: number) {
    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : window;
  }

  /** Reads limit counts, giving any key found without an expiry its window again (self healing). */
  private async peek(limits: { key: string; window: number }[]) {
    const counts = (await this.redis.eval(PEEK_SCRIPT, limits.length, ...limits.map((l) => l.key), ...limits.map((l) => l.window))) as (string | null)[];
    return counts.map(Number);
  }

  /** Refuses a sign in attempt while any of its failure counts is at its limit. */
  private async assertLoginAllowed(limits: ReturnType<typeof loginLimits>) {
    const counts = await this.peek(limits);
    let wait = 0;
    for (const [i, l] of limits.entries()) {
      if (Number(counts[i]) >= l.max) wait = Math.max(wait, await this.secondsLeft(l.key, l.window));
    }
    if (wait) throw new RateLimitError("LOGIN_RATE_LIMITED", `Too many attempts. Please wait ${waitMessage(wait)}, or reset your password.`, wait);
  }

  private async session(userId: string, meta: Meta, isNewUser: boolean) {
    const pair = await this.tokens.issue(userId, await this.grants(userId), meta);
    return { ...pair, user: await this.me(userId), isNewUser };
  }

  /** Creates a shopper account. Staff accounts are made with the admin:create script. */
  async signup(input: { name: string; email: string; password: string }, meta: Meta) {
    await this.limit(`signup:ip:${clientKey(meta.ip)}`, SIGNUPS_PER_HOUR_PER_IP, "Too many accounts made from this network. Please try again later.", "SIGNUP_RATE_LIMITED", HOUR_SECONDS);
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
    const limits = loginLimits(email, clientKey(meta.ip));
    await this.assertLoginAllowed(limits);
    const [user] = await this.db.select().from(users).where(sameEmail(email));
    // an unknown email costs a full hash too, so timing does not reveal which emails have accounts
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await decoyHash()));
    if (!user || !user.passwordHash || !ok) {
      for (const l of limits) await this.count(l.key, l.window);
      throw new ApiError(401, "INVALID_CREDENTIALS", "That email and password do not match. Try again, or reset your password.");
    }
    if (user.status === "BLOCKED") throw new ApiError(403, "ACCOUNT_BLOCKED", "This account is blocked. Contact AltasGoods support.");
    // only this email and address: a lock another address earned stays
    await this.redis.del(limits[0]!.key);
    return this.session(user.id, meta, false);
  }

  /**
   * Emails a code to reset the password. Answers the same whether or not the
   * email has an account, so the form cannot be used to find out who shops here.
   */
  async requestPasswordReset(rawEmail: string, meta: Meta) {
    const email = normalizeEmail(rawEmail);
    await this.limit(`pwreset:req-ip:${clientKey(meta.ip)}`, CODE_REQUESTS_PER_HOUR_PER_IP, "Too many codes requested from this network. Please try again later.", "OTP_RATE_LIMITED", HOUR_SECONDS);
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
    return { ...response, ...(devToolsEnabled() ? { devCode: code } : {}) };
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
    // lift the sign in lock on this address, and the per email valve
    const [here, , everywhere] = loginLimits(normalizeEmail(user.email), clientKey(meta.ip));
    await this.redis.del(key, here!.key, everywhere!.key);
    // the code proves the address is theirs
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.password), emailVerifiedAt: this.clock.now(), mustChangePassword: false })
      .where(eq(users.id, user.id));
    await this.tokens.revokeAll(user.id);
    await this.email.send(passwordChangedEmail(user.email)).catch((e: Error) => this.logger.warn(`Password changed notice not sent: ${e.message}`));
    return this.session(user.id, meta, false);
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }) {
    const { userId: _userId, ...pair } = await this.tokens.rotate(refreshToken, (id, db) => this.grants(id, db), meta);
    return pair;
  }

  logout(refreshToken: string) {
    return this.tokens.revoke(refreshToken);
  }

  /**
   * Staff roles and the "password change required" flag, as carried in the
   * access token. A blocked account gets no new token, so a refresh fails.
   */
  async grants(userId: string, db: Tx = this.db): Promise<Grants> {
    const [user] = await db.select({ staff: users.staffRoles, status: users.status, pwc: users.mustChangePassword }).from(users).where(eq(users.id, userId));
    if (!user || user.status === "BLOCKED") throw new ApiError(401, "REFRESH_INVALID", "Please sign in again.");
    return { staff: user.staff, pwc: user.pwc };
  }

  /**
   * Accepts a staff invite: sets the chosen password and signs in. The link
   * came to their inbox, so it also confirms the email address.
   */
  async acceptInvite(input: { token: string; password: string }, meta: Meta) {
    const invalid = () => new ApiError(400, "INVITE_INVALID", "This invite link has expired or was already used. Ask a Super Admin to send a new one.");
    const userId = await this.invites.consume(input.token);
    if (!userId) throw invalid();
    const [user] = await this.db.select({ id: users.id, email: users.email, status: users.status, staff: users.staffRoles }).from(users).where(eq(users.id, userId));
    // removed or disabled since the invite went out
    if (!user || user.status === "BLOCKED" || !user.staff.length) throw invalid();
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.password), mustChangePassword: false, emailVerifiedAt: this.clock.now() })
      .where(eq(users.id, user.id));
    // any session from before (a shopper made staff, say) ends with the new password
    await this.tokens.revokeAll(user.id);
    const [here, , everywhere] = loginLimits(normalizeEmail(user.email), clientKey(meta.ip));
    await this.redis.del(here!.key, everywhere!.key);
    return this.session(user.id, meta, false);
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
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /** Changes the password with the current one, and signs out every other device. */
  async changePassword(userId: string, sessionId: string, input: { currentPassword: string; newPassword: string }) {
    const [user] = await this.db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
    if (!user) throw notFound("User");
    // signed in already, so counted per account: wrong guesses from a stolen session stay slow
    const failures = `pwchange:fail:${userId}`;
    const [failed] = await this.peek([{ key: failures, window: WINDOW_SECONDS }]);
    if (failed! >= PASSWORD_CHANGE_FAILURES_PER_WINDOW) {
      const wait = await this.secondsLeft(failures, WINDOW_SECONDS);
      throw new RateLimitError("LOGIN_RATE_LIMITED", `Too many attempts. Please wait ${waitMessage(wait)}, or reset your password.`, wait);
    }
    if (!user.passwordHash || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      await this.count(failures, WINDOW_SECONDS);
      throw new ApiError(400, "PASSWORD_INCORRECT", "Your current password is not right. If you have forgotten it, sign out and use Forgot password.");
    }
    // a password of their own replaces a temporary one
    await this.db.update(users).set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false }).where(eq(users.id, userId));
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
      ...(devToolsEnabled() ? { devCode: code } : {}),
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
