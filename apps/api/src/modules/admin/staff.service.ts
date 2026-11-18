import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, conflict, forbidden, notFound } from "../../common/errors.js";
import { DB, EMAIL_PROVIDER } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { sessions, users, type StaffRole } from "../../db/schema.js";
import type { EmailProvider } from "../auth/email.provider.js";
import { passwordChangedEmail, staffInviteEmail } from "../auth/emails.js";
import { INVITE_TTL_HOURS, InvitesService } from "../auth/invites.service.js";
import { hashPassword } from "../auth/password.js";
import { TokensService } from "../auth/tokens.service.js";
import type { staffCreateBody } from "./staff.schemas.js";

type Row = typeof users.$inferSelect;
const isStaff = sql`cardinality(${users.staffRoles}) > 0`;
const sameEmail = (email: string) => sql`lower(${users.email}) = ${email}`;
const isUniqueViolation = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505";
/** A Super Admin who can actually sign in: not disabled, and has a password (an unanswered invite does not count). */
const activeSuper = (r: Pick<Row, "staffRoles" | "status" | "passwordHash">) => r.staffRoles.includes("SUPER_ADMIN") && r.status === "ACTIVE" && !!r.passwordHash;

const selfError = () => conflict("STAFF_SELF", "You cannot disable, remove or demote your own account. Ask another Super Admin.");
const lastError = () => conflict("LAST_SUPER_ADMIN", "This is the last active Super Admin. Make someone else a Super Admin first.");

/**
 * AltasGoods Control staff: who has which role, and whether they can sign in.
 * Every change that could take away a Super Admin runs under one lock, so two
 * admins demoting each other at the same moment cannot leave the store with none.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger("Staff");

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(InvitesService) private readonly invites: InvitesService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async list() {
    const rows = await this.db.select().from(users).where(isStaff).orderBy(asc(users.createdAt), asc(users.email));
    return this.present(rows);
  }

  async member(id: string) {
    const [row] = await this.db.select().from(users).where(and(eq(users.id, id), isStaff));
    if (!row) throw notFound("Staff member");
    return (await this.present([row]))[0]!;
  }

  /**
   * Adds a staff member. An existing shopper account with the email gets the
   * roles and keeps its password, unless a temporary one is set. Sends no
   * email itself: the caller records the grant in the audit log first, then
   * calls invite(), so a failed email never leaves a grant unrecorded.
   */
  async create(actorId: string, input: z.infer<typeof staffCreateBody>) {
    const email = input.email.trim().toLowerCase();
    const temp = input.mode === "password" ? await hashPassword(input.tempPassword) : undefined;
    const taken = () => conflict("STAFF_EXISTS", "This email already belongs to a staff member. Edit their roles instead.");
    const { id, existing } = await this.locked(actorId, async (tx) => {
      const [existing] = await tx.select().from(users).where(sameEmail(email));
      if (existing?.staffRoles.length) throw taken();
      if (existing?.status === "BLOCKED") throw conflict("ACCOUNT_BLOCKED", "This email belongs to a blocked shopper account. Unblock it in Customers first.");
      if (existing) {
        const updated = await tx
          .update(users)
          .set({ staffRoles: input.roles, ...(temp ? { passwordHash: temp, mustChangePassword: true } : {}) })
          .where(and(eq(users.id, existing.id), sql`cardinality(${users.staffRoles}) = 0`))
          .returning({ id: users.id });
        // promoted a moment ago by someone else (the admin:create script does not take this lock)
        if (!updated.length) throw taken();
        return { id: existing.id, existing };
      }
      const [row] = await tx
        .insert(users)
        .values({ email, name: input.name, staffRoles: input.roles, passwordHash: temp ?? null, mustChangePassword: !!temp })
        .returning({ id: users.id })
        .catch((e: unknown) => {
          throw isUniqueViolation(e) ? conflict("STAFF_EXISTS", "An account with this email was just created. Refresh and try again.") : e;
        });
      return { id: row!.id, existing: undefined };
    });
    if (existing && temp) {
      // their old password no longer works, so neither do their sessions
      await this.tokens.revokeAll(id);
      await this.email.send(passwordChangedEmail(existing.email)).catch((e: Error) => this.logger.warn(`Password changed notice not sent: ${e.message}`));
    }
    return this.member(id);
  }

  /** Emails a new invite link, cancelling the earlier one. */
  async resendInvite(id: string) {
    const member = await this.member(id);
    if (member.status === "BLOCKED") throw conflict("STAFF_DISABLED", "Enable this staff member before sending them an invite.");
    const inviteLink = await this.invite(id);
    return { member: await this.member(id), inviteLink };
  }

  async setRoles(actorId: string, id: string, roles: StaffRole[]) {
    const { before, after } = await this.locked(actorId, async (tx) => {
      const target = await this.target(tx, id);
      const demoting = target.staffRoles.includes("SUPER_ADMIN") && !roles.includes("SUPER_ADMIN");
      if (demoting && target.id === actorId) throw selfError();
      if (demoting) await this.guardLastSuper(tx, target);
      await tx.update(users).set({ staffRoles: roles }).where(eq(users.id, id));
      return { before: target, after: { ...target, staffRoles: roles } };
    });
    // roles live in the access token: a role taken away must stop working now, not at the next refresh.
    // Not for your own account: you stay a Super Admin (see above), which passes every check anyway.
    if (id !== actorId && before.staffRoles.some((r) => !roles.includes(r))) await this.tokens.revokeAll(id);
    return { before: before.staffRoles, after: await this.member(after.id) };
  }

  /** BLOCKED is disabled: they cannot sign in, and every session ends at once. */
  async setStatus(actorId: string, id: string, status: "ACTIVE" | "BLOCKED") {
    const before = await this.locked(actorId, async (tx) => {
      const target = await this.target(tx, id);
      if (status === "BLOCKED") {
        if (target.id === actorId) throw selfError();
        await this.guardLastSuper(tx, target);
      }
      await tx.update(users).set({ status }).where(eq(users.id, id));
      return target;
    });
    if (status === "BLOCKED") await this.tokens.revokeAll(id);
    return { before: before.status, after: await this.member(id) };
  }

  /** Takes away every staff role and ends their sessions. The account stays, so the audit log still names them. */
  async remove(actorId: string, id: string) {
    const before = await this.locked(actorId, async (tx) => {
      const target = await this.target(tx, id);
      if (target.id === actorId) throw selfError();
      await this.guardLastSuper(tx, target);
      await tx.update(users).set({ staffRoles: [] }).where(eq(users.id, id));
      return target;
    });
    await this.tokens.revokeAll(id);
    await this.invites.revoke(id);
    return before;
  }

  /**
   * Runs a staff change under one lock, held until commit, after checking the
   * one asking is still an active Super Admin: their token may predate another
   * admin taking that role away a moment ago.
   */
  private locked<T>(actorId: string, fn: (tx: Tx) => Promise<T>) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('altasgoods:staff-roles'))`);
      const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
      if (!actor || !activeSuper(actor)) throw forbidden("Only an active Super Admin can change staff.");
      return fn(tx);
    });
  }

  private async target(tx: Tx, id: string) {
    const [row] = await tx.select().from(users).where(and(eq(users.id, id), isStaff));
    if (!row) throw notFound("Staff member");
    return row;
  }

  /**
   * Runs under the lock. Refuses to take away the last active Super Admin.
   * The actor check in locked() already keeps one active Super Admin (the one
   * asking) besides the target, so this is defence in depth.
   */
  private async guardLastSuper(tx: Tx, target: Row) {
    if (activeSuper(target)) {
      const others = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(ne(users.id, target.id), sql`'SUPER_ADMIN' = any(${users.staffRoles})`, eq(users.status, "ACTIVE"), sql`${users.passwordHash} is not null`))
        .limit(1);
      if (!others.length) throw lastError();
    }
  }

  /**
   * Emails a fresh invite link (the earlier one stops working). Returns the
   * link only when no email really goes out (see InvitesService.showLink).
   */
  async invite(id: string) {
    const [row] = await this.db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, id));
    const { link } = await this.invites.issue(id);
    try {
      await this.email.send(staffInviteEmail(row!.email, row!.name, link, INVITE_TTL_HOURS));
    } catch (e) {
      this.logger.error(`Invite not sent to ${row!.email}: ${(e as Error).message}`);
      throw new ApiError(502, "INVITE_NOT_SENT", "The invite email could not be sent. The staff member is saved; try Resend invite in a moment.");
    }
    return InvitesService.showLink() ? link : undefined;
  }

  private async present(rows: Row[]) {
    const ids = rows.map((r) => r.id);
    const [pending, activity] = await Promise.all([
      this.invites.pending(ids),
      // every sign in and every refresh starts a session row
      ids.length ? this.db.select({ userId: sessions.userId, at: max(sessions.createdAt) }).from(sessions).where(inArray(sessions.userId, ids)).groupBy(sessions.userId) : [],
    ]);
    const lastActive = new Map(activity.map((a) => [a.userId, a.at]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      roles: r.staffRoles,
      status: r.status,
      mustChangePassword: r.mustChangePassword,
      invitePending: pending.has(r.id),
      lastActiveAt: lastActive.get(r.id)?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
