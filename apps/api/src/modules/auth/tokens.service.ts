import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Redis } from "ioredis";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../../config/env.js";
import type { Db, Tx } from "../../db/client.js";
import { sessions } from "../../db/schema.js";
import { ApiError } from "../../common/errors.js";
import { CLOCK, DB, REDIS } from "../../common/tokens.js";
import type { Clock } from "../../common/infra.module.js";

export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;

export interface AccessClaims {
  sub: string;
  sid: string;
  /** AltasGoods Control roles; absent for shoppers */
  staff: string[];
  /** "Password change required": the account has a temporary password, so staff routes refuse it */
  pwc?: boolean;
}

/** What a session may act as, re-read from the database on every refresh. */
export interface Grants {
  staff: string[];
  pwc?: boolean;
}

/**
 * How long a just rotated refresh token still gets the pair it was rotated
 * into. Browsers send the same token from parallel requests (prefetches, two
 * tabs); without this the second one looks like theft and signs everyone out.
 */
export const REFRESH_GRACE_SECONDS = 30;
/** How many rotations within the window a repeat may follow to reach the live session. */
const REFRESH_GRACE_HOPS = 3;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const secret = () => new TextEncoder().encode(env().JWT_SECRET);
const revokedAll = (userId: string) => `revoked-all:${userId}`;
const graceKey = (refreshHash: string) => `refresh-grace:${refreshHash}`;

/** The pair a rotation produced, kept briefly so a repeat of the old token gets it again. */
export interface GraceEntry {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  grants: Grants;
}

let graceCipherKey: { secret: string; key: Buffer } | undefined;
/** AES-256 key for the grace cache, derived from JWT_SECRET for this purpose only. */
function graceKeyBytes() {
  const jwtSecret = env().JWT_SECRET;
  if (graceCipherKey?.secret !== jwtSecret) {
    graceCipherKey = { secret: jwtSecret, key: Buffer.from(hkdfSync("sha256", jwtSecret, "altasgoods", "refresh-grace", 32)) };
  }
  return graceCipherKey.key;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Encrypts with AES-256-GCM, bound to the old token's hash so an entry cannot be moved to another key. */
export function sealGrace(entry: GraceEntry, refreshHash: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", graceKeyBytes(), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(refreshHash));
  const body = Buffer.concat([cipher.update(JSON.stringify(entry), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/** Opens a sealed entry; anything not exactly as sealed (tag, IV, layout, token) reads as a miss. */
export function openGrace(sealed: string, refreshHash: string): GraceEntry | null {
  try {
    const parts = sealed.split(".");
    if (parts.length !== 3) return null;
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url")) as [Buffer, Buffer, Buffer];
    // GCM would otherwise accept a shortened tag, which is easier to forge
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", graceKeyBytes(), iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(refreshHash));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as GraceEntry;
  } catch {
    return null;
  }
}

const sameGrants = (a: Grants, b: Grants) => !!a.pwc === !!b.pwc && a.staff.length === b.staff.length && a.staff.every((r, i) => r === b.staff[i]);

type Meta = { userAgent?: string; ip?: string };
/** Reads what a session may act as; throws (401) for an account that may not get a token. */
export type GrantsFor = (userId: string, db: Tx) => Promise<Grants>;

@Injectable()
export class TokensService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async issue(userId: string, grants: Grants, meta: Meta) {
    const { pair } = await this.create(this.db, userId, grants, meta);
    return pair;
  }

  private async create(db: Tx, userId: string, grants: Grants, meta: Meta) {
    const refreshToken = randomBytes(32).toString("base64url");
    const [session] = await db
      .insert(sessions)
      .values({ userId, refreshHash: sha256(refreshToken), userAgent: meta.userAgent?.slice(0, 200), ip: meta.ip?.slice(0, 64), expiresAt: new Date(this.clock.now().getTime() + REFRESH_TTL_MS) })
      .returning({ id: sessions.id });
    const pair = { accessToken: await this.sign({ sub: userId, sid: session!.id, ...grants }), refreshToken, expiresIn: ACCESS_TTL_SECONDS };
    return { sessionId: session!.id, pair };
  }

  sign(claims: AccessClaims) {
    return new SignJWT({ sid: claims.sid, ...(claims.staff.length ? { staff: claims.staff } : {}), ...(claims.pwc ? { pwc: true } : {}) })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("blubuy-api")
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(secret());
  }

  async verify(token: string): Promise<AccessClaims> {
    let claims: AccessClaims;
    try {
      const { payload } = await jwtVerify(token, secret(), { issuer: "blubuy-api" });
      claims = { sub: String(payload.sub), sid: String(payload.sid), staff: (payload.staff as string[]) ?? [], pwc: payload.pwc === true };
    } catch {
      throw new ApiError(401, "TOKEN_INVALID", "Your session has expired. Please sign in again.");
    }
    // access tokens are stateless; for a while after an "every device" sign out, their session is checked too
    if ((await this.redis.exists(revokedAll(claims.sub))) && !(await this.isSessionActive(claims.sid))) {
      throw new ApiError(401, "TOKEN_INVALID", "Your session has ended. Please sign in again.");
    }
    return claims;
  }

  /**
   * Rotates a refresh token. Presenting an already rotated or revoked token is
   * treated as theft: every session of that user is revoked. The exception is a
   * repeat within REFRESH_GRACE_SECONDS of its rotation (parallel requests
   * holding the same cookie, a late request from a slow tab): it gets the pair
   * its rotation led to, as long as that session is live and the account may
   * still sign in, and is otherwise refused without signing anyone out.
   *
   * The session row is locked for the whole rotation, so parallel callers queue
   * up behind the first and then find its answer in the grace cache.
   */
  async rotate(refreshToken: string, grantsFor: GrantsFor, meta: Meta) {
    const hash = sha256(refreshToken);
    const outcome = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(sessions).where(eq(sessions.refreshHash, hash)).for("update");
      const now = this.clock.now();
      if (!row) throw new ApiError(401, "REFRESH_INVALID", "Please sign in again.");
      if (row.revokedAt) {
        // signed out or revoked rather than rotated, or rotated too long ago: reuse
        if (!row.replacedBy || now.getTime() - row.revokedAt.getTime() > REFRESH_GRACE_SECONDS * 1000) return { reused: true as const, userId: row.userId };
        const repeat = await this.graceAnswer(tx, row.userId, hash, row.replacedBy, row.revokedAt, now, grantsFor);
        // a just rotated token whose line ended (signed out, revoked) or whose answer is gone: refused, not theft
        if (!repeat) throw new ApiError(401, "REFRESH_INVALID", "Please sign in again.");
        return { pair: repeat };
      }
      if (row.expiresAt < now) throw new ApiError(401, "REFRESH_EXPIRED", "Please sign in again.");
      const grants = await grantsFor(row.userId, tx);
      const next = await this.create(tx, row.userId, grants, meta);
      await tx.update(sessions).set({ revokedAt: now, replacedBy: next.sessionId, lastUsedAt: now }).where(eq(sessions.id, row.id));
      // written before the row lock is released, so a caller queued behind this one always finds it
      const entry: GraceEntry = { sessionId: next.sessionId, accessToken: next.pair.accessToken, refreshToken: next.pair.refreshToken, grants };
      await this.redis.set(graceKey(hash), sealGrace(entry, hash), "EX", REFRESH_GRACE_SECONDS);
      return { pair: { ...next.pair, userId: row.userId } };
    });
    if (!outcome.pair) {
      // the same path as "sign out everywhere", so access tokens already handed out stop working too
      await this.revokeAll(outcome.userId);
      throw new ApiError(401, "REFRESH_REUSED", "This session was ended for your security. Please sign in again.");
    }
    return outcome.pair;
  }

  /**
   * The pair a just rotated token led to: its successor's, or, when that was
   * rotated again within the window too, the live session at the end of the
   * line (at most REFRESH_GRACE_HOPS rotations on), each hop read from its own
   * sealed grace entry. Null when the line ends in a signed out or revoked
   * session, leaves the window, or an entry is missing.
   */
  private async graceAnswer(tx: Tx, userId: string, presentedHash: string, firstNext: string, rotatedAt: Date, now: Date, grantsFor: GrantsFor) {
    const windowEnd = rotatedAt.getTime() + REFRESH_GRACE_SECONDS * 1000;
    let hash = presentedHash;
    let expected = firstNext;
    for (let hop = 0; hop < REFRESH_GRACE_HOPS; hop++) {
      const sealed = await this.redis.get(graceKey(hash));
      const entry = sealed ? openGrace(sealed, hash) : null;
      if (!entry || entry.sessionId !== expected) return null;
      // locked like any rotation, so the head cannot be rotated while it is handed out
      const [next] = await tx.select().from(sessions).where(eq(sessions.id, entry.sessionId)).for("update");
      if (!next || next.userId !== userId || next.expiresAt < now) return null;
      if (!next.revokedAt) {
        // blocked since (throws) or given other roles since (a fresh access token says so)
        const grants = await grantsFor(userId, tx);
        const accessToken = sameGrants(grants, entry.grants) ? entry.accessToken : await this.sign({ sub: userId, sid: next.id, ...grants });
        return { accessToken, refreshToken: entry.refreshToken, expiresIn: ACCESS_TTL_SECONDS, userId };
      }
      // rotated again within the window: follow it; signed out or revoked: the line ends here
      if (!next.replacedBy || next.revokedAt.getTime() > windowEnd) return null;
      hash = next.refreshHash;
      expected = next.replacedBy;
    }
    return null;
  }

  async revoke(refreshToken: string) {
    await this.db.update(sessions).set({ revokedAt: this.clock.now() }).where(and(eq(sessions.refreshHash, sha256(refreshToken)), isNull(sessions.revokedAt)));
  }

  /** Ends every session of a user, access tokens already handed out included, for example after a password change. */
  async revokeAll(userId: string) {
    await this.db.update(sessions).set({ revokedAt: this.clock.now() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    // lapses once every access token issued before now has expired
    await this.redis.set(revokedAll(userId), "1", "EX", ACCESS_TTL_SECONDS);
  }

  /** Ends every session of a user except one (the device asking), access tokens included. */
  async revokeOthers(userId: string, keepSessionId: string) {
    await this.db.update(sessions).set({ revokedAt: this.clock.now() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.id, keepSessionId)));
    await this.redis.set(revokedAll(userId), "1", "EX", ACCESS_TTL_SECONDS);
  }

  async isSessionActive(sessionId: string) {
    const [row] = await this.db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, sessionId));
    return !!row && !row.revokedAt;
  }
}
