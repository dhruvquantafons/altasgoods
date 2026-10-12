import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LOGISTICS_PROVIDER } from "../src/common/tokens.js";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { orderItems } from "../src/db/schema.js";
import { ShippingService } from "../src/modules/commerce/shipping/shipping.service.js";
import type { Booking, LogisticsProvider, ShipmentRequest } from "../src/modules/commerce/shipping/provider.js";
import { courierStatus } from "../src/modules/commerce/shipping/shiprocket.provider.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

/** A courier that books instantly and reports whatever scan the test sets. */
const scans = new Map<string, string>();
const booked: ShipmentRequest[] = [];
const courier = {
  name: "SHIPROCKET" as const,
  booked,
  book: vi.fn(async (r: ShipmentRequest, _done: Booking, save: (b: Booking) => Promise<void>) => {
    booked.push(r);
    const n = booked.length;
    await save({ carrierOrderRef: `so-${n}`, shipmentRef: `sh-${n}` });
    return { carrierOrderRef: `so-${n}`, shipmentRef: `sh-${n}`, awb: `AWB${n}`, courier: "Delhivery", labelUrl: `https://labels.test/${n}.pdf` };
  }),
  cancel: vi.fn(async () => {}),
  track: vi.fn(async (awb: string) => (scans.has(awb) ? { awb, raw: scans.get(awb)!, status: courierStatus(scans.get(awb)!) } : null)),
  parseWebhook: () => null,
  trackingUrl: (awb: string) => `https://track.test/${awb}`,
} satisfies LogisticsProvider & { booked: ShipmentRequest[] };

let t: TestContext;
let shopper: Record<string, string>;
let staff: Record<string, string>;
let addressId: string;
const { db, pool } = createDb(env().TEST_DATABASE_URL);

beforeAll(async () => {
  t = await createTestApp([{ provide: LOGISTICS_PROVIDER, useValue: courier }]);
  shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
  addressId = (await t.http.get("/v1/me/addresses").set(shopper).expect(200)).body[0].id;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});

/** A paid, packed order line for one unit of a product. */
async function packedLine(slug: string, paymentMethod = "UPI") {
  const p = await t.http.get(`/v1/products/${slug}`).expect(200);
  const placed = await t.http.post("/v1/orders").set(shopper).set("Idempotency-Key", randomUUID()).send({ addressId, paymentMethod, lines: [{ offerId: p.body.offerId, qty: 1, variant: "" }] }).expect(201);
  if (paymentMethod !== "COD") await t.http.post(`/v1/payments/${placed.body.payment.id}/sandbox/complete`).set(shopper).send({ outcome: "SUCCESS" }).expect(200);
  const orderId = placed.body.order.id as string;
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const to of ["ACCEPTED", "PACKED"]) await transition([item!.id], to);
  return { orderId, itemId: item!.id, totalPaise: placed.body.order.totalPaise as number };
}
const transition = (ids: string[], to: string, reason?: string) => t.http.post("/v1/admin/order-items/transition").set(staff).send({ ids, to, reason }).expect(200);

describe("shipping with a courier", () => {
  it("books the parcel when the line is marked ready to ship, and shows the label and tracking", async () => {
    const line = await packedLine("speaker-boom", "COD");
    const r = await transition([line.itemId], "READY_TO_SHIP");
    expect(r.body.results[0]).toMatchObject({ ok: true, status: "READY_TO_SHIP" });

    const req = courier.booked.at(-1)!;
    expect(req).toMatchObject({ cod: true, item: { units: 1 }, reference: expect.stringContaining(line.orderId) });
    // a single parcel order carries the whole amount due, delivery fee included
    expect(req.amountPaise).toBe(line.totalPaise);

    const admin = await t.http.get(`/v1/admin/orders/${line.orderId}`).set(staff).expect(200);
    expect(admin.body.items[0]).toMatchObject({ awb: `AWB${courier.booked.length}`, courier: "Delhivery", labelUrl: expect.stringContaining("labels.test"), simulated: false });
    const mine = await t.http.get(`/v1/me/orders/${line.orderId}`).set(shopper).expect(200);
    expect(mine.body.items[0]).toMatchObject({ courier: "Delhivery", trackingUrl: expect.stringContaining("track.test") });

    // the development simulator never moves a parcel a real courier carries
    await t.http.post("/v1/dev/logistics/advance").set(staff).send({ orderItemId: line.itemId, to: "SHIPPED" }).expect(409);
  });

  it("follows the courier's scans, walking skipped steps, until delivered", async () => {
    const line = await packedLine("airfryer-crisp");
    await transition([line.itemId], "READY_TO_SHIP");
    const [{ awb }] = (await db.select({ awb: orderItems.awb }).from(orderItems).where(eq(orderItems.id, line.itemId))) as [{ awb: string }];

    scans.set(awb, "Pickup Scheduled");
    expect((await t.http.post(`/v1/admin/order-items/${line.itemId}/tracking/refresh`).set(staff).expect(200)).body).toMatchObject({ status: "READY_TO_SHIP", trackingStatus: "Pickup Scheduled" });

    scans.set(awb, "Delivered");
    expect(await t.app.get(ShippingService).pollTracking()).toBeGreaterThanOrEqual(1);
    const mine = await t.http.get(`/v1/me/orders/${line.orderId}`).set(shopper).expect(200);
    expect(mine.body.items[0].status).toBe("DELIVERED");
    expect(mine.body.events.filter((e: { orderItemId: string | null }) => e.orderItemId).map((e: { toStatus: string }) => e.toStatus)).toEqual(
      expect.arrayContaining(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]),
    );
  });

  it("calls the courier off when a booked line is cancelled", async () => {
    const line = await packedLine("cookware-pan");
    await transition([line.itemId], "READY_TO_SHIP");
    courier.cancel.mockClear();
    const r = await transition([line.itemId], "CANCELLED", "Customer changed address");
    expect(r.body.results[0]).toMatchObject({ ok: true, status: "CANCELLED" });
    expect(courier.cancel).toHaveBeenCalledWith({ carrierOrderRef: expect.stringMatching(/^so-/), awb: expect.stringMatching(/^AWB/) });
  });

  it("keeps the line packed when the courier cannot book it", async () => {
    const line = await packedLine("tablet-slate");
    courier.book.mockRejectedValueOnce(new Error("Shiprocket could not assign a courier: Insufficient wallet balance"));
    const r = await transition([line.itemId], "READY_TO_SHIP");
    expect(r.body.results[0]).toMatchObject({ ok: false, error: expect.stringContaining("wallet") });
    const [row] = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.id, line.itemId));
    expect(row!.status).toBe("PACKED");
  });
});
