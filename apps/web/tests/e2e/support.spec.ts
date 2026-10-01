import { expect, test } from "@playwright/test";
import { apiAs, apiSession, PHONES, signedIn, watchErrors } from "./support";

/** Care Desk changes are saved: everything an agent does survives a reload. */

const REVATHI = "9811020001";
const S = "/v1/support";

async function freshTicket() {
  const customer = apiAs(await apiSession(PHONES.shopper));
  const orders = await customer.get<{ items: { id: string; paymentStatus: string }[] }>("/v1/me/orders?pageSize=50");
  const paid = orders.items.find((o) => o.paymentStatus === "CAPTURED" || o.paymentStatus === "PARTIALLY_REFUNDED") ?? orders.items[0]!;
  const t = await customer.post<{ id: string }>("/v1/me/support/tickets", {
    subject: "Speaker crackles at high volume",
    category: "Product quality",
    orderId: paid.id,
    body: "The left speaker crackles above half volume.",
    channel: "CHAT",
  });
  return { id: t.id, customer };
}

test("an agent's changes to a ticket are saved", async ({ browser }) => {
  const { id, customer } = await freshTicket();
  const ctx = await signedIn(browser, REVATHI);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/support/tickets/${id}`);
  await expect(page.locator("h1")).toContainText("Speaker crackles");

  // priority
  await page.locator("#t-priority").selectOption("URGENT");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Ticket updated and logged to the audit trail")).toBeVisible();
  await page.reload();
  await expect(page.locator("#t-priority")).toHaveValue("URGENT");
  await expect(page.getByText("Priority set to Urgent")).toBeVisible();

  // internal note, then a reply with an attachment that waits for the customer
  await page.getByRole("tab", { name: "Internal note" }).click();
  await page.getByLabel("Internal note").fill("Known driver issue on batch 24B");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Internal note added")).toBeVisible();
  await page.getByRole("tab", { name: /^Reply by/ }).click();
  await page.getByLabel("Reply to customer").fill("Thanks, could you try the attached reset steps?");
  await page.locator('input[type="file"]').setInputFiles({ name: "reset-steps.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%sample\n") });
  await expect(page.getByRole("list", { name: "Attachments to send" })).toContainText("reset-steps.pdf");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Reply sent by chat/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Known driver issue on batch 24B")).toBeVisible();
  await expect(page.getByText("Thanks, could you try the attached reset steps?")).toBeVisible();
  await expect(page.getByRole("link", { name: "reset-steps.pdf" })).toBeVisible();
  await expect(page.locator("#t-status")).toHaveValue("PENDING_CUSTOMER");

  // a refund within the agent's limit
  await page.getByRole("button", { name: /Issue refund/ }).click();
  await page.locator("#rf-amount").fill("100");
  await page.getByRole("dialog").getByRole("button", { name: "Issue refund" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Refund of ₹100 initiated/ })).toBeVisible();
  await page.reload();
  // the action history lists the refund
  const history = page.locator("li").filter({ hasText: /^Refund/ }).filter({ hasText: "₹100" });
  await expect(page.getByText("On this ticket")).toBeVisible();
  await expect(history.first()).toBeVisible();

  // the customer sees the reply and the refund, never the note
  const mine = await customer.get<{ status: string; messages: { body: string }[] }>(`/v1/me/support/tickets/${id}`);
  const bodies = mine.messages.map((m) => m.body).join("\n");
  expect(bodies).toContain("attached reset steps");
  expect(bodies).toContain("We have initiated a refund of ₹100");
  expect(bodies).not.toContain("batch 24B");
  expect(errors).toEqual([]);
  await ctx.close();
});

test("bulk assignment in the inbox is saved", async ({ browser }) => {
  const { id } = await freshTicket();
  const ctx = await signedIn(browser, REVATHI);
  const page = await ctx.newPage();
  await page.goto(`/support/tickets?view=unassigned&q=${id}`);
  await page.getByRole("checkbox", { name: `Select ${id}` }).first().check();
  await page.getByLabel("Assign to agent").selectOption({ label: "Megha Pillai, L2" });
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText("1 ticket assigned to Megha Pillai")).toBeVisible();
  const staff = apiAs(await apiSession(REVATHI));
  const t = await staff.get<{ assignee: { name: string } | null; status: string }>(`${S}/tickets/${id}`);
  expect(t.assignee?.name).toBe("Megha Pillai");
  expect(t.status).toBe("OPEN");
  await ctx.close();
});

test("an agent opens a ticket from the order lookup", async ({ browser }) => {
  const ctx = await signedIn(browser, REVATHI);
  const page = await ctx.newPage();
  await page.goto("/support/orders");
  const first = page.locator("a[href^='/support/orders?q=']").first();
  if (await first.count()) await first.click();
  else await page.goto("/support/orders?q=BB-");
  const create = page.getByRole("button", { name: "Create ticket" }).first();
  await create.click();
  await page.locator("#nt-body").fill("Customer called to confirm the delivery address.");
  await page.getByRole("dialog").getByRole("button", { name: "Create ticket" }).click();
  await expect(page).toHaveURL(/\/support\/tickets\/TK-\d+$/);
  await expect(page.getByText("Customer called to confirm the delivery address.")).toBeVisible();
  await ctx.close();
});
