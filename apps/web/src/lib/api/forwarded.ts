/** Hops of X-Forwarded-For passed on; the API only reads the nearest ones. */
const MAX_HOPS = 20;

/**
 * Headers that tell the API who the visitor is when the web server calls it on
 * their behalf: their browser, and their address as X-Forwarded-For.
 *
 * The chain is passed on as Next.js received it, nothing overwritten, so the
 * API's TRUST_PROXY setting walks it from its own end and stops at the first
 * hop it does not trust. A reverse proxy in front of Next appends the address
 * it saw, which then outranks anything the visitor wrote in the header. With
 * no proxy in front, Next fills the header with the connecting address only
 * when it is missing, so a live store should sit behind one.
 *
 * Pure, so the proxy can use it too. Server Actions get it through clientApi()
 * in lib/api/server.ts.
 */
export function forwardingHeaders(incoming: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const hops = (incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip") ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (hops.length) out["x-forwarded-for"] = hops.slice(-MAX_HOPS).join(", ");
  const ua = incoming.get("user-agent");
  if (ua) out["user-agent"] = ua;
  return out;
}
