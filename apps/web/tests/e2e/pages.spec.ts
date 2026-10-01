import { expect, test } from "@playwright/test";
import { AREAS, crawl, signedIn, watchErrors } from "./support";

/**
 * Opens every page each workspace links to, as the role that uses it, and
 * fails on server errors, page crashes, React console errors (duplicate keys,
 * hydration mismatches) and links to pages that do not exist.
 */
for (const area of AREAS) {
  test(`every page works: ${area.name}`, async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    const ctx = area.phone ? await signedIn(browser, area.phone) : await browser.newContext();
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const failures: string[] = [];

    const visited = await crawl(
      page,
      area,
      { perDynamic: 2, max: 160 },
      async (target) => {
        errors.length = 0;
        const res = await page.goto(target, { waitUntil: "load" });
        await page.waitForTimeout(250);
        const status = res?.status() ?? 0;
        if (status >= 400) failures.push(`${target}: HTTP ${status}`);
        for (const e of errors) failures.push(`${target}: ${e}`);
        if (area.phone && new URL(page.url()).pathname.startsWith("/login")) failures.push(`${target}: sent to sign in`);
      },
      (from, href) => failures.push(`${from}: links to ${href}, which does not exist`),
    );

    console.log(`${area.name}: ${visited} pages checked, ${failures.length} problems`);
    await ctx.close();
    expect(failures).toEqual([]);
  });
}
