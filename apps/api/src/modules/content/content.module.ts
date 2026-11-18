import { Module } from "@nestjs/common";
import { AdminContentController, StorefrontContentController } from "./content.controller.js";
import { ContentService } from "./content.service.js";

/** The editable storefront pages: policies, help, careers, press, about and brand spotlights. */
@Module({
  controllers: [AdminContentController, StorefrontContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
