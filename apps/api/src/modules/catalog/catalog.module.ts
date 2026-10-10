import { Module } from "@nestjs/common";
import { AdminCatalogController, MediaController } from "./admin-catalog.controller.js";
import { AdminCatalogService } from "./admin-catalog.service.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

@Module({ controllers: [CatalogController, AdminCatalogController, MediaController], providers: [CatalogService, AdminCatalogService], exports: [CatalogService] })
export class CatalogModule {}
