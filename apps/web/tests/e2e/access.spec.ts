import { expect, test } from "@playwright/test";
import { PHONES, signedIn, signInWithForm, watchErrors } from "./support";

/** Who can reach which workspace, and the ways into Seller Hub. */

test("signed-out visitors are sent to the right sign in", async ({ page }) => {
  for (const [path, as] of [
    ["/account/orders", null],
    ["/checkout", null],
    ["/seller", "seller"],
    ["/admin", "staff"],
    ["/support", "staff"],
  ] as const) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}${as ? `&as=${as}` : ""}`));
  }
});

test("a shopper is kept out of BluBuy Control and Care Desk", async ({ browser }) => {
  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  for (const path of ["/admin", "/support"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/as=staff&denied=1/);
    await expect(page.locator("p[role=alert]")).toContainText("no BluBuy staff access");
  }
  // a shopper visiting Seller Hub is offered registration
  await page.goto("/seller");
  await expect(page).toHaveURL(/\/seller\/register$/);
  await ctx.close();
});

for (const [where, linkName] of [
  ["/seller/register", "Already selling? Sign in"],
  ["/sell", "Seller Hub login"],
] as const) {
  test(`"${linkName}" on ${where} switches a shopper to their seller account`, async ({ browser }) => {
    const ctx = await signedIn(browser, PHONES.shopper);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto(where);
    await page.locator("main, header").getByRole("link", { name: linkName }).first().click();
    await expect(page).toHaveURL(/\/login\?next=%2Fseller&as=seller/);
    await expect(page.locator("p[role=alert]")).toContainText("You are signed in as Ananya Sharma, which has no seller account");
    await signInWithForm(page, PHONES.seller);
    await expect(page).toHaveURL(/\/seller$/);
    await expect(page.locator("h1").first()).toContainText("Rohan");
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("signed-out visitors reach Seller Hub through the seller sign in", async ({ page }) => {
  await page.goto("/seller/register");
  await page.getByRole("link", { name: "Already selling? Sign in" }).click();
  await signInWithForm(page, PHONES.seller);
  await expect(page).toHaveURL(/\/seller$/);
});

test("a seller goes straight to Seller Hub from the storefront", async ({ browser }) => {
  const ctx = await signedIn(browser, PHONES.seller);
  const page = await ctx.newPage();
  await page.goto("/sell");
  await page.locator("main").getByRole("link", { name: "Seller Hub login" }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await ctx.close();
});
