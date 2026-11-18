import { Global, Module } from "@nestjs/common";
import { AdminBannersController, AdminSystemController, StorefrontBannersController, StorefrontSettingsController } from "./admin.controllers.js";
import { BannersService } from "./banners.service.js";
import { AuditService } from "./audit.service.js";
import { SettingsService } from "./settings.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { StaffController } from "./staff.controller.js";
import { StaffService } from "./staff.service.js";

/** The audit log, store settings and staff. Global, so every module can record changes and read settings. */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AdminSystemController, StorefrontSettingsController, AdminBannersController, StorefrontBannersController, StaffController],
  providers: [AuditService, SettingsService, BannersService, StaffService],
  exports: [AuditService, SettingsService],
})
export class AdminModule {}
