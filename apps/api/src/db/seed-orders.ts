/**
 * Demo order history, created through the real services (quote, place, pay,
 * store fulfilment, courier scans) and then back-dated, so every number in
 * AltasGoods Control and My Account comes from genuine order flows.
 */
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { eq, inArray, sql } from "drizzle-orm";
import { AppModule } from "../app.module.js";
import type { Db } from "./client.js";
import { addresses, orderEvents, orderItems, orders, payments, users, type OrderItemStatus } from "./schema.js";
import { DB } from "../common/tokens.js";
import { OrdersService } from "../modules/commerce/orders.service.js";
import { PaymentsService } from "../modules/commerce/payments/payments.service.js";
import { SandboxPaymentProvider } from "../modules/commerce/payments/sandbox.provider.js";
import { FulfilmentService } from "../modules/commerce/fulfilment.service.js";
import { DevLogisticsService } from "../modules/commerce/dev-logistics.service.js";
import { ReturnsService } from "../modules/commerce/returns/returns.service.js";
import { DEMO_CUSTOMER_PHONE, DEMO_STAFF_PHONE } from "./demo.js";

type Target = Exclude<OrderItemStatus, "PENDING"> | "PAYMENT_PENDING";

interface Plan {
  phone: string;
  products: string[];
  method: "UPI" | "CARD" | "COD" | "NETBANKING";
  target: Target;
  daysAgo: number;
  coupon?: string;
}

const STEPS: OrderItemStatus[] = ["ACCEPTED", "PACKED", "READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export async function seedOrders() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get<Db>(DB);
  const ordersSvc = app.get(OrdersService);
  const paymentsSvc = app.get(PaymentsService);
  const fulfilment = app.get(FulfilmentService);
  const courier = app.get(DevLogisticsService);

  // shoppers only: no staff
  const [staff] = await db.select({ id: users.id }).from(users).where(eq(users.phone, DEMO_STAFF_PHONE));
  const shoppers = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(sql`cardinality(${users.staffRoles}) = 0`)
    .orderBy(users.createdAt)
    .limit(30);
  const others = shoppers.filter((s) => s.phone !== DEMO_CUSTOMER_PHONE).map((s) => s.phone);
  const featured = ["headphones-studio", "earbuds-pods", "speaker-boom", "airfryer-crisp", "laptop-air", "phone-aurora", "cookware-pan", "camera-mirrorless", "tablet-slate", "blender-pro"];
  const anyone = ["tee-classic", "serum-glow", "coffee-beans", "vase-ceramic", "yoga-mat", "books-stack", "lamp-arc", "sneakers-white"];

  const plans: Plan[] = [
    { phone: DEMO_CUSTOMER_PHONE, products: ["headphones-studio"], method: "UPI", target: "OUT_FOR_DELIVERY", daysAgo: 2 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["books-stack", "tea-assam"], method: "CARD", target: "SHIPPED", daysAgo: 1 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["sneakers-white"], method: "UPI", target: "NEW", daysAgo: 0, coupon: "BIGDAYS10" },
    { phone: DEMO_CUSTOMER_PHONE, products: ["chair-lounge"], method: "UPI", target: "DELIVERED", daysAgo: 6 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["tee-classic", "cushions-linen"], method: "COD", target: "DELIVERED", daysAgo: 12 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["serum-glow"], method: "UPI", target: "DELIVERED", daysAgo: 20 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["oil-olive"], method: "UPI", target: "CANCELLED", daysAgo: 9 },
    { phone: DEMO_CUSTOMER_PHONE, products: ["watch-smart"], method: "UPI", target: "PAYMENT_PENDING", daysAgo: 0 },
  ];
  const sellerTargets: Target[] = ["NEW", "NEW", "NEW", "NEW", "NEW", "ACCEPTED", "ACCEPTED", "ACCEPTED", "PACKED", "PACKED", "READY_TO_SHIP", "READY_TO_SHIP", "SHIPPED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "CANCELLED"];
  sellerTargets.forEach((target, i) => {
    const days = target === "NEW" ? 0 : target === "ACCEPTED" || target === "PACKED" ? 0.3 : target === "READY_TO_SHIP" ? 1 : target === "SHIPPED" ? 2 : target === "OUT_FOR_DELIVERY" ? 3 : target === "DELIVERED" ? 4 + i : 5;
    plans.push({
      phone: others[i % others.length]!,
      products: i % 4 === 3 ? [featured[i % featured.length]!, anyone[i % anyone.length]!] : [featured[i % featured.length]!],
      method: (["UPI", "UPI", "COD", "CARD", "NETBANKING"] as const)[i % 5]!,
      target,
      daysAgo: days,
      coupon: i % 6 === 0 ? "BIGDAYS10" : undefined,
    });
  });

  const offerFor = async (slug: string) => {
    const r = await db.execute<{ id: string; price: number }>(sql`
      select o.id, o.price_paise as price from offers o join products p on p.id = o.product_id
      where p.slug = ${slug} and o.status = 'ACTIVE' and o.stock > 0 order by o.price_paise asc limit 1`);
    return r.rows[0];
  };

  let created = 0;
  for (const plan of plans) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, plan.phone));
    if (!user) continue;
    let [address] = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, user.id)).limit(1);
    if (!address) [address] = await db.insert(addresses).values({ userId: user.id, name: "Demo Customer", phone: plan.phone, line1: `${100 + created}, MG Road`, city: "Pune", state: "Maharashtra", pincode: "411001", isDefault: true }).returning({ id: addresses.id });
    const lines = [];
    for (const slug of plan.products) {
      const o = await offerFor(slug);
      if (o) lines.push({ offerId: o.id, qty: 1, variant: "" });
    }
    if (!lines.length) continue;
    const method = plan.method === "COD" && (await offerFor(plan.products[0]!))!.price > 5_000_000 ? "UPI" : plan.method;

    let placed;
    try {
      placed = await ordersSvc.place(user.id, { addressId: address!.id, paymentMethod: method, lines, couponCode: plan.coupon }, randomUUID());
    } catch {
      continue;
    }
    const orderId = placed.order.id;
    if (method !== "COD" && plan.target !== "PAYMENT_PENDING") {
      const [p] = await db.select({ ref: payments.providerRef }).from(payments).where(eq(payments.orderId, orderId));
      await paymentsSvc.process(SandboxPaymentProvider.event(p!.ref!, "SUCCESS"));
    }

    const items = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
    if (plan.target === "CANCELLED") await ordersSvc.cancel(user.id, orderId, { reason: "Ordered by mistake" });
    else if (plan.target !== "NEW" && plan.target !== "PAYMENT_PENDING") {
      for (const item of items) {
        for (const step of STEPS) {
          if (step === "ACCEPTED" || step === "PACKED" || step === "READY_TO_SHIP") {
            await fulfilment.transition(staff!.id, { ids: [item.id], to: step });
          } else {
            await courier.advance({ id: user.id, sessionId: "seed", staff: [] }, item.id, step);
          }
          if (step === plan.target) break;
        }
      }
    }
    await backdate(db, orderId, plan.daysAgo * 86_400_000 + created * 7 * 60_000);
    created++;
  }
  await seedReturns(db, app.get(ReturnsService));
  await app.close();
  return created;
}

/** A few returns in different stages, so My Account and AltasGoods Control show real ones. */
async function seedReturns(db: Db, svc: ReturnsService) {
  const delivered = await db
    .select({ itemId: orderItems.id, userId: orders.userId, phone: users.phone })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orderItems.status, "DELIVERED"))
    .orderBy(orderItems.createdAt);
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    qty: 1,
    reasonCode: "DEFECTIVE",
    reasonLabel: "Item is defective or not working",
    fault: "STORE" as const,
    resolution: "REFUND" as const,
    refundTo: "SOURCE" as const,
    pickupDate: today,
    pickupSlot: "10 AM to 1 PM",
    photoIds: [],
  };
  const demo = delivered.find((d) => d.phone === DEMO_CUSTOMER_PHONE);
  const others = delivered.filter((d) => d.phone !== DEMO_CUSTOMER_PHONE);
  const plans: { line: (typeof delivered)[number] | undefined; stages: ("OUT_FOR_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "RECEIVED")[]; extra?: object }[] = [
    { line: demo, stages: [], extra: { reasonCode: "NOT_AS_DESCRIBED", reasonLabel: "Item is not as described", comments: "The colour is much darker than the photos." } },
    { line: others[0], stages: ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"], extra: { comments: "Stops working after a few minutes." } },
    { line: others[1], stages: ["OUT_FOR_PICKUP", "PICKED_UP"], extra: { reasonCode: "WRONG_ITEM", reasonLabel: "Received a different item", resolution: "REPLACEMENT", refundTo: undefined } },
    // left for the store to decide
    { line: others[2], stages: [], extra: { reasonCode: "MISSING_PARTS", reasonLabel: "Parts or accessories are missing", comments: "The charging cable was not in the box." } },
  ];
  for (const p of plans) {
    if (!p.line) continue;
    try {
      const r = await svc.create(p.line.userId, { ...base, ...p.extra, orderItemId: p.line.itemId } as Parameters<ReturnsService["create"]>[1]);
      // demo orders are backdated past the return window, so the store approves before pickup
      if (p.stages.length && r.status === "PENDING_REVIEW") await svc.decide(r.id, true, "Approved as a goodwill return");
      for (const to of p.stages) await svc.advance(r.id, to);
    } catch (e) {
      console.warn(`Skipped a demo return: ${String(e)}`);
    }
  }
}

/** Shifts every timestamp of an order into the past, keeping their spacing. */
async function backdate(db: Db, orderId: string, ms: number) {
  if (ms <= 0) return;
  const shift = sql`${`${Math.round(ms / 1000)} seconds`}::interval`;
  await db.update(orders).set({ placedAt: sql`${orders.placedAt} - ${shift}`, createdAt: sql`${orders.createdAt} - ${shift}`, paymentDueBy: sql`${orders.paymentDueBy} - ${shift}` }).where(eq(orders.id, orderId));
  await db
    .update(orderItems)
    .set({
      createdAt: sql`${orderItems.createdAt} - ${shift}`,
      promisedBy: sql`${orderItems.promisedBy} - ${shift}`,
      dispatchBy: sql`${orderItems.dispatchBy} - ${shift}`,
      shippedAt: sql`${orderItems.shippedAt} - ${shift}`,
      deliveredAt: sql`${orderItems.deliveredAt} - ${shift}`,
      cancelledAt: sql`${orderItems.cancelledAt} - ${shift}`,
    })
    .where(eq(orderItems.orderId, orderId));
  await db.update(orderEvents).set({ createdAt: sql`${orderEvents.createdAt} - ${shift}` }).where(eq(orderEvents.orderId, orderId));
  const pays = await db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orderId));
  if (pays.length) await db.update(payments).set({ createdAt: sql`${payments.createdAt} - ${shift}`, capturedAt: sql`${payments.capturedAt} - ${shift}` }).where(inArray(payments.id, pays.map((p) => p.id)));
}
