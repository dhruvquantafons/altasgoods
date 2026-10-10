import { expect, test } from "@playwright/test";
import { apiAs, apiSession, deliver, expectNoErrors, paidOrder, PHONES, returnRequest, signedIn, watchErrors } from "./support";

/** Returns in AltasGoods Control against the live API: pickup scans, the store's check, and out-of-policy decisions. */

type Return = { id: string; status: string; refundStatus: string | null; qcNote: string | null; decisionNote: string | null };

const sessions = async () => {
  const shopper = apiAs(await apiSession(PHONES.shopper));
  const staff = apiAs(await apiSession(PHONES.staff));
  return { shopper, staff };
};

test("store staff take a return from pickup to a passed check and the customer is refunded", async ({ browser }) => {
  const { shopper, staff } = await sessions();
  // above the instant refund limit, so the refund waits for the store's check
  const { itemId } = await paidOrder(shopper, "headphones-studio");
  await deliver(staff, itemId);
  const created = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId, { comments: "Left ear cup is silent." }));
  expect(created.status).toBe("PICKUP_SCHEDULED");

  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/admin/returns/${created.id}`);
  await expect(page.getByRole("heading", { name: created.id })).toBeVisible();
  await expect(page.getByText("Left ear cup is silent.")).toBeVisible();

  for (const scan of ["Out for pickup", "Picked up", "In transit", "Received at the warehouse"]) {
    await page.getByRole("button", { name: `Simulate: ${scan}` }).click();
    await expect(page.getByRole("button", { name: `Simulate: ${scan}` })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Pass check" }).click();
  await expect(page.getByRole("button", { name: "Pass check" })).toHaveCount(0);

  const after = await shopper.get<Return>(`/v1/me/returns/${created.id}`);
  expect(after.status).toBe("COMPLETED");
  expect(after.refundStatus).not.toBeNull();

  // the shopper sees it in My Account
  const sctx = await signedIn(browser, PHONES.shopper);
  const spage = await sctx.newPage();
  await spage.goto("/account/returns");
  await expect(spage.getByText(created.id).first()).toBeVisible();
  await expectNoErrors(errors, "admin return detail");
  await ctx.close();
  await sctx.close();
});

test("a failed check is recorded with the store's notes", async ({ browser }) => {
  const { shopper, staff } = await sessions();
  const { itemId } = await paidOrder(shopper, "headphones-studio");
  await deliver(staff, itemId);
  const created = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId));
  for (const to of ["OUT_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "RECEIVED"]) await staff.post(`/v1/dev/returns/${created.id}/advance`, { to });

  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  await page.goto("/admin/returns");
  const row = page.getByRole("row").filter({ hasText: created.id });
  await expect(row.getByText("Check the item")).toBeVisible();
  await row.getByRole("link", { name: created.id }).click();

  await page.getByRole("button", { name: "Fail check" }).click();
  const dialog = page.getByRole("dialog");
  // a failed check needs a description
  await expect(dialog.getByRole("button", { name: "Record failed check" })).toBeDisabled();
  await dialog.getByLabel("What is wrong with the item").fill("The box arrived sealed but empty");
  await dialog.getByRole("button", { name: "Record failed check" }).click();
  await expect(page.getByRole("button", { name: "Fail check" })).toHaveCount(0);

  const after = await staff.get<Return>(`/v1/admin/returns/${created.id}`);
  expect(after.status).toBe("QC_FAILED");
  expect(after.qcNote).toBe("The box arrived sealed but empty");
  await ctx.close();
});

test("store staff approve and reject requests made after the return window", async ({ browser }) => {
  const { shopper, staff } = await sessions();
  const late = async () => {
    const { itemId } = await paidOrder(shopper, "speaker-boom");
    await deliver(staff, itemId, 30);
    const r = await shopper.post<Return>("/v1/me/returns", returnRequest(itemId));
    expect(r.status).toBe("PENDING_REVIEW");
    return r;
  };
  const [approve, reject] = [await late(), await late()];

  const ctx = await signedIn(browser, PHONES.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto("/admin/returns");
  await expect(page.getByRole("row").filter({ hasText: approve.id }).getByText("Outside the return window")).toBeVisible();

  await page.goto(`/admin/returns/${approve.id}`);
  await page.getByRole("button", { name: "Approve return" }).click();
  await expect(page.getByRole("button", { name: "Approve return" })).toHaveCount(0);
  expect((await staff.get<Return>(`/v1/admin/returns/${approve.id}`)).status).toBe("PICKUP_SCHEDULED");

  await page.goto(`/admin/returns/${reject.id}`);
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason for the customer").fill("Delivered 30 days ago, past the 10 day window.");
  await dialog.getByRole("button", { name: "Reject return" }).click();
  await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);

  const rejected = await staff.get<Return>(`/v1/admin/returns/${reject.id}`);
  expect(rejected.status).toBe("REJECTED");
  expect(rejected.decisionNote).toBe("Delivered 30 days ago, past the 10 day window.");
  await expectNoErrors(errors, "admin returns");
  await ctx.close();
});
