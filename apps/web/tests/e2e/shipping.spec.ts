import { expect, test } from "@playwright/test";
import { ACCOUNTS, apiAs, apiSession, paidOrder, signedIn, watchErrors } from "./support";

/** Shipping shows real parcels from the API, with the simulated courier until Shiprocket is switched on. */

test("a parcel handed to the courier shows up in Shipping and moves with its scans", async ({ browser }) => {
  const shopper = apiAs(await apiSession(ACCOUNTS.shopper));
  const staff = apiAs(await apiSession(ACCOUNTS.staff));
  const { orderId, itemId } = await paidOrder(shopper, "tea-assam");
  for (const to of ["ACCEPTED", "PACKED", "READY_TO_SHIP"]) await staff.post("/v1/admin/order-items/transition", { ids: [itemId], to });
  const order = await staff.get<{ items: { id: string; awb: string | null }[] }>(`/v1/admin/orders/${orderId}`);
  const awb = order.items.find((i) => i.id === itemId)!.awb!;
  expect(awb).toBeTruthy();

  const ctx = await signedIn(browser, ACCOUNTS.staff);
  const page = await ctx.newPage();
  const errors = watchErrors(page);

  await page.goto("/logistics");
  await expect(page.getByText("Simulated courier", { exact: true })).toBeVisible();
  await expect(page.getByText("To switch on Shiprocket")).toBeVisible();

  await page.goto(`/logistics/shipments?q=${awb}`);
  const row = page.locator("tr", { hasText: awb });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Simulate: Picked up" }).click();
  await expect(row.getByRole("button", { name: "Simulate: Out for delivery" })).toBeVisible();

  await page.goto("/logistics/shipments?view=transit");
  await expect(page.locator("tr", { hasText: awb })).toHaveCount(1);
  expect(errors).toEqual([]);
  await ctx.close();
});
