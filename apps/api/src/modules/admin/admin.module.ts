import { Global, Module } from "@nestjs/common";
import { AdminBannersController, AdminSystemController, StorefrontBannersController, StorefrontSettingsController } from "./admin.controllers.js";
import { BannersService } from "./banners.service.js";
import { AuditService } from "./audit.service.js";
import { SettingsService } from "./settings.service.js";

/** The audit log and store settings. Global, so every module can record changes and read settings. */
@Global()
@Module({
  controllers: [AdminSystemController, StorefrontSettingsController, AdminBannersController, StorefrontBannersController],
  providers: [AuditService, SettingsService, BannersService],
  exports: [AuditService, SettingsService],
})
export class AdminModule {}
