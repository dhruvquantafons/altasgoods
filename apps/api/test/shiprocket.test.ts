import { describe, expect, it, vi } from "vitest";
import { courierStatus, ShiprocketLogisticsProvider } from "../src/modules/commerce/shipping/shiprocket.provider.js";
import { courierPath } from "../src/modules/commerce/shipping/shipping.service.js";
import type { ShipmentRequest } from "../src/modules/commerce/shipping/provider.js";

const config = { email: "api@altasgoods.test", password: "pw", pickupLocation: "Primary", webhookToken: "hook-token", box: [20, 15, 10] as [number, number, number] };

/** A fetch that answers each call in turn ({ status, body } or a bare body) and records what was asked. */
function fakeFetch(...responses: unknown[]) {
  const fn = vi.fn(async () => {
    const next = responses.shift() as { status?: number; body?: unknown } | undefined;
    const [status, body] = next && typeof next === "object" && "status" in next ? [next.status!, next.body] : [200, next];
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return fn as typeof fn & typeof fetch;
}
const sent = (f: ReturnType<typeof fakeFetch>, n: number) => {
  const [url, init] = f.mock.calls[n] as unknown as [string, RequestInit];
  return { path: url.replace("https://apiv2.shiprocket.in/v1/external", ""), body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>).Authorization };
};

const request: ShipmentRequest = {
  reference: "AG-261012-10001-abcd1234",
  placedAt: new Date("2026-10-12T08:35:00Z"),
  customer: { name: "Ananya Sharma", phone: "+91 98450 12345", email: null },
  address: { line1: "12 MG Road", line2: "Indiranagar", landmark: null, city: "Bengaluru", state: "Karnataka", pincode: "560038" },
  item: { name: "Studio headphones", sku: "HP-1", units: 2, unitPricePaise: 149_900 },
  amountPaise: 289_900,
  cod: true,
  weightGrams: 1600,
};

describe("Shiprocket status mapping", () => {
  it.each([
    ["Picked Up", "SHIPPED"],
    ["IN TRANSIT", "SHIPPED"],
    ["Undelivered", "SHIPPED"],
    ["Out For Delivery", "OUT_FOR_DELIVERY"],
    ["Delivered", "DELIVERED"],
    ["RTO Initiated", "RTO_IN_TRANSIT"],
    ["RTO_DELIVERED", "RTO_RECEIVED"],
    ["Lost", "LOST"],
    ["Pickup Scheduled", null],
    ["Out For Pickup", null],
    ["Canceled", null],
  ])("%s moves the line to %s", (raw, status) => expect(courierStatus(raw)).toBe(status));

  it("walks every step a skipped scan implies, and ignores scans that go backwards", () => {
    expect(courierPath("READY_TO_SHIP", "DELIVERED")).toEqual(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]);
    expect(courierPath("READY_TO_SHIP", "RTO_RECEIVED")).toEqual(["SHIPPED", "RTO_IN_TRANSIT", "RTO_RECEIVED"]);
    expect(courierPath("OUT_FOR_DELIVERY", "SHIPPED")).toEqual(["SHIPPED"]);
    expect(courierPath("SHIPPED", "SHIPPED")).toEqual([]);
    expect(courierPath("DELIVERED", "SHIPPED")).toEqual([]);
  });
});

describe("Shiprocket provider", () => {
  it("books a parcel: order, AWB, pickup and label, saving each step", async () => {
    const f = fakeFetch(
      { token: "tok" },
      { order_id: 111, shipment_id: 222 },
      { awb_assign_status: 1, response: { data: { awb_code: "AWB999", courier_name: "Delhivery Surface" } } },
      { pickup_status: 1 },
      { label_created: 1, label_url: "https://labels.test/222.pdf" },
    );
    const saved: unknown[] = [];
    const p = new ShiprocketLogisticsProvider({ ...config, fetch: f });
    const booked = await p.book(request, {}, async (s) => void saved.push(s));

    expect(booked).toEqual({ carrierOrderRef: "111", shipmentRef: "222", awb: "AWB999", courier: "Delhivery Surface", labelUrl: "https://labels.test/222.pdf" });
    expect(saved).toEqual([{ carrierOrderRef: "111", shipmentRef: "222" }, { awb: "AWB999", courier: "Delhivery Surface" }, { labelUrl: "https://labels.test/222.pdf" }]);

    const order = sent(f, 1);
    expect(order.path).toBe("/orders/create/adhoc");
    expect(order.auth).toBe("Bearer tok");
    expect(order.body).toMatchObject({
      order_id: "AG-261012-10001-abcd1234",
      order_date: "2026-10-12 14:05",
      pickup_location: "Primary",
      billing_customer_name: "Ananya",
      billing_last_name: "Sharma",
      billing_phone: "9845012345",
      billing_email: "api@altasgoods.test",
      payment_method: "COD",
      sub_total: 2998,
      // the customer owes ₹2,899: ₹99 less than the line, its coupon share
      total_discount: 99,
      shipping_charges: 0,
      weight: 1.6,
      length: 20,
    });
    expect(sent(f, 2)).toMatchObject({ path: "/courier/assign/awb", body: { shipment_id: 222 } });
  });

  it("resumes a booking without creating the order again", async () => {
    const f = fakeFetch({ token: "tok" }, { awb_assign_status: 1, response: { data: { awb_code: "AWB1", courier_name: "Xpressbees" } } }, {}, { label_url: "https://l" });
    const p = new ShiprocketLogisticsProvider({ ...config, fetch: f });
    await p.book(request, { carrierOrderRef: "111", shipmentRef: "222" }, async () => {});
    expect(sent(f, 1).path).toBe("/courier/assign/awb");
  });

  it("explains why no courier could be assigned", async () => {
    const f = fakeFetch({ token: "tok" }, { awb_assign_status: 0, response: { data: { awb_assign_error: "Insufficient wallet balance" } } });
    const p = new ShiprocketLogisticsProvider({ ...config, fetch: f });
    await expect(p.book(request, { carrierOrderRef: "111", shipmentRef: "222" }, async () => {})).rejects.toThrow(/Insufficient wallet balance/);
  });

  it("signs in again when the token has expired", async () => {
    const f = fakeFetch({ token: "old" }, { status: 401, body: {} }, { token: "new" }, { tracking_data: { shipment_track: [{ current_status: "Delivered" }] } });
    const p = new ShiprocketLogisticsProvider({ ...config, fetch: f });
    expect(await p.track("AWB1")).toEqual({ awb: "AWB1", raw: "Delivered", status: "DELIVERED" });
    expect(sent(f, 3).auth).toBe("Bearer new");
  });

  it("accepts webhooks only with the configured token", () => {
    const p = new ShiprocketLogisticsProvider(config);
    const body = { awb: 12345, current_status: "OUT FOR DELIVERY" };
    expect(() => p.parseWebhook(body, { "x-api-key": "wrong" })).toThrow();
    expect(() => new ShiprocketLogisticsProvider({ ...config, webhookToken: undefined }).parseWebhook(body, { "x-api-key": "" })).toThrow();
    expect(p.parseWebhook(body, { "x-api-key": "hook-token" })).toEqual({ awb: "12345", raw: "OUT FOR DELIVERY", status: "OUT_FOR_DELIVERY" });
  });
});
