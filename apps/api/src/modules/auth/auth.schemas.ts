import { normalizePhone } from "./phone.js";
import { z } from "zod";

const email = z.email("Enter a valid email address").max(120);
/** NIST 800-63B: length over composition rules; 128 is plenty and keeps hashing bounded. */
const password = z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer");
const code = z.string().regex(/^\d{6}$/, "Enter the 6 digit code");

export const signupBody = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email,
  password,
});

export const loginBody = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });

export const forgotPasswordBody = z.object({ email });
export const forgotPasswordResponse = z.object({
  email: z.string().describe("Masked address; the same answer is given whether or not an account exists"),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
  devCode: z.string().optional().describe("Only outside production, and only when the account exists"),
});

export const resetPasswordBody = z.object({ email, code, password });

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  staffRoles: z.array(z.string()).describe("AltasGoods Control roles; empty for shoppers"),
  createdAt: z.iso.datetime().describe("When the account was created"),
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

export const emailOtpBody = z.object({ email });
export const emailOtpResponse = z.object({
  email: z.string().describe("Masked address the code was sent to"),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
  devCode: z.string().optional().describe("Only outside production"),
});
export const emailVerifyBody = z.object({ code });

export const updateMeBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z
    .string()
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v.trim() === "") return v === undefined ? undefined : null;
      return normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Enter a valid 10 digit mobile number" }), z.NEVER);
    })
    .describe("Optional contact number; send null or an empty string to remove it"),
});

export const changePasswordBody = z.object({ currentPassword: z.string().min(1, "Enter your current password").max(128), newPassword: password });
