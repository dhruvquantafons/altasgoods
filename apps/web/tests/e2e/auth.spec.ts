import { expect, test } from "@playwright/test";
import { ACCOUNTS, signInWithForm, watchErrors } from "./support";

/** Sign up, sign in and password resets, through the real forms. */

const fresh = () => `e2e.${Date.now()}.${Math.floor(Math.random() * 1e6)}@altasgoods.test`;

test("a shopper signs up, signs out and signs back in", async ({ page }) => {
  const errors = watchErrors(page);
  const email = fresh();
  await page.goto("/signup");
  await page.fill("#su-name", "Priya Raman");
  await page.fill("#su-email", email);
  await page.fill("#su-password", "short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  await page.fill("#su-password", "a-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);

  // an existing email is turned away with a way to sign in
  await page.context().clearCookies();
  await page.goto("/signup");
  await page.fill("#su-name", "Someone Else");
  await page.fill("#su-email", email.toUpperCase());
  await page.fill("#su-password", "another-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: "Sign in instead" })).toBeVisible();

  await page.goto("/login?next=/account/orders");
  await signInWithForm(page, email, "a-long-password");
  await expect(page).toHaveURL(/\/account\/orders$/);
  expect(errors).toEqual([]);
});

test("a wrong password is refused without saying whether the email exists", async ({ page }) => {
  await page.goto("/login");
  await signInWithForm(page, ACCOUNTS.shopper, "not-the-password");
  await expect(page.locator("p[role=alert]")).toContainText("do not match");
  await signInWithForm(page, "nobody.here@altasgoods.test", "not-the-password");
  await expect(page.locator("p[role=alert]")).toContainText("do not match");
});

test("a forgotten password is reset with the emailed code", async ({ page }) => {
  const errors = watchErrors(page);
  const email = fresh();
  await page.goto("/signup");
  await page.fill("#su-name", "Forgetful Shopper");
  await page.fill("#su-email", email);
  await page.fill("#su-password", "first-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.context().clearCookies();

  await page.goto("/login?next=/account");
  await page.fill("#login-email", email);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.locator("#forgot-email")).toHaveValue(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  // outside production the API hands the code back, so no inbox is needed
  await page.getByRole("button", { name: "Fill it in" }).click();
  await page.fill("#reset-password", "second-password");
  await page.getByRole("button", { name: "Set new password and sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.context().clearCookies();
  await page.goto("/login");
  await signInWithForm(page, email, "first-password");
  await expect(page.locator("p[role=alert]")).toContainText("do not match");
  await signInWithForm(page, email, "second-password");
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("staff sign in to AltasGoods Control with email and password", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/as=staff/);
  await expect(page.getByRole("heading", { name: "Sign in to AltasGoods Control" })).toBeVisible();
  await signInWithForm(page, ACCOUNTS.staff);
  await expect(page).toHaveURL(/\/admin$/);
});
