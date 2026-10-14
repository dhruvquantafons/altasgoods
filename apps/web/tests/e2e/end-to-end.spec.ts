import { expect, test, type Page } from "@playwright/test";
import { audited, closeDb, DATABASE_URL, row } from "./db";
import { ACCOUNTS, API, apiAs, apiSession, deliver, E2E_PASSWORD, paidOrder, signedIn, signInWithForm, watchErrors } from "./support";

/**
 * Every admin change, end to end: made in AltasGoods Control or the Care Desk,
 * read back from Postgres, shown on the storefront, and written to the audit log.
 * (Settings are covered in admin.spec.ts, next to the other tests that change them.)
 *
 * Reads the database directly, so it runs only when E2E_DATABASE_URL points at
 * the same (throwaway) database the API under test uses.
 */

test.skip(!DATABASE_URL, "Set E2E_DATABASE_URL to the API's database to check what is stored");
test.describe.configure({ mode: "serial" });
test.afterAll(closeDb);

const stamp = () => Date.now().toString(36);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

/** A brand new shopper with an address, so one test's account never affects another's. */
async function newShopper(name: string) {
  const email = `e2e.e2e.${stamp()}.${Math.floor(Math.random() * 1e6)}@altasgoods.test`;
  const r = await fetch(`${API}/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password: E2E_PASSWORD }),
  });
  if (!r.ok) throw new Error(`signup ${r.status}: ${await r.text()}`);
  const shopper = apiAs(await apiSession(email));
  await shopper.post("/v1/me/addresses", {
    name,
    phone: "9845098450",
    line1: "7, Church Street",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    type: "HOME",
    isDefault: true,
  });
  const { id } = (await row<{ id: string }>("select id from users where email = $1", [email]))!;
  return { email, shopper, id };
}

/** Signs in through the storefront form and waits until it lands on the homepage. */
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await signInWithForm(page, email);
  await expect(page).toHaveURL(/\/$/);
}

/** The product this spec creates in the admin, so its sale and edits change no other test's prices. */
let product: { id: string; slug: string; title: string; pricePaise: number };

test("a product added in the admin is stored, sold on the storefront, and its edits show at once", async ({ browser }) => {
  const title = `Test Copper Bottle ${stamp()}`;
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin/catalog/new");
  await page.getByLabel("Add product images").setInputFiles({ name: "bottle.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Remove image 1" })).toBeVisible();
  await page.fill("#pf-title", title);
  await page.fill("#pf-sku", `E2E-${stamp()}`);
  await page.fill("#pf-desc", "Hammered copper, 1 litre.");
  await page.fill("#pf-hl", "Keeps water cool\nLeak proof lid");
  await page.fill("#pf-price", "899");
  await page.fill("#pf-mrp", "1299");
  await page.fill("#pf-stock", "40");
  await page.selectOption("#pf-brand", { index: 1 });
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/(?!new$)[^/]+$/);
  const id = page.url().split("/").pop()!;

  // stored: the product and its offer
  const stored = await row<{ slug: string; title: string; highlights: string[]; price_paise: number; mrp_paise: number; stock: number }>(
    "select p.slug, p.title, p.highlights, o.price_paise, o.mrp_paise, o.stock from products p join offers o on o.product_id = p.id where p.id = $1",
    [id],
  );
  expect(stored).toMatchObject({ title, highlights: ["Keeps water cool", "Leak proof lid"], price_paise: 89_900, mrp_paise: 129_900, stock: 40 });
  expect(await audited("product.create", id)).toMatchObject({ actor_name: "E2E Admin" });
  product = { id, slug: stored!.slug, title, pricePaise: stored!.price_paise };

  // on the storefront
  const shop = await browser.newContext();
  const pdp = await shop.newPage();
  await pdp.goto(`/p/${product.slug}`);
  await expect(pdp.getByRole("heading", { level: 1 })).toContainText(title);
  await expect(pdp.getByText("Leak proof lid")).toBeVisible();

  // an edit is stored, logged with what changed, and shown
  await page.fill("#pf-hl", "Keeps water cool\nLeak proof lid\nHandmade in Moradabad");
  await page.fill("#pf-stock", "35");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. The store shows the changes now.")).toBeVisible();
  expect((await row<{ highlights: string[] }>("select highlights from products where id = $1", [id]))!.highlights).toContain("Handmade in Moradabad");
  expect((await row<{ stock: number }>("select stock from offers where product_id = $1", [id]))!.stock).toBe(35);
  const edit = await row<{ changes: Record<string, unknown> }>(
    "select changes from audit_events where action = 'product.update' and entity_id = $1 order by created_at desc limit 1",
    [id],
  );
  expect(Object.keys(edit!.changes)).toEqual(expect.arrayContaining(["highlights", "stock"]));
  await pdp.reload();
  await expect(pdp.getByText("Handmade in Moradabad")).toBeVisible();

  expect(errors).toEqual([]);
  await shop.close();
  await ctx.close();
});

test("a sale and a coupon made in the admin are stored, priced on the storefront and charged at checkout", async ({ browser }) => {
  const name = `Diwali ${stamp()}`;
  const code = `DIWALI${stamp().toUpperCase()}`.slice(0, 20);
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin/promotions");
  await page.getByRole("button", { name: "New sale" }).click();
  await page.fill("#sl-name", name);
  await page.fill("#sl-headline", "Lights, gifts and 20% off");
  await page.fill("#sl-pct", "20");
  await page.selectOption("#sl-scope", "PRODUCTS");
  await page.getByPlaceholder("Filter").fill(product.title);
  await page.getByRole("dialog").getByText(product.title).first().click();
  await page.getByRole("button", { name: "Create sale" }).click();
  await expect(page.getByText("Sale created")).toBeVisible();

  const sale = await row<{ id: string; discount_percent: number; scope: string; product_ids: string[]; status: string }>(
    "select id, discount_percent, scope, product_ids, status from sales where name = $1",
    [name],
  );
  expect(sale).toMatchObject({ discount_percent: 20, scope: "PRODUCTS", product_ids: [product.id], status: "ACTIVE" });
  expect(await audited("sale.create", sale!.id)).toBeTruthy();

  await page.goto("/admin/promotions?tab=coupons");
  await page.getByRole("button", { name: "New coupon" }).click();
  await page.fill("#cp-code", code);
  await page.fill("#cp-desc", "Flat ₹100 off for Diwali");
  await page.selectOption("#cp-type", "FLAT");
  await page.fill("#cp-value", "100");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText("Coupon created")).toBeVisible();
  const coupon = await row<{ type: string; value: number; status: string; show_on_storefront: boolean }>(
    "select type, value, status, show_on_storefront from coupons where code = $1",
    [code],
  );
  expect(coupon).toMatchObject({ type: "FLAT", status: "ACTIVE", show_on_storefront: true });
  expect(await audited("coupon.create", code)).toBeTruthy();

  const salePaise = Math.max(100, Math.floor((product.pricePaise * 80) / 10_000) * 100);
  const shop = await browser.newContext();
  const store = await shop.newPage();
  await store.goto(`/p/${product.slug}`);
  await expect(store.getByText(`${name}: 20% off`)).toBeVisible();
  await store.goto("/deals");
  await expect(store.getByText(name).first()).toBeVisible();
  await expect(store.getByText(code).first()).toBeVisible();
  await shop.close();

  // the order is charged the sale price less the coupon, and that is what is stored
  const { shopper } = await newShopper("Kabir Mehta");
  const offer = await shopper.get<{ offerId: string }>(`/v1/products/${product.slug}`);
  const [address] = await shopper.get<{ id: string }[]>("/v1/me/addresses");
  const placed = await shopper.post<{ order: { id: string } }>(
    "/v1/orders",
    { addressId: address!.id, paymentMethod: "COD", couponCode: code, lines: [{ offerId: offer.offerId, qty: 1, variant: "" }] },
    { "idempotency-key": crypto.randomUUID() },
  );
  const order = await row<{ subtotal_paise: number; coupon_code: string; coupon_discount_paise: number }>(
    "select subtotal_paise, coupon_code, coupon_discount_paise from orders where id = $1",
    [placed.order.id],
  );
  expect(order).toMatchObject({ subtotal_paise: salePaise, coupon_code: code, coupon_discount_paise: 10_000 });
  expect((await row<{ unit_price_paise: number }>("select unit_price_paise from order_items where order_id = $1", [placed.order.id]))!.unit_price_paise).toBe(
    salePaise,
  );

  // pausing takes the sale off the storefront
  await page.goto("/admin/promotions");
  await page.locator("tr", { hasText: name }).getByRole("button", { name: "Pause" }).click();
  await expect(page.locator("tr", { hasText: name })).toContainText("Paused");
  expect((await row<{ status: string }>("select status from sales where id = $1", [sale!.id]))!.status).toBe("PAUSED");
  expect(await audited("sale.pause", sale!.id)).toBeTruthy();
  const after = await browser.newContext();
  const pdp = await after.newPage();
  await pdp.goto(`/p/${product.slug}`);
  await expect(pdp.getByText(`${name}: 20% off`)).toHaveCount(0);
  await after.close();

  expect(errors).toEqual([]);
  await ctx.close();
});

test("a banner made in Storefront CMS is stored and shown on the homepage", async ({ browser }) => {
  const title = `Holi colours ${stamp()}`;
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  await page.goto("/admin/cms");
  await page.getByRole("button", { name: "Add slide" }).click();
  await page.getByRole("dialog").locator("input[type=file]").setInputFiles({ name: "holi.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Replace image" })).toBeVisible();
  await page.fill("#bn-title", title);
  await page.fill("#bn-href", `/p/${product.slug}`);
  await page.getByRole("button", { name: "Add to homepage" }).click();
  await expect(page.getByText("Banner added")).toBeVisible();

  const banner = await row<{ id: string; placement: string; href: string; active: boolean; image: string }>(
    "select id, placement, href, active, image from banners where title = $1",
    [title],
  );
  expect(banner).toMatchObject({ placement: "HERO", href: `/p/${product.slug}`, active: true });
  expect(banner!.image).toMatch(/^\/media\//);
  expect(await audited("banner.create", banner!.id)).toBeTruthy();

  const shop = await browser.newContext();
  const home = await shop.newPage();
  await home.goto("/");
  // a slide that is not on screen yet is hidden from the accessibility tree, so find it by its label
  const slide = home.locator(`[aria-roledescription="slide"][aria-label$=": ${title}"]`);
  await expect(slide).toBeAttached();
  await expect(slide.locator(`a[href="/p/${product.slug}"]`)).toBeAttached();
  await shop.close();

  await page
    .locator("li", { hasText: title })
    .getByRole("button", { name: `Remove ${title}` })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: title })).toHaveCount(0);
  expect(await row("select id from banners where id = $1", [banner!.id])).toBeUndefined();
  expect(await audited("banner.delete", banner!.id)).toBeTruthy();
  await ctx.close();
});

test("a customer's review is stored, the store's reply shows under it, and the rating updates", async ({ browser }) => {
  const staff = apiAs(await apiSession(ACCOUNTS.staff));
  const { email, shopper, id: userId } = await newShopper("Ishita Banerjee");
  const { itemId } = await paidOrder(shopper, product.slug);
  await deliver(staff, itemId);
  const before = (await row<{ rating_count: number }>("select rating_count from products where id = $1", [product.id]))!.rating_count;
  const title = `Lovely bottle ${stamp()}`;

  const shop = await browser.newContext();
  const pdp = await shop.newPage();
  await signIn(pdp, email);
  await pdp.goto(`/p/${product.slug}#reviews`);
  await pdp.locator("#reviews").getByRole("button", { name: "Write a review" }).click();
  await pdp.getByRole("button", { name: "5 stars" }).click();
  await pdp.fill("#rv-title", title);
  await pdp.fill("#rv-body", "Solid copper, no leaks after a month.");
  await pdp.getByRole("button", { name: "Post review" }).click();
  await expect(pdp.getByText("your review is live")).toBeVisible();

  const review = await row<{ id: string; rating: number; status: string; order_item_id: string }>(
    "select id, rating, status, order_item_id from reviews where user_id = $1 and product_id = $2",
    [userId, product.id],
  );
  expect(review).toMatchObject({ rating: 5, status: "PUBLISHED", order_item_id: itemId });
  expect((await row<{ rating_count: number }>("select rating_count from products where id = $1", [product.id]))!.rating_count).toBe(before + 1);

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  await page.goto("/admin/reviews?status=PUBLISHED");
  await page.locator("li", { hasText: title }).getByRole("button", { name: "Reply" }).click();
  await page.fill("#rm-text", "Thank you, Ishita. Enjoy it!");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Reply posted")).toBeVisible();
  expect((await row<{ reply: string }>("select reply from reviews where id = $1", [review!.id]))!.reply).toBe("Thank you, Ishita. Enjoy it!");
  expect(await row("select 1 from audit_events where entity_type = 'review' and entity_id = $1", [review!.id])).toBeTruthy();

  await pdp.reload();
  const shown = pdp.locator("#reviews li", { hasText: title });
  await expect(shown.getByText("Response from AltasGoods")).toBeVisible();
  await expect(shown.getByText("Thank you, Ishita. Enjoy it!")).toBeVisible();
  await shop.close();
  await ctx.close();
});

test("blocking a customer is stored and stops them signing in; unblocking lets them back", async ({ browser }) => {
  const { email, id } = await newShopper("Rohan Kulkarni");
  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  await page.goto(`/admin/customers/${id}`);
  await page.getByRole("button", { name: "Block account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Block/ }).click();
  await expect(page.getByText("Rohan Kulkarni is blocked")).toBeVisible();
  expect((await row<{ status: string }>("select status from users where id = $1", [id]))!.status).toBe("BLOCKED");
  expect(await audited("customer.block", id)).toBeTruthy();

  const shop = await browser.newContext();
  const login = await shop.newPage();
  await login.goto("/login");
  await signInWithForm(login, email);
  await expect(login.getByText(/This account is blocked/)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Unblock account" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Unblock/ })
    .click();
  await expect(page.getByText("Rohan Kulkarni can sign in again")).toBeVisible();
  expect((await row<{ status: string }>("select status from users where id = $1", [id]))!.status).toBe("ACTIVE");
  await login.goto("/login");
  await signInWithForm(login, email);
  await expect(login).toHaveURL(/\/$/);
  await shop.close();
  await ctx.close();
});

test("a ticket a customer raises is stored, reaches the Care Desk, and the agent's reply reaches the customer", async ({ browser }) => {
  const { email, id: userId } = await newShopper("Farah Khan");
  const shop = await browser.newContext();
  const page = await shop.newPage();
  const errors = watchErrors(page);
  await signIn(page, email);
  await page.goto("/account/support");
  await page.getByRole("button", { name: "Raise a ticket" }).click();
  await page.fill("#tk-body", "My parcel shows delivered but nothing arrived at the door.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/Ticket TK-\d+ is open/)).toBeVisible();
  const ticketId = (await page.getByText(/Ticket TK-\d+ is open/).textContent())!.match(/TK-\d+/)![0];

  const ticket = await row<{ user_id: string; status: string; customer_name: string }>(
    "select user_id, status, customer_name from support_tickets where id = $1",
    [ticketId],
  );
  expect(ticket).toMatchObject({ user_id: userId, customer_name: "Farah Khan" });
  expect(
    await row("select 1 from support_messages where ticket_id = $1 and kind = 'CUSTOMER' and body like 'My parcel shows delivered%'", [ticketId]),
  ).toBeTruthy();

  const desk = await signedIn(browser, ACCOUNTS.revathi);
  const agent = await desk.newPage();
  await agent.goto(`/support/tickets?q=${ticketId}`);
  await agent.getByRole("link", { name: ticketId }).first().click();
  await expect(agent).toHaveURL(new RegExp(`/support/tickets/${ticketId}$`));
  await expect(agent.getByText(/My parcel shows delivered but nothing arrived at the door\./).first()).toBeVisible();
  await agent.getByRole("tab", { name: /^Reply by/ }).click();
  await agent.getByLabel("Reply to customer").fill("Sorry about this, Farah. We have asked the courier to check.");
  await agent.getByRole("button", { name: "Send", exact: true }).click();
  await expect(agent.getByText(/Reply sent/)).toBeVisible();
  expect(await row("select 1 from support_messages where ticket_id = $1 and kind = 'AGENT' and body like 'Sorry about this, Farah%'", [ticketId])).toBeTruthy();

  await page.goto("/account/support");
  await expect(page.getByText(ticketId).first()).toBeVisible();
  const mine = await apiAs(await apiSession(email)).get<{ messages: { body: string }[] }>(`/v1/me/support/tickets/${ticketId}`);
  expect(mine.messages.map((m) => m.body).join("\n")).toContain("We have asked the courier to check");
  expect(errors).toEqual([]);
  await shop.close();
  await desk.close();
});

test("profile, addresses and wishlist saved in My Account are stored", async ({ browser }) => {
  const { email, id } = await newShopper("Neha Joshi");
  const shop = await browser.newContext();
  const page = await shop.newPage();
  await signIn(page, email);
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.fill("#pf-name", "Neha R. Joshi");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Neha R. Joshi").first()).toBeVisible();
  expect((await row<{ name: string }>("select name from users where id = $1", [id]))!.name).toBe("Neha R. Joshi");

  await page.goto("/account/addresses");
  await page.getByRole("button", { name: "Add a new address" }).click();
  await page.fill("#ad-name", "Neha Joshi");
  await page.fill("#ad-mobile", "9845022222");
  await page.fill("#ad-pin", "411001");
  await page.fill("#ad-l1", "21, FC Road");
  await page.fill("#ad-l2", "Shivajinagar");
  await page.fill("#ad-city", "Pune");
  await page.selectOption("#ad-state", "Maharashtra");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("21, FC Road")).toBeVisible();
  expect(await row("select 1 from addresses where user_id = $1 and line1 = '21, FC Road' and pincode = '411001'", [id])).toBeTruthy();

  await page.goto(`/p/${product.slug}`);
  await page.getByRole("button", { name: "Save to wishlist", exact: true }).click();
  await expect.poll(async () => (await row("select 1 from wishlist_items where user_id = $1 and product_id = $2", [id, product.id])) ?? null).toBeTruthy();

  // the wishlist follows the account to another browser, and signing out clears it from this one
  const other = await browser.newContext();
  const second = await other.newPage();
  await signIn(second, email);
  await second.goto("/account/wishlist");
  await expect(second.getByText(product.title)).toBeVisible();
  await other.close();

  await shop.clearCookies(); // the session ends
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("altasgoods.wishlist.v1"))).toBe("[]");
  await shop.close();
});
