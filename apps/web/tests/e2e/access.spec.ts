import { expect, test } from "@playwright/test";
import { PHONES, signedIn } from "./support";

/** Who can reach which workspace. */

test("signed-out visitors are sent to the right sign in", async ({ page }) => {
  for (const [path, as] of [
    ["/account/orders", null],
    ["/checkout", null],
    ["/admin", "staff"],
    ["/support", "staff"],
  ] as const) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}${as ? `&as=${as}` : ""}`));
  }
});

test("a shopper is kept out of AltasGoods Control and Care Desk", async ({ browser }) => {
  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  for (const path of ["/admin", "/support"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/as=staff&denied=1/);
    await expect(page.locator("p[role=alert]")).toContainText("no AltasGoods staff access");
  }
  await ctx.close();
});

test("the marketplace seller pages are gone", async ({ page, browser }) => {
  for (const path of ["/seller", "/seller/register", "/sell", "/sell/fees", "/store/apex-retail"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  const ctx = await signedIn(browser, PHONES.staff);
  const staff = await ctx.newPage();
  for (const path of ["/admin/sellers", "/admin/sellers/approvals", "/admin/payouts", "/admin/fees", "/admin/ads"]) {
    const r = await staff.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await ctx.close();
});

test("the Plus, AltasCoins and ads pages are gone", async ({ page, browser }) => {
  for (const path of ["/plus", "/account/plus", "/account/rewards"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  const ctx = await signedIn(browser, PHONES.staff);
  const staff = await ctx.newPage();
  for (const path of ["/admin/ads", "/admin/ads/campaigns", "/admin/ads/reports"]) {
    const r = await staff.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await ctx.close();
});
