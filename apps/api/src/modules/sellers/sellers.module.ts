import { Module } from "@nestjs/common";
import { KYC_PROVIDER } from "../../common/tokens.js";
import { AuthModule } from "../auth/auth.module.js";
import { ApplicationStore } from "./applications.store.js";
import { SandboxKycProvider } from "./kyc/sandbox.provider.js";
import { OnboardingService } from "./onboarding.service.js";
import { ReviewService } from "./review.service.js";
import { OnboardingController, ReviewController } from "./sellers.controllers.js";

/** Seller onboarding and KYC (spec 3.1, 9.2.1, 9.3.2, 11.8). */
@Module({
  imports: [AuthModule],
  controllers: [OnboardingController, ReviewController],
  providers: [
    ApplicationStore,
    OnboardingService,
    ReviewService,
    { provide: KYC_PROVIDER, useClass: SandboxKycProvider },
  ],
  exports: [OnboardingService, ReviewService],
})
export class SellersModule {}
