import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type { Problem, User } from "./types";
import { ACCESS_COOKIE, apiUrl, peekClaims } from "./session";

/** Error carrying the API's problem details. */
export class ApiRequestError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail);
  }
}

/** API client for the current request, signed in when a session cookie exists. */
export async function api() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return createClient<paths>({
    baseUrl: apiUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
}

/** Bearer header for calls openapi-fetch does not cover (uploads, file downloads). */
export async function authHeader(): Promise<Record<string, string>> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Streams a file from the API back to the browser, keeping the session token on the server. */
export async function proxyFile(path: string) {
  try {
    const r = await fetch(`${apiUrl()}${path}`, { headers: await authHeader(), cache: "no-store" });
    if (!r.ok) return new Response(r.status === 404 ? "Not found" : "Not available", { status: r.status === 404 ? 404 : r.status === 403 ? 403 : 502 });
    const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const h of ["content-type", "content-disposition", "content-length"]) {
      const v = r.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(r.body, { status: 200, headers });
  } catch {
    return new Response("BluBuy is unreachable right now", { status: 503 });
  }
}

/** Anonymous client for public catalog reads. */
export const publicApi = () => createClient<paths>({ baseUrl: apiUrl(), cache: "no-store" });

/**
 * Unwraps an openapi-fetch result: returns data, throws ApiRequestError on
 * failure, or calls notFound() for 404s when asked to.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }, opts: { notFoundOn404?: boolean } = {}): T {
  if (result.data !== undefined && result.response.ok) return result.data;
  if (result.response.status === 404 && opts.notFoundOn404) notFound();
  const e = (result.error ?? {}) as Partial<Problem>;
  throw new ApiRequestError({
    type: e.type ?? "about:blank",
    title: e.title ?? "Request failed",
    status: e.status ?? result.response.status,
    code: e.code ?? "REQUEST_FAILED",
    detail: e.detail ?? "Something went wrong. Please try again.",
    errors: e.errors,
  });
}

/** The signed-in user, or null. Cached for the duration of one request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!peekClaims(token)) return null;
  const r = await (await api()).GET("/v1/me");
  return r.response.ok && r.data ? r.data : null;
});

/** Whether the API is reachable; pages fall back gracefully when it is not. */
export async function apiAvailable() {
  try {
    const r = await fetch(`${apiUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}
