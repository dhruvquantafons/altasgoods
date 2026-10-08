"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { publicApi } from "@/lib/api/server";
import { clearSession, REFRESH_COOKIE, setSession } from "@/lib/api/session";
import type { OtpChallenge, User } from "@/lib/api/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const failure = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};

/** Sends a sign in code. Outside production the code is returned for convenience. */
export async function requestOtp(phone: string): Promise<Result<OtpChallenge>> {
  try {
    const r = await publicApi().POST("/v1/auth/otp", { body: { phone } });
    return r.data ? { ok: true, data: r.data } : failure(r.error, "Could not send the code");
  } catch {
    return { ok: false, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };
  }
}

/** Verifies the code and starts a session (httpOnly cookies). */
export async function verifyOtp(input: { challengeId: string; code: string; name?: string }): Promise<Result<{ user: User; isNewUser: boolean }>> {
  try {
    const r = await publicApi().POST("/v1/auth/otp/verify", { body: input });
    if (!r.data) return failure(r.error, "Could not verify the code");
    // switching accounts: end the previous session on the server too
    const previous = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (previous) await publicApi().POST("/v1/auth/logout", { body: { refreshToken: previous } }).catch(() => undefined);
    await setSession(r.data);
    return { ok: true, data: { user: r.data.user, isNewUser: r.data.isNewUser } };
  } catch {
    return { ok: false, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };
  }
}

/** Ends the session everywhere it can, then redirects. */
export async function signOut(next = "/") {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) await publicApi().POST("/v1/auth/logout", { body: { refreshToken } }).catch(() => undefined);
  await clearSession();
  redirect(next);
}
