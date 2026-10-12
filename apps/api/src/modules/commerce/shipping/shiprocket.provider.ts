import { timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiError } from "../../../common/errors.js";
import type { Booking, CourierStatus, LogisticsProvider, ShipmentRequest, TrackingUpdate } from "./provider.js";

const API = "https://apiv2.shiprocket.in/v1/external";
/** Shiprocket tokens last 10 days; renew a day early. */
const TOKEN_TTL_MS = 9 * 86_400_000;

export const SHIPROCKET_TOKEN_HEADER = "x-api-key";

export interface ShiprocketConfig {
  email: string;
  password: string;
  pickupLocation: string;
  webhookToken?: string;
  /** length, breadth, height in cm */
  box: [number, number, number];
  /** injectable for tests */
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * Shiprocket's status words to the item status they move a line to. RTO is
 * checked before delivery, so "RTO Delivered" is a return to us, not a delivery.
 * Anything not listed (pickup scheduled, out for pickup, NDR raised) leaves
 * the line where it is.
 */
export function courierStatus(raw: string): CourierStatus | null {
  const s = raw.toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (s.startsWith("RTO")) return s.includes("DELIVERED") ? "RTO_RECEIVED" : "RTO_IN_TRANSIT";
  if (s === "DELIVERED") return "DELIVERED";
  if (s.includes("OUT FOR DELIVERY")) return "OUT_FOR_DELIVERY";
  if (s === "LOST" || s === "DAMAGED" || s === "DESTROYED" || s === "DISPOSED OFF") return "LOST";
  // picked up and moving; "Undelivered" is a failed attempt that goes back out
  if (["PICKED UP", "SHIPPED", "IN TRANSIT", "REACHED AT DESTINATION HUB", "REACHED DESTINATION HUB", "MISROUTED", "DELAYED", "UNDELIVERED", "IN FLIGHT", "IN TRANSIT AT DESTINATION HUB"].includes(s)) return "SHIPPED";
  return null;
}

const rupees = (paise: number) => Math.round(paise) / 100;

/** "2026-10-12 14:05" in India time, the format Shiprocket wants. */
function istStamp(d: Date) {
  const t = new Date(d.getTime() + 5.5 * 3_600_000).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 16)}`;
}

/**
 * Shiprocket, India's courier aggregator: one API in front of Delhivery,
 * Blue Dart, Xpressbees and others. Shiprocket picks the courier its rules
 * prefer when the AWB is assigned. There is no test mode: every booking is a
 * real shipment charged to the Shiprocket wallet.
 */
export class ShiprocketLogisticsProvider implements LogisticsProvider {
  readonly name = "SHIPROCKET" as const;
  private readonly logger = new Logger("Shiprocket");
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: ShiprocketConfig) {
    this.fetch = config.fetch ?? fetch;
    this.now = config.now ?? Date.now;
  }

  async book(r: ShipmentRequest, done: Booking, save: (step: Booking) => Promise<void>) {
    let { carrierOrderRef, shipmentRef, awb, courier, labelUrl } = done;

    if (!shipmentRef) {
      const [first, ...rest] = r.customer.name.trim().split(/\s+/);
      const line = r.item.unitPricePaise * r.item.units;
      // the collectable amount differs from the line value by its coupon share and any delivery fee
      const diff = r.amountPaise - line;
      const created = await this.call<{ order_id: number; shipment_id: number }>("POST", "/orders/create/adhoc", {
        order_id: r.reference,
        order_date: istStamp(r.placedAt),
        pickup_location: this.config.pickupLocation,
        billing_customer_name: first ?? r.customer.name,
        billing_last_name: rest.join(" "),
        billing_address: r.address.line1,
        billing_address_2: [r.address.line2, r.address.landmark].filter(Boolean).join(", "),
        billing_city: r.address.city,
        billing_pincode: r.address.pincode,
        billing_state: r.address.state,
        billing_country: "India",
        billing_email: r.customer.email ?? this.config.email,
        billing_phone: r.customer.phone.replace(/\D/g, "").slice(-10),
        shipping_is_billing: true,
        order_items: [{ name: r.item.name.slice(0, 200), sku: r.item.sku, units: r.item.units, selling_price: rupees(r.item.unitPricePaise) }],
        payment_method: r.cod ? "COD" : "Prepaid",
        shipping_charges: diff > 0 ? rupees(diff) : 0,
        total_discount: diff < 0 ? rupees(-diff) : 0,
        sub_total: rupees(line),
        length: this.config.box[0],
        breadth: this.config.box[1],
        height: this.config.box[2],
        weight: Math.max(0.1, r.weightGrams / 1000),
      });
      if (!created.shipment_id) throw new ApiError(502, "COURIER_BOOKING_FAILED", "Shiprocket did not create the shipment");
      carrierOrderRef = String(created.order_id);
      shipmentRef = String(created.shipment_id);
      await save({ carrierOrderRef, shipmentRef });
    }

    if (!awb) {
      const assigned = await this.call<{ awb_assign_status?: number; message?: string; response?: { data?: { awb_code?: string; courier_name?: string; awb_assign_error?: string } } }>(
        "POST",
        "/courier/assign/awb",
        { shipment_id: Number(shipmentRef) },
      );
      const data = assigned.response?.data;
      if (assigned.awb_assign_status !== 1 || !data?.awb_code) {
        throw new ApiError(502, "COURIER_AWB_FAILED", `Shiprocket could not assign a courier: ${data?.awb_assign_error ?? assigned.message ?? "no courier available"}`);
      }
      awb = data.awb_code;
      courier = data.courier_name;
      await save({ awb, courier });
    }

    // pickup and label can be retried from the Shiprocket panel, so a failure here does not undo the booking
    try {
      await this.call("POST", "/courier/generate/pickup", { shipment_id: [Number(shipmentRef)] });
    } catch (e) {
      this.logger.warn(`Pickup request for shipment ${shipmentRef} failed: ${(e as Error).message}`);
    }
    if (!labelUrl) {
      try {
        const label = await this.call<{ label_url?: string }>("POST", "/courier/generate/label", { shipment_id: [Number(shipmentRef)] });
        if (label.label_url) {
          labelUrl = label.label_url;
          await save({ labelUrl });
        }
      } catch (e) {
        this.logger.warn(`Label for shipment ${shipmentRef} failed: ${(e as Error).message}`);
      }
    }
    return { carrierOrderRef, shipmentRef, awb, courier, labelUrl };
  }

  async cancel(booking: { carrierOrderRef: string | null; awb: string | null }) {
    if (booking.carrierOrderRef) await this.call("POST", "/orders/cancel", { ids: [Number(booking.carrierOrderRef)] });
  }

  async track(awb: string): Promise<TrackingUpdate | null> {
    const res = await this.call<{ tracking_data?: { track_status?: number; shipment_track?: { current_status?: string }[] } }>("GET", `/courier/track/awb/${encodeURIComponent(awb)}`);
    const raw = res.tracking_data?.shipment_track?.[0]?.current_status;
    if (!raw) return null;
    return { awb, raw, status: courierStatus(raw) };
  }

  parseWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): TrackingUpdate | null {
    const expected = this.config.webhookToken;
    const given = String(headers[SHIPROCKET_TOKEN_HEADER] ?? "");
    if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new ApiError(401, "WEBHOOK_TOKEN_INVALID", "Webhook token does not match");
    }
    const b = (body ?? {}) as { awb?: string | number; current_status?: string; shipment_status?: string };
    const raw = b.current_status ?? b.shipment_status;
    if (!b.awb || !raw) return null;
    return { awb: String(b.awb), raw, status: courierStatus(raw) };
  }

  trackingUrl(awb: string) {
    return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
  }

  private async authToken(renew = false) {
    if (!renew && this.token && this.token.expiresAt > this.now()) return this.token.value;
    const res = await this.fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
    });
    const json = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
    if (!res.ok || !json.token) {
      this.logger.error(`Login failed with ${res.status}: ${json.message ?? ""}`);
      throw new ApiError(502, "COURIER_LOGIN_FAILED", "Could not sign in to Shiprocket. Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD");
    }
    this.token = { value: json.token, expiresAt: this.now() + TOKEN_TTL_MS };
    return json.token;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, retried = false): Promise<T> {
    const res = await this.fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.authToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // an expired or revoked token: sign in again once
    if (res.status === 401 && !retried) {
      this.token = undefined;
      return this.call<T>(method, path, body, true);
    }
    const json = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: Record<string, string[]> };
    if (!res.ok) {
      const detail = json.errors ? Object.values(json.errors).flat().join(" ") : (json.message ?? "");
      this.logger.error(`${method} ${path} failed with ${res.status}: ${detail}`);
      throw new ApiError(502, "COURIER_ERROR", `Shiprocket: ${detail || "the request failed"}`);
    }
    return json;
  }
}
