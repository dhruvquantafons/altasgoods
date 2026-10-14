import { lookup, type LookupAddress, type LookupOptions } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

/**
 * Downloads product photos named by URL in a catalog import. Only public
 * http(s) hosts are fetched: every address a name resolves to is checked
 * when the connection is made (so a DNS answer cannot switch to an internal
 * address after the check), redirects are checked again, and the body is cut
 * off past the size limit.
 */

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const internal = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  internal.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  internal.addSubnet(net, prefix, "ipv6");

/** Loopback, private, link-local, multicast and reserved addresses, including IPv4 written as IPv6. */
export function isInternalAddress(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return internal.check(mapped[1]!, "ipv4");
  const family = isIP(address);
  if (!family) return true;
  return internal.check(address, family === 4 ? "ipv4" : "ipv6");
}

class BlockedHost extends Error {}

function publicLookup(hostname: string, options: LookupOptions, cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, "");
    if (!addresses.length || addresses.some((a) => isInternalAddress(a.address))) return cb(new BlockedHost(hostname), "");
    if (options.all) return cb(null, addresses);
    cb(null, addresses[0]!.address, addresses[0]!.family);
  });
}

/** The image bytes, or a short reason it could not be fetched, suitable for showing the admin. */
export async function downloadImage(url: string, maxBytes: number): Promise<{ ok: true; buffer: Buffer } | { ok: false; reason: string }> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") return { ok: false, reason: "only http and https links can be fetched" };
    const host = current.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && isInternalAddress(host)) return { ok: false, reason: "points at a private address" };
    try {
      const res = await get(current, maxBytes);
      if ("location" in res) {
        current = new URL(res.location, current);
        continue;
      }
      return res;
    } catch (e) {
      if (e instanceof BlockedHost) return { ok: false, reason: "points at a private address" };
      return { ok: false, reason: e instanceof Error && e.message === "timeout" ? "took too long to download" : "could not be downloaded" };
    }
  }
  return { ok: false, reason: "redirects too many times" };
}

function get(url: URL, maxBytes: number): Promise<{ ok: true; buffer: Buffer } | { ok: false; reason: string } | { location: string }> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { lookup: publicLookup as never, headers: { "User-Agent": "AltasGoods catalog import", Accept: "image/*" }, timeout: TIMEOUT_MS }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ location: res.headers.location });
      }
      if (status !== 200) {
        res.resume();
        return resolve({ ok: false, reason: `the server answered ${status}` });
      }
      if (Number(res.headers["content-length"] ?? 0) > maxBytes) {
        res.destroy();
        return resolve({ ok: false, reason: "is larger than 4 MB" });
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > maxBytes) {
          res.destroy();
          resolve({ ok: false, reason: "is larger than 4 MB" });
        } else chunks.push(c);
      });
      res.on("end", () => resolve({ ok: true, buffer: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
