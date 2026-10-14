import { expect, test } from "@playwright/test";
import { audited, closeDb, DATABASE_URL, row } from "./db";
import { ACCOUNTS, apiAs, apiSession, deliver, paidOrder, signedIn, watchErrors } from "./support";

/** AltasGoods Control on real data: settings take effect on the storefront, and every change is logged. */

type Settings = Record<string, Record<string, unknown>>;

test.afterAll(closeDb);

/** The settings without who saved them last, ready to send back. */
async function currentSettings(admin: ReturnType<typeof apiAs>) {
  const s = await admin.get<Settings & { updatedAt?: unknown; updatedBy?: unknown }>("/v1/admin/settings");
  delete s.updatedAt;
  delete s.updatedBy;
  return s as Settings;
}

test("a delivery fee changed in Settings shows in the cart, and the change is in the audit log", async ({ browser }) => {
  const admin = apiAs(await apiSession(ACCOUNTS.staff));
  const base = await currentSettings(admin);

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  try {
    await page.goto("/admin/settings");
    await page.fill("#st-delivery-fee", "75");
    await page.fill("#st-delivery-freeFrom", "100000");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    // a small order now pays the new fee
    const shop = await browser.newContext();
    const shopper = await shop.newPage();
    await shopper.goto("/p/tea-assam");
    await shopper.getByRole("button", { name: "Add to cart" }).first().click();
    await shopper.goto("/cart");
    await expect(shopper.getByText("₹75 on orders under ₹1,00,000")).toBeVisible();
    await shop.close();

    await page.goto("/admin/audit?area=settings");
    await expect(page.getByText(/delivery\.feePaise/).first()).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await admin.put("/v1/admin/settings", base);
    await ctx.close();
  }
});

test("settings saved in the admin are stored in the database and change the storefront", async ({ browser }) => {
  test.skip(!DATABASE_URL, "Set E2E_DATABASE_URL to the API's database to check what is stored");
  const admin = apiAs(await apiSession(ACCOUNTS.staff));
  const base = await admin.get<Record<string, unknown>>("/v1/admin/settings");
  delete base.updatedAt;
  delete base.updatedBy;
  const email = `hello.${Date.now().toString(36)}@altasgoods.test`;

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  try {
    await page.goto("/admin/settings");
    await page.fill("#st-delivery-fee", "65");
    await page.fill("#st-delivery-freeFrom", "100000");
    await page.fill("#st-company-email", email);
    await page.getByRole("switch", { name: "Show the notice" }).click();
    await page.fill("#st-notice", "Holi: orders placed on 14 March ship on 16 March");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    const stored = (await row<{ value: { delivery: { feePaise: number }; company: { email: string }; notice: { enabled: boolean; message: string } } }>(
      "select value from store_settings where id = 'store'",
    ))!.value;
    expect(stored.delivery.feePaise).toBe(6_500);
    expect(stored.company.email).toBe(email);
    expect(stored.notice).toEqual({ enabled: true, message: "Holi: orders placed on 14 March ship on 16 March" });
    expect(await audited("settings.update", "store")).toMatchObject({ actor_name: "E2E Admin" });

    const shop = await browser.newContext();
    const store = await shop.newPage();
    await store.goto("/contact");
    await expect(store.getByText(email).first()).toBeVisible();
    await expect(store.getByRole("status").filter({ hasText: "Holi: orders placed on 14 March" })).toBeVisible();
    await store.goto("/p/tea-assam");
    await store.getByRole("button", { name: "Add to cart" }).first().click();
    await store.goto("/cart");
    await expect(store.getByText("₹65 on orders under ₹1,00,000")).toBeVisible();
    await shop.close();
  } finally {
    await admin.put("/v1/admin/settings", base);
    await ctx.close();
  }
});

test("the storefront notice appears while it is switched on", async ({ browser }) => {
  const admin = apiAs(await apiSession(ACCOUNTS.staff));
  const base = await currentSettings(admin);
  try {
    await admin.put("/v1/admin/settings", { ...base, notice: { enabled: true, message: "Diwali: orders after 2 pm on 1 Nov ship on 3 Nov" } });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // the storefront caches settings for up to a minute; saving from the admin page refreshes it at once
    await expect(async () => {
      await page.goto("/help");
      await expect(page.getByRole("status").filter({ hasText: "Diwali: orders after 2 pm" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 75_000 });
    await ctx.close();
  } finally {
    await admin.put("/v1/admin/settings", base);
  }
});

test("the admin account page shows the signed-in staff member", async ({ browser }) => {
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  await page.goto("/admin/account");
  await expect(page.getByText(ACCOUNTS.staff)).toBeVisible();
  await expect(page.getByRole("main").getByText("Super Admin", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  await ctx.close();
});

test("overview, customers and payments show real orders", async ({ browser }) => {
  const shopper = apiAs(await apiSession(ACCOUNTS.shopper));
  const { orderId } = await paidOrder(shopper, "tea-assam");

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin");
  await expect(page.getByText("Sales today")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(orderId) }).first()).toBeVisible();

  await page.goto(`/admin/customers?q=${ACCOUNTS.shopper}`);
  await page.locator("tr", { hasText: ACCOUNTS.shopper }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ananya Sharma");
  await expect(page.getByRole("link", { name: orderId })).toBeVisible();
  await expect(page.getByRole("button", { name: "Block account" })).toBeVisible();

  await page.goto(`/admin/payments?q=${orderId}`);
  await expect(page.locator("tr", { hasText: orderId })).toContainText("Sandbox (test)");
  await page.getByRole("link", { name: "Refunds", exact: true }).click();
  await expect(page).toHaveURL(/tab=refunds/);

  for (const gone of ["/admin/team", "/admin/reports"]) expect((await page.goto(gone))?.status(), gone).toBe(404);
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a sale created in the admin lowers the product page price, and checkout charges it", async ({ browser }) => {
  const admin = apiAs(await apiSession(ACCOUNTS.staff));
  const shopper = apiAs(await apiSession(ACCOUNTS.shopper));
  const name = `Holi ${Date.now().toString(36)}`;
  const product = await shopper.get<{ id: string; offerId: string; pricePaise: number }>("/v1/products/tea-assam");
  const expected = Math.max(100, Math.floor((product.pricePaise * 70) / 10_000) * 100);

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  let saleId: string | undefined;
  try {
    await page.goto("/admin/promotions");
    await page.getByRole("button", { name: "New sale" }).click();
    await page.fill("#sl-name", name);
    await page.fill("#sl-pct", "30");
    await page.selectOption("#sl-scope", "PRODUCTS");
    await page.getByPlaceholder("Filter").fill("Assam");
    await page
      .getByRole("dialog")
      .getByText(/Assam Gold/)
      .first()
      .click();
    await page.getByRole("button", { name: "Create sale" }).click();
    await expect(page.getByText("Sale created")).toBeVisible();
    await expect(page.locator("tr", { hasText: name })).toContainText("Live");
    saleId = (await admin.get<{ id: string; name: string }[]>("/v1/admin/sales")).find((s) => s.name === name)?.id;

    // the storefront shows it (saving refreshed the cached catalog)
    const shop = await browser.newContext();
    const pdp = await shop.newPage();
    await pdp.goto("/p/tea-assam");
    await expect(pdp.getByText(`${name}: 30% off`)).toBeVisible();
    await shop.close();

    // and the order is charged the sale price
    const [address] = await shopper.get<{ id: string }[]>("/v1/me/addresses");
    const placed = await shopper.post<{ order: { subtotalPaise: number } }>(
      "/v1/orders",
      { addressId: address!.id, paymentMethod: "COD", lines: [{ offerId: product.offerId, qty: 1, variant: "" }] },
      { "idempotency-key": crypto.randomUUID() },
    );
    expect(placed.order.subtotalPaise).toBe(expected);
    expect(errors).toEqual([]);
  } finally {
    // a live sale would change prices for the other tests
    if (saleId) await admin.del(`/v1/admin/sales/${saleId}`);
    await ctx.close();
  }
});

test("a coupon created in the admin is listed in the cart", async ({ browser }) => {
  const code = `E2E${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  await page.goto("/admin/promotions?tab=coupons");
  await page.getByRole("button", { name: "New coupon" }).click();
  await page.fill("#cp-code", code);
  await page.fill("#cp-desc", "15% off for testing");
  await page.fill("#cp-value", "15");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText("Coupon created")).toBeVisible();
  await expect(page.locator("tr", { hasText: code })).toContainText("Live");

  const shop = await browser.newContext();
  const deals = await shop.newPage();
  await deals.goto("/deals");
  await expect(deals.getByText(code).first()).toBeVisible();
  await shop.close();

  await page.locator("tr", { hasText: code }).getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("tr", { hasText: code })).toContainText("Paused");
  await page
    .locator("tr", { hasText: code })
    .getByRole("button", { name: `Delete ${code}` })
    .click();
  await expect(page.locator("tr", { hasText: code })).toHaveCount(0);
  await ctx.close();
});

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("a hero slide added in Storefront CMS shows on the homepage, and hiding it takes it off", async ({ browser }) => {
  const title = `Diwali lights ${Date.now().toString(36)}`;
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin/cms");
  await page.getByRole("button", { name: "Add slide" }).click();
  await page.getByRole("dialog").locator("input[type=file]").setInputFiles({ name: "diwali.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Replace image" })).toBeVisible();
  await page.fill("#bn-title", title);
  await page.fill("#bn-eyebrow", "Diwali");
  await page.fill("#bn-href", "/deals");
  await page.getByRole("button", { name: "Add to homepage" }).click();
  await expect(page.getByText("Banner added")).toBeVisible();
  const row = page.locator("li", { hasText: title });
  await expect(row).toContainText("Showing");

  const shop = await browser.newContext();
  const home = await shop.newPage();
  await home.goto("/");
  await expect(home.getByText(title).first()).toBeAttached();

  await row.getByRole("button", { name: "Hide" }).click();
  await expect(row).toContainText("Hidden");
  await home.reload();
  await expect(home.getByText(title)).toHaveCount(0);
  await shop.close();

  await row.getByRole("button", { name: `Remove ${title}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: title })).toHaveCount(0);
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a customer reviews a delivered product from its page, and hiding it in the admin takes it off", async ({ browser }) => {
  const shopperApi = apiAs(await apiSession(ACCOUNTS.shopper));
  const staffApi = apiAs(await apiSession(ACCOUNTS.staff));
  // a product the shopper has not reviewed yet
  const reviewed = new Set((await shopperApi.get<{ product: { slug: string } }[]>("/v1/me/reviews")).map((r) => r.product.slug));
  const slug = ["oil-olive", "books-stack", "cushions-linen", "tee-classic", "serum-glow", "watch-smart"].find((s) => !reviewed.has(s))!;
  const { itemId } = await paidOrder(shopperApi, slug);
  await deliver(staffApi, itemId);
  const title = `Great buy ${Date.now().toString(36)}`;

  const shop = await signedIn(browser, ACCOUNTS.shopper);
  const pdp = await shop.newPage();
  const errors = watchErrors(pdp);
  await pdp.goto(`/p/${slug}#reviews`);
  await pdp.locator("#reviews").getByRole("button", { name: "Write a review" }).click();
  await pdp.getByRole("button", { name: "4 stars" }).click();
  await pdp.fill("#rv-title", title);
  await pdp.fill("#rv-body", "Exactly as described and arrived quickly.");
  await pdp.getByRole("button", { name: "Post review" }).click();
  await expect(pdp.getByText("your review is live")).toBeVisible();
  await pdp.reload();
  await expect(pdp.locator("#reviews").getByText(title)).toBeVisible();
  await expect(pdp.locator("#reviews").getByText("Ananya S.").first()).toBeVisible();

  // the store hides it
  const admin = await signedIn(browser, ACCOUNTS.staff);
  const page = await admin.newPage();
  await page.goto("/admin/reviews?status=PUBLISHED");
  const row = page.locator("li", { hasText: title });
  await row.getByRole("button", { name: "Hide" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hide review" }).click();
  await expect(page.getByText("Review hidden")).toBeVisible();
  await pdp.reload();
  await expect(pdp.locator("#reviews").getByText(title)).toHaveCount(0);

  // and the customer still sees it in their account
  await pdp.goto("/account/reviews");
  const mine = pdp.locator("li", { hasText: title });
  await expect(mine).toBeVisible();
  await expect(mine.getByText("Not shown")).toBeVisible();
  expect(errors).toEqual([]);
  await shop.close();
  await admin.close();
});
