import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import * as s from "./admin.schemas.js";
import { AuditService, diff } from "./audit.service.js";
import * as b from "./banners.schemas.js";
import { BannersService } from "./banners.service.js";
import { SettingsService } from "./settings.service.js";

@ApiTags("Admin")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN")
@Controller("v1/admin")
export class AdminSystemController {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  @Get("audit")
  @ApiResponse({ status: 200, standardSchema: s.auditList })
  auditLog(@Query({ schema: s.auditQuery }) q: z.infer<typeof s.auditQuery>) {
    return this.audit.list(q);
  }

  @Get("settings")
  @ApiResponse({ status: 200, standardSchema: s.settingsResponse })
  getSettings() {
    return this.settings.detail();
  }

  @Put("settings")
  @ApiResponse({ status: 200, standardSchema: s.settingsResponse })
  putSettings(@CurrentUser() u: AuthUser, @Body({ schema: s.settingsSchema }) body: z.infer<typeof s.settingsSchema>) {
    return this.settings.update(u.id, body);
  }
}

@ApiTags("Storefront")
@Controller("v1/storefront")
export class StorefrontSettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  /** Company and grievance details, the storefront notice and delivery thresholds. */
  @Public()
  @Get("settings")
  @ApiResponse({ status: 200, standardSchema: s.storefrontSettingsSchema })
  async get() {
    const { delivery, cod, notice, company, grievance } = await this.settings.get();
    return { delivery, cod, notice, company, grievance };
  }
}

const bannerId = { schema: z.uuid() };
const where = (placement: string) => (placement === "HERO" ? "hero slide" : "promo tile");

@ApiTags("Admin storefront CMS")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "CATALOG_MANAGER")
@Controller("v1/admin/banners")
export class AdminBannersController {
  constructor(
    @Inject(BannersService) private readonly svc: BannersService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, standardSchema: z.array(b.bannerSchema) })
  list() {
    return this.svc.list();
  }

  @Post()
  @ApiResponse({ status: 201, standardSchema: b.bannerSchema })
  async create(@CurrentUser() u: AuthUser, @Body({ schema: b.bannerInput }) body: z.infer<typeof b.bannerInput>) {
    const banner = await this.svc.create(body);
    await this.audit.log(u, "banner.create", { type: "banner", id: banner.id }, `Added ${where(banner.placement)} "${banner.title}"`);
    return banner;
  }

  @Patch(":id")
  @ApiResponse({ status: 200, standardSchema: b.bannerSchema })
  async update(@CurrentUser() u: AuthUser, @Param("id", bannerId) id: string, @Body({ schema: b.bannerPatch }) body: z.infer<typeof b.bannerPatch>) {
    const { before, after } = await this.svc.update(id, body);
    const changes = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body));
    if (Object.keys(changes).length) await this.audit.log(u, "banner.update", { type: "banner", id }, `Edited ${where(after.placement)} "${after.title}"`, changes);
    return after;
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param("id", bannerId) id: string) {
    const banner = await this.svc.remove(id);
    await this.audit.log(u, "banner.delete", { type: "banner", id }, `Removed ${where(banner.placement)} "${banner.title}"`);
  }

  @Post("reorder")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: z.array(b.bannerSchema) })
  async reorder(@CurrentUser() u: AuthUser, @Body({ schema: b.reorderBody }) body: z.infer<typeof b.reorderBody>) {
    const list = await this.svc.reorder(body.placement, body.ids);
    await this.audit.log(u, "banner.reorder", { type: "banner" }, `Reordered the ${body.placement === "HERO" ? "hero slides" : "promo tiles"}`);
    return list;
  }
}

@ApiTags("Storefront")
@Controller("v1/storefront")
export class StorefrontBannersController {
  constructor(@Inject(BannersService) private readonly svc: BannersService) {}

  /** The homepage hero slides and promo tiles showing now, in order. */
  @Public()
  @Get("banners")
  @ApiResponse({ status: 200, standardSchema: b.storefrontBanners })
  get() {
    return this.svc.storefront();
  }
}
