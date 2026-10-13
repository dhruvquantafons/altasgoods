import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { EMAIL_PROVIDER } from "../../common/tokens.js";
import { env } from "../../config/env.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { ConsoleEmailProvider, SmtpEmailProvider } from "./email.provider.js";
import { TokensService } from "./tokens.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    { provide: EMAIL_PROVIDER, useFactory: () => (env().EMAIL_PROVIDER === "smtp" ? new SmtpEmailProvider(env()) : new ConsoleEmailProvider()) },
    // every route requires a signed-in user unless marked @Public()
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, TokensService, EMAIL_PROVIDER],
})
export class AuthModule {}
