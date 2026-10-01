import { expect, test, type Page } from "@playwright/test";

/** The home page banner rotates on its own, and only the pause button stops it. */

const current = (page: Page) => page.getByRole("group", { name: "Choose slide" }).locator('button[aria-current="true"]').getAttribute("aria-label");

test("the banner moves by itself, even under the mouse", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Featured offers" });
  await banner.hover();
  const first = await current(page);
  await expect.poll(() => current(page), { timeout: 9000 }).not.toBe(first);
});

test("arrows move it and it keeps rotating afterwards; pause stops it", async ({ page }) => {
  await page.goto("/");
  const first = await current(page);
  await page.getByRole("button", { name: "Next slide" }).click();
  const second = await current(page);
  expect(second).not.toBe(first);
  await expect.poll(() => current(page), { timeout: 9000 }).not.toBe(second);

  await page.getByRole("button", { name: "Pause slideshow" }).click();
  const paused = await current(page);
  await page.waitForTimeout(7000);
  expect(await current(page)).toBe(paused);
  await page.getByRole("button", { name: "Play slideshow" }).click();
  await expect.poll(() => current(page), { timeout: 9000 }).not.toBe(paused);
});

test("with reduced motion it starts paused and the play button starts it", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  const first = await current(page);
  await page.waitForTimeout(7000);
  expect(await current(page)).toBe(first);
  await page.getByRole("button", { name: "Play slideshow" }).click();
  await expect.poll(() => current(page), { timeout: 9000 }).not.toBe(first);
  await ctx.close();
});
