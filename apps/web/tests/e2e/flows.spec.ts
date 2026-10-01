import { expect, test } from "@playwright/test";
import { API, apiAs, apiSession, deliver, expectNoErrors, newPhone, paidOrder, PHONES, signedIn, watchErrors } from "./support";

/** The main journeys end to end in the browser, against the live API. Setup that is not under test goes through the API. */

type Order = { id: string; items: { id: string; status: string }[] };

/** A 1 x 1 PNG, enough for upload checks that read the file signature. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

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
  await expect(page.getByText("BluBuy Pay sandbox: no real money moves")).toBeVisible();
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

test("a shopper requests a return with a photo and the seller sees it", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const seller = apiAs(await apiSession(PHONES.seller));
  const { orderId, itemId } = await paidOrder(shopper, "cookware-pan");
  await deliver(seller, itemId);

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

  // the seller sees the request with the customer's photo
  const sctx = await signedIn(browser, PHONES.seller);
  const spage = await sctx.newPage();
  await spage.goto(`/seller/returns/${returnId}`);
  await expect(spage.getByText("The handle came off in the box.")).toBeVisible();
  const photo = await spage.request.get(`/seller/returns/${returnId}/photos/${created.photos[0]!.id}`);
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toBe("image/png");
  await ctx.close();
  await sctx.close();
});

test("a seller confirms, packs and ships an order through to delivery", async ({ browser }) => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const { orderId } = await paidOrder(shopper, "speaker-boom");
  const ctx = await signedIn(browser, PHONES.seller);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto(`/seller/orders/${orderId}`);
  await expect(page.getByRole("heading", { name: `Order ${orderId}` })).toBeVisible();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByRole("button", { name: "Generate label and invoice" })).toBeVisible();
  await page.getByRole("button", { name: "Generate label and invoice" }).click();
  await expect(page.getByRole("button", { name: "Mark ready to ship" })).toBeVisible();
  await page.getByRole("button", { name: "Mark ready to ship" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark ready to ship" }).click();
  await expect(page.getByText("Courier simulator (development only)")).toBeVisible();

  for (const scan of ["Scan pickup", "Scan out for delivery", "Scan delivered"]) {
    await page.getByRole("button", { name: scan }).click();
    await expect(page.getByRole("button", { name: scan })).toHaveCount(0);
  }
  await expect(page.getByText("Courier simulator (development only)")).toHaveCount(0);
  await expect(page.getByText("Delivered").first()).toBeVisible();

  const order = await shopper.get<Order>(`/v1/me/orders/${orderId}`);
  expect(order.items.map((i) => i.status)).toEqual(["DELIVERED"]);
  await expectNoErrors(errors, "seller order processing");
  await ctx.close();
});

test("BluBuy staff approve a new seller's application and the seller reaches Seller Hub", async ({ browser }) => {
  const phone = newPhone();
  const tail = phone.slice(-4);
  const letter = () => "ABCDEFGHJKLMNPRSTUVWXYZ"[Math.floor(Math.random() * 23)];
  const pan = `AA${letter()}F${letter()}${tail}${letter()}`;
  const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const first14 = `27${pan}1Z`;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = BASE36.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const gstin = first14 + BASE36[(36 - (sum % 36)) % 36];
  const store = `Test Traders ${tail}${letter()}${letter()}`;

  const session = await apiSession(phone, "Test Applicant");
  const applicant = apiAs(session);
  const BASE = "/v1/me/seller-application";
  await applicant.post(BASE);
  const otp = await applicant.post<{ devCode: string }>("/v1/me/email/otp", { email: `applicant${tail}@example.in` });
  await applicant.post("/v1/me/email/verify", { code: otp.devCode });
  await applicant.patch(BASE, { constitution: "LLP" });
  await applicant.post(`${BASE}/verify/gstin`, { gstin });
  await applicant.patch(BASE, {
    storeName: store,
    careNumber: "+91 20 4012 8821",
    grievanceContact: `Test Applicant, grievance${tail}@example.in`,
    pickup: { line1: "Plot 12, Sector 7", line2: "Bhosari MIDC", city: "Pune", state: "Maharashtra", pincode: "411026", contactName: "Ravi Patil", contactPhone: "9822011834", slot: "4:00 to 6:00 PM" },
    categories: ["cat-home"],
    brand: { ownBrand: false, reseller: true },
  });
  const account = `5020${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}7`;
  const bank = await applicant.post<{ requiredDocuments: { kind: string; required: boolean }[] }>(`${BASE}/verify/bank`, { holder: store, account, ifsc: "HDFC0001234" });
  for (const d of bank.requiredDocuments.filter((x) => x.required)) {
    const form = new FormData();
    form.set("kind", d.kind);
    form.set("file", new Blob([new Uint8Array(d.kind === "SIGNATURE" ? PNG : PDF)], { type: d.kind === "SIGNATURE" ? "image/png" : "application/pdf" }), d.kind === "SIGNATURE" ? "signature.png" : "document.pdf");
    const r = await fetch(`${API}${BASE}/documents`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` }, body: form });
    expect(r.status, `upload ${d.kind}`).toBe(201);
  }
  const submitted = await applicant.post<{ id: string; status: string }>(`${BASE}/submit`, { acceptAgreement: true });
  expect(submitted.status).toBe("UNDER_REVIEW");

  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto("/admin/sellers/approvals");
  await page.getByRole("row").filter({ hasText: store }).getByRole("button", { name: "Review" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: store })).toBeVisible();
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${store} approved` })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expectNoErrors(errors, "application approval");
  await ctx.close();

  // a fresh sign in carries the new seller grant
  const sctx = await signedIn(browser, phone, "Test Applicant");
  const spage = await sctx.newPage();
  await spage.goto("/seller");
  await expect(spage).toHaveURL(/\/seller$/);
  await expect(spage.getByText(store).first()).toBeVisible();
  await sctx.close();
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
