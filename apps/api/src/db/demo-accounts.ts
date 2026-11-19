/**
 * Development only: one sign-in for every role, all with the same password, so
 * a developer can try each workspace without making accounts by hand.
 *
 *   npm run db:demo-accounts
 *
 * Safe to run again: it resets these accounts' roles and password each time.
 * It refuses to run when NODE_ENV is production. Real staff are added from
 * AltasGoods Control > Staff, and the first Super Admin with `admin:create`.
 */
import { sql } from "drizzle-orm";
import { isProduction } from "../config/env.js";
import { hashPassword } from "../modules/auth/password.js";
import { createDb } from "./client.js";
import { users, type StaffRole } from "./schema.js";

export const DEMO_ACCOUNT_PASSWORD = "Demo@12345";

export const DEMO_ACCOUNTS: { email: string; name: string; roles: StaffRole[] }[] = [
  { email: "superadmin@altasgoods.test", name: "Demo Super Admin", roles: ["SUPER_ADMIN"] },
  { email: "ops@altasgoods.test", name: "Demo Ops Admin", roles: ["OPS_ADMIN"] },
  { email: "catalog@altasgoods.test", name: "Demo Catalog Manager", roles: ["CATALOG_MANAGER"] },
  { email: "auditor@altasgoods.test", name: "Demo Auditor", roles: ["AUDITOR"] },
  { email: "agent@altasgoods.test", name: "Demo Support Agent", roles: ["SUPPORT_AGENT"] },
  { email: "specialist@altasgoods.test", name: "Demo Support Specialist", roles: ["SUPPORT_SPECIALIST"] },
  { email: "supervisor@altasgoods.test", name: "Demo Support Supervisor", roles: ["SUPPORT_SUPERVISOR"] },
  { email: "shopper@altasgoods.test", name: "Demo Shopper", roles: [] },
];

if (isProduction()) {
  console.error("Refusing to create demo accounts: NODE_ENV is production.");
  process.exit(1);
}

const { db, pool } = createDb();
const passwordHash = await hashPassword(DEMO_ACCOUNT_PASSWORD);
const now = new Date();
for (const a of DEMO_ACCOUNTS) {
  const values = { name: a.name, passwordHash, staffRoles: a.roles, status: "ACTIVE" as const, mustChangePassword: false, emailVerifiedAt: now, deletedAt: null };
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${a.email}`);
  if (existing) await db.update(users).set(values).where(sql`${users.id} = ${existing.id}`);
  else await db.insert(users).values({ email: a.email, ...values });
}
await pool.end();

console.log(`Demo accounts ready (password for all: ${DEMO_ACCOUNT_PASSWORD}):`);
for (const a of DEMO_ACCOUNTS) console.log(`  ${(a.roles[0] ?? "SHOPPER").padEnd(20)} ${a.email}`);
console.log("Staff sign in at http://localhost:3000/login?as=staff, the shopper at /login.");
