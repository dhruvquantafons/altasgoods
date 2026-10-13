"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { publicApi } from "@/lib/api/server";
import { clearSession, REFRESH_COOKIE, setSession } from "@/lib/api/session";
import type { PasswordResetChallenge, Session, User } from "@/lib/api/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const failure = (e: unknown, fallback: string): { ok: false; error: string; code?: string } => {
  const p = (e ?? {}) as { detail?: string; code?: string; errors?: { message: string }[] };
  return { ok: false, error: p.errors?.[0]?.message ?? p.detail ?? fallback, code: p.code };
};

const unreachable = { ok: false as const, error: "AltasGoods is unreachable right now. Please try again in a moment.", code: "API_UNAVAILABLE" };

/** Stores the new session in httpOnly cookies, ending the previous one on the server when switching accounts. */
async function startSession(session: Session) {
  const previous = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (previous) await publicApi().POST("/v1/auth/logout", { body: { refreshToken: previous } }).catch(() => undefined);
  await setSession(session);
  return { user: session.user, isNewUser: session.isNewUser };
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<Result<{ user: User; isNewUser: boolean }>> {
  try {
    const r = await publicApi().POST("/v1/auth/signup", { body: input });
    return r.data ? { ok: true, data: await startSession(r.data) } : failure(r.error, "Could not create your account");
  } catch {
    return unreachable;
  }
}

export async function signIn(input: { email: string; password: string }): Promise<Result<{ user: User; isNewUser: boolean }>> {
  try {
    const r = await publicApi().POST("/v1/auth/login", { body: input });
    return r.data ? { ok: true, data: await startSession(r.data) } : failure(r.error, "Could not sign you in");
  } catch {
    return unreachable;
  }
}

/** Emails a reset code. Outside production the code is returned for convenience. */
export async function forgotPassword(email: string): Promise<Result<PasswordResetChallenge>> {
  try {
    const r = await publicApi().POST("/v1/auth/password/forgot", { body: { email } });
    return r.data ? { ok: true, data: r.data } : failure(r.error, "Could not send the code");
  } catch {
    return unreachable;
  }
}

/** Sets a new password with the emailed code, then signs in. */
export async function resetPassword(input: { email: string; code: string; password: string }): Promise<Result<{ user: User; isNewUser: boolean }>> {
  try {
    const r = await publicApi().POST("/v1/auth/password/reset", { body: input });
    return r.data ? { ok: true, data: await startSession(r.data) } : failure(r.error, "Could not reset your password");
  } catch {
    return unreachable;
  }
}

/** Ends the session everywhere it can, then redirects. */
export async function signOut(next = "/") {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) await publicApi().POST("/v1/auth/logout", { body: { refreshToken } }).catch(() => undefined);
  await clearSession();
  redirect(next);
}
