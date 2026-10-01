import "server-only";
import { cookies } from "next/headers";

export const ACCESS_COOKIE = "bb_at";
export const REFRESH_COOKIE = "bb_rt";
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 30 * 24 * 3600;

export const apiUrl = () => process.env.BLUBUY_API_URL ?? "http://localhost:4000";

const base = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };
export const accessCookie = (value: string) => ({ name: ACCESS_COOKIE, value, ...base, maxAge: ACCESS_MAX_AGE });
export const refreshCookie = (value: string) => ({ name: REFRESH_COOKIE, value, ...base, maxAge: REFRESH_MAX_AGE });

/** Stores a fresh token pair. Only callable from Server Actions and Route Handlers. */
export async function setSession(tokens: { accessToken: string; refreshToken: string }) {
  const jar = await cookies();
  jar.set(accessCookie(tokens.accessToken));
  jar.set(refreshCookie(tokens.refreshToken));
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Reads (without verifying) the claims of an access token, for optimistic checks only. */
export function peekClaims(token: string | undefined): { sub: string; exp: number; sellers: string[]; staff: string[] } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return { sub: String(payload.sub), exp: Number(payload.exp), sellers: payload.sellers ?? [], staff: payload.staff ?? [] };
  } catch {
    return null;
  }
}
