import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

/** An access token as the proxy reads it: only the payload matters, the API checks the signature. */
function token(claims: { staff?: string[]; pwc?: boolean }) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part({ sub: "u1", sid: "s1", exp: Math.floor(Date.now() / 1000) + 600, ...claims })}.sig`;
}

/** Runs the proxy for a signed-in visitor (no refresh cookie, so it never calls the API). */
async function visit(path: string, claims: { staff?: string[]; pwc?: boolean }) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"), { headers: { cookie: `bb_at=${token(claims)}` } });
  const res = await proxy(req);
  const location = res.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe("staff areas in the proxy", () => {
  it("sends a Catalog Manager to the catalog instead of pages outside their role", async () => {
    expect(await visit("/admin", { staff: ["CATALOG_MANAGER"] })).toBe("/admin/catalog");
    expect(await visit("/admin/orders", { staff: ["CATALOG_MANAGER"] })).toBe("/admin/catalog");
    expect(await visit("/admin/catalog/abc", { staff: ["CATALOG_MANAGER"] })).toBeNull();
    expect(await visit("/logistics", { staff: ["CATALOG_MANAGER"] })).toMatch(/^\/login\?.*denied=1/);
  });

  it("lets an Auditor open every admin page but staff", async () => {
    for (const path of ["/admin", "/admin/settings", "/admin/orders/AG-1", "/admin/audit"]) expect(await visit(path, { staff: ["AUDITOR"] })).toBeNull();
    expect(await visit("/admin/staff", { staff: ["AUDITOR"] })).toBe("/admin");
  });

  it("keeps staff management to Super Admins", async () => {
    expect(await visit("/admin/staff", { staff: ["OPS_ADMIN"] })).toBe("/admin");
    expect(await visit("/admin/staff", { staff: ["SUPER_ADMIN"] })).toBeNull();
  });

  it("keeps the Care Desk and AltasGoods Control apart", async () => {
    expect(await visit("/admin", { staff: ["SUPPORT_AGENT"] })).toMatch(/^\/login\?.*denied=1/);
    expect(await visit("/support/tickets", { staff: ["SUPPORT_AGENT"] })).toBeNull();
    expect(await visit("/support", { staff: ["OPS_ADMIN"] })).toMatch(/^\/login\?.*denied=1/);
  });

  it("sends staff with a temporary password to change it first", async () => {
    expect(await visit("/admin/catalog", { staff: ["CATALOG_MANAGER"], pwc: true })).toBe("/account/profile?change=1");
    expect(await visit("/support", { staff: ["SUPPORT_AGENT"], pwc: true })).toBe("/account/profile?change=1");
    expect(await visit("/account/profile", { staff: ["CATALOG_MANAGER"], pwc: true })).toBeNull();
  });
});

describe("refreshing in the proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tells the API who the visitor is, so the session records the real client", async () => {
    const fetchMock = vi.fn(async () => Response.json({ accessToken: token({}), refreshToken: "rt-2", expiresIn: 900 }));
    vi.stubGlobal("fetch", fetchMock);
    const req = new NextRequest(new URL("/account", "http://localhost:3000"), {
      headers: { cookie: "bb_rt=rt-1", "x-forwarded-for": "198.51.100.1, 203.0.113.7", "user-agent": "Mozilla/5.0 Firefox" },
    });
    const res = await proxy(req);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/auth\/refresh$/);
    expect(new Headers(init.headers).get("x-forwarded-for")).toBe("198.51.100.1, 203.0.113.7");
    expect(new Headers(init.headers).get("user-agent")).toBe("Mozilla/5.0 Firefox");
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: "rt-1" });
    expect(res.cookies.get("bb_rt")?.value).toBe("rt-2");
  });
});
