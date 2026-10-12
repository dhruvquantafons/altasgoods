import { randomInt } from "node:crypto";
import { ApiError } from "../../../common/errors.js";
import type { LogisticsProvider } from "./provider.js";

/**
 * Stands in for a courier until one is connected: booking hands out an AWB at
 * once, and scans are driven by hand from the admin panel in development.
 */
export class SimulatedLogisticsProvider implements LogisticsProvider {
  readonly name = "SIMULATED" as const;

  async book() {
    return { awb: `BBL${randomInt(1_000_000_000, 9_999_999_999)}`, courier: "AltasGoods Logistics" };
  }

  async cancel() {}

  async track() {
    return null;
  }

  parseWebhook(): never {
    throw new ApiError(404, "NOT_FOUND", "No courier is connected");
  }

  trackingUrl() {
    return null;
  }
}
