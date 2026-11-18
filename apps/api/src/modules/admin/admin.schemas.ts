import { z } from "zod";
import { gstRateBpSchema, hsnSchema } from "../catalog/gst.js";

const rupeesInPaise = z.number().int().min(0).max(100_000_000);

/** A full 6 digit pincode, or the first 2 to 5 digits of a group of them. */
const areaEntry = z.string().regex(/^\d{2,6}$/, "Use a 6 digit pincode or a 2 to 5 digit prefix");

/** Where the store does not deliver, does not take cash on delivery, or is slower. */
export const deliveryAreasSchema = z.object({
  blocked: z.array(areaEntry).max(500).describe("Pincodes and prefixes we do not deliver to"),
  noCod: z.array(areaEntry).max(500).describe("Pincodes and prefixes where cash on delivery is off"),
  extraDays: z
    .array(z.object({ prefix: areaEntry, days: z.number().int().min(0).max(15) }))
    .max(500)
    .describe("Extra days added to the delivery promise; the longest matching prefix wins"),
});
export type DeliveryAreas = z.infer<typeof deliveryAreasSchema>;
const NO_AREA_RULES: DeliveryAreas = { blocked: [], noCod: [], extraDays: [] };

/** Store-wide settings. Defaults are what the store ran with before settings existed. */
export const settingsSchema = z.object({
  delivery: z.object({
    feePaise: rupeesInPaise.describe("Delivery fee for orders below the free delivery threshold"),
    freeFromPaise: rupeesInPaise.describe("Orders at or above this subtotal ship free"),
    areas: deliveryAreasSchema.default(NO_AREA_RULES),
  }),
  cod: z.object({
    enabled: z.boolean().describe("Off stops cash on delivery for every order"),
    maxOrderPaise: rupeesInPaise.describe("Largest order total that can be paid by cash on delivery"),
  }),
  tax: z.object({
    defaultGstRateBp: gstRateBpSchema.describe("GST rate in basis points for products whose category and own settings have none"),
    defaultHsn: hsnSchema.nullable().describe("HSN code for products whose category and own settings have none"),
  }),
  reviews: z.object({ autoPublish: z.boolean().describe("Publish customer reviews straight away; otherwise they wait for approval") }),
  notice: z.object({
    enabled: z.boolean(),
    message: z.string().trim().max(200).describe("Shown in a bar at the top of every storefront page while enabled"),
  }),
  company: z.object({
    legalName: z.string().trim().min(2).max(120),
    cin: z.string().trim().max(40),
    gstin: z.string().trim().max(20),
    registeredOffice: z.string().trim().max(300),
    customerCare: z.string().trim().max(40),
    customerCareHours: z.string().trim().max(80),
    email: z.email().max(120),
    website: z.string().trim().max(120),
  }),
  grievance: z.object({
    name: z.string().trim().min(2).max(80),
    designation: z.string().trim().max(120),
    email: z.email().max(120),
    phone: z.string().trim().max(40),
    hours: z.string().trim().max(80),
    address: z.string().trim().max(300),
    ackHours: z.number().int().min(1).max(720),
    resolutionDays: z.number().int().min(1).max(90),
  }),
});
export type StoreSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: StoreSettings = {
  delivery: { feePaise: 4_000, freeFromPaise: 49_900, areas: NO_AREA_RULES },
  cod: { enabled: true, maxOrderPaise: 5_000_000 },
  tax: { defaultGstRateBp: 1800, defaultHsn: null },
  reviews: { autoPublish: true },
  notice: { enabled: false, message: "" },
  company: {
    legalName: "AltasGoods Commerce Private Limited",
    cin: "U47912KA2025PTC204817",
    gstin: "29AALCB4821Q1Z6",
    registeredOffice: "Level 9, Lakeview Square, 14 Residency Road, Ashok Nagar, Bengaluru, Karnataka 560025",
    customerCare: "1800 210 4455",
    customerCareHours: "8 am to 10 pm, every day",
    email: "care@altasgoods.in",
    website: "www.altasgoods.in",
  },
  grievance: {
    name: "Meenakshi Raghavan",
    designation: "Grievance Officer, AltasGoods Commerce Private Limited",
    email: "grievance.officer@altasgoods.in",
    phone: "+91 80 4718 2200",
    hours: "Monday to Saturday, 9:30 am to 6:30 pm",
    address: "Level 9, Lakeview Square, 14 Residency Road, Bengaluru, Karnataka 560025",
    ackHours: 48,
    resolutionDays: 30,
  },
};

/** What the storefront may read: everything except internal switches. */
export const storefrontSettingsSchema = settingsSchema
  .pick({ delivery: true, cod: true, notice: true, company: true, grievance: true })
  // the pincode rules are answered by the pincode check, not published
  .extend({ delivery: settingsSchema.shape.delivery.pick({ feePaise: true, freeFromPaise: true }) });

export const settingsResponse = settingsSchema.extend({ updatedAt: z.iso.datetime().nullable(), updatedBy: z.string().nullable() });

export const auditQuery = z.object({
  q: z.string().trim().max(80).optional().describe("Searches the summary"),
  action: z.string().trim().max(60).optional().describe("An action or a prefix, for example product or sale.create"),
  entityType: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(80).optional(),
  actorId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const auditEventSchema = z.object({
  id: z.number().int(),
  actorId: z.uuid().nullable(),
  actorName: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  summary: z.string(),
  changes: z.record(z.string(), z.tuple([z.unknown(), z.unknown()])).nullable(),
  createdAt: z.iso.datetime(),
});

export const auditList = z.object({
  items: z.array(auditEventSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  actors: z.array(z.object({ id: z.uuid(), name: z.string() })).describe("Everyone in the log, for the filter"),
});
