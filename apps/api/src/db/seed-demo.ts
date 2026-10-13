/**
 * Demo accounts for the automated tests: shoppers with addresses, the store's
 * staff and the care team with their tickets. Runs after seed(); never part of
 * `npm run db:seed`, so real databases hold no dummy accounts.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProduction } from "../config/env.js";
import { hashPassword } from "../modules/auth/password.js";
import { normalizePhone } from "../modules/auth/phone.js";
import type { Db } from "./client.js";
import { DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD, DEMO_STAFF_EMAIL } from "./demo.js";
import { WEB_MOCK } from "./seed.js";
import { seedSupport } from "./seed-support.js";
import * as t from "./schema.js";

interface MockCustomer { name: string; email: string; phone: string; joinedAt: string; status: string }
interface MockAddress { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; type: string; isDefault?: boolean }

export async function seedDemoAccounts(db: Db) {
  if (isProduction()) throw new Error("Refusing to add demo accounts to a production database");
  const people = await import(pathToFileURL(fileURLToPath(new URL("people.ts", WEB_MOCK))).href);
  const customers = people.customers as MockCustomer[];
  const mockAddresses = people.customerAddresses as MockAddress[];
  // one hash for every demo account keeps the fixture fast
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // the demo shopper first, then the other shoppers in the demo data
  const shopperRows = customers.map((c, i) => ({
    email: i === 0 ? DEMO_CUSTOMER_EMAIL : c.email.toLowerCase(),
    passwordHash,
    phone: normalizePhone(c.phone),
    name: c.name,
    status: (c.status === "blocked" ? "BLOCKED" : "ACTIVE") as "ACTIVE" | "BLOCKED",
    createdAt: new Date(c.joinedAt),
  }));
  const uniqueShoppers = [...new Map(shopperRows.map((r) => [r.email, r])).values()];
  const shoppers = await db.insert(t.users).values(uniqueShoppers).returning({ id: t.users.id, email: t.users.email });
  await db.insert(t.users).values({ email: DEMO_STAFF_EMAIL, passwordHash, name: "Kavya Iyer", emailVerifiedAt: new Date("2025-04-01T10:00:00+05:30"), staffRoles: ["SUPER_ADMIN"] });

  const ananya = shoppers.find((u) => u.email === DEMO_CUSTOMER_EMAIL)!;
  await db.insert(t.addresses).values(
    mockAddresses.map((a) => ({
      userId: ananya.id,
      name: a.name,
      phone: normalizePhone(a.phone) ?? a.phone,
      line1: a.line1,
      line2: a.line2 ?? null,
      landmark: a.landmark ?? null,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      type: a.type.toUpperCase() as "HOME" | "WORK" | "OTHER",
      isDefault: !!a.isDefault,
    })),
  );

  const support = await seedSupport(db, shoppers, passwordHash);
  return { users: shoppers.length + 1 + support.agents, tickets: support.tickets };
}
