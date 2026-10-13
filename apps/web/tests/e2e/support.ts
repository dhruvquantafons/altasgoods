import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const API = process.env.E2E_API_URL ?? "http://localhost:4000";

/** Accounts global-setup.ts creates through sign up and `npm run admin:create`; nothing is seeded. */
export const E2E_PASSWORD = "e2e-password-1234";
export const ACCOUNTS = {
  shopper: "e2e.shopper@altasgoods.test",
  staff: "e2e.admin@altasgoods.test",
  /** Care agents, named so the Care Desk shows them as in the support specs */
  revathi: "e2e.revathi@altasgoods.test",
  megha: "e2e.megha@altasgoods.test",
} as const;

type Json = Record<string, unknown>;

type Session = { accessToken: string; refreshToken: string; user: { id: string } };
const sessionCache = new Map<string, { at: number; session: Promise<Session> }>();

/** Signs in through the API with email and password. Sessions are reused for a few minutes per account. */
export function apiSession(email: string, password = E2E_PASSWORD): Promise<Session> {
  const hit = sessionCache.get(email);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.session;
  const session = signInByApi(email, password);
  sessionCache.set(email, { at: Date.now(), session });
  session.catch(() => sessionCache.delete(email));
  return session;
}

async function signInByApi(email: string, password: string): Promise<Session> {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const s = (await r.json()) as Json;
  if (!r.ok) throw new Error(`/v1/auth/login ${email} ${r.status}: ${JSON.stringify(s)}`);
  return { accessToken: s.accessToken as string, refreshToken: s.refreshToken as string, user: s.user as { id: string } };
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

/** Places and pays (sandbox UPI) an order for one unit of a product; returns the order and its item. */
export async function paidOrder(shopper: Api, slug: string) {
  const product = await shopper.get<{ offerId: string }>(`/v1/products/${slug}`);
  const [address] = await shopper.get<{ id: string }[]>("/v1/me/addresses");
  const placed = await shopper.post<{ order: { id: string }; payment: { id: string } }>("/v1/orders", { addressId: address!.id, paymentMethod: "UPI", lines: [{ offerId: product.offerId, qty: 1, variant: "" }] }, { "idempotency-key": crypto.randomUUID() });
  await shopper.post(`/v1/payments/${placed.payment.id}/sandbox/complete`, { outcome: "SUCCESS" });
  const order = await shopper.get<{ id: string; items: { id: string }[] }>(`/v1/me/orders/${placed.order.id}`);
  return { orderId: order.id, itemId: order.items[0]!.id };
}

/** Takes a paid item through the store's fulfilment steps and simulated courier scans to delivered. */
export async function deliver(staff: Api, itemId: string, deliveredDaysAgo?: number) {
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await staff.post("/v1/admin/order-items/transition", { ids: [itemId], to });
  for (const to of ["SHIPPED", "OUT_FOR_DELIVERY"]) await staff.post("/v1/dev/logistics/advance", { orderItemId: itemId, to });
  await staff.post("/v1/dev/logistics/advance", { orderItemId: itemId, to: "DELIVERED", deliveredDaysAgo });
}

/** A return request body for an item, refunded to the source, picked up today. */
export const returnRequest = (itemId: string, extra: Json = {}) => ({
  orderItemId: itemId,
  qty: 1,
  reasonCode: "DEFECTIVE",
  reasonLabel: "Item is defective or not working",
  fault: "STORE",
  resolution: "REFUND",
  refundTo: "SOURCE",
  pickupDate: new Date().toISOString().slice(0, 10),
  pickupSlot: "10 AM to 1 PM",
  photoIds: [],
  ...extra,
});

/** A browser context already signed in as this account (httpOnly session cookies, like a real sign in). */
export async function signedIn(browser: Browser, email: string): Promise<BrowserContext> {
  const s = await apiSession(email);
  const ctx = await browser.newContext();
  const host = new URL(WEB).hostname;
  await ctx.addCookies([
    { name: "bb_at", value: s.accessToken, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "bb_rt", value: s.refreshToken, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  return ctx;
}

/** Signs in through the real sign in form. */
export async function signInWithForm(page: Page, email: string, password = E2E_PASSWORD) {
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
  account: string | null;
  roots: string[];
  include: RegExp;
  exclude?: RegExp;
}

/** Workspaces and the role that uses each. */
export const AREAS: Area[] = [
  {
    name: "storefront and public pages",
    account: null,
    roots: ["/", "/portals", "/careers", "/login", "/signup", "/forgot-password", "/s?q=laptop"],
    include: /^\//,
    exclude: /^\/(account|checkout|order|admin|logistics|support)(\/|$)/,
  },
  { name: "My Account and checkout", account: ACCOUNTS.shopper, roots: ["/account", "/cart", "/checkout"], include: /^\/(account|cart|checkout)(\/|$)/ },
  { name: "AltasGoods Control", account: ACCOUNTS.staff, roots: ["/admin"], include: /^\/admin(\/|$)/ },
  { name: "Hub Console", account: ACCOUNTS.staff, roots: ["/logistics"], include: /^\/logistics(\/|$)/ },
  { name: "Care Desk", account: ACCOUNTS.staff, roots: ["/support"], include: /^\/support(\/|$)/ },
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
