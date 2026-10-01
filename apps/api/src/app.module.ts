import { Module } from "@nestjs/common";
import { InfraModule } from "./common/infra.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { CommerceModule } from "./modules/commerce/commerce.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { SellersModule } from "./modules/sellers/sellers.module.js";

@Module({
  imports: [InfraModule, AuthModule, CatalogModule, CommerceModule, SellersModule],
  controllers: [HealthController],
})
export class AppModule {}
