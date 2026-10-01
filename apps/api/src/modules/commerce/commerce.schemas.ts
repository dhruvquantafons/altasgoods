import { z } from "zod";
import { pageQuery, paginated } from "../../common/http.js";
import { ORDER_ITEM_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "../../db/schema.js";
import { normalizePhone } from "../auth/phone.js";

/* -------------------------------- Addresses ------------------------------ */

export const addressBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10 digit mobile number" }), z.NEVER)),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6 digit pincode"),
  type: z.enum(["HOME", "WORK", "OTHER"]).default("HOME"),
  isDefault: z.boolean().default(false),
});
export const addressPatch = addressBody.partial();
export const addressSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  landmark: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  type: z.enum(["HOME", "WORK", "OTHER"]),
  isDefault: z.boolean(),
});

/* ---------------------------------- Cart --------------------------------- */

export const cartLineInput = z.object({
  offerId: z.uuid(),
  variant: z.string().max(80).default(""),
  qty: z.number().int().min(1).max(10),
  savedForLater: z.boolean().default(false),
});
export const putCartBody = z.object({ lines: z.array(cartLineInput).max(50) });
export const addCartItemBody = cartLineInput.omit({ savedForLater: true });
export const patchCartItemBody = z.object({ qty: z.number().int().min(1).max(10).optional(), savedForLater: z.boolean().optional() });

const sellerMini = z.object({ id: z.string(), slug: z.string(), displayName: z.string() });

export const cartLineSchema = z.object({
  id: z.uuid(),
  offerId: z.uuid(),
  productId: z.string(),
  slug: z.string(),
  title: z.string(),
  image: z.string(),
  variant: z.string(),
  qty: z.number().int(),
  savedForLater: z.boolean(),
  seller: sellerMini,
  pricePaise: z.number().int(),
  mrpPaise: z.number().int(),
  inStock: z.boolean(),
  availableQty: z.number().int(),
  deliveryDays: z.number().int(),
  codAvailable: z.boolean(),
});
export const cartSchema = z.object({
  lines: z.array(cartLineSchema),
  summary: z.object({ itemCount: z.number().int(), mrpTotalPaise: z.number().int(), subtotalPaise: z.number().int(), savingsPaise: z.number().int() }),
});

/* -------------------------------- Checkout ------------------------------- */

export const quoteBody = z.object({
  addressId: z.uuid(),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  lines: z.array(cartLineInput.omit({ savedForLater: true })).max(50).optional().describe("Buy now lines; defaults to the cart"),
});

export const quoteLineSchema = z.object({
  offerId: z.uuid(),
  productId: z.string(),
  slug: z.string(),
  title: z.string(),
  image: z.string(),
  variant: z.string(),
  qty: z.number().int(),
  unitPricePaise: z.number().int(),
  mrpPaise: z.number().int(),
  lineTotalPaise: z.number().int(),
});

export const quoteSchema = z.object({
  shipments: z.array(
    z.object({
      seller: sellerMini,
      fulfilledBy: z.enum(["BLUBUY", "SELLER"]),
      lines: z.array(quoteLineSchema),
      subtotalPaise: z.number().int(),
      deliveryFeePaise: z.number().int(),
      promisedBy: z.iso.datetime(),
    }),
  ),
  mrpTotalPaise: z.number().int(),
  subtotalPaise: z.number().int(),
  couponDiscountPaise: z.number().int(),
  coupon: z.object({ code: z.string(), applied: z.boolean(), message: z.string() }).nullable(),
  deliveryFeePaise: z.number().int(),
  totalPaise: z.number().int(),
  savingsPaise: z.number().int(),
  cod: z.object({ available: z.boolean(), reason: z.string().nullable() }),
  issues: z.array(z.object({ offerId: z.uuid(), code: z.string(), message: z.string() })),
  canPlaceOrder: z.boolean(),
});

export const placeOrderBody = quoteBody.extend({ paymentMethod: z.enum(PAYMENT_METHODS) });

/* --------------------------------- Orders -------------------------------- */

export const orderItemSchema = z.object({
  id: z.uuid(),
  productId: z.string(),
  title: z.string(),
  image: z.string(),
  variant: z.string(),
  qty: z.number().int(),
  unitPricePaise: z.number().int(),
  mrpPaise: z.number().int(),
  status: z.enum(ORDER_ITEM_STATUSES),
  seller: sellerMini,
  promisedBy: z.iso.datetime(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  awb: z.string().nullable(),
  canCancel: z.boolean(),
});

export const orderEventSchema = z.object({
  orderItemId: z.uuid().nullable(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actor: z.string(),
  note: z.string().nullable(),
  at: z.iso.datetime(),
});

export const paymentSummary = z.object({
  id: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  amountPaise: z.number().int(),
});

export const orderSchema = z.object({
  id: z.string(),
  status: z.enum(ORDER_STATUSES),
  placedAt: z.iso.datetime(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentDueBy: z.iso.datetime().nullable(),
  address: z.object({ name: z.string(), phone: z.string(), line1: z.string(), line2: z.string().nullable().optional(), landmark: z.string().nullable().optional(), city: z.string(), state: z.string(), pincode: z.string(), type: z.string() }),
  mrpTotalPaise: z.number().int(),
  subtotalPaise: z.number().int(),
  couponCode: z.string().nullable(),
  couponDiscountPaise: z.number().int(),
  deliveryFeePaise: z.number().int(),
  totalPaise: z.number().int(),
  items: z.array(orderItemSchema),
  payments: z.array(paymentSummary),
  refunds: z.array(z.object({ id: z.uuid(), amountPaise: z.number().int(), status: z.string(), reason: z.string(), createdAt: z.iso.datetime() })),
  events: z.array(orderEventSchema),
});

export const nextActionSchema = z.object({ type: z.literal("REDIRECT"), url: z.string() }).nullable();
export const placeOrderResponse = z.object({ order: orderSchema, payment: paymentSummary.extend({ nextAction: nextActionSchema }) });

export const orderSummarySchema = z.object({
  id: z.string(),
  status: z.enum(ORDER_STATUSES),
  placedAt: z.iso.datetime(),
  totalPaise: z.number().int(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  itemCount: z.number().int(),
  items: z.array(orderItemSchema.pick({ id: true, productId: true, title: true, image: true, status: true, qty: true, promisedBy: true, deliveredAt: true })),
});
export const orderListQuery = z.object({ status: z.enum(["all", "open", "delivered", "cancelled"]).default("all"), ...pageQuery, pageSize: pageQuery.pageSize.default(10) });
export const orderList = paginated(orderSummarySchema);

export const cancelBody = z.object({ itemIds: z.array(z.uuid()).optional().describe("Defaults to every cancellable item"), reason: z.string().trim().min(3).max(200) });

/* -------------------------------- Payments ------------------------------- */

export const sandboxCompleteBody = z.object({ outcome: z.enum(["SUCCESS", "FAILURE"]) });
export const paymentDetailSchema = paymentSummary.extend({ orderId: z.string(), provider: z.string(), failureReason: z.string().nullable(), orderStatus: z.enum(ORDER_STATUSES) });

/* ------------------------------ Seller orders ----------------------------- */

export const sellerItemsQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((s): s is (typeof ORDER_ITEM_STATUSES)[number] => (ORDER_ITEM_STATUSES as readonly string[]).includes(s)) : [])),
  q: z.string().trim().max(60).optional(),
  ...pageQuery,
});

export const sellerItemSchema = z.object({
  id: z.uuid(),
  orderId: z.string(),
  placedAt: z.iso.datetime(),
  productId: z.string(),
  title: z.string(),
  image: z.string(),
  variant: z.string(),
  qty: z.number().int(),
  unitPricePaise: z.number().int(),
  status: z.enum(ORDER_ITEM_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  shipTo: z.object({ name: z.string(), city: z.string(), pincode: z.string() }),
  dispatchBy: z.iso.datetime().nullable(),
  promisedBy: z.iso.datetime(),
  awb: z.string().nullable(),
  netSettlementPaise: z.number().int().nullable(),
});
export const sellerItemList = paginated(sellerItemSchema).extend({ counts: z.record(z.string(), z.number().int()) });

export const sellerOrderSchema = z.object({
  id: z.string(),
  placedAt: z.iso.datetime(),
  status: z.enum(ORDER_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  shipTo: z.object({ name: z.string(), city: z.string(), state: z.string(), pincode: z.string() }),
  items: z.array(
    sellerItemSchema.omit({ orderId: true, placedAt: true, paymentMethod: true, shipTo: true }).extend({
      fees: z.array(z.object({ code: z.string(), label: z.string(), amountPaise: z.number().int() })).nullable(),
      allowedActions: z.array(z.enum(ORDER_ITEM_STATUSES)),
    }),
  ),
  events: z.array(orderEventSchema),
});

export const transitionBody = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
  to: z.enum(["ACCEPTED", "PACKED", "READY_TO_SHIP", "CANCELLED"]),
  reason: z.string().trim().min(3).max(200).optional(),
});
export const transitionResult = z.object({ results: z.array(z.object({ id: z.uuid(), ok: z.boolean(), status: z.enum(ORDER_ITEM_STATUSES).nullable(), error: z.string().nullable() })) });

export const devAdvanceBody = z.object({ orderItemId: z.uuid(), to: z.enum(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_IN_TRANSIT", "RTO_RECEIVED"]) });
