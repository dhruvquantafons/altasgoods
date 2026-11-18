import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../../common/tokens.js";
import { devToolsEnabled, env } from "../../config/env.js";

export const INVITE_TTL_HOURS = 72;
const TTL_SECONDS = INVITE_TTL_HOURS * 3600;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
/** token hash -> user id; only the hash is stored, so a Redis dump holds no usable links */
const byToken = (hash: string) => `staff-invite:${hash}`;
/** user id -> token hash, so a resend or a removal can cancel the earlier link */
const byUser = (userId: string) => `staff-invite-user:${userId}`;

/**
 * One-time links that let a new staff member choose their password. Each
 * person has at most one live link: issuing a new one cancels the last.
 */
@Injectable()
export class InvitesService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** A fresh link for the user, replacing any earlier one. */
  async issue(userId: string) {
    await this.revoke(userId);
    const token = randomBytes(32).toString("base64url");
    const hash = sha256(token);
    await this.redis.multi().set(byToken(hash), userId, "EX", TTL_SECONDS).set(byUser(userId), hash, "EX", TTL_SECONDS).exec();
    return { token, link: `${env().WEB_ORIGIN}/set-password?token=${token}` };
  }

  /** Cancels the user's link, if any. */
  async revoke(userId: string) {
    const hash = await this.redis.get(byUser(userId));
    if (hash) await this.redis.del(byToken(hash));
    await this.redis.del(byUser(userId));
  }

  /** Uses up a link and returns whose it was, or null when it is unknown, expired or already used. */
  async consume(token: string) {
    const hash = sha256(token);
    const userId = await this.redis.get(byToken(hash));
    if (!userId) return null;
    // whoever deletes the key first owns the link, so two tabs cannot both use it
    if ((await this.redis.del(byToken(hash))) === 0) return null;
    await this.redis.del(byUser(userId));
    return userId;
  }

  /** Which of these users have a link waiting. */
  async pending(userIds: string[]) {
    if (!userIds.length) return new Set<string>();
    const hashes = await this.redis.mget(...userIds.map(byUser));
    return new Set(userIds.filter((_, i) => hashes[i]));
  }

  /**
   * Whether the admin may be shown the link itself. Only when no email really
   * goes out (the console provider, which production refuses) or in development.
   */
  static showLink() {
    return devToolsEnabled() || env().EMAIL_PROVIDER === "console";
  }
}
