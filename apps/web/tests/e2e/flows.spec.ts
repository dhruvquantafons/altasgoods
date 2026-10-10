import { expect, test } from "@playwright/test";
import { API, apiAs, apiSession, deliver, expectNoErrors, paidOrder, PHONES, signedIn, watchErrors } from "./support";

/** The main journeys end to end in the browser, against the live API. Setup that is not under test goes through the API. */

type Order = { id: string; items: { id: string; status: string }[] };

/** A 1 x 1 PNG, enough for upload checks that read the file signature. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("a shopper adds to cart, checks out with UPI and pays", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  await shopper.put("/v1/cart", { lines: [] });
  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/p/speaker-boom");
  await page.locator("#buy-actions").getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your cart" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Place order" }).click();

  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Deliver to this address" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("radio", { name: /^UPI Pay with any UPI app/ }).check();
  await page.getByLabel("UPI ID").fill("test@okaxis");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByText(/Verified: /)).toBeVisible();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();

  await page.waitForURL(/\/checkout\/pay\//);
  await expect(page.getByText("AltasGoods Pay sandbox: no real money moves")).toBeVisible();
  await page.getByRole("button", { name: /^Pay ₹/ }).click();
  await page.waitForURL(/\/order\/confirmed\?id=BB-\d{6}-\d{5,}$/);
  await expect(page.getByRole("heading", { name: /^Order placed, thank you/ })).toBeVisible();

  const id = new URL(page.url()).searchParams.get("id")!;
  const order = await shopper.get<Order & { paymentStatus?: string }>(`/v1/me/orders/${id}`);
  expect(order.items.map((i) => i.status)).toEqual(["NEW"]);
  await expectNoErrors(errors, "checkout");
  await ctx.close();
});

test("a shopper cancels an order before it ships", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const { orderId } = await paidOrder(shopper, "speaker-boom");
  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto(`/account/orders/${orderId}`);
  await page.getByRole("button", { name: "Cancel item" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Cancel from order ${orderId}`)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel item" }).click();
  await expect(dialog.getByText("Choose a reason so we can improve.")).toBeVisible();
  await dialog.getByRole("radio", { name: "Ordered by mistake" }).check();
  await dialog.getByRole("button", { name: "Cancel item" }).click();
  await expect(dialog.getByText("Cancellation confirmed")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("This order was cancelled")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel item" })).toHaveCount(0);

  const order = await shopper.get<Order>(`/v1/me/orders/${orderId}`);
  expect(order.items.map((i) => i.status)).toEqual(["CANCELLED"]);
  await expectNoErrors(errors, "order cancel");
  await ctx.close();
});

test("a shopper requests a return with a photo and the store sees it", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const staff = apiAs(await apiSession(PHONES.staff));
  const { orderId, itemId } = await paidOrder(shopper, "cookware-pan");
  await deliver(staff, itemId);

  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/account/orders/${orderId}/return?item=${itemId}`);
  await expect(page.getByRole("heading", { name: "Return or replace items" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("radio", { name: "Item arrived damaged" }).check();
  await page.getByLabel("Tell us more (optional)").fill("The handle came off in the box.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Add at least one photo so we can approve this quickly.")).toBeVisible();
  await page.getByLabel("Add a photo").setInputFiles({ name: "handle.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("handle.png")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await page.getByRole("radio", { name: /^Refund/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Choose a pickup time window.")).toBeVisible();
  await page.getByRole("button", { name: "9 AM to 12 PM" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check and submit" })).toBeVisible();
  await page.getByRole("button", { name: "Submit request" }).click();

  const done = page.getByText(/Request RT-\d+ is approved/);
  await expect(done).toBeVisible();
  const returnId = (await done.textContent())!.match(/RT-\d+/)![0];
  const created = await shopper.get<{ status: string; photos: { id: string }[]; comments: string; pickupSlot: string }>(`/v1/me/returns/${returnId}`);
  expect(created).toMatchObject({ status: "PICKUP_SCHEDULED", comments: "The handle came off in the box.", pickupSlot: "9 AM to 12 PM" });
  expect(created.photos).toHaveLength(1);
  await expectNoErrors(errors, "return wizard");

  // the store sees the request with the customer's photo
  const sctx = await signedIn(browser, PHONES.staff);
  const spage = await sctx.newPage();
  await spage.goto(`/admin/returns/${returnId}`);
  await expect(spage.getByText("The handle came off in the box.")).toBeVisible();
  const photo = await spage.request.get(`/admin/returns/${returnId}/photos/${created.photos[0]!.id}`);
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe("image/png");
  await ctx.close();
  await sctx.close();
});

test("store staff accept, pack and ship an order through to delivery", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const { orderId } = await paidOrder(shopper, "speaker-boom");
  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  // the new line waits in the queue
  await page.goto("/admin/orders");
  await expect(page.getByRole("row").filter({ hasText: orderId }).first()).toBeVisible();

  await page.goto(`/admin/orders/${orderId}`);
  await expect(page.getByRole("heading", { name: orderId })).toBeVisible();
  for (const step of ["Accept", "Mark packed", "Ready to ship"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
    await expect(page.getByRole("button", { name: step, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText(/AWB [A-Z]{3}\d{10}/)).toBeVisible();

  for (const scan of ["Picked up", "Out for delivery", "Delivered"]) {
    await page.getByRole("button", { name: `Simulate: ${scan}` }).click();
    await expect(page.getByRole("button", { name: `Simulate: ${scan}` })).toHaveCount(0);
  }

  const order = await shopper.get<Order>(`/v1/me/orders/${orderId}`);
  expect(order.items.map((i) => i.status)).toEqual(["DELIVERED"]);
  await expectNoErrors(errors, "store order processing");
  await ctx.close();
});

test("a signed in shopper's call back request reaches the Care Desk", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const ctx = await signedIn(browser, PHONES.shopper);
  const page = await ctx.newPage();
  await page.goto("/contact");
  const section = page.locator("#call-back");
  await expect(section.getByLabel("Mobile number")).toHaveValue("9845012345");
  await section.getByLabel("What is it about?").selectOption("A payment");
  await section.getByRole("button", { name: "Request a call back" }).click();
  await expect(section.getByText("Call-back requested")).toBeVisible();
  const ref = await section.getByRole("link", { name: /^TK-/ }).textContent();

  const ticket = await shopper.get<{ id: string; subject: string; channel: string; category: string }>(`/v1/me/support/tickets/${ref}`);
  expect(ticket).toMatchObject({ subject: "Call back about a payment", channel: "PHONE", category: "Payment" });
  await ctx.close();

  // signed out visitors are asked to sign in instead
  const anon = await browser.newContext();
  const apage = await anon.newPage();
  await apage.goto("/contact");
  await expect(apage.locator("#call-back").getByRole("link", { name: "Sign in to request a call back" })).toBeVisible();
  await anon.close();
});

test("store staff add a product with a photo, then take it off sale", async ({ browser }) => {
  const tag = String(Date.now()).slice(-6);
  const title = `Test Brass Lamp ${tag}`;
  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/admin/catalog/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("SKU").fill(`AG-TEST-${tag}`);
  await page.getByLabel("Description").fill("A warm brass lamp for the bedside.");
  await page.getByLabel("Add product images").setInputFiles({ name: "lamp.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Image 1")).toBeVisible();
  await page.getByLabel("Category", { exact: false }).first().selectOption({ label: "Home & Furniture" });
  await page.getByLabel("Subcategory").selectOption("Lighting");
  await page.getByLabel("Brand").selectOption({ label: "Hearth" });
  await page.getByLabel("Selling price").fill("2499");
  await page.getByLabel("MRP").fill("2999");
  await expect(page.getByText("(16% off")).toBeVisible();
  await page.getByLabel("Units in stock").fill("12");
  await page.getByRole("button", { name: "Add product", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/catalog\/p-test-brass-lamp-/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const slug = page.url().split("/admin/catalog/p-")[1]!;
  const live = await fetch(`${API}/v1/products/${slug}`);
  expect(live.status).toBe(200);
  expect(await live.json()).toMatchObject({ title, pricePaise: 249_900, inStock: true });

  // the shopper sees it straight away, at the price set in Control
  const shop = await ctx.newPage();
  await shop.goto(`/p/${slug}`);
  await expect(shop.getByRole("heading", { name: title })).toBeVisible();
  await expect(shop.getByText("₹2,499").first()).toBeVisible();

  // a price change reaches the product page too
  await page.getByLabel("Selling price").fill("1999");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. The store shows the changes now.")).toBeVisible();
  await shop.reload();
  await expect(shop.getByText("₹1,999").first()).toBeVisible();

  await page.goto(`/admin/catalog?q=${encodeURIComponent(title)}`);
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("switch", { name: `${title} on sale` }).click();
  await expect(page.getByText("Taken off the store")).toBeVisible();
  await expect.poll(async () => (await fetch(`${API}/v1/products/${slug}`)).status).toBe(404);
  expect((await shop.goto(`/p/${slug}`))?.status()).toBe(404);
  await expectNoErrors(errors, "product management");
  await ctx.close();
});
