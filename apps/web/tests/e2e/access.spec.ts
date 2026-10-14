import { expect, test } from "@playwright/test";
import { ACCOUNTS, signedIn } from "./support";

/** Who can reach which workspace. */

test("signed-out visitors are sent to the right sign in", async ({ page }) => {
  for (const [path, as] of [
    ["/account/orders", null],
    ["/checkout", null],
    ["/admin", "staff"],
    ["/support", "staff"],
    ["/logistics", "staff"],
    ["/portals", "staff"],
  ] as const) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}${as ? `&as=${as}` : ""}`));
  }
});

test("a shopper is kept out of AltasGoods Control and Care Desk", async ({ browser }) => {
  const ctx = await signedIn(browser, ACCOUNTS.shopper);
  const page = await ctx.newPage();
  for (const path of ["/admin", "/support", "/logistics", "/portals"]) {
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
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const staff = await ctx.newPage();
  for (const path of ["/admin/sellers", "/admin/sellers/approvals", "/admin/payouts", "/admin/fees", "/admin/ads"]) {
    const r = await staff.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await ctx.close();
});

test("the Plus, AltasCoins and ads pages are gone", async ({ page, browser }) => {
  expect((await page.goto("/plus"))?.status(), "/plus").toBe(404);
  // My Account pages send signed-out visitors to sign in first, so check them signed in
  const shopperCtx = await signedIn(browser, ACCOUNTS.shopper);
  const shopper = await shopperCtx.newPage();
  for (const path of ["/account/plus", "/account/rewards"]) {
    const r = await shopper.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await shopperCtx.close();
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const staff = await ctx.newPage();
  for (const path of ["/admin/ads", "/admin/ads/campaigns", "/admin/ads/reports"]) {
    const r = await staff.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await ctx.close();
});

test("Shipping and the workspace launcher are for admins only", async ({ browser }) => {
  // a Care Desk agent is staff, but not an admin
  const agentCtx = await signedIn(browser, ACCOUNTS.revathi);
  const agent = await agentCtx.newPage();
  for (const path of ["/logistics", "/portals"]) {
    await agent.goto(path);
    await expect(agent, path).toHaveURL(/as=staff&denied=1/);
  }
  await agentCtx.close();

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const admin = await ctx.newPage();
  await admin.goto("/logistics");
  await expect(admin.getByRole("heading", { name: "Shipping", level: 1 })).toBeVisible();
  await admin.goto("/portals");
  await expect(admin.getByRole("heading", { name: "Workspaces", level: 1 })).toBeVisible();
  // the fleet pages a store on Shiprocket does not need are gone
  for (const path of ["/logistics/runs", "/logistics/ndr", "/logistics/associates", "/logistics/cod", "/logistics/inbound", "/logistics/associate-app"]) {
    const r = await admin.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  await ctx.close();
});
