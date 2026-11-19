import { isIPv4, isIPv6 } from "node:net";

/**
 * The address a rate limit counts against. IPv4 as is (an IPv4 client seen
 * over IPv6 too); IPv6 by its /64, since one connection is usually handed a
 * whole /64 and could otherwise spread its tries over countless addresses.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip) return "unknown";
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  if (isIPv4(ip)) return ip;
  const addr = ip.split("%")[0]!;
  if (!isIPv6(addr)) return "unknown";
  const width = (groups: string[]) => groups.reduce((n, g) => n + (g.includes(".") ? 2 : 1), 0);
  const [head = "", tail] = addr.split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const groups = tail === undefined ? front : [...front, ...Array<string>(8 - width(front) - width(back)).fill("0"), ...back];
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}
