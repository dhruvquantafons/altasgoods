import { expect, test, type Page } from "@playwright/test";
import { signInWithForm, watchErrors } from "./support";

/** My Account shows and saves the signed-in shopper's own details. */

const fresh = () => `e2e.acct.${Date.now()}.${Math.floor(Math.random() * 1e6)}@altasgoods.test`;

async function newShopper(page: Page, name: string, password = "first-password") {
  const email = fresh();
  await page.goto("/signup");
  await page.fill("#su-name", name);
  await page.fill("#su-email", email);
  await page.fill("#su-password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

test("the account shows the shopper's own name, and profile changes are saved", async ({ page }) => {
  const errors = watchErrors(page);
  const email = await newShopper(page, "Meera Pai");

  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meera");
  await expect(page.getByText("Ananya")).toHaveCount(0);

  await page.goto("/account/profile");
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.fill("#pf-name", "Meera Krishna Pai");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Meera Krishna Pai").first()).toBeVisible();

  await page.getByRole("button", { name: "Change password" }).click();
  await page.fill("#pw-current", "wrong-password");
  await page.fill("#pw-new", "second-password");
  await page.getByRole("dialog").getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("current password is not right")).toBeVisible();
  await page.fill("#pw-current", "first-password");
  await page.getByRole("dialog").getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await signInWithForm(page, email, "second-password");
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("addresses are saved to the account", async ({ page }) => {
  await newShopper(page, "Arjun Rao");
  await page.goto("/account/addresses");
  for (const [line1, pin] of [
    ["12, 4th Cross, Indiranagar", "560038"],
    ["Flat 3B, Lake View Apartments", "560087"],
  ]) {
    await page.getByRole("button", { name: "Add a new address" }).click();
    await page.fill("#ad-name", "Arjun Rao");
    await page.fill("#ad-mobile", "9845011111");
    await page.fill("#ad-pin", pin!);
    await page.fill("#ad-l1", line1!);
    await page.fill("#ad-l2", "Bengaluru East");
    await page.fill("#ad-city", "Bengaluru");
    await page.selectOption("#ad-state", "Karnataka");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText(line1!)).toBeVisible();
  }

  // still there after a reload, and the default can move
  await page.reload();
  await expect(page.getByText("Flat 3B, Lake View Apartments")).toBeVisible();
  await page.getByRole("button", { name: "Set as default" }).click();
  await expect(page.getByText("Default address updated")).toBeVisible();
  await page.reload();
  const card = page.locator("article", { hasText: "Flat 3B, Lake View Apartments" });
  await expect(card.getByText("Default")).toBeVisible();

  await card.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Flat 3B, Lake View Apartments")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("article", { hasText: "12, 4th Cross, Indiranagar" }).getByText("Default")).toBeVisible();
});

test("the wishlist holds what the shopper saved, and pages with no data behind them are gone", async ({ page }) => {
  await newShopper(page, "Sana Iqbal");
  await page.goto("/account/wishlist");
  await expect(page.getByText("Your wishlist is empty")).toBeVisible();

  await page.goto("/p/headphones-studio");
  await page.getByRole("button", { name: /^Save .* to wishlist$/ }).first().click();
  await page.goto("/account/wishlist");
  await expect(page.getByText("1 saved item")).toBeVisible();
  await page.getByRole("button", { name: /^Remove .* from wishlist$/ }).click();
  await expect(page.getByText("Your wishlist is empty")).toBeVisible();

  for (const path of ["/account/wallet", "/account/payments", "/account/notifications"]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
});
