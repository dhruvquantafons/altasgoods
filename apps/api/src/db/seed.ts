/**
 * Seeds the database from the web app's demo data (apps/web/src/lib/mock), so
 * the storefront, the API and the dashboards share one catalog. The products
 * are placeholders until the client's own catalogue is added in AltasGoods
 * Control. Destructive: clears every table first. Refuses to run in production.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { isProduction } from "../config/env.js";
import { normalizePhone } from "../modules/auth/phone.js";
import { HOUSE_SELLER_ID } from "../common/house.js";
import { createDb, type Db } from "./client.js";
import { seedSupport } from "./seed-support.js";
import * as t from "./schema.js";

const WEB_MOCK = new URL("../../../web/src/lib/mock/", import.meta.url);

import { DEMO_CUSTOMER_PHONE, DEMO_STAFF_PHONE } from "./demo.js";

export { DEMO_CUSTOMER_PHONE, DEMO_STAFF_PHONE };

// Minimal shapes of the web mock modules (loaded dynamically, outside this project's type root)
interface MockCategory { id: string; slug: string; name: string; icon: string; image?: string; children?: { id: string; slug: string; name: string }[] }
interface MockOffer { sellerId: string; price: number; mrp: number; stock: number; deliveryDays: number; codAvailable: boolean; returnWindowDays: number }
interface MockProduct {
  id: string; slug: string; sku: string; title: string; brandId: string; categoryId: string; subcategory: string; image: string; description: string;
  highlights: string[]; specs: unknown[]; variants: unknown[]; rating: number; ratingCount: number; reviewCount: number; tags: string[];
  assured: boolean; featuredSellerId: string; listingStatus: string; soldLast30d: number; createdAt: string; offers: MockOffer[];
}
interface MockCustomer { name: string; email: string; phone: string; joinedAt: string; status: string }
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
    customers: people.customers as MockCustomer[],
    addresses: people.customerAddresses as MockAddress[],
    coupons: engagement.coupons as MockCoupon[],
  };
}

// The demo data is written as of this moment (NOW in apps/web/src/lib/utils.ts).
// Coupon windows are shifted by the time since then so seeded sales stay live.
const MOCK_NOW = Date.parse("2026-10-01T10:30:00+05:30");
const shiftFromMock = (iso: string) => new Date(Date.parse(iso) + Math.max(0, Date.now() - MOCK_NOW));

const WEIGHT_BY_CATEGORY: Record<string, number> = { "cat-home": 2500, "cat-appliances": 4500, "cat-electronics": 1200, "cat-mobiles": 450, "cat-fashion": 600, "cat-sports": 1500 };

export async function seed(db: Db) {
  if (isProduction()) throw new Error("Refusing to seed a production database");
  const m = await loadMock();

  await db.execute(sql`truncate table refunds, payment_events, payments, order_events, order_items, orders, cart_items, addresses, coupons,
    return_events, returns, customer_uploads,
    support_attachments, support_actions, support_events, support_messages, support_tickets,
    media, files,
    offers, products, seller_members, sellers, brands, categories, sessions, otp_challenges, users restart identity cascade`);
  await db.execute(sql`alter sequence order_number_seq restart with 10001`);
  await db.execute(sql`alter sequence support_ticket_seq restart with 60001`);
  await db.execute(sql`alter sequence return_seq restart with 70001`);

  await db.insert(t.categories).values(
    m.categories.flatMap((c, i) => [
      { id: c.id, slug: c.slug, name: c.name, icon: c.icon, image: c.image ?? null, sortOrder: i },
      ...(c.children ?? []).map((ch, j) => ({ id: ch.id, slug: `${c.slug}-${ch.slug}`, name: ch.name, parentId: c.id, icon: c.icon, sortOrder: j })),
    ]),
  );
  await db.insert(t.brands).values(m.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, verified: b.verified })));

  await db.insert(t.sellers).values({
    id: HOUSE_SELLER_ID,
    slug: "altasgoods",
    displayName: "AltasGoods",
    legalName: "AltasGoods",
    ownerName: "AltasGoods",
    email: "support@altasgoods.in",
    phone: "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  });

  // users: the demo shopper, other shoppers and the store's staff
  const shopperRows = m.customers.map((c, i) => ({
    phone: i === 0 ? DEMO_CUSTOMER_PHONE : normalizePhone(c.phone)!,
    name: c.name,
    email: c.email,
    status: (c.status === "blocked" ? "BLOCKED" : "ACTIVE") as "ACTIVE" | "BLOCKED",
    createdAt: new Date(c.joinedAt),
  }));
  const uniqueShoppers = [...new Map(shopperRows.filter((r) => r.phone).map((r) => [r.phone, r])).values()];
  const insertedShoppers = await db.insert(t.users).values(uniqueShoppers).returning({ id: t.users.id, phone: t.users.phone });
  await db.insert(t.users).values({ phone: DEMO_STAFF_PHONE, name: "Kavya Iyer", email: "kavya.iyer@altasgoods.in", emailVerifiedAt: new Date("2025-04-01T10:00:00+05:30"), staffRoles: ["SUPER_ADMIN"] });

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
      listingStatus: p.listingStatus === "suppressed" ? "SUPPRESSED" : "LIVE",
      soldLast30d: p.soldLast30d,
      searchText: `${p.title} ${brandName.get(p.brandId) ?? ""} ${categoryName.get(p.categoryId) ?? ""} ${p.subcategory}`,
      createdAt: new Date(p.createdAt),
    })),
  );
  // the store's own price and stock: the demo data's featured offer for each product
  await db.insert(t.offers).values(
    m.products.map((p) => {
      const o = p.offers.find((x) => x.sellerId === p.featuredSellerId) ?? p.offers[0]!;
      return {
        productId: p.id,
        sellerId: HOUSE_SELLER_ID,
        pricePaise: o.price * 100,
        mrpPaise: o.mrp * 100,
        // demo stock is generous so seeded orders never run a product dry
        stock: o.stock === 0 ? 0 : Math.max(o.stock, 25),
        deliveryDays: o.deliveryDays,
        codAvailable: o.codAvailable,
        returnWindowDays: o.returnWindowDays,
        weightGrams: WEIGHT_BY_CATEGORY[p.categoryId] ?? 800,
      };
    }),
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

  // coupons a seller funded in the demo data have no place in a single store
  await db.insert(t.coupons).values(
    m.coupons.filter((c) => c.fundedBy !== "seller").map((c) => ({
      code: c.code,
      description: c.description,
      type: (c.type === "percent" ? "PERCENT" : "FLAT") as "PERCENT" | "FLAT",
      value: c.type === "percent" ? c.value : c.value * 100,
      maxDiscountPaise: c.maxDiscount ? c.maxDiscount * 100 : null,
      minOrderPaise: c.minOrder * 100,
      startsAt: shiftFromMock(c.startsAt),
      endsAt: shiftFromMock(c.endsAt),
      status: (c.status === "paused" ? "PAUSED" : "ACTIVE") as "ACTIVE" | "PAUSED",
      fundedBy: c.fundedBy === "bank" ? ("BANK" as const) : ("STORE" as const),
      usageLimit: c.limit,
      usageCount: c.usage,
    })),
  );

  const support = await seedSupport(db, insertedShoppers);
  return { products: m.products.length, users: insertedShoppers.length + 1 + support.agents, tickets: support.tickets };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db, pool } = createDb();
  const counts = await seed(db);
  await pool.end();
  console.log(`Seeded ${counts.products} products, ${counts.users} users, ${counts.tickets} support tickets`);
  if (!process.argv.includes("--no-orders")) {
    const { seedOrders } = await import("./seed-orders.js");
    console.log(`Created ${await seedOrders()} demo orders through the order services`);
  }
  console.log(`Demo shopper: ${DEMO_CUSTOMER_PHONE}   Demo staff (AltasGoods Control): ${DEMO_STAFF_PHONE}`);
}
