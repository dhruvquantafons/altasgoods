import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CommerceModule } from "../commerce/commerce.module.js";
import { AdminCustomersController, CustomerSupportController, SupportController } from "./support.controllers.js";
import { SupportLookupService } from "./support-lookup.service.js";
import { SupportService } from "./support.service.js";

/** Care Desk tickets and customer help conversations (spec 9.4, 11.11, 11.13). */
@Module({
  imports: [CommerceModule, AuthModule],
  controllers: [SupportController, CustomerSupportController, AdminCustomersController],
  providers: [SupportService, SupportLookupService],
  exports: [SupportService],
})
export class SupportModule {}
