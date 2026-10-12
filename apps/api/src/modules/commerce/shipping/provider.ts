import type { OrderItemStatus } from "../../../db/schema.js";

/** Item statuses a courier's scans can move a line to. */
export type CourierStatus = Extract<OrderItemStatus, "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO_IN_TRANSIT" | "RTO_RECEIVED" | "LOST">;

export interface ShipmentRequest {
  /** our unique reference for this parcel; one order line ships as one parcel */
  reference: string;
  placedAt: Date;
  customer: { name: string; phone: string; email: string | null };
  address: { line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string };
  item: { name: string; sku: string; units: number; unitPricePaise: number };
  /** what the customer owes for this parcel, after its coupon share and any delivery fee */
  amountPaise: number;
  cod: boolean;
  weightGrams: number;
}

/** What booking returns. Each step's ids are saved as soon as they exist, so a retry resumes. */
export interface Booking {
  carrierOrderRef?: string;
  shipmentRef?: string;
  awb?: string;
  courier?: string;
  labelUrl?: string;
}

export interface TrackingUpdate {
  awb: string;
  /** the courier's status word for word, for the timeline */
  raw: string;
  /** where that status moves the line, or null when it does not (pickup scheduled, NDR and so on) */
  status: CourierStatus | null;
}

/**
 * Courier boundary. The simulated courier and Shiprocket implement it; the
 * rest of the API never talks to a courier directly.
 */
export interface LogisticsProvider {
  readonly name: "SIMULATED" | "SHIPROCKET";
  /**
   * Books the parcel, resuming from whatever the earlier attempt saved:
   * creates the courier order, assigns an AWB, schedules pickup, makes the label.
   * `save` is called after each step so nothing is booked twice.
   */
  book(request: ShipmentRequest, done: Booking, save: (step: Booking) => Promise<void>): Promise<Booking & { awb: string }>;
  cancel(booking: { carrierOrderRef: string | null; awb: string | null }): Promise<void>;
  /** The latest scan for an AWB, or null when the courier has none yet. */
  track(awb: string): Promise<TrackingUpdate | null>;
  /** Verifies and parses a tracking webhook. Throws on a bad token; null for events we do not act on. */
  parseWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): TrackingUpdate | null;
  /** A page where the customer can follow the parcel. */
  trackingUrl(awb: string): string | null;
}
