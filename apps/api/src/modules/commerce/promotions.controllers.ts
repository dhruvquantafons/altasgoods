import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuditService, diff } from "../admin/audit.service.js";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import * as s from "./promotions.schemas.js";
import { PromotionsService } from "./promotions.service.js";

const saleId = { schema: z.uuid() };
const couponCode = { schema: z.string().min(1).max(24).transform((v) => v.toUpperCase()) };
const pct = (n: number) => `${n}% off`;

@ApiTags("Admin promotions")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin")
export class AdminPromotionsController {
  constructor(
    @Inject(PromotionsService) private readonly svc: PromotionsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get("sales")
  @ApiResponse({ status: 200, standardSchema: z.array(s.saleSchema) })
  sales() {
    return this.svc.sales();
  }

  @Get("sales/:id")
  @ApiResponse({ status: 200, standardSchema: s.saleSchema })
  sale(@Param("id", saleId) id: string) {
    return this.svc.sale(id);
  }

  @Post("sales")
  @ApiResponse({ status: 201, standardSchema: s.saleSchema })
  async createSale(@CurrentUser() u: AuthUser, @Body({ schema: s.saleInput }) body: z.infer<typeof s.saleInput>) {
    const sale = await this.svc.createSale(body);
    await this.audit.log(u, "sale.create", { type: "sale", id: sale.id }, `Created sale ${sale.name}, ${pct(sale.discountPercent)}`);
    return sale;
  }

  @Patch("sales/:id")
  @ApiResponse({ status: 200, standardSchema: s.saleSchema })
  async updateSale(@CurrentUser() u: AuthUser, @Param("id", saleId) id: string, @Body({ schema: s.salePatch }) body: z.infer<typeof s.salePatch>) {
    const { before, after } = await this.svc.updateSale(id, body);
    const changes = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body));
    const verb = body.status && body.status !== before.status ? (body.status === "PAUSED" ? "Paused" : "Resumed") : "Edited";
    if (Object.keys(changes).length) await this.audit.log(u, body.status === "PAUSED" ? "sale.pause" : "sale.update", { type: "sale", id }, `${verb} sale ${after.name}`, changes);
    return after;
  }

  @Delete("sales/:id")
  @HttpCode(204)
  async deleteSale(@CurrentUser() u: AuthUser, @Param("id", saleId) id: string) {
    const sale = await this.svc.deleteSale(id);
    await this.audit.log(u, "sale.delete", { type: "sale", id }, `Deleted sale ${sale.name}`);
  }

  @Get("coupons")
  @ApiResponse({ status: 200, standardSchema: z.array(s.couponSchema) })
  coupons() {
    return this.svc.coupons();
  }

  @Post("coupons")
  @ApiResponse({ status: 201, standardSchema: s.couponSchema })
  async createCoupon(@CurrentUser() u: AuthUser, @Body({ schema: s.couponInput }) body: z.infer<typeof s.couponInput>) {
    const c = await this.svc.createCoupon(body);
    await this.audit.log(u, "coupon.create", { type: "coupon", id: c.code }, `Created coupon ${c.code}: ${c.description}`);
    return c;
  }

  @Patch("coupons/:code")
  @ApiResponse({ status: 200, standardSchema: s.couponSchema })
  async updateCoupon(@CurrentUser() u: AuthUser, @Param("code", couponCode) code: string, @Body({ schema: s.couponPatch }) body: z.infer<typeof s.couponPatch>) {
    const { before, after } = await this.svc.updateCoupon(code, body);
    const changes = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body));
    const verb = body.status && body.status !== before.status ? (body.status === "PAUSED" ? "Paused" : "Resumed") : "Edited";
    if (Object.keys(changes).length) await this.audit.log(u, body.status === "PAUSED" ? "coupon.pause" : "coupon.update", { type: "coupon", id: code }, `${verb} coupon ${code}`, changes);
    return after;
  }

  @Delete("coupons/:code")
  @HttpCode(204)
  async deleteCoupon(@CurrentUser() u: AuthUser, @Param("code", couponCode) code: string) {
    await this.svc.deleteCoupon(code);
    await this.audit.log(u, "coupon.delete", { type: "coupon", id: code }, `Deleted coupon ${code}`);
  }
}

@ApiTags("Storefront")
@Controller("v1/storefront")
export class StorefrontPromotionsController {
  constructor(@Inject(PromotionsService) private readonly svc: PromotionsService) {}

  /** Sales running now, biggest discount first. */
  @Public()
  @Get("sales/live")
  @ApiResponse({ status: 200, standardSchema: z.array(s.liveSaleSchema) })
  async liveSales() {
    return (await this.svc.liveSales()).map(({ id, name, slug, headline, description, discountPercent, scope, categoryIds, productIds, startsAt, endsAt, bannerImage }) => ({
      id,
      name,
      slug,
      headline,
      description,
      discountPercent,
      scope,
      categoryIds,
      productIds,
      startsAt,
      endsAt,
      bannerImage,
    }));
  }

  /** Coupons customers can use now and the store chose to show. */
  @Public()
  @Get("coupons")
  @ApiResponse({ status: 200, standardSchema: z.array(s.storefrontCouponSchema) })
  coupons() {
    return this.svc.storefrontCoupons();
  }
}
