import { timingSafeEqual } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiError } from "../../../common/errors.js";
import { fetchText, OutboundFailure, parseJson } from "../../../common/outbound.js";
import type { Booking, CourierServiceability, CourierStatus, LogisticsProvider, ShipmentRequest, TrackingUpdate } from "./provider.js";

const API = "https://apiv2.shiprocket.in/v1/external";
/** Shiprocket tokens last 10 days; renew a day early. */
const TOKEN_TTL_MS = 9 * 86_400_000;
/** Longest we wait for Shiprocket on any call. */
export const SHIPROCKET_TIMEOUT_MS = 15_000;

export const SHIPROCKET_TOKEN_HEADER = "x-api-key";

export interface ShiprocketConfig {
  email: string;
  password: string;
  pickupLocation: string;
  webhookToken?: string;
  /** where parcels leave from; without it the serviceability check is skipped */
  pickupPincode?: string;
  /** length, breadth, height in cm */
  box: [number, number, number];
  /** injectable for tests */
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
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

const NOT_FOUND = Symbol("notFound");
/** What Shiprocket's 404 says when no courier reaches the delivery pincode. */
const NO_COURIER = /no courier|not serviceable|non[- ]?serviceable|unserviceable|not available for (this )?pincode/i;

interface ShiprocketCourier {
  estimated_delivery_days?: string | number;
  etd?: string;
  cod?: number | string;
}

/** A courier's estimate in days: its own number, else the days until its etd date. */
function courierDays(c: ShiprocketCourier, nowMs: number): number | null {
  const n = Number(c.estimated_delivery_days);
  if (c.estimated_delivery_days !== undefined && c.estimated_delivery_days !== "" && Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const at = c.etd ? Date.parse(c.etd) : NaN;
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - nowMs) / 86_400_000));
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
  get pickupPincode() {
    return this.config.pickupPincode;
  }
  private readonly logger = new Logger("Shiprocket");
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: ShiprocketConfig) {
    this.fetch = config.fetch ?? fetch;
    this.now = config.now ?? Date.now;
    this.timeoutMs = config.timeoutMs ?? SHIPROCKET_TIMEOUT_MS;
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

  /**
   * Whether Shiprocket's couriers reach a pincode from the pickup pincode, whether
   * any takes cash on delivery, and the fastest courier's estimate in days.
   * Null when no pickup pincode is configured. Throws when Shiprocket fails;
   * the caller decides what that means.
   * Fields read: data.available_courier_companies[].estimated_delivery_days (or
   * the date in etd) and .cod (1 when the courier takes cash on delivery). The
   * list is empty, or Shiprocket answers 404, when nothing serves the pincode.
   */
  async serviceability(deliveryPincode: string, weightGrams: number): Promise<CourierServiceability | null> {
    if (!this.config.pickupPincode) return null;
    const weight = Math.max(0.1, Math.round(weightGrams / 100) / 10);
    const query = new URLSearchParams({ pickup_postcode: this.config.pickupPincode, delivery_postcode: deliveryPincode, weight: String(weight), cod: "0" });
    const res = await this.call<{ [NOT_FOUND]?: boolean; message?: string; data?: { available_courier_companies?: unknown } }>("GET", `/courier/serviceability/?${query}`, undefined, false, true);
    const none: CourierServiceability = { serviceable: false, codAvailable: false, etaDays: null };
    // only a positive answer counts as "not serviceable"; anything unrecognised throws so the caller falls back
    if (res[NOT_FOUND]) {
      if (NO_COURIER.test(res.message ?? "") && !/pickup/i.test(res.message ?? "")) return none;
      throw new ApiError(502, "COURIER_ERROR", `Shiprocket: unrecognised serviceability answer (404: ${res.message ?? "no message"})`);
    }
    const list = res.data?.available_courier_companies;
    if (!Array.isArray(list)) throw new ApiError(502, "COURIER_ERROR", "Shiprocket: unrecognised serviceability answer");
    if (!list.length) return none;
    const couriers = list as ShiprocketCourier[];
    const days = couriers.map((c) => courierDays(c, this.now())).filter((d): d is number => d !== null);
    return {
      serviceable: true,
      // a courier that does not say either way is not taken as a refusal
      codAvailable: couriers.some((c) => c.cod === undefined || Number(c.cod) === 1),
      etaDays: days.length ? Math.min(...days) : null,
    };
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
    const { res, text } = await this.send("POST /auth/login", `${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
    });
    const json = parseJson<{ token?: string; message?: string }>(text);
    if (!res.ok || !json.token) {
      this.logger.error(`Login failed with ${res.status}: ${json.message ?? ""}`);
      throw new ApiError(502, "COURIER_LOGIN_FAILED", "Could not sign in to Shiprocket. Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD");
    }
    this.token = { value: json.token, expiresAt: this.now() + TOKEN_TTL_MS };
    return json.token;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, retried = false, notFoundIsAnswer = false): Promise<T> {
    const { res, text } = await this.send(`${method} ${path}`, `${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.authToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // an expired or revoked token: sign in again once
    if (res.status === 401 && !retried) {
      this.token = undefined;
      return this.call<T>(method, path, body, true, notFoundIsAnswer);
    }
    const json = parseJson<T & { message?: string; errors?: Record<string, string[]> }>(text);
    if (res.status === 404 && notFoundIsAnswer) return { ...json, [NOT_FOUND]: true };
    if (!res.ok) {
      const detail = json.errors ? Object.values(json.errors).flat().join(" ") : (json.message ?? "");
      this.logger.error(`${method} ${path} failed with ${res.status}: ${detail}`);
      throw new ApiError(502, "COURIER_ERROR", `Shiprocket: ${detail || "the request failed"}`);
    }
    return json;
  }

  /** One bounded request; a timeout is a 504, a network failure a 502. */
  private async send(what: string, url: string, init: RequestInit) {
    try {
      return await fetchText(this.fetch, url, init, this.timeoutMs);
    } catch (e) {
      if (!(e instanceof OutboundFailure)) throw e;
      this.logger.error(`${what} ${e.message}`);
      if (e.timedOut) throw new ApiError(504, "COURIER_TIMEOUT", "Shiprocket took too long to answer. Please try again.");
      throw new ApiError(502, "COURIER_ERROR", "Shiprocket could not be reached");
    }
  }
}
