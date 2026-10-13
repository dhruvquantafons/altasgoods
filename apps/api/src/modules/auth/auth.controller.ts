import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service.js";
import { CurrentUser, Public, type AuthUser } from "./auth.guard.js";
import {
  changePasswordBody,
  emailOtpBody,
  emailOtpResponse,
  emailVerifyBody,
  forgotPasswordBody,
  forgotPasswordResponse,
  loginBody,
  refreshBody,
  resetPasswordBody,
  sessionResponse,
  signupBody,
  tokenPairResponse,
  updateMeBody,
  userSchema,
} from "./auth.schemas.js";

const meta = (req: Request) => ({ userAgent: req.headers["user-agent"], ip: req.ip });

@ApiTags("Auth")
@Controller("v1")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("auth/signup")
  @HttpCode(201)
  @ApiResponse({ status: 201, standardSchema: sessionResponse })
  signup(@Body({ schema: signupBody }) body: z.infer<typeof signupBody>, @Req() req: Request) {
    return this.auth.signup(body, meta(req));
  }

  @Public()
  @Post("auth/login")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: sessionResponse })
  login(@Body({ schema: loginBody }) body: z.infer<typeof loginBody>, @Req() req: Request) {
    return this.auth.login(body, meta(req));
  }

  @Public()
  @Post("auth/password/forgot")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: forgotPasswordResponse })
  forgotPassword(@Body({ schema: forgotPasswordBody }) body: z.infer<typeof forgotPasswordBody>) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Post("auth/password/reset")
  @HttpCode(200)
  @ApiResponse({ status: 200, standardSchema: sessionResponse })
  resetPassword(@Body({ schema: resetPasswordBody }) body: z.infer<typeof resetPasswordBody>, @Req() req: Request) {
    return this.auth.resetPassword(body, meta(req));
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
  @Post("me/password")
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body({ schema: changePasswordBody }) body: z.infer<typeof changePasswordBody>) {
    await this.auth.changePassword(user.id, user.sessionId, body);
  }

  @ApiBearerAuth()
  @Post("me/sessions/sign-out-others")
  @HttpCode(204)
  async signOutOthers(@CurrentUser() user: AuthUser) {
    await this.auth.signOutOthers(user.id, user.sessionId);
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
