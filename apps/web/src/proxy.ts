import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic session handling (no database work here):
 * 1. refreshes an expired or expiring access token with the refresh token, and
 *    hands the new token to this same request so Server Components see it;
 * 2. sends signed-out visitors of protected areas to sign in;
 * 3. keeps BluBuy Control to staff and Seller Hub to seller accounts.
 * Real authorisation happens in the API on every call.
 */
const ACCESS = "bb_at";
const REFRESH = "bb_rt";
const PROTECTED = [/^\/account(\/|$)/, /^\/checkout(\/|$)/, /^\/order\//, /^\/seller(\/|$)/, /^\/admin(\/|$)/, /^\/support(\/|$)/];
const STAFF_AREAS = /^\/(admin|support)(\/|$)/;
const OPEN = [/^\/seller\/register(\/|$)/];

const apiUrl = () => process.env.BLUBUY_API_URL ?? "http://localhost:4000";
const cookieBase = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };

function claims(token?: string): { exp: number; sellers: string[]; staff: string[] } | null {
  if (!token) return null;
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return { exp: Number(p.exp), sellers: p.sellers ?? [], staff: p.staff ?? [] };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  let access = req.cookies.get(ACCESS)?.value;
  const refresh = req.cookies.get(REFRESH)?.value;
  let refreshed: { accessToken: string; refreshToken: string } | null = null;
  let clear = false;

  const path = req.nextUrl.pathname;
  const current = claims(access);
  // grants live in the token: refresh once when an area needs one the token lacks,
  // so a seller approved (or staff role granted) since sign in gets straight in
  const lacksGrant = !!current && ((path.startsWith("/seller") && !OPEN.some((r) => r.test(path)) && !current.sellers.length) || (STAFF_AREAS.test(path) && !current.staff.length));
  if ((!current || current.exp * 1000 < Date.now() + 30_000 || lacksGrant) && refresh) {
    try {
      const r = await fetch(`${apiUrl()}/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        refreshed = await r.json();
        access = refreshed!.accessToken;
        req.cookies.set(ACCESS, refreshed!.accessToken);
        req.cookies.set(REFRESH, refreshed!.refreshToken);
      } else if (r.status === 401) {
        clear = true;
        access = undefined;
        req.cookies.delete(ACCESS);
        req.cookies.delete(REFRESH);
      }
    } catch {
      // API unreachable: carry on, pages show their own offline state
    }
  }

  const session = claims(access);
  const signedIn = !!session && session.exp * 1000 > Date.now();
  let res: NextResponse;
  if (PROTECTED.some((r) => r.test(path)) && !OPEN.some((r) => r.test(path)) && !signedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", path + req.nextUrl.search);
    if (path.startsWith("/seller")) url.searchParams.set("as", "seller");
    if (STAFF_AREAS.test(path)) url.searchParams.set("as", "staff");
    res = NextResponse.redirect(url);
  } else if (signedIn && STAFF_AREAS.test(path) && !session!.staff.length) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", path + req.nextUrl.search);
    url.searchParams.set("as", "staff");
    url.searchParams.set("denied", "1");
    res = NextResponse.redirect(url);
  } else if (signedIn && path.startsWith("/seller") && !OPEN.some((r) => r.test(path)) && !session!.sellers.length) {
    res = NextResponse.redirect(new URL("/seller/register", req.url));
  } else {
    res = NextResponse.next({ request: { headers: req.headers } });
  }

  if (refreshed) {
    res.cookies.set({ name: ACCESS, value: refreshed.accessToken, ...cookieBase, maxAge: 15 * 60 });
    res.cookies.set({ name: REFRESH, value: refreshed.refreshToken, ...cookieBase, maxAge: 30 * 24 * 3600 });
  } else if (clear) {
    res.cookies.delete(ACCESS);
    res.cookies.delete(REFRESH);
  }
  return res;
}

export const config = {
  // pages only: skip static files, images and Next internals
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
