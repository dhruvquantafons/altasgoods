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
 * Deletes KEYS[1] (the user's current-link pointer) only when it still names
 * ARGV[1] (this link's hash). Returns 1 when it did: this link was the latest.
 */
const TAKE_IF_CURRENT = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

/**
 * One-time links that let a new staff member choose their password. Only the
 * latest link of a person works: the per-user pointer names it, and consume()
 * accepts a link only while the pointer still does. So a link orphaned by two
 * resends racing (or a resend racing an accept) cannot be used, and nothing
 * revives it later, even if the same person is added again within 72 hours.
 */
@Injectable()
export class InvitesService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** A fresh link for the user. The pointer moves to it, so any earlier link stops working. */
  async issue(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const hash = sha256(token);
    const previous = await this.redis.get(byUser(userId));
    await this.redis.multi().set(byToken(hash), userId, "EX", TTL_SECONDS).set(byUser(userId), hash, "EX", TTL_SECONDS).exec();
    // tidy only: the pointer check in consume() is what makes the old link useless
    if (previous && previous !== hash) await this.redis.del(byToken(previous));
    return { token, link: `${env().WEB_ORIGIN}/set-password?token=${token}` };
  }

  /** Cancels the user's link, if any: with no pointer, no link of theirs is accepted. */
  async revoke(userId: string) {
    const hash = await this.redis.get(byUser(userId));
    await this.redis.del(byUser(userId));
    if (hash) await this.redis.del(byToken(hash));
  }

  /** Uses up a link and returns whose it was, or null when it is unknown, expired, used or no longer the latest. */
  async consume(token: string) {
    const hash = sha256(token);
    // GETDEL: of two tabs using the same link, only one gets the user id
    const userId = await this.redis.getdel(byToken(hash));
    if (!userId) return null;
    const current = (await this.redis.eval(TAKE_IF_CURRENT, 1, byUser(userId), hash)) as number;
    return current === 1 ? userId : null;
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
