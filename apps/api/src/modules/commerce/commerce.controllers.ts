import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Redis } from "ioredis";
import { z } from "zod";
import { forbidden } from "../../common/errors.js";
import { REDIS } from "../../common/tokens.js";
import { isProduction } from "../../config/env.js";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { AddressesService } from "./addresses.service.js";
import { CartService } from "./cart.service.js";
import * as s from "./commerce.schemas.js";
import { OrdersService } from "./orders.service.js";
import { PaymentsService } from "./payments/payments.service.js";
import { FulfilmentService } from "./fulfilment.service.js";
import { DevLogisticsService } from "./dev-logistics.service.js";

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
  sandbox(@CurrentUser() u: AuthUser, @Param("id", uuidParam) id: string, @Body({ schema: s.sandboxCompleteBody }) body: z.infer<typeof s.sandboxCompleteBody>) {
    return this.payments.sandboxComplete(u.id, id, body.outcome);
  }

  /** Provider webhook. Authenticated by its HMAC signature, not a user token. */
  @Public()
  @Post("webhooks/sandbox")
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
  constructor(@Inject(FulfilmentService) private readonly svc: FulfilmentService) {}

  @Get("order-items")
  @ApiResponse({ status: 200, standardSchema: s.fulfilmentItemList })
  list(@Query({ schema: s.fulfilmentItemsQuery }) q: z.infer<typeof s.fulfilmentItemsQuery>) {
    return this.svc.list(q);
  }

  @Get("orders/:id")
  @ApiResponse({ status: 200, standardSchema: s.fulfilmentOrderSchema })
  order(@Param("id") id: string) {
    return this.svc.order(id);
  }

  @Post("order-items/transition")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: s.transitionResult })
  transition(@CurrentUser() u: AuthUser, @Body({ schema: s.transitionBody }) body: z.infer<typeof s.transitionBody>) {
    return this.svc.transition(u.id, body);
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
   * Clears sign in code and verification rate limits, so automated browser
   * tests can sign the demo accounts in repeatedly. Disabled in production.
   */
  @Public()
  @Post("rate-limits/reset")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.object({ cleared: z.number().int() }) })
  async resetRateLimits() {
    if (isProduction()) throw forbidden("Development endpoints are disabled in production");
    const prefix = this.redis.options.keyPrefix ?? "";
    let cleared = 0;
    for (const pattern of ["otp:req:*", "email-otp:req:*", "kyc:*"]) {
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
