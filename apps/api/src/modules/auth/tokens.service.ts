import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../../config/env.js";
import type { Db } from "../../db/client.js";
import { sessions } from "../../db/schema.js";
import { ApiError } from "../../common/errors.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Clock } from "../../common/infra.module.js";

export const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;

export interface AccessClaims {
  sub: string;
  sid: string;
  sellers: string[];
  /** BluBuy Control roles; absent for shoppers and sellers */
  staff: string[];
}

/** What a session may act as, re-read from the database on every refresh. */
export interface Grants {
  sellers: string[];
  staff: string[];
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const secret = () => new TextEncoder().encode(env().JWT_SECRET);

@Injectable()
export class TokensService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async issue(userId: string, grants: Grants, meta: { userAgent?: string; ip?: string }) {
    const refreshToken = randomBytes(32).toString("base64url");
    const [session] = await this.db
      .insert(sessions)
      .values({ userId, refreshHash: sha256(refreshToken), userAgent: meta.userAgent?.slice(0, 200), ip: meta.ip, expiresAt: new Date(this.clock.now().getTime() + REFRESH_TTL_MS) })
      .returning({ id: sessions.id });
    return { accessToken: await this.sign({ sub: userId, sid: session!.id, ...grants }), refreshToken, expiresIn: ACCESS_TTL_SECONDS };
  }

  sign(claims: AccessClaims) {
    return new SignJWT({ sid: claims.sid, sellers: claims.sellers, ...(claims.staff.length ? { staff: claims.staff } : {}) })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.sub)
      .setIssuer("blubuy-api")
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(secret());
  }

  async verify(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, secret(), { issuer: "blubuy-api" });
      return { sub: String(payload.sub), sid: String(payload.sid), sellers: (payload.sellers as string[]) ?? [], staff: (payload.staff as string[]) ?? [] };
    } catch {
      throw new ApiError(401, "TOKEN_INVALID", "Your session has expired. Please sign in again.");
    }
  }

  /**
   * Rotates a refresh token. Presenting an already rotated or revoked token is
   * treated as theft: every session of that user is revoked.
   */
  async rotate(refreshToken: string, grantsFor: (userId: string) => Promise<Grants>, meta: { userAgent?: string; ip?: string }) {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.refreshHash, sha256(refreshToken)));
    const now = this.clock.now();
    if (!row) throw new ApiError(401, "REFRESH_INVALID", "Please sign in again.");
    if (row.revokedAt) {
      await this.db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
      throw new ApiError(401, "REFRESH_REUSED", "This session was ended for your security. Please sign in again.");
    }
    if (row.expiresAt < now) throw new ApiError(401, "REFRESH_EXPIRED", "Please sign in again.");
    const next = await this.issue(row.userId, await grantsFor(row.userId), meta);
    const nextSession = await this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.refreshHash, sha256(next.refreshToken)));
    await this.db.update(sessions).set({ revokedAt: now, replacedBy: nextSession[0]?.id, lastUsedAt: now }).where(eq(sessions.id, row.id));
    return { ...next, userId: row.userId };
  }

  async revoke(refreshToken: string) {
    await this.db.update(sessions).set({ revokedAt: this.clock.now() }).where(and(eq(sessions.refreshHash, sha256(refreshToken)), isNull(sessions.revokedAt)));
  }

  async isSessionActive(sessionId: string) {
    const [row] = await this.db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, sessionId));
    return !!row && !row.revokedAt;
  }
}
