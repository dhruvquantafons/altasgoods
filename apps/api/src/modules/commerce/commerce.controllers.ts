import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Redis } from "ioredis";
import { z } from "zod";
import { forbidden } from "../../common/errors.js";
import { REDIS } from "../../common/tokens.js";
import { env, isProduction } from "../../config/env.js";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import { WishlistService } from "./wishlist.service.js";
import * as s from "./commerce.schemas.js";
import { OrdersService } from "./orders.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { FulfilmentService } from "./fulfilment.service.js";
import { DevLogisticsService } from "./dev-logistics.service.js";
import { ServiceabilityService } from "./serviceability.service.js";
import { ShippingService } from "./shipping/shipping.service.js";
import { AuditService, diff } from "../admin/audit.service.js";
import { rupees } from "../../common/money.js";
import { AdminInsightsService } from "./admin-insights.service.js";
import { ADDRESS_FIELDS, OrderAdminService } from "./order-admin.service.js";

const uuidParam = { schema: z.uuid() };

@ApiTags("Addresses")
@ApiBearerAuth()
@Controller("v1/me/addresses")
export class AddressesController {
  constructor(@Inject(AddressesService) private readonly svc: AddressesService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: z.array(s.addressSchema) })
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @Post()
  @ApiResponse({ status: 201, standardSchema: s.addressSchema })
  create(@CurrentUser() u: AuthUser, @Body({ schema: s.addressBody }) body: z.infer<typeof s.addressBody>) {
    return this.svc.create(u.id, body);
  }

  @Patch(":id")
  @ApiResponse({ status: 200, standardSchema: s.addressSchema })
  update(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.addressPatch }) body: z.infer<typeof s.addressPatch>) {
    return this.svc.update(u.id, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    await this.svc.remove(u.id, id);
  }
}

@ApiTags("Wishlist")
@ApiBearerAuth()
@Controller("v1/me/wishlist")
export class WishlistController {
  constructor(@Inject(WishlistService) private readonly svc: WishlistService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.wishlistSchema })
  get(@CurrentUser() u: AuthUser) {
    return this.svc.get(u.id);
  }

  @Put()
  @ApiResponse({ status: 200, standardSchema: s.wishlistSchema })
  replace(@CurrentUser() u: AuthUser, @Body({ schema: s.putWishlistBody }) body: z.infer<typeof s.putWishlistBody>) {
    return this.svc.replace(u.id, body.productIds);
  }
}

@ApiTags("Cart")
@ApiBearerAuth()
@Controller("v1/cart")
export class CartController {
  constructor(@Inject(CartService) private readonly svc: CartService) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  get(@CurrentUser() u: AuthUser) {
    return this.svc.get(u.id);
  }

  @Put()
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  replace(@CurrentUser() u: AuthUser, @Body({ schema: s.putCartBody }) body: z.infer<typeof s.putCartBody>) {
    return this.svc.replace(u.id, body.lines);
  }

  @Post("merge")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  merge(@CurrentUser() u: AuthUser, @Body({ schema: s.putCartBody }) body: z.infer<typeof s.putCartBody>) {
    return this.svc.merge(u.id, body.lines);
  }

  @Post("items")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  add(@CurrentUser() u: AuthUser, @Body({ schema: s.addCartItemBody }) body: z.infer<typeof s.addCartItemBody>) {
    return this.svc.add(u.id, body);
  }

  @Patch("items/:id")
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  update(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.patchCartItemBody }) body: z.infer<typeof s.patchCartItemBody>) {
    return this.svc.update(u.id, id, body);
  }

  @Delete("items/:id")
  @ApiResponse({ status: 200, standardSchema: s.cartSchema })
  remove(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    return this.svc.remove(u.id, id);
  }
}

@ApiTags("Checkout and orders")
@ApiBearerAuth()
@Controller("v1")
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  @Post("checkout/quote")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.quoteSchema })
  quote(@CurrentUser() u: AuthUser, @Body({ schema: s.quoteBody }) body: z.infer<typeof s.quoteBody>) {
    return this.orders.quote(u.id, body);
  }

  @Post("orders")
  @ApiResponse({ status: 201, standardSchema: s.placeOrderResponse })
  place(@CurrentUser() u: AuthUser, @Body({ schema: s.placeOrderBody }) body: z.infer<typeof s.placeOrderBody>, @Headers("idempotency-key") key?: string) {
    return this.orders.place(u.id, body, key);
  }

  @Get("me/orders")
  @ApiResponse({ status: 200, standardSchema: s.orderList })
  list(@CurrentUser() u: AuthUser, @Query({ schema: s.orderListQuery }) q: z.infer<typeof s.orderListQuery>) {
    return this.orders.list(u.id, q);
  }

  @Get("me/orders/:id")
  @ApiResponse({ status: 200, standardSchema: s.orderSchema })
  detail(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.orders.detail(u.id, id);
  }

  @Post("me/orders/:id/cancel")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.orderSchema })
  cancel(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body({ schema: s.cancelBody }) body: z.infer<typeof s.cancelBody>) {
    return this.orders.cancel(u.id, id, body);
  }

  @Post("me/orders/:id/payments")
  @ApiResponse({ status: 201, standardSchema: s.paymentSummary.extend({ nextAction: s.nextActionSchema }) })
  retryPayment(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    return this.payments.retry(u.id, id);
  }
}

@ApiTags("Payments")
@Controller("v1/payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Get(":id")
  @ApiResponse({ status: 200, standardSchema: s.paymentDetailSchema })
  get(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    return this.payments.get(u.id, id);
  }

  @ApiBearerAuth()
  @Post(":id/sandbox/complete")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.paymentDetailSchema })
  sandbox(
    @CurrentUser() u: AuthUser,
    @Param("id", uuidParam) id: string,
    @Body({ schema: s.sandboxCompleteBody }) body: z.infer<typeof s.sandboxCompleteBody>,
  ) {
    return this.payments.sandboxComplete(u.id, id, body.outcome);
  }

  /** Razorpay Checkout success: verified against its signature and Razorpay before the order is confirmed. */
  @ApiBearerAuth()
  @Post(":id/confirm")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.paymentDetailSchema })
  confirm(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.confirmPaymentBody }) body: z.infer<typeof s.confirmPaymentBody>) {
    return this.payments.confirm(u.id, id, body);
  }

  /** Provider webhooks. Authenticated by their HMAC signature, not a user token. */
  @Public()
  @Post(["webhooks/sandbox", "webhooks/razorpay"])
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const result = await this.payments.receiveWebhook(req.rawBody ?? Buffer.from(""), req.headers);
    return { received: true, duplicate: result.duplicate };
  }
}

@ApiTags("Admin orders")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin")
export class AdminOrdersController {
  constructor(
    @Inject(FulfilmentService) private readonly svc: FulfilmentService,
    @Inject(ShippingService) private readonly shipping: ShippingService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OrderAdminService) private readonly admin: OrderAdminService,
  ) {}

  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("order-items")
  @ApiResponse({ status: 200, standardSchema: s.fulfilmentItemList })
  list(@Query({ schema: s.fulfilmentItemsQuery }) q: z.infer<typeof s.fulfilmentItemsQuery>) {
    return this.svc.list(q);
  }

  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("orders/:id")
  @ApiResponse({ status: 200, standardSchema: s.fulfilmentOrderSchema })
  order(@Param("id") id: string) {
    return this.svc.order(id);
  }

  @Post("order-items/transition")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.transitionResult })
  async transition(@CurrentUser() u: AuthUser, @Body({ schema: s.transitionBody }) body: z.infer<typeof s.transitionBody>) {
    const r = await this.svc.transition(u.id, body);
    const done = r.results.filter((x) => x.ok).length;
    const verb: Record<typeof body.to, string> = {
      ACCEPTED: "Accepted",
      PACKED: "Packed",
      READY_TO_SHIP: "Marked ready to ship",
      CANCELLED: "Cancelled",
      LOST: "Marked lost",
      RTO_RECEIVED: "Received back at the store",
    };
    if (done) {
      await this.audit.log(
        u,
        `order.${body.to.toLowerCase()}`,
        { type: "order_item", id: done === 1 ? r.results.find((x) => x.ok)!.id : null },
        `${verb[body.to]} ${done} order line${done === 1 ? "" : "s"}${body.reason ? `: ${body.reason}` : ""}`,
      );
    }
    return r;
  }

  /** Corrects the delivery address before the parcel is booked with the courier (409 ADDRESS_LOCKED after). */
  @Patch("orders/:id/address")
  @ApiResponse({ status: 200, standardSchema: s.fulfilmentOrderSchema })
  async address(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body({ schema: s.orderAddressBody }) body: z.infer<typeof s.orderAddressBody>) {
    const { before, after } = await this.admin.updateAddress(u, id, body);
    const changes = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, [...ADDRESS_FIELDS]);
    if (Object.keys(changes).length) await this.audit.log(u, "order.address", { type: "order", id }, `Changed the delivery address of order ${id}`, changes);
    return this.svc.order(id);
  }

  /** Internal notes on the order. Staff only: no customer response ever includes them. */
  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("orders/:id/notes")
  @ApiResponse({ status: 200, standardSchema: z.array(s.orderNoteSchema) })
  notes(@Param("id") id: string) {
    return this.admin.notes(id);
  }

  @Post("orders/:id/notes")
  @ApiResponse({ status: 201, standardSchema: s.orderNoteSchema })
  async addNote(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body({ schema: s.orderNoteBody }) body: z.infer<typeof s.orderNoteBody>) {
    const note = await this.admin.addNote(u, id, body.body);
    await this.audit.log(u, "order.note", { type: "order", id }, `Added an internal note to order ${id}`);
    return note;
  }

  /** Which courier is connected, and what Shiprocket still needs before it can take over. */
  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("logistics/status")
  @ApiResponse({ status: 200, standardSchema: s.logisticsStatusSchema })
  logisticsStatus() {
    const e = env();
    return {
      provider: this.shipping.providerName,
      shiprocket: {
        credentials: !!(e.SHIPROCKET_EMAIL && e.SHIPROCKET_PASSWORD),
        pickupLocation: !!e.SHIPROCKET_PICKUP_LOCATION,
        webhookToken: !!e.SHIPROCKET_WEBHOOK_TOKEN,
      },
      webhookPath: "/v1/logistics/webhooks/tracking",
    };
  }

  /** Asks the courier for the line's latest scan now, instead of waiting for the next poll. */
  @Post("order-items/:id/tracking/refresh")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.trackingRefreshResult })
  refreshTracking(@Param("id", uuidParam) id: string) {
    return this.shipping.refresh(id);
  }
}

@ApiTags("Admin refunds")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin")
export class AdminRefundsController {
  constructor(
    @Inject(OrderAdminService) private readonly admin: OrderAdminService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * A goodwill or manual refund. SOURCE: to the captured online payment,
   * through the refund job (PENDING until the gateway answers). MANUAL: money
   * the store already sent by UPI or bank transfer, recorded COMPLETED with
   * its reference. Both are capped: what is left of the payment, or on cash
   * on delivery what was collected and not yet refunded.
   */
  @Post("orders/:id/refunds")
  @ApiResponse({ status: 201, standardSchema: s.adminRefundSchema })
  async create(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body({ schema: s.adminRefundBody }) body: z.infer<typeof s.adminRefundBody>) {
    const r = await this.admin.refund(u.id, id, body);
    const how = body.method === "SOURCE" ? "to the original payment method" : `paid by hand, reference ${body.reference}`;
    await this.audit.log(u, "refund.create", { type: "refund", id: r.id }, `Refunded ${rupees(r.amountPaise)} on order ${id} ${how}: ${body.reason}`);
    return r;
  }

  /**
   * Sends a FAILED or NEEDS_ATTENTION refund again under the same receipt,
   * after staff checked the gateway. If the gateway itself failed the refund
   * under that receipt it stays failed: issue a new refund instead.
   */
  @Post("refunds/:id/retry")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.adminRefundSchema })
  async retry(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string) {
    const r = await this.admin.retry(id);
    await this.audit.log(u, "refund.retry", { type: "refund", id }, `Sent the refund of ${rupees(r.amountPaise)} on order ${r.orderId} to the gateway again`);
    return r;
  }

  /** Records the payout of a manual refund that was waiting for one (a Care Desk refund on cash on delivery, say). */
  @Post("refunds/:id/mark-paid")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.adminRefundSchema })
  async markPaid(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.markPaidBody }) body: z.infer<typeof s.markPaidBody>) {
    const r = await this.admin.markPaid(id, body.reference, body.note);
    await this.audit.log(u, "refund.mark_paid", { type: "refund", id }, `Marked the refund of ${rupees(r.amountPaise)} on order ${r.orderId} paid, reference ${body.reference}`);
    return r;
  }
}

@ApiTags("Admin")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin")
export class AdminInsightsController {
  constructor(@Inject(AdminInsightsService) private readonly svc: AdminInsightsService) {}

  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("overview")
  @ApiResponse({ status: 200, standardSchema: s.adminOverviewSchema })
  overview() {
    return this.svc.overview();
  }

  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("payments")
  @ApiResponse({ status: 200, standardSchema: s.adminPaymentList })
  payments(@Query({ schema: s.adminPaymentsQuery }) q: z.infer<typeof s.adminPaymentsQuery>) {
    return this.svc.payments(q);
  }

  @StaffOnly("OPS_ADMIN", "AUDITOR")
  @Get("refunds")
  @ApiResponse({ status: 200, standardSchema: s.adminRefundList })
  refunds(@Query({ schema: s.adminRefundsQuery }) q: z.infer<typeof s.adminRefundsQuery>) {
    return this.svc.refunds(q);
  }
}

@ApiTags("Storefront")
@Controller("v1/storefront")
export class StorefrontPincodesController {
  constructor(@Inject(ServiceabilityService) private readonly serviceability: ServiceabilityService) {}

  /** Whether we deliver to a pincode, whether cash on delivery works there, and any extra days. */
  @Public()
  @Get("pincodes/:pin")
  @ApiResponse({ status: 200, standardSchema: s.pincodeCheckSchema })
  async check(@Param("pin", { schema: s.pincodeParam }) pin: string) {
    return { pincode: pin, ...(await this.serviceability.check(pin)) };
  }
}

@ApiTags("Logistics")
@Controller("v1/logistics")
export class LogisticsController {
  constructor(@Inject(ShippingService) private readonly shipping: ShippingService) {}

  /**
   * Courier tracking webhook, authenticated by the token set on it in the
   * courier's panel. Optional: tracking is also polled every 10 minutes.
   * (Shiprocket refuses webhook URLs containing "shiprocket", "sr" or "kr".)
   */
  @Public()
  @Post("webhooks/tracking")
  @HttpCode(200)
  async webhook(@Body() body: unknown, @Headers() headers: Record<string, string | string[] | undefined>) {
    await this.shipping.receiveWebhook(body, headers);
    return { received: true };
  }
}

@ApiTags("Development")
@ApiBearerAuth()
@Controller("v1/dev")
export class DevController {
  constructor(
    @Inject(DevLogisticsService) private readonly logistics: DevLogisticsService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Clears sign in, password reset and verification rate limits, so automated
   * browser tests can sign their accounts in repeatedly. Disabled in production.
   */
  @Public()
  @Post("rate-limits/reset")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.object({ cleared: z.number().int() }) })
  async resetRateLimits() {
    if (isProduction()) throw forbidden("Development endpoints are disabled in production");
    const prefix = this.redis.options.keyPrefix ?? "";
    let cleared = 0;
    for (const pattern of ["login:fail:*", "pwreset:req:*", "email-otp:req:*", "kyc:*"]) {
      const keys: string[] = [];
      const stream = this.redis.scanStream({ match: `${prefix}${pattern}`, count: 200 });
      for await (const batch of stream) keys.push(...(batch as string[]));
      // scan returns prefixed keys; del adds the prefix again
      if (keys.length) cleared += await this.redis.del(...keys.map((k) => k.slice(prefix.length)));
    }
    return { cleared };
  }

  /** Stands in for courier scans until a courier partner is connected. Disabled in production. */
  @Post("logistics/advance")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.object({ id: z.uuid(), status: z.string() }) })
  advance(@CurrentUser() u: AuthUser, @Body({ schema: s.devAdvanceBody }) body: z.infer<typeof s.devAdvanceBody>) {
    if (isProduction()) throw forbidden("Development endpoints are disabled in production");
    return this.logistics.advance(u, body.orderItemId, body.to, body.deliveredDaysAgo);
  }
}
