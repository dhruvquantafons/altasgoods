import { z } from "zod";
import { pageQuery, paginated } from "../../common/http.js";
import { ORDER_ITEM_STATUSES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, REFUND_METHODS, REFUND_STATUSES } from "../../db/schema.js";
import { normalizePhone } from "../auth/phone.js";

/* -------------------------------- Addresses ------------------------------ */

export const addressBody = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10 digit mobile number" }), z.NEVER)),
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
/** An order's delivery address, as staff correct it: the same fields and checks as a saved address. */
export const orderAddressBody = addressBody.omit({ isDefault: true });
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

export const wishlistSchema = z.object({ productIds: z.array(z.string()).describe("Newest first") });
export const putWishlistBody = z.object({ productIds: z.array(z.string().min(1).max(100)).max(200) });

/* -------------------------------- Checkout ------------------------------- */

export const quoteBody = z.object({
  addressId: z.uuid(),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  lines: z
    .array(cartLineInput.omit({ savedForLater: true }))
    .max(50)
    .optional()
    .describe("Buy now lines; defaults to the cart"),
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
  lines: z.array(quoteLineSchema),
  /** one shipment from the store, promised by the slowest line */
  promisedBy: z.iso.datetime(),
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

export const pincodeParam = z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6 digit pincode");
export const pincodeCheckSchema = z.object({
  pincode: z.string(),
  serviceable: z.boolean(),
  codAvailable: z.boolean(),
  extraDays: z.number().int().describe("Days the store adds to the usual delivery promise here"),
  etaDays: z.number().int().nullable().describe("The courier's estimate in days, when it gave one"),
  source: z.enum(["rules", "rules+shiprocket"]),
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
  gstRateBp: z.number().int().describe("GST rate the line was sold at, in basis points"),
  taxPaise: z.number().int().describe("The GST included in the line's price, after its share of any coupon"),
  status: z.enum(ORDER_ITEM_STATUSES),
  promisedBy: z.iso.datetime(),
  shippedAt: z.iso.datetime().nullable(),
  deliveredAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  awb: z.string().nullable(),
  courier: z.string().nullable(),
  /** the courier's tracking page, when a real courier carries the parcel */
  trackingUrl: z.string().nullable(),
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
  address: z.object({
    name: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().nullable().optional(),
    landmark: z.string().nullable().optional(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    type: z.string(),
  }),
  mrpTotalPaise: z.number().int(),
  subtotalPaise: z.number().int(),
  couponCode: z.string().nullable(),
  couponDiscountPaise: z.number().int(),
  deliveryFeePaise: z.number().int(),
  totalPaise: z.number().int(),
  gstIncludedPaise: z.number().int().describe("GST included in the prices of the lines that are not cancelled; the delivery fee carries none"),
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
export const orderListQuery = z.object({
  status: z.enum(["all", "open", "delivered", "cancelled"]).default("all"),
  ...pageQuery,
  pageSize: pageQuery.pageSize.default(10),
});
export const orderList = paginated(orderSummarySchema);

export const cancelBody = z.object({
  itemIds: z.array(z.uuid()).optional().describe("Defaults to every cancellable item"),
  reason: z.string().trim().min(3).max(200),
});

/* -------------------------------- Payments ------------------------------- */

export const sandboxCompleteBody = z.object({ outcome: z.enum(["SUCCESS", "FAILURE"]) });
export const paymentDetailSchema = paymentSummary.extend({
  orderId: z.string(),
  provider: z.string(),
  failureReason: z.string().nullable(),
  orderStatus: z.enum(ORDER_STATUSES),
  sessionOpen: z.boolean().describe("False when the gateway could not open this payment; start a new attempt with POST /v1/me/orders/{id}/payments"),
  checkout: z
    .object({ gateway: z.literal("RAZORPAY"), keyId: z.string(), orderRef: z.string(), currency: z.literal("INR") })
    .nullable()
    .describe("Set when the customer pays in the gateway's own checkout"),
});
export { razorpayConfirmBody as confirmPaymentBody } from "./payments/razorpay.provider.js";

/* ------------------------------- Fulfilment ------------------------------- */

export const fulfilmentItemsQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter((s): s is (typeof ORDER_ITEM_STATUSES)[number] => (ORDER_ITEM_STATUSES as readonly string[]).includes(s)) : [])),
  q: z.string().trim().max(60).optional(),
  ...pageQuery,
});

export const fulfilmentItemSchema = z.object({
  id: z.uuid(),
  orderId: z.string(),
  placedAt: z.iso.datetime(),
  productId: z.string(),
  title: z.string(),
  image: z.string(),
  variant: z.string(),
  qty: z.number().int(),
  unitPricePaise: z.number().int(),
  gstRateBp: z.number().int(),
  hsn: z.string().nullable(),
  taxPaise: z.number().int(),
  status: z.enum(ORDER_ITEM_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  shipTo: z.object({ name: z.string(), city: z.string(), pincode: z.string() }),
  dispatchBy: z.iso.datetime().nullable(),
  promisedBy: z.iso.datetime(),
  awb: z.string().nullable(),
  courier: z.string().nullable(),
  /** the courier's shipping label to print and stick on the parcel */
  labelUrl: z.string().nullable(),
  /** the courier's latest status, word for word */
  trackingStatus: z.string().nullable(),
  trackedAt: z.iso.datetime().nullable(),
  trackingUrl: z.string().nullable(),
  /** true while scans are driven by hand (development); false once a real courier carries it */
  simulated: z.boolean(),
});
export const fulfilmentItemList = paginated(fulfilmentItemSchema).extend({ counts: z.record(z.string(), z.number().int()) });

export const adminRefundSchema = z.object({
  id: z.uuid(),
  orderId: z.string(),
  orderItemId: z.uuid().nullable(),
  amountPaise: z.number().int(),
  status: z.enum(REFUND_STATUSES),
  method: z.enum(REFUND_METHODS),
  reason: z.string(),
  reference: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const fulfilmentOrderSchema = z.object({
  id: z.string(),
  placedAt: z.iso.datetime(),
  status: z.enum(ORDER_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  totalPaise: z.number().int(),
  gstIncludedPaise: z.number().int().describe("GST included in the prices of the lines that are not cancelled"),
  shipTo: z.object({ name: z.string(), city: z.string(), state: z.string(), pincode: z.string() }),
  /** the full delivery address and phone for the shipping label */
  address: z.object({
    name: z.string(),
    phone: z.string(),
    line1: z.string(),
    line2: z.string().nullable(),
    landmark: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
    type: z.string().describe("HOME, WORK or OTHER"),
  }),
  items: z.array(
    fulfilmentItemSchema.omit({ orderId: true, placedAt: true, paymentMethod: true, shipTo: true }).extend({
      allowedActions: z.array(z.enum(ORDER_ITEM_STATUSES)),
    }),
  ),
  events: z.array(orderEventSchema),
  /** true while no line is ready to ship and none has an AWB */
  addressEditable: z.boolean(),
  /** every refund on the order, with its true status */
  refunds: z.array(adminRefundSchema),
  /** what a new refund may be: SOURCE needs a captured online payment; maxPaise is the cap for either method */
  refundLimit: z.object({ source: z.boolean(), maxPaise: z.number().int() }),
});

export const transitionBody = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
  to: z.enum(["ACCEPTED", "PACKED", "READY_TO_SHIP", "CANCELLED", "LOST", "RTO_RECEIVED"]),
  reason: z.string().trim().min(3).max(500).optional().describe("Required to cancel, mark lost (LOST) or record a parcel back at the store (RTO_RECEIVED)"),
});
export const adminRefundBody = z.object({
  amountPaise: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().min(3).max(500).describe("Why, for the team; the customer sees \"Refund from AltasGoods\""),
  method: z.enum(REFUND_METHODS).describe("SOURCE goes back through the gateway; MANUAL records money the store already sent by UPI or bank transfer"),
  reference: z
    .string()
    .trim()
    .min(4)
    .max(60)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ./_-]*$/, "Use the UTR or UPI reference as the bank shows it")
    .optional()
    .describe("Required for MANUAL: the UTR or UPI reference of the payout"),
  orderItemId: z.uuid().optional().describe("The line it is for, if any"),
  note: z.string().trim().max(500).optional().describe("Staff-only remark"),
});
export const markPaidBody = z.object({
  reference: adminRefundBody.shape.reference.unwrap().describe("The UTR or UPI reference of the payout"),
  note: z.string().trim().max(500).optional(),
});


export const orderNoteBody = z.object({ body: z.string().trim().min(1).max(2000) });
export const orderNoteSchema = z.object({ id: z.uuid(), authorId: z.uuid().nullable(), authorName: z.string(), body: z.string(), createdAt: z.iso.datetime() });

export const transitionResult = z.object({
  results: z.array(z.object({ id: z.uuid(), ok: z.boolean(), status: z.enum(ORDER_ITEM_STATUSES).nullable(), error: z.string().nullable() })),
});

export const logisticsStatusSchema = z.object({
  provider: z.enum(["SIMULATED", "SHIPROCKET"]).describe("Who ships orders right now"),
  /** what is set up for Shiprocket, so staff can see what is still missing */
  shiprocket: z.object({ credentials: z.boolean(), pickupLocation: z.boolean(), webhookToken: z.boolean() }),
  webhookPath: z.string().describe("Path of the tracking webhook to give the courier, after the API's address"),
});

export const trackingRefreshResult = z.object({ id: z.uuid(), status: z.enum(ORDER_ITEM_STATUSES), trackingStatus: z.string().nullable() });

export const devAdvanceBody = z.object({
  orderItemId: z.uuid(),
  to: z.enum(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_IN_TRANSIT", "RTO_RECEIVED"]),
  /** with DELIVERED: dates the delivery this many days back, to exercise return windows */
  deliveredDaysAgo: z.number().int().min(1).max(120).optional(),
});

/* ------------------------------ Admin insights ------------------------------ */

const money = z.object({ orders: z.number().int(), revenuePaise: z.number().int() });

export const adminOverviewSchema = z.object({
  today: money.describe("Since midnight IST"),
  last7Days: money,
  last30Days: money,
  averageOrderPaise: z.number().int().describe("Over the last 30 days"),
  work: z.object({
    toAccept: z.number().int(),
    toPack: z.number().int(),
    toHandOver: z.number().int(),
    returnsWaiting: z.number().int(),
    refundsPending: z.number().int(),
    refundsPendingPaise: z.number().int(),
    refundsNeedAttention: z.number().int().describe("Refunds the gateway could not confirm; check the gateway, then retry"),
  }),
  series: z.array(z.object({ date: z.string(), orders: z.number().int(), revenuePaise: z.number().int() })).describe("The last 14 days, oldest first"),
  topProducts: z.array(z.object({ productId: z.string(), title: z.string(), image: z.string(), units: z.number().int(), revenuePaise: z.number().int() })),
  latestOrders: z.array(
    z.object({
      id: z.string(),
      placedAt: z.iso.datetime(),
      status: z.enum(ORDER_STATUSES),
      totalPaise: z.number().int(),
      paymentMethod: z.enum(PAYMENT_METHODS),
      customerName: z.string(),
    }),
  ),
  lowStock: z.array(z.object({ productId: z.string(), title: z.string(), image: z.string().nullable(), stock: z.number().int() })),
});

const customerRef = z.object({ id: z.uuid(), name: z.string().nullable(), email: z.string() });

export const adminPaymentsQuery = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  provider: z.enum(["SANDBOX", "RAZORPAY", "COD"]).optional(),
  q: z.string().trim().max(80).optional().describe("Order ID, gateway reference or customer email"),
  ...pageQuery,
});

export const adminPaymentList = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      orderId: z.string(),
      provider: z.enum(["SANDBOX", "RAZORPAY", "COD"]),
      method: z.enum(PAYMENT_METHODS),
      amountPaise: z.number().int(),
      status: z.enum(PAYMENT_STATUSES),
      providerRef: z.string().nullable(),
      failureReason: z.string().nullable(),
      capturedAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
      customer: customerRef,
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  summary: z.object({
    capturedTodayCount: z.number().int(),
    capturedTodayPaise: z.number().int(),
    failedLast24h: z.number().int(),
    refundsPendingCount: z.number().int(),
    refundsPendingPaise: z.number().int(),
  }),
});

export const adminRefundsQuery = z.object({
  status: z.enum(REFUND_STATUSES).optional(),
  q: z.string().trim().max(80).optional().describe("Order ID or customer email"),
  ...pageQuery,
});

export const adminRefundList = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      orderId: z.string(),
      amountPaise: z.number().int(),
      status: z.enum(REFUND_STATUSES),
      reason: z.string(),
      method: z.enum(PAYMENT_METHODS).describe("How the customer paid"),
      refundMethod: z.enum(REFUND_METHODS).describe("SOURCE: through the gateway. MANUAL: paid by the store, PENDING until marked paid"),
      reference: z.string().nullable().describe("The payout's UTR or UPI reference, for a MANUAL refund"),
      provider: z.enum(["SANDBOX", "RAZORPAY", "COD"]),
      providerRef: z.string().nullable(),
      createdAt: z.iso.datetime(),
      completedAt: z.iso.datetime().nullable(),
      customer: customerRef,
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
