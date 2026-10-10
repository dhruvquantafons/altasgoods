import { z } from "zod";

export const requestOtpBody = z.object({ phone: z.string().min(10).max(16).describe("Indian mobile number, any common format") });
export const requestOtpResponse = z.object({
  challengeId: z.uuid(),
  phone: z.string().describe("Masked number the code was sent to"),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
  devCode: z.string().optional().describe("Only outside production, so you can sign in without SMS"),
});

export const verifyOtpBody = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code"),
  name: z.string().trim().min(2).max(80).optional().describe("Used when the account is created"),
});

export const userSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  isPlus: z.boolean(),
  staffRoles: z.array(z.string()).describe("AltasGoods Control roles; empty for shoppers"),
});

export const sessionResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().describe("Access token lifetime in seconds"),
  user: userSchema,
  isNewUser: z.boolean(),
});

export const refreshBody = z.object({ refreshToken: z.string().min(20) });
export const tokenPairResponse = z.object({ accessToken: z.string(), refreshToken: z.string(), expiresIn: z.number().int() });

export const emailOtpBody = z.object({ email: z.email().max(120) });
export const emailOtpResponse = z.object({
  email: z.string().describe("Masked address the code was sent to"),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
  devCode: z.string().optional().describe("Only outside production"),
});
export const emailVerifyBody = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code") });

export const updateMeBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email().optional(),
});
