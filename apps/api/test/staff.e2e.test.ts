import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { DB, EMAIL_PROVIDER, REDIS } from "../src/common/tokens.js";
import { createDb, type Db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import type { EmailMessage, EmailProvider } from "../src/modules/auth/email.provider.js";
import { StaffService } from "../src/modules/admin/staff.service.js";
import { InvitesService } from "../src/modules/auth/invites.service.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, signUp, type TestContext } from "./helpers.js";

/** Keeps every email the app sends, so tests can follow the links in them. */
class OutboxEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  /** Addresses whose emails fail, as an SMTP outage would */
  failFor = new Set<string>();
  async send(message: EmailMessage) {
    if (this.failFor.has(message.to)) throw new Error("421 Service not available");
    this.sent.push(message);
  }
  inviteTokenFor(to: string) {
    const last = this.sent.filter((m) => m.to === to).at(-1);
    return last?.text.match(/\/set-password\?token=([A-Za-z0-9_-]+)/)?.[1];
  }
}

const outbox = new OutboxEmailProvider();
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const S = "/v1/admin/staff";
let t: TestContext;
let admin: Record<string, string>;
let adminId: string;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Adds a staff member with a temporary password, changes it as they would, and signs them in. */
async function staffWith(email: string, roles: string[], name = "Test Staff") {
  const created = await t.http.post(S).set(admin).send({ name, email, roles, mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
  const { auth } = await signIn(t.http, email, "temporary-pass-1");
  await t.http.post("/v1/me/password").set(auth).send({ currentPassword: "temporary-pass-1", newPassword: "chosen-password-1" }).expect(204);
  const fresh = await signIn(t.http, email, "chosen-password-1");
  return { id: created.body.member.id as string, auth: fresh.auth, session: fresh.session };
}

beforeAll(async () => {
  t = await createTestApp([{ provide: EMAIL_PROVIDER, useValue: outbox }]);
  const s = await signIn(t.http, DEMO_STAFF);
  admin = s.auth;
  adminId = s.session.user.id;
});
afterAll(async () => {
  await pool.end();
  await t.close();
});
beforeEach(() => {
  outbox.sent = [];
  outbox.failFor.clear();
});

describe("staff list", () => {
  it("lists everyone with a staff role, for Super Admins only", async () => {
    const r = await t.http.get(S).set(admin).expect(200);
    const kavya = r.body.find((m: { email: string }) => m.email === DEMO_STAFF);
    expect(kavya).toMatchObject({ id: adminId, name: "Kavya Iyer", roles: ["SUPER_ADMIN"], status: "ACTIVE", mustChangePassword: false, invitePending: false });
    expect(kavya.createdAt).toBeTruthy();
    // shoppers are not staff
    expect(r.body.some((m: { email: string }) => m.email === DEMO_CUSTOMER)).toBe(false);

    const ops = await staffWith("ops.lister@altasgoods.in", ["OPS_ADMIN"]);
    await t.http.get(S).set(ops.auth).expect(403);
    await t.http.post(S).set(ops.auth).send({ name: "Sneaky", email: "sneaky@altasgoods.in", roles: ["SUPER_ADMIN"], mode: "invite" }).expect(403);
  });
});

describe("adding staff", () => {
  it("sets a temporary password that must be changed before any staff work", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Meera Pillai", email: "Meera.Pillai@altasgoods.in", roles: ["OPS_ADMIN"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
    expect(created.body.member).toMatchObject({ email: "meera.pillai@altasgoods.in", name: "Meera Pillai", roles: ["OPS_ADMIN"], status: "ACTIVE", mustChangePassword: true });
    expect(created.body).not.toHaveProperty("inviteLink");

    const login = await signIn(t.http, "meera.pillai@altasgoods.in", "temporary-pass-1");
    expect(login.session.user).toMatchObject({ staffRoles: ["OPS_ADMIN"], mustChangePassword: true });
    const blocked = await t.http.get("/v1/admin/order-items").set(login.auth).expect(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    // their profile and the password change still work
    const me = await t.http.get("/v1/me").set(login.auth).expect(200);
    expect(me.body.mustChangePassword).toBe(true);
    await t.http.post("/v1/me/password").set(login.auth).send({ currentPassword: "temporary-pass-1", newPassword: "meera-chosen-1" }).expect(204);
    expect((await t.http.get("/v1/me").set(login.auth).expect(200)).body.mustChangePassword).toBe(false);

    // the next token carries no "change required" flag
    const next = await t.http.post("/v1/auth/refresh").send({ refreshToken: login.session.refreshToken }).expect(200);
    await t.http.get("/v1/admin/order-items").set(bearer(next.body.accessToken)).expect(200);

    const audit = await t.http.get("/v1/admin/audit").set(admin).query({ entityType: "staff", entityId: created.body.member.id }).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toContain("staff.create");
  });

  it("invites by email with a one-time link that signs them in", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Rohan Das", email: "rohan.das@altasgoods.in", roles: ["CATALOG_MANAGER"], mode: "invite" }).expect(201);
    expect(created.body.member).toMatchObject({ roles: ["CATALOG_MANAGER"], mustChangePassword: false, invitePending: true });
    const token = outbox.inviteTokenFor("rohan.das@altasgoods.in")!;
    expect(token).toBeTruthy();
    const email = outbox.sent.find((m) => m.to === "rohan.das@altasgoods.in")!;
    expect(email.html).toContain(`/set-password?token=${token}`);
    expect(email.html).not.toContain("ask for this code");
    // the console email provider means nobody gets the email, so the admin gets the link to pass on
    expect(created.body.inviteLink).toBe(`${env().WEB_ORIGIN}/set-password?token=${token}`);

    // no password until the invite is accepted
    await t.http.post("/v1/auth/login").send({ email: "rohan.das@altasgoods.in", password: "anything-at-all" }).expect(401);
    await t.http.post("/v1/auth/invite/accept").send({ token, password: "short" }).expect(422);
    const accepted = await t.http.post("/v1/auth/invite/accept").send({ token, password: "rohan-chosen-1" }).expect(200);
    expect(accepted.body.user).toMatchObject({ email: "rohan.das@altasgoods.in", staffRoles: ["CATALOG_MANAGER"], mustChangePassword: false, emailVerified: true });
    await t.http.get("/v1/admin/products").set(bearer(accepted.body.accessToken)).expect(200);
    await signIn(t.http, "rohan.das@altasgoods.in", "rohan-chosen-1");

    // the link works once
    const again = await t.http.post("/v1/auth/invite/accept").send({ token, password: "rohan-chosen-2" }).expect(400);
    expect(again.body.code).toBe("INVITE_INVALID");
    const list = await t.http.get(S).set(admin).expect(200);
    expect(list.body.find((m: { email: string }) => m.email === "rohan.das@altasgoods.in").invitePending).toBe(false);
  });

  it("resending an invite replaces the earlier link", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Isha Rao", email: "isha.rao@altasgoods.in", roles: ["AUDITOR"], mode: "invite" }).expect(201);
    const first = outbox.inviteTokenFor("isha.rao@altasgoods.in")!;
    const resent = await t.http.post(`${S}/${created.body.member.id}/invite`).set(admin).expect(200);
    const second = outbox.inviteTokenFor("isha.rao@altasgoods.in")!;
    expect(second).not.toBe(first);
    expect(resent.body.inviteLink).toContain(second);
    await t.http.post("/v1/auth/invite/accept").send({ token: first, password: "isha-chosen-1" }).expect(400);
    await t.http.post("/v1/auth/invite/accept").send({ token: second, password: "isha-chosen-1" }).expect(200);
  });

  it("gives an existing shopper a role and keeps their password", async () => {
    const shopper = await signUp(t.http, "turned.staff@example.com", "Turned Staff", "shopper-password-1");
    const created = await t.http.post(S).set(admin).send({ name: "Someone Else", email: "Turned.Staff@example.com", roles: ["SUPPORT_AGENT"], mode: "invite" }).expect(201);
    expect(created.body.member).toMatchObject({ id: shopper.session.user.id, name: "Turned Staff", roles: ["SUPPORT_AGENT"] });
    const login = await signIn(t.http, "turned.staff@example.com", "shopper-password-1");
    expect(login.session.user.staffRoles).toEqual(["SUPPORT_AGENT"]);
  });

  it("replaces an existing shopper's password only when asked to, and signs them out", async () => {
    const shopper = await signUp(t.http, "reset.staff@example.com", "Reset Staff", "shopper-password-1");
    await t.http.post(S).set(admin).send({ name: "Reset Staff", email: "reset.staff@example.com", roles: ["OPS_ADMIN"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
    await t.http.post("/v1/auth/login").send({ email: "reset.staff@example.com", password: "shopper-password-1" }).expect(401);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: shopper.session.refreshToken }).expect(401);
    await signIn(t.http, "reset.staff@example.com", "temporary-pass-1");
  });

  it("records the role grant in the audit log even when the invite email fails", async () => {
    const shopper = await signUp(t.http, "invite.fails@example.com", "Invite Fails", "shopper-password-1");
    outbox.failFor.add("invite.fails@example.com");
    const r = await t.http.post(S).set(admin).send({ name: "Invite Fails", email: "invite.fails@example.com", roles: ["OPS_ADMIN"], mode: "invite" }).expect(502);
    expect(r.body.code).toBe("INVITE_NOT_SENT");
    // the roles were granted, and the log says so
    const audit = await t.http.get("/v1/admin/audit").set(admin).query({ entityType: "staff", entityId: shopper.session.user.id }).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toContain("staff.create");
    // and the admin can send it again once email works
    outbox.failFor.clear();
    await t.http.post(`${S}/${shopper.session.user.id}/invite`).set(admin).expect(200);
    expect(outbox.inviteTokenFor("invite.fails@example.com")).toBeTruthy();
  });

  it("promotes a shopper once when two admins add them at the same moment", async () => {
    const shopper = await signUp(t.http, "double.add@example.com", "Double Add");
    const svc = t.app.get(StaffService);
    const input = { name: "Double Add", email: "double.add@example.com", roles: ["OPS_ADMIN" as const], mode: "invite" as const };
    // open a few pooled connections first, so the two really overlap
    const appDb = t.app.get<symbol, Db>(DB);
    await Promise.all([1, 2, 3, 4].map(() => appDb.execute(sql`select pg_sleep(0.05)`)));
    const results = await Promise.allSettled([svc.create(adminId, input), svc.create(adminId, input)]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((results.find((x) => x.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "STAFF_EXISTS" });
    const [row] = await db.select({ roles: users.staffRoles }).from(users).where(eq(users.id, shopper.session.user.id));
    expect(row!.roles).toEqual(["OPS_ADMIN"]);
  });

  it("refuses an email that is already staff, an empty role list and a missing temporary password", async () => {
    const dup = await t.http.post(S).set(admin).send({ name: "Copy", email: DEMO_STAFF.toUpperCase(), roles: ["OPS_ADMIN"], mode: "invite" }).expect(409);
    expect(dup.body.code).toBe("STAFF_EXISTS");
    await t.http.post(S).set(admin).send({ name: "No Roles", email: "noroles@altasgoods.in", roles: [], mode: "invite" }).expect(422);
    await t.http.post(S).set(admin).send({ name: "Bad Role", email: "badrole@altasgoods.in", roles: ["OWNER"], mode: "invite" }).expect(422);
    await t.http.post(S).set(admin).send({ name: "No Pass", email: "nopass@altasgoods.in", roles: ["OPS_ADMIN"], mode: "password" }).expect(422);
  });
});

describe("changing staff", () => {
  it("edits roles, and a removed role stops working at once", async () => {
    const m = await staffWith("roles.change@altasgoods.in", ["OPS_ADMIN", "CATALOG_MANAGER"]);
    await t.http.get("/v1/admin/order-items").set(m.auth).expect(200);
    await t.http.patch(`${S}/${m.id}`).set(admin).send({ roles: [] }).expect(422);
    const r = await t.http.patch(`${S}/${m.id}`).set(admin).send({ roles: ["CATALOG_MANAGER"] }).expect(200);
    expect(r.body.roles).toEqual(["CATALOG_MANAGER"]);
    // the old access token named Ops Admin; it no longer works
    await t.http.get("/v1/admin/order-items").set(m.auth).expect(401);
    const again = await signIn(t.http, "roles.change@altasgoods.in", "chosen-password-1");
    await t.http.get("/v1/admin/order-items").set(again.auth).expect(403);
    await t.http.get("/v1/admin/products").set(again.auth).expect(200);

    const audit = await t.http.get("/v1/admin/audit").set(admin).query({ entityType: "staff", entityId: m.id }).expect(200);
    const entry = audit.body.items.find((e: { action: string }) => e.action === "staff.roles");
    expect(entry.changes.roles).toEqual([["OPS_ADMIN", "CATALOG_MANAGER"], ["CATALOG_MANAGER"]]);
  });

  it("disables and enables a staff member", async () => {
    const m = await staffWith("disabled.staff@altasgoods.in", ["OPS_ADMIN"]);
    const r = await t.http.post(`${S}/${m.id}/disable`).set(admin).expect(200);
    expect(r.body.status).toBe("BLOCKED");
    await t.http.get("/v1/admin/order-items").set(m.auth).expect(401);
    await t.http.post("/v1/auth/refresh").send({ refreshToken: m.session.refreshToken }).expect(401);
    const login = await t.http.post("/v1/auth/login").send({ email: "disabled.staff@altasgoods.in", password: "chosen-password-1" }).expect(403);
    expect(login.body.code).toBe("ACCOUNT_BLOCKED");

    const back = await t.http.post(`${S}/${m.id}/enable`).set(admin).expect(200);
    expect(back.body.status).toBe("ACTIVE");
    await signIn(t.http, "disabled.staff@altasgoods.in", "chosen-password-1");
    const audit = await t.http.get("/v1/admin/audit").set(admin).query({ entityType: "staff", entityId: m.id }).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["staff.disable", "staff.enable"]));
  });

  it("refuses a refresh for a blocked account even if its sessions were left open", async () => {
    const m = await staffWith("blocked.refresh@altasgoods.in", ["OPS_ADMIN"]);
    // blocked straight in the database, so no session was revoked
    await db.update(users).set({ status: "BLOCKED" }).where(eq(users.id, m.id));
    const r = await t.http.post("/v1/auth/refresh").send({ refreshToken: m.session.refreshToken }).expect(401);
    expect(r.body.code).toBe("REFRESH_INVALID");
    await db.update(users).set({ status: "ACTIVE" }).where(eq(users.id, m.id));
  });

  it("removes a staff member but keeps the account", async () => {
    const m = await staffWith("removed.staff@altasgoods.in", ["OPS_ADMIN"]);
    await t.http.delete(`${S}/${m.id}`).set(admin).expect(204);
    await t.http.get("/v1/admin/order-items").set(m.auth).expect(401);
    const list = await t.http.get(S).set(admin).expect(200);
    expect(list.body.some((x: { id: string }) => x.id === m.id)).toBe(false);
    // the account stays for the audit trail, as a shopper
    const login = await signIn(t.http, "removed.staff@altasgoods.in", "chosen-password-1");
    expect(login.session.user.staffRoles).toEqual([]);
    await t.http.delete(`${S}/${m.id}`).set(admin).expect(404);
    const audit = await t.http.get("/v1/admin/audit").set(admin).query({ entityType: "staff", entityId: m.id }).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toContain("staff.remove");
  });

  it("drops a pending invite when the staff member is removed", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Gone Soon", email: "gone.soon@altasgoods.in", roles: ["OPS_ADMIN"], mode: "invite" }).expect(201);
    const token = outbox.inviteTokenFor("gone.soon@altasgoods.in")!;
    await t.http.delete(`${S}/${created.body.member.id}`).set(admin).expect(204);
    await t.http.post("/v1/auth/invite/accept").send({ token, password: "gone-chosen-1" }).expect(400);
  });

  it("will not let you disable, remove or demote yourself", async () => {
    for (const r of [
      await t.http.post(`${S}/${adminId}/disable`).set(admin).expect(409),
      await t.http.delete(`${S}/${adminId}`).set(admin).expect(409),
      await t.http.patch(`${S}/${adminId}`).set(admin).send({ roles: ["OPS_ADMIN"] }).expect(409),
    ]) {
      expect(r.body.code).toBe("STAFF_SELF");
    }
    // adding a role to yourself is fine
    await t.http.patch(`${S}/${adminId}`).set(admin).send({ roles: ["SUPER_ADMIN", "OPS_ADMIN"] }).expect(200);
    await t.http.patch(`${S}/${adminId}`).set(admin).send({ roles: ["SUPER_ADMIN"] }).expect(200);
  });
});

describe("Auditor", () => {
  it("reads every admin area and changes nothing", async () => {
    const a = await staffWith("auditor@altasgoods.in", ["AUDITOR"]);
    const reads = [
      "/v1/admin/products",
      "/v1/admin/categories",
      "/v1/admin/brands",
      "/v1/admin/banners",
      "/v1/admin/reviews",
      "/v1/admin/settings",
      "/v1/admin/audit",
      "/v1/admin/order-items",
      "/v1/admin/overview",
      "/v1/admin/payments",
      "/v1/admin/refunds",
      "/v1/admin/returns",
      "/v1/admin/customers",
      "/v1/admin/sales",
      "/v1/admin/coupons",
      "/v1/admin/logistics/status",
    ];
    for (const path of reads) {
      const r = await t.http.get(path).set(a.auth);
      expect([path, r.status]).toEqual([path, 200]);
    }
    const customers = await t.http.get("/v1/admin/customers").set(a.auth).expect(200);
    await t.http.get(`/v1/admin/customers/${customers.body.items[0].id}`).set(a.auth).expect(200);

    const settings = await t.http.get("/v1/admin/settings").set(a.auth).expect(200);
    const id = customers.body.items[0].id;
    const writes: [string, () => PromiseLike<{ status: number }>][] = [
      ["PUT settings", () => t.http.put("/v1/admin/settings").set(a.auth).send(settings.body)],
      ["POST categories", () => t.http.post("/v1/admin/categories").set(a.auth).send({ name: "Auditor Category" })],
      ["POST brands", () => t.http.post("/v1/admin/brands").set(a.auth).send({ name: "Auditor Brand" })],
      ["POST banners", () => t.http.post("/v1/admin/banners").set(a.auth).send({})],
      ["PATCH customer", () => t.http.patch(`/v1/admin/customers/${id}`).set(a.auth).send({ status: "BLOCKED" })],
      ["POST sales", () => t.http.post("/v1/admin/sales").set(a.auth).send({})],
      ["POST transition", () => t.http.post("/v1/admin/order-items/transition").set(a.auth).send({})],
      ["POST return decision", () => t.http.post(`/v1/admin/returns/RT-1/decision`).set(a.auth).send({})],
    ];
    for (const [label, call] of writes) expect([label, (await call()).status]).toEqual([label, 403]);
    // and staff management is for Super Admins
    await t.http.get(S).set(a.auth).expect(403);
  });
});

describe("invite links", () => {
  it("accepts only the latest link, even when links are left behind by a race", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Race Invite", email: "race.invite@altasgoods.in", roles: ["AUDITOR"], mode: "password", tempPassword: "temporary-pass-1" }).expect(201);
    const id = created.body.member.id as string;
    const invites = t.app.get(InvitesService);
    const redis = t.app.get<symbol, import("ioredis").Redis>(REDIS);

    // two resends at once: exactly one of the two links works
    const [a, b] = await Promise.all([invites.issue(id), invites.issue(id)]);
    const used = await Promise.all([invites.consume(a.token), invites.consume(b.token)]);
    expect(used.filter((u) => u === id)).toHaveLength(1);

    // a link whose token key survived a race, but that is no longer the latest, is refused
    const old = await invites.issue(id);
    const latest = await invites.issue(id);
    const hash = (await redis.get(`staff-invite-user:${id}`))!;
    const { createHash } = await import("node:crypto");
    await redis.set(`staff-invite:${createHash("sha256").update(old.token).digest("hex")}`, id, "EX", 60);
    expect(hash).toBe(createHash("sha256").update(latest.token).digest("hex"));
    expect(await invites.consume(old.token)).toBeNull();
    expect(await invites.consume(latest.token)).toBe(id);

    // and after a cancel, a leftover token key revives nothing
    const left = await invites.issue(id);
    await invites.revoke(id);
    await redis.set(`staff-invite:${createHash("sha256").update(left.token).digest("hex")}`, id, "EX", 60);
    expect(await invites.consume(left.token)).toBeNull();
  });

  it("lets two tabs use the same link only once", async () => {
    const created = await t.http.post(S).set(admin).send({ name: "Two Tabs", email: "two.tabs@altasgoods.in", roles: ["AUDITOR"], mode: "invite" }).expect(201);
    const token = outbox.inviteTokenFor("two.tabs@altasgoods.in")!;
    const [x, y] = await Promise.all([
      t.http.post("/v1/auth/invite/accept").send({ token, password: "two-tabs-pass-1" }),
      t.http.post("/v1/auth/invite/accept").send({ token, password: "two-tabs-pass-2" }),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 400]);
    expect(created.body.member.id).toBeTruthy();
  });
});

describe("the last Super Admin", () => {
  let other: Awaited<ReturnType<typeof staffWith>>;
  let bystander: Awaited<ReturnType<typeof staffWith>>;

  it("cannot be demoted, even by two Super Admins demoting each other at once", async () => {
    other = await staffWith("second.super@altasgoods.in", ["SUPER_ADMIN"]);
    bystander = await staffWith("bystander@altasgoods.in", ["CATALOG_MANAGER"]);
    // straight to the service, so both changes really overlap (over HTTP the first one's sign out can win the race)
    const svc = t.app.get(StaffService);
    // open a few pooled connections first, so neither change waits on a connect while the other finishes
    const appDb = t.app.get<symbol, Db>(DB);
    await Promise.all([1, 2, 3, 4].map(() => appDb.execute(sql`select pg_sleep(0.05)`)));
    const results = await Promise.allSettled([svc.setRoles(adminId, other.id, ["OPS_ADMIN"]), svc.setRoles(other.id, adminId, ["OPS_ADMIN"])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    // whoever goes second is no longer a Super Admin by the time the lock is theirs
    expect(lost.reason).toMatchObject({ code: "FORBIDDEN" });
    const rows = await db.select({ roles: users.staffRoles, status: users.status }).from(users);
    expect(rows.filter((u) => u.roles.includes("SUPER_ADMIN") && u.status === "ACTIVE")).toHaveLength(1);
  });

  it("lets nobody whose Super Admin role was just taken change any staff", async () => {
    const rows = await db.select({ id: users.id, roles: users.staffRoles }).from(users);
    const last = rows.find((u) => u.roles.includes("SUPER_ADMIN"))!;
    const demoted = last.id === adminId ? other.id : adminId;
    const svc = t.app.get(StaffService);
    for (const attempt of [
      () => svc.setRoles(demoted, last.id, ["OPS_ADMIN"]),
      () => svc.setStatus(demoted, last.id, "BLOCKED"),
      () => svc.remove(demoted, last.id),
      // not only changes that could drop a Super Admin
      () => svc.setRoles(demoted, bystander.id, ["SUPER_ADMIN"]),
      () => svc.setStatus(demoted, bystander.id, "ACTIVE"),
      () => svc.create(demoted, { name: "Sneaky", email: "sneaky.add@altasgoods.in", roles: ["SUPER_ADMIN"], mode: "invite" }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
