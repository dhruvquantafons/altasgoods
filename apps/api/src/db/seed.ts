/**
 * Seeds the database from the web app's demo data (apps/web/src/lib/mock), so
 * the storefront, the API and the dashboards share one catalog. Destructive:
 * clears every table first. Refuses to run in production.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { isProduction } from "../config/env.js";
import { normalizePhone } from "../modules/auth/phone.js";
import { createDb, type Db } from "./client.js";
import * as t from "./schema.js";

const WEB_MOCK = new URL("../../../web/src/lib/mock/", import.meta.url);

import { DEMO_APPLICANT_PHONE, DEMO_CUSTOMER_PHONE, DEMO_SELLER_PHONE, DEMO_STAFF_PHONE } from "./demo.js";

export { DEMO_CUSTOMER_PHONE, DEMO_SELLER_PHONE, DEMO_STAFF_PHONE };

// Minimal shapes of the web mock modules (loaded dynamically, outside this project's type root)
interface MockCategory { id: string; slug: string; name: string; icon: string; image?: string; commission: number; children?: { id: string; slug: string; name: string }[] }
interface MockOffer { sellerId: string; price: number; mrp: number; stock: number; fulfilledBy: "blubuy" | "seller"; deliveryDays: number; codAvailable: boolean; returnWindowDays: number }
interface MockProduct {
  id: string; slug: string; sku: string; title: string; brandId: string; categoryId: string; subcategory: string; image: string; description: string;
  highlights: string[]; specs: unknown[]; variants: unknown[]; rating: number; ratingCount: number; reviewCount: number; tags: string[];
  assured: boolean; featuredSellerId: string; listingStatus: string; soldLast30d: number; createdAt: string; offers: MockOffer[];
}
interface MockSeller { id: string; slug: string; displayName: string; legalName: string; ownerName: string; email: string; phone: string; gstin: string; pan: string; city: string; state: string; pincode: string; joinedAt: string; status: string; tier: "Bronze" | "Silver" | "Gold" | "Platinum"; rating: number; ratingCount: number }
interface MockCustomer { name: string; email: string; phone: string; plusMember: boolean; joinedAt: string; status: string }
interface MockAddress { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; pincode: string; type: string; isDefault?: boolean }
interface MockCoupon { code: string; description: string; type: "percent" | "flat"; value: number; maxDiscount?: number; minOrder: number; usage: number; limit: number; startsAt: string; endsAt: string; status: string; fundedBy: string }

async function loadMock() {
  const load = (f: string) => import(pathToFileURL(fileURLToPath(new URL(f, WEB_MOCK))).href);
  const catalog = await load("catalog.ts");
  const people = await load("people.ts");
  const engagement = await load("engagement.ts");
  return {
    categories: catalog.categories as MockCategory[],
    brands: catalog.brands as { id: string; slug: string; name: string; verified: boolean }[],
    products: catalog.products as MockProduct[],
    sellers: people.sellers as MockSeller[],
    customers: people.customers as MockCustomer[],
    addresses: people.customerAddresses as MockAddress[],
    coupons: engagement.coupons as MockCoupon[],
  };
}

const WEIGHT_BY_CATEGORY: Record<string, number> = { "cat-home": 2500, "cat-appliances": 4500, "cat-electronics": 1200, "cat-mobiles": 450, "cat-fashion": 600, "cat-sports": 1500 };

export async function seed(db: Db) {
  if (isProduction()) throw new Error("Refusing to seed a production database");
  const m = await loadMock();

  await db.execute(sql`truncate table refunds, payment_events, payments, order_events, order_items, orders, cart_items, addresses, coupons,
    kyc_documents, files, seller_application_events, seller_applications,
    offers, products, seller_members, sellers, brands, categories, sessions, otp_challenges, users restart identity cascade`);
  await db.execute(sql`alter sequence order_number_seq restart with 10001`);
  await db.execute(sql`alter sequence seller_application_seq restart with 50001`);

  await db.insert(t.categories).values(
    m.categories.flatMap((c, i) => [
      { id: c.id, slug: c.slug, name: c.name, icon: c.icon, image: c.image ?? null, commissionBps: Math.round(c.commission * 100), sortOrder: i },
      ...(c.children ?? []).map((ch, j) => ({ id: ch.id, slug: `${c.slug}-${ch.slug}`, name: ch.name, parentId: c.id, icon: c.icon, commissionBps: Math.round(c.commission * 100), sortOrder: j })),
    ]),
  );
  await db.insert(t.brands).values(m.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, verified: b.verified })));

  // sellers that can trade are ACTIVE; a payout hold does not stop selling
  const sellerStatus = (s: string) => (s === "active" || s === "on_hold" ? "ACTIVE" : s.toUpperCase());
  await db.insert(t.sellers).values(
    m.sellers.map((s) => ({
      id: s.id,
      slug: s.slug,
      displayName: s.displayName,
      legalName: s.legalName,
      ownerName: s.ownerName,
      email: s.email,
      phone: s.id === "s-apex" ? DEMO_SELLER_PHONE : (normalizePhone(s.phone) ?? s.phone),
      gstin: s.gstin,
      pan: s.pan,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      status: sellerStatus(s.status),
      tier: s.tier,
      rating: s.rating,
      ratingCount: s.ratingCount,
      joinedAt: new Date(s.joinedAt),
    })),
  );

  // users: the demo shopper, other shoppers, and one owner per seller
  const shopperRows = m.customers.map((c, i) => ({
    phone: i === 0 ? DEMO_CUSTOMER_PHONE : normalizePhone(c.phone)!,
    name: c.name,
    email: c.email,
    isPlus: c.plusMember,
    plusRenewsAt: c.plusMember ? new Date("2026-11-12T00:00:00+05:30") : null,
    status: (c.status === "blocked" ? "BLOCKED" : "ACTIVE") as "ACTIVE" | "BLOCKED",
    createdAt: new Date(c.joinedAt),
  }));
  const uniqueShoppers = [...new Map(shopperRows.filter((r) => r.phone).map((r) => [r.phone, r])).values()];
  const insertedShoppers = await db.insert(t.users).values(uniqueShoppers).returning({ id: t.users.id, phone: t.users.phone });
  const ownerRows = m.sellers.map((s) => ({ phone: s.id === "s-apex" ? DEMO_SELLER_PHONE : (normalizePhone(s.phone) ?? `+9190000${String(m.sellers.indexOf(s)).padStart(5, "0")}`), name: s.ownerName, email: s.email }));
  const owners = await db.insert(t.users).values(ownerRows).onConflictDoNothing().returning({ id: t.users.id, phone: t.users.phone });
  const ownerByPhone = new Map(owners.map((o) => [o.phone, o.id]));
  await db.insert(t.users).values({ phone: DEMO_STAFF_PHONE, name: "Kavya Iyer", email: "kavya.iyer@blubuy.in", emailVerifiedAt: new Date("2025-04-01T10:00:00+05:30"), staffRoles: ["SUPER_ADMIN"] });
  await db.insert(t.sellerMembers).values(
    m.sellers.flatMap((s, i) => {
      const userId = ownerByPhone.get(ownerRows[i]!.phone);
      return userId ? [{ sellerId: s.id, userId, role: "OWNER" as const }] : [];
    }),
  );

  const brandName = new Map(m.brands.map((b) => [b.id, b.name]));
  const categoryName = new Map(m.categories.map((c) => [c.id, c.name]));
  await db.insert(t.products).values(
    m.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      title: p.title,
      brandId: p.brandId,
      categoryId: p.categoryId,
      subcategory: p.subcategory,
      description: p.description,
      highlights: p.highlights,
      specs: p.specs as never,
      variants: p.variants as never,
      images: [p.image],
      rating: p.rating,
      ratingCount: p.ratingCount,
      reviewCount: p.reviewCount,
      tags: p.tags,
      assured: p.assured,
      featuredSellerId: p.featuredSellerId,
      listingStatus: p.listingStatus === "suppressed" ? "SUPPRESSED" : "LIVE",
      soldLast30d: p.soldLast30d,
      searchText: `${p.title} ${brandName.get(p.brandId) ?? ""} ${categoryName.get(p.categoryId) ?? ""} ${p.subcategory}`,
      createdAt: new Date(p.createdAt),
    })),
  );
  await db.insert(t.offers).values(
    m.products.flatMap((p) =>
      p.offers.map((o) => ({
        productId: p.id,
        sellerId: o.sellerId,
        pricePaise: o.price * 100,
        mrpPaise: o.mrp * 100,
        // demo stock is generous so seeded orders never run a listing dry
        stock: o.stock === 0 ? 0 : Math.max(o.stock, 25),
        fulfilledBy: (o.fulfilledBy === "blubuy" ? "BLUBUY" : "SELLER") as "BLUBUY" | "SELLER",
        deliveryDays: o.deliveryDays,
        codAvailable: o.codAvailable,
        returnWindowDays: o.returnWindowDays,
        weightGrams: WEIGHT_BY_CATEGORY[p.categoryId] ?? 800,
      })),
    ),
  );

  const ananya = insertedShoppers.find((u) => u.phone === DEMO_CUSTOMER_PHONE)!;
  await db.insert(t.addresses).values(
    m.addresses.map((a) => ({
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

  await db.insert(t.coupons).values(
    m.coupons.map((c) => ({
      code: c.code,
      description: c.description,
      type: (c.type === "percent" ? "PERCENT" : "FLAT") as "PERCENT" | "FLAT",
      value: c.type === "percent" ? c.value : c.value * 100,
      maxDiscountPaise: c.maxDiscount ? c.maxDiscount * 100 : null,
      minOrderPaise: c.minOrder * 100,
      startsAt: new Date(c.startsAt),
      endsAt: new Date(c.endsAt),
      status: (c.status === "paused" ? "PAUSED" : "ACTIVE") as "ACTIVE" | "PAUSED",
      fundedBy: c.fundedBy.toUpperCase() as "BLUBUY" | "SELLER" | "BANK",
      usageLimit: c.limit,
      usageCount: c.usage,
    })),
  );

  return { products: m.products.length, sellers: m.sellers.length, users: insertedShoppers.length + owners.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db, pool } = createDb();
  const counts = await seed(db);
  await pool.end();
  console.log(`Seeded ${counts.products} products, ${counts.sellers} sellers, ${counts.users} users`);
  if (!process.argv.includes("--no-orders")) {
    const { seedOrders } = await import("./seed-orders.js");
    console.log(`Created ${await seedOrders()} demo orders through the order services`);
  }
  if (!process.argv.includes("--no-applications")) {
    const { seedApplications } = await import("./seed-applications.js");
    console.log(`Created ${await seedApplications()} seller applications through the onboarding services`);
  }
  console.log(`Demo shopper: ${DEMO_CUSTOMER_PHONE}   Demo seller (Apex Retail): ${DEMO_SELLER_PHONE}`);
  console.log(`Demo staff (BluBuy Control): ${DEMO_STAFF_PHONE}   Applicant with changes requested: ${DEMO_APPLICANT_PHONE}`);
}
