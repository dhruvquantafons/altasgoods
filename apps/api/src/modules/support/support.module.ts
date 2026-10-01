import { Module } from "@nestjs/common";
import { CommerceModule } from "../commerce/commerce.module.js";
import { CustomerSupportController, SupportController } from "./support.controllers.js";
import { SupportService } from "./support.service.js";

/** Care Desk tickets and customer help conversations (spec 9.4, 11.11, 11.13). */
@Module({
  imports: [CommerceModule],
  controllers: [SupportController, CustomerSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
