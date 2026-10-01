import { expect, test } from "@playwright/test";
import { apiAs, apiSession, deliver, expectNoErrors, paidOrder, PHONES, returnRequest, signedIn, watchErrors } from "./support";

/** Returns in Seller Hub against the live API: pickup scans, the seller's check, and out-of-policy decisions. */

type Return = { id: string; status: string; refundStatus: string | null; qcNote: string | null; sellerNote: string | null };

const sessions = async () => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const seller = apiAs(await apiSession(PHONES.seller));
  return { shopper, seller };
};

test("a seller takes a return from pickup to a passed check and the customer is refunded", async ({ browser }) => {
  const { shopper, seller } = await sessions();
  // above the instant refund limit, so the refund waits for the seller's check
  const { itemId } = await paidOrder(shopper, "headphones-studio");
  await deliver(seller, itemId);
  const created = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId, { comments: "Left ear cup is silent." }));
  expect(created.status).toBe("PICKUP_SCHEDULED");

  const ctx = await signedIn(browser, PHONES.seller);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/seller/returns/${created.id}`);
  await expect(page.getByRole("heading", { name: `Return ${created.id}` })).toBeVisible();
  await expect(page.getByText("Left ear cup is silent.")).toBeVisible();

  for (const scan of ["Scan out for pickup", "Scan picked up", "Scan in transit", "Scan received"]) {
    await page.getByRole("button", { name: scan }).click();
    await expect(page.getByRole("button", { name: scan })).toHaveCount(0);
  }
  await expect(page.getByText("Record the quality check")).toBeVisible();
  await page.getByRole("radio", { name: /^Sellable/ }).check();
  await page.getByLabel("Notes").fill("Serial matches, works fine");
  await page.getByRole("button", { name: "Save check" }).click();
  await expect(page.getByText("Quality check passed").first()).toBeVisible();

  const after = await shopper.get<Return>(`/v1/me/returns/${created.id}`);
  expect(after.status).toBe("COMPLETED");
  expect(after.refundStatus).not.toBeNull();
  expect(after.qcNote).toContain("Serial matches");

  // the shopper sees it in My Account
  const sctx = await signedIn(browser, PHONES.shopper);
  const spage = await sctx.newPage();
  await spage.goto("/account/returns");
  await expect(spage.getByText(created.id).first()).toBeVisible();
  await expectNoErrors(errors, "seller return detail");
  await ctx.close();
  await sctx.close();
});

test("a failed check is recorded with the seller's notes for BluBuy to review", async ({ browser }) => {
  const { shopper, seller } = await sessions();
  const { itemId } = await paidOrder(shopper, "headphones-studio");
  await deliver(seller, itemId);
  const created = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId));
  for (const to of ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"]) await seller.post(`/v1/dev/returns/${created.id}/advance`, { to });

  const ctx = await signedIn(browser, PHONES.seller);
  const page = await ctx.newPage();
  await page.goto("/seller/returns?tab=action");
  const row = page.getByRole("row").filter({ hasText: created.id });
  await expect(row.getByText("Grade the item")).toBeVisible();
  await row.getByRole("link", { name: created.id }).click();

  await page.getByRole("radio", { name: /^Empty box/ }).check();
  // a failed check needs a description
  await expect(page.getByRole("button", { name: "Save check" })).toBeDisabled();
  await page.getByLabel("Notes").fill("The box arrived sealed but empty");
  await page.getByRole("button", { name: "Save check" }).click();
  await expect(page.getByText("Quality check failed").first()).toBeVisible();
  await expect(page.getByText(/BluBuy reviews your check/)).toBeVisible();

  const after = await seller.get<Return>(`/v1/seller/returns/${created.id}`);
  expect(after.status).toBe("QC_FAILED");
  expect(after.qcNote).toBe("Empty box. The box arrived sealed but empty");
  await ctx.close();
});

test("a seller approves and rejects requests made after the return window", async ({ browser }) => {
  const { shopper, seller } = await sessions();
  const late = async () => {
    const { itemId } = await paidOrder(shopper, "speaker-boom");
    await deliver(seller, itemId, 30);
    const r = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId));
    expect(r.status).toBe("PENDING_SELLER_REVIEW");
    return r;
  };
  const [approve, reject] = [await late(), await late()];

  const ctx = await signedIn(browser, PHONES.seller);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto("/seller/returns?tab=action");

  const approveRow = page.getByRole("row").filter({ hasText: approve.id });
  await expect(approveRow.getByText("Out of policy")).toBeVisible();
  await approveRow.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("row").filter({ hasText: approve.id })).toHaveCount(0);
  expect((await seller.get<Return>(`/v1/seller/returns/${approve.id}`)).status).toBe("PICKUP_SCHEDULED");

  await page.goto(`/seller/returns/${reject.id}`);
  await expect(page.getByText("This request is outside the return policy")).toBeVisible();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").selectOption("Outside the return window");
  await dialog.getByLabel("Message to the customer").fill("Delivered 30 days ago, past the 10 day window.");
  await dialog.getByRole("button", { name: "Reject return" }).click();
  await expect(page.getByText("Rejected", { exact: true }).first()).toBeVisible();

  const rejected = await seller.get<Return>(`/v1/seller/returns/${reject.id}`);
  expect(rejected.status).toBe("REJECTED");
  expect(rejected.sellerNote).toBe("Outside the return window. Delivered 30 days ago, past the 10 day window.");
  await expectNoErrors(errors, "seller returns");
  await ctx.close();
});
