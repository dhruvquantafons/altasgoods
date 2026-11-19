import { expect, test } from "@playwright/test";
import { ACCOUNTS, API, apiAs, apiSession, deliver, E2E_PASSWORD, newShopperByApi, paidOrder, resetRateLimits, signedIn, signInWithForm, watchErrors } from "./support";

/** Journeys added with the go live work: staff, content, buy again, account deletion and delivery areas. */

const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test("a Super Admin adds staff with a temporary password, who must choose their own and then sees only their role's menu", async ({ browser }) => {
  await resetRateLimits();
  const email = `e2e.staff.${stamp()}@altasgoods.test`;
  const temp = "Temp-pass-4821";
  const mine = "My-own-pass-7733";

  const adminCtx = await signedIn(browser, ACCOUNTS.staff);
  const admin = await adminCtx.newPage();
  const adminErrors = watchErrors(admin);
  await admin.goto("/admin/staff");
  await admin.getByRole("button", { name: "Add staff" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Catalog Colleague");
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Catalog Manager").check();
  await dialog.getByLabel("Set a temporary password").check();
  await dialog.locator("#st-temp").fill(temp);
  await dialog.getByRole("button", { name: "Add staff member" }).click();
  await expect(admin.getByText("Catalog Colleague is added")).toBeVisible();
  await expect(admin.getByRole("cell", { name: new RegExp(email.replace(".", "\\.")) })).toBeVisible();
  expect(adminErrors).toEqual([]);
  await adminCtx.close();

  // the new staff member signs in with the temporary password and is held on the change password step
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto("/login?as=staff");
  await signInWithForm(page, email, temp);
  await expect(page).toHaveURL(/\/account\/profile/);
  await expect(page.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  // the admin is closed to them until they do
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/profile/);

  await page.locator("#pw-current").fill(temp);
  await page.locator("#pw-new").fill(mine);
  await page.getByRole("dialog").getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/admin/);

  // only a Catalog Manager's menu
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Products" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pages and content" })).toBeVisible();
  for (const hidden of ["Orders", "Payments", "Staff", "Settings"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).not.toHaveURL(/\/admin\/staff$/);
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a policy section edited in Pages and content shows on the policy page", async ({ browser }) => {
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const sentence = `Edited by the e2e suite ${stamp()}.`;

  await page.goto("/admin/content");
  await page.getByRole("button", { name: /^Edit Cancellation/ }).click();
  const body = page.getByRole("dialog").getByLabel("Text (Markdown)").first();
  await body.fill(`${sentence}\n\n${await body.inputValue()}`);
  await expect(page.getByRole("dialog").getByLabel("Preview of section 1").getByText(sentence)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Page saved")).toBeVisible();

  const shop = await browser.newContext();
  const policy = await shop.newPage();
  // the storefront caches content for up to a minute, so look again until it is there
  await expect(async () => {
    await policy.goto("/policies/cancellation");
    await expect(policy.getByText(sentence)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 75_000 });
  await shop.close();
  expect(errors).toEqual([]);
  await ctx.close();
});

test("Buy again on a delivered order puts the item in the cart", async ({ browser }) => {
  const { shopper } = await newShopperByApi("Divya Menon");
  const staff = apiAs(await apiSession(ACCOUNTS.staff));
  const { orderId, itemId } = await paidOrder(shopper, "tea-assam");
  await deliver(staff, itemId);
  await shopper.put("/v1/cart", { lines: [] });

  const ctx = await signedIn(browser, (await shopper.get<{ email: string }>("/v1/me")).email);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/account/orders/${orderId}`);
  await page.getByRole("button", { name: "Buy again" }).first().click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
  await expect(page.getByText(/Assam/i).first()).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a customer with no open orders deletes the account, is signed out and cannot sign in again", async ({ browser }) => {
  const { email, shopper } = await newShopperByApi("Leela Nair");
  expect(await shopper.get("/v1/me")).toBeTruthy();

  const ctx = await signedIn(browser, email);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.locator("#delete-password").fill("wrong-password-1");
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#delete-password").fill(E2E_PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/signed-out\?deleted=1/);

  // signed out: the account is closed to the old cookies, and the password no longer works
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  const again = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: E2E_PASSWORD }) });
  expect(again.ok).toBe(false);
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a pincode prefix blocked in Settings is refused at checkout with a clear message", async ({ browser }) => {
  const admin = apiAs(await apiSession(ACCOUNTS.staff));
  const { email, shopper } = await newShopperByApi("Kiran Rao", { pincode: "561101", line1: "3, Lake Road", isDefault: true });
  await shopper.put("/v1/cart", { lines: [] });

  // blocked in the admin, through the Settings form
  const adminCtx = await signedIn(browser, ACCOUNTS.staff);
  const settings = await adminCtx.newPage();
  await settings.goto("/admin/settings");
  const blocked = settings.getByLabel("Do not deliver to");
  const before = await blocked.inputValue();
  await blocked.fill(`${before}\n5611`.trim());
  await settings.getByRole("button", { name: "Save settings" }).click();
  await expect(settings.getByText("Settings saved")).toBeVisible();

  const ctx = await signedIn(browser, email);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  try {
    await page.goto("/p/tea-assam");
    await page.locator("#buy-actions").getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
    await page.goto("/cart");
    await page.getByRole("link", { name: "Place order" }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByText("Not deliverable to this pincode yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deliver to this address" })).toBeDisabled();
    // and the order itself is refused by the API
    const [address] = await shopper.get<{ id: string }[]>("/v1/me/addresses");
    const product = await shopper.get<{ offerId: string }>("/v1/products/tea-assam");
    await expect(shopper.post("/v1/orders", { addressId: address!.id, paymentMethod: "UPI", lines: [{ offerId: product.offerId, qty: 1, variant: "" }] }, { "idempotency-key": crypto.randomUUID() })).rejects.toThrow(/PINCODE_UNSERVICEABLE|deliver to 561101/);
  } finally {
    // put the area list back as it was
    const now = await admin.get<Record<string, unknown> & { delivery?: unknown }>("/v1/admin/settings");
    delete now.updatedAt;
    delete now.updatedBy;
    const areas = (now as { delivery?: { areas?: { blocked: string[] } } }).delivery?.areas;
    if (areas) areas.blocked = areas.blocked.filter((p) => p !== "5611");
    await admin.put("/v1/admin/settings", now);
  }
  expect(errors).toEqual([]);
  await ctx.close();
  await adminCtx.close();
});
