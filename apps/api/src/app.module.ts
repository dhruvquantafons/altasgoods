import { Module } from "@nestjs/common";
import { InfraModule } from "./common/infra.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { CommerceModule } from "./modules/commerce/commerce.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { FilesModule } from "./modules/files/files.module.js";
import { SellersModule } from "./modules/sellers/sellers.module.js";
import { SupportModule } from "./modules/support/support.module.js";

@Module({
  imports: [InfraModule, FilesModule, AuthModule, CatalogModule, CommerceModule, SellersModule, SupportModule],
  controllers: [HealthController],
})
export class AppModule {}
