import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service.js";
import { CurrentUser, Public, type AuthUser } from "./auth.guard.js";
import {
  emailOtpBody,
  emailOtpResponse,
  emailVerifyBody,
  refreshBody,
  requestOtpBody,
  requestOtpResponse,
  sessionResponse,
  tokenPairResponse,
  updateMeBody,
  userSchema,
  verifyOtpBody,
} from "./auth.schemas.js";

const meta = (req: Request) => ({ userAgent: req.headers["user-agent"], ip: req.ip });

@ApiTags("Auth")
@Controller("v1")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("auth/otp")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: requestOtpResponse })
  requestOtp(@Body({ schema: requestOtpBody }) body: z.infer<typeof requestOtpBody>) {
    return this.auth.requestOtp(body.phone);
  }

  @Public()
  @Post("auth/otp/verify")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: sessionResponse })
  verify(@Body({ schema: verifyOtpBody }) body: z.infer<typeof verifyOtpBody>, @Req() req: Request) {
    return this.auth.verifyOtp(body, meta(req));
  }

  @Public()
  @Post("auth/refresh")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: tokenPairResponse })
  refresh(@Body({ schema: refreshBody }) body: z.infer<typeof refreshBody>, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, meta(req));
  }

  @Public()
  @Post("auth/logout")
  @HttpCode(204)
  async logout(@Body({ schema: refreshBody }) body: z.infer<typeof refreshBody>) {
    await this.auth.logout(body.refreshToken);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiResponse({ status: 200, standardSchema: userSchema })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Patch("me")
  @ApiResponse({ status: 200, standardSchema: userSchema })
  updateMe(@CurrentUser() user: AuthUser, @Body({ schema: updateMeBody }) body: z.infer<typeof updateMeBody>) {
    return this.auth.updateMe(user.id, body);
  }

  @ApiBearerAuth()
  @Post("me/email/otp")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: emailOtpResponse })
  requestEmailOtp(@CurrentUser() user: AuthUser, @Body({ schema: emailOtpBody }) body: z.infer<typeof emailOtpBody>) {
    return this.auth.requestEmailOtp(user.id, body.email);
  }

  @ApiBearerAuth()
  @Post("me/email/verify")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: userSchema })
  verifyEmail(@CurrentUser() user: AuthUser, @Body({ schema: emailVerifyBody }) body: z.infer<typeof emailVerifyBody>) {
    return this.auth.verifyEmailOtp(user.id, body.code);
  }
}
