import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { EMAIL_PROVIDER, SMS_PROVIDER } from "../../common/tokens.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { ConsoleEmailProvider, ConsoleSmsProvider } from "./sms.provider.js";
import { TokensService } from "./tokens.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
    { provide: EMAIL_PROVIDER, useClass: ConsoleEmailProvider },
    // every route requires a signed-in user unless marked @Public()
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, TokensService, EMAIL_PROVIDER, SMS_PROVIDER],
})
export class AuthModule {}
