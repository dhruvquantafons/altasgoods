import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { LOGISTICS_PROVIDER, REDIS } from "../../common/tokens.js";
import type { DeliveryAreas } from "../admin/admin.schemas.js";
import { SettingsService } from "../admin/settings.service.js";
import type { CourierServiceability, LogisticsProvider } from "./shipping/provider.js";

/** How long a courier's answer for a pincode is reused. */
const CACHE_SECONDS = 12 * 3600;
/** The weight asked about when the caller does not know it. */
const DEFAULT_WEIGHT_GRAMS = 500;
/** Courier quotes are by weight slab; answers are shared within a 500 g bucket. */
const BUCKET_GRAMS = 500;

export interface ServiceabilityResult {
  serviceable: boolean;
  codAvailable: boolean;
  /** days the admin adds to the usual promise for this area */
  extraDays: number;
  /** the courier's own estimate in days, when Shiprocket answered */
  etaDays: number | null;
  source: "rules" | "rules+shiprocket";
}

export interface ServiceabilityOptions {
  /** total parcel weight; the courier's answer can depend on it */
  weightGrams?: number;
}

/** True when `entry` (a full pincode or a prefix) covers the pincode. */
const covers = (entry: string, pincode: string) => pincode.startsWith(entry);

/** The admin's rules for one pincode. Pure; the longest matching prefix sets the extra days. */
export function applyAreaRules(areas: DeliveryAreas, pincode: string) {
  const longest = areas.extraDays.filter((e) => covers(e.prefix, pincode)).reduce<{ prefix: string; days: number } | null>((best, e) => (!best || e.prefix.length > best.prefix.length ? e : best), null);
  const serviceable = !areas.blocked.some((e) => covers(e, pincode));
  return {
    serviceable,
    codAvailable: serviceable && !areas.noCod.some((e) => covers(e, pincode)),
    extraDays: longest?.days ?? 0,
  };
}

/**
 * Whether, how fast and how we can deliver to a pincode: the admin's rules,
 * and Shiprocket's own check when Shiprocket is the courier and has a pickup
 * pincode. Either can say no. A Shiprocket failure never blocks anyone: the
 * rules answer alone and the failure is logged.
 */
@Injectable()
export class ServiceabilityService {
  private readonly logger = new Logger("Serviceability");

  constructor(
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGISTICS_PROVIDER) private readonly provider: LogisticsProvider,
  ) {}

  async check(pincode: string, options: ServiceabilityOptions = {}): Promise<ServiceabilityResult> {
    const { delivery } = await this.settings.get();
    const rules = applyAreaRules(delivery.areas, pincode);
    // no need to ask the courier about a place we have already ruled out
    if (!rules.serviceable || !this.provider.serviceability) return { ...rules, etaDays: null, source: "rules" };

    const courier = await this.courier(pincode, options.weightGrams ?? DEFAULT_WEIGHT_GRAMS);
    if (!courier) return { ...rules, etaDays: null, source: "rules" };
    return {
      serviceable: rules.serviceable && courier.serviceable,
      codAvailable: rules.codAvailable && courier.serviceable && courier.codAvailable,
      extraDays: rules.extraDays,
      etaDays: courier.etaDays,
      source: "rules+shiprocket",
    };
  }

  /** The courier's answer, from cache when fresh; null when it cannot or does not answer. */
  private async courier(pincode: string, weightGrams: number): Promise<CourierServiceability | null> {
    const bucket = Math.max(1, Math.ceil(weightGrams / BUCKET_GRAMS));
    const key = `serviceability:${pincode}:${bucket}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as CourierServiceability;
    } catch (e) {
      this.logger.warn(`Cache read failed: ${(e as Error).message}`);
    }
    try {
      const answer = await this.provider.serviceability!(pincode, bucket * BUCKET_GRAMS);
      if (!answer) return null;
      await this.redis.set(key, JSON.stringify(answer), "EX", CACHE_SECONDS).catch((e: Error) => this.logger.warn(`Cache write failed: ${e.message}`));
      return answer;
    } catch (e) {
      this.logger.warn(`Courier check for ${pincode} failed, using the delivery rules alone: ${(e as Error).message}`);
      return null;
    }
  }
}
