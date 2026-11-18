/**
 * Outbound HTTP to third parties (payment gateway, courier). Every call is
 * bounded by a timeout, so a slow partner can never hold a request or a
 * database transaction open indefinitely.
 */

/** The request never produced a response: it timed out, or the network failed. */
export class OutboundFailure extends Error {
  constructor(
    readonly timedOut: boolean,
    cause: unknown,
  ) {
    super(timedOut ? "Request timed out" : `Request failed: ${(cause as Error)?.message ?? String(cause)}`, { cause });
  }
}

const isTimeout = (e: unknown) => {
  const name = (e as { name?: string } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
};

/**
 * Fetches and reads the body as text within `timeoutMs` (the body read is
 * bounded by the same signal). Throws OutboundFailure when no complete
 * response arrived; HTTP error statuses are returned for the caller to judge.
 */
export async function fetchText(f: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<{ res: Response; text: string }> {
  try {
    const res = await f(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    return { res, text: await res.text() };
  } catch (e) {
    throw new OutboundFailure(isTimeout(e), e);
  }
}

/** Parses a JSON body, treating an empty or malformed one as {}. */
export function parseJson<T>(text: string): T {
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
