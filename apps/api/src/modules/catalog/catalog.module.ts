import { Module } from "@nestjs/common";
import { AdminCatalogController, MediaController } from "./admin-catalog.controller.js";
import { AdminCatalogService } from "./admin-catalog.service.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { ProductImportService } from "./product-import.service.js";

import { AdminReviewsController, ReviewsController } from "./reviews.controllers.js";
import { ReviewsService } from "./reviews.service.js";

@Module({ controllers: [CatalogController, AdminCatalogController, MediaController, ReviewsController, AdminReviewsController], providers: [CatalogService, AdminCatalogService, ProductImportService, ReviewsService], exports: [CatalogService] })
export class CatalogModule {}
