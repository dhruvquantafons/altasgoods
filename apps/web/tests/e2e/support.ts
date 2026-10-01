import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const API = process.env.E2E_API_URL ?? "http://localhost:4000";

export const PHONES = { shopper: "9845012345", seller: "9820011223", staff: "9811012345", applicant: "9700011004" } as const;

/** A fresh, unused mobile number for tests that need a new account. */
export const newPhone = () => `7${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

type Json = Record<string, unknown>;

type Session = { accessToken: string; refreshToken: string; user: { id: string } };
const sessionCache = new Map<string, { at: number; session: Promise<Session> }>();

/**
 * Signs in through the API with the development code. Sessions are reused
 * for a few minutes per phone, since sign in codes are rate limited.
 */
export function apiSession(phone: string, name?: string): Promise<Session> {
  const hit = sessionCache.get(phone);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.session;
  const session = signInByApi(phone, name);
  sessionCache.set(phone, { at: Date.now(), session });
  session.catch(() => sessionCache.delete(phone));
  return session;
}

async function signInByApi(phone: string, name?: string, retry = true): Promise<Session> {
  const post = async (p: string, body: Json) => {
    const r = await fetch(`${API}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await r.json()) as Json;
    if (!r.ok) throw Object.assign(new Error(`${p} ${r.status}: ${JSON.stringify(json)}`), { status: r.status });
    return json;
  };
  try {
    const otp = await post("/v1/auth/otp", { phone });
    const s = await post("/v1/auth/otp/verify", { challengeId: otp.challengeId, code: otp.devCode, name });
    return { accessToken: s.accessToken as string, refreshToken: s.refreshToken as string, user: s.user as { id: string } };
  } catch (e) {
    // other test files sign the same demo accounts in; clear the development rate limit once
    if (!retry || (e as { status?: number }).status !== 429) throw e;
    await fetch(`${API}/v1/dev/rate-limits/reset`, { method: "POST" });
    return signInByApi(phone, name, false);
  }
}

/** Calls the API as a session. Throws with the problem details on failure. */
export function apiAs(session: { accessToken: string }) {
  const call = async <T = Json>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> => {
    const r = await fetch(`${API}${p}`, {
      method,
      headers: { authorization: `Bearer ${session.accessToken}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${text}`);
    return (text ? JSON.parse(text) : null) as T;
  };
  return {
    get: <T = Json>(p: string) => call<T>("GET", p),
    post: <T = Json>(p: string, body?: unknown, headers?: Record<string, string>) => call<T>("POST", p, body ?? {}, headers),
    patch: <T = Json>(p: string, body: unknown) => call<T>("PATCH", p, body),
    put: <T = Json>(p: string, body: unknown) => call<T>("PUT", p, body),
  };
}

type Api = ReturnType<typeof apiAs>;

/** Places and pays (sandbox UPI) an order for one unit of a product from Apex Retail; returns the order and its item. */
export async function paidOrder(shopper: Api, slug: string) {
  const product = await shopper.get<{ offers: { id: string; seller: { id: string } }[] }>(`/v1/products/${slug}`);
  const offer = product.offers.find((o) => o.seller.id === "s-apex");
  if (!offer) throw new Error(`Apex Retail does not sell ${slug}`);
  const [address] = await shopper.get<{ id: string }[]>("/v1/me/addresses");
  const placed = await shopper.post<{ order: { id: string }; payment: { id: string } }>("/v1/orders", { addressId: address!.id, paymentMethod: "UPI", lines: [{ offerId: offer.id, qty: 1, variant: "" }] }, { "idempotency-key": crypto.randomUUID() });
  await shopper.post(`/v1/payments/${placed.payment.id}/sandbox/complete`, { outcome: "SUCCESS" });
  const order = await shopper.get<{ id: string; items: { id: string }[] }>(`/v1/me/orders/${placed.order.id}`);
  return { orderId: order.id, itemId: order.items[0]!.id };
}

/** Takes a paid item through the seller's steps and simulated courier scans to delivered. */
export async function deliver(seller: Api, itemId: string, deliveredDaysAgo?: number) {
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await seller.post("/v1/seller/order-items/transition", { ids: [itemId], to });
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY"]) await seller.post("/v1/dev/logistics/advance", { orderItemId: itemId, to });
  await seller.post("/v1/dev/logistics/advance", { orderItemId: itemId, to: "DELIVERED", deliveredDaysAgo });
}

/** A return request body for an item, refunded to the source, picked up today. */
export const returnRequest = (itemId: string, extra: Json = {}) => ({
  orderItemId: itemId,
  qty: 1,
  reasonCode: "DEFECTIVE",
  reasonLabel: "Item is defective or not working",
  fault: "SELLER",
  resolution: "REFUND",
  refundTo: "SOURCE",
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupSlot: "10 AM to 1 PM",
  photoIds: [],
  ...extra,
});

/** A browser context already signed in as this phone (httpOnly session cookies, like a real sign in). */
export async function signedIn(browser: Browser, phone: string, name?: string): Promise<BrowserContext> {
  const s = await apiSession(phone, name);
  const ctx = await browser.newContext();
  const host = new URL(WEB).hostname;
  await ctx.addCookies([
    { name: "bb_at", value: s.accessToken, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "bb_rt", value: s.refreshToken, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  return ctx;
}

/** Signs in through the real sign in form with the development code. */
export async function signInWithForm(page: Page, phone: string) {
  await page.fill("#mobile", phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByRole("button", { name: "Fill it in" }).click();
  await page.getByRole("button", { name: "Verify and sign in" }).click();
}

/**
 * Records page crashes and console errors (React warnings such as duplicate
 * keys arrive as console errors in development).
 */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // the browser reports failed resource loads separately from app errors
    if (/Failed to load resource/.test(text)) return;
    errors.push(`console: ${text.slice(0, 400)}`);
  });
  return errors;
}

export async function expectNoErrors(errors: string[], where: string) {
  expect(errors, `errors on ${where}`).toEqual([]);
}

/* ------------------------------- Routes ------------------------------- */

const APP = path.resolve(__dirname, "../../src/app");

type Route = { route: string; re: RegExp; dynamic: boolean; kind: "page" | "handler" };

/** Every page and route handler, from the app directory (route groups removed, [param] matches one segment). */
export function appRoutes(): Route[] {
  const out: Route[] = [];
  const toRe = (segs: string[]) => new RegExp(`^${segs.map((s) => "/" + (s.startsWith("[") ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("")}/?$`);
  const walk = (dir: string, segs: string[]) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name.startsWith("_") || name.startsWith("@")) continue;
        walk(full, name.startsWith("(") ? segs : [...segs, name]);
      } else if (name === "page.tsx" || name === "route.ts") {
        out.push({ route: `/${segs.join("/")}`, re: segs.length ? toRe(segs) : /^\/$/, dynamic: segs.some((s) => s.startsWith("[")), kind: name === "page.tsx" ? "page" : "handler" });
      }
    }
  };
  walk(APP, []);
  // static routes win over dynamic ones
  return out.sort((a, b) => Number(a.dynamic) - Number(b.dynamic));
}

export function routeOf(pathname: string, routes = appRoutes()) {
  return routes.find((r) => r.re.test(pathname)) ?? null;
}

/* ------------------------------ Crawling ------------------------------ */

export interface Area {
  name: string;
  phone: string | null;
  roots: string[];
  include: RegExp;
  exclude?: RegExp;
}

/** Workspaces and the role that uses each. */
export const AREAS: Area[] = [
  {
    name: "storefront and public pages",
    phone: null,
    roots: ["/", "/portals", "/sell", "/careers", "/login", "/signup", "/seller/register", "/s?q=laptop"],
    include: /^\//,
    exclude: /^\/(account|checkout|order|seller|admin|logistics|support)(\/|$)/,
  },
  { name: "My Account and checkout", phone: PHONES.shopper, roots: ["/account", "/cart", "/checkout"], include: /^\/(account|cart|checkout)(\/|$)/ },
  { name: "Seller Hub", phone: PHONES.seller, roots: ["/seller"], include: /^\/seller(\/|$)/, exclude: /^\/seller\/register/ },
  { name: "BluBuy Control", phone: PHONES.staff, roots: ["/admin"], include: /^\/admin(\/|$)/ },
  { name: "Hub Console", phone: PHONES.staff, roots: ["/logistics"], include: /^\/logistics(\/|$)/ },
  { name: "Care Desk", phone: PHONES.staff, roots: ["/support"], include: /^\/support(\/|$)/ },
];

/**
 * Breadth first walk over the links of an area. Calls `visit` on each page;
 * dynamic routes are sampled `perDynamic` times.
 */
export async function crawl(page: Page, area: Area, opts: { perDynamic: number; max: number }, visit: (target: string) => Promise<void>, onMissing?: (from: string, href: string) => void) {
  const routes = appRoutes();
  const seen = new Set<string>();
  const perRoute = new Map<string, number>();
  const queue = [...area.roots];
  let visited = 0;
  while (queue.length && visited < opts.max) {
    const target = queue.shift()!;
    if (seen.has(target)) continue;
    seen.add(target);
    visited++;
    await visit(target);
    const from = new URL(page.url()).pathname;
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? "").filter((h) => h.startsWith("/") && !h.startsWith("//")));
    for (const href of hrefs) {
      const p = new URL(href, "http://x").pathname;
      if (!area.include.test(p) || area.exclude?.test(p)) continue;
      const route = routeOf(p, routes);
      if (!route) {
        onMissing?.(from, p);
        continue;
      }
      if (route.kind === "handler") continue;
      // tabs and filters in the query string are the same page
      const key = route.dynamic ? p : route.route;
      if (seen.has(key) || queue.includes(key)) continue;
      const n = perRoute.get(route.route) ?? 0;
      if (route.dynamic && n >= opts.perDynamic) continue;
      perRoute.set(route.route, n + 1);
      queue.push(key);
    }
  }
  return visited;
}
