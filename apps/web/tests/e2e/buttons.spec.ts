import { expect, test, type Page } from "@playwright/test";
import { AREAS, crawl, signedIn, watchErrors } from "./support";

/**
 * Clicks every distinct button on one page of every kind, and the buttons
 * inside any dialog a button opens. A button fails when it throws, logs a
 * React error, or produces no visible response at all.
 *
 * Pages that write to the real API (checkout, orders, registration, reviews)
 * are covered by the flow tests instead, so this crawl never changes data.
 */
test.describe.configure({ mode: "parallel" });

const API_PAGES = /^\/(checkout|order|cart)(\/|$)|^\/account\/orders|^\/seller\/orders|^\/seller\/register|^\/admin\/sellers\/approvals/;
const SKIP_NAMES = /sign ?out|log ?out/i;
const MAX_BUTTONS = 40;

/** Things a button can do that are not visible in the DOM. */
const SIGNALS = () => {
  const w = window as unknown as { __signals: number };
  w.__signals = 0;
  const bump = () => {
    w.__signals++;
  };
  window.print = bump;
  window.open = () => (bump(), null);
  if (navigator.clipboard) navigator.clipboard.writeText = async () => bump();
  const createUrl = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (o: Blob | MediaSource) => (bump(), createUrl(o));
  // the browser's own required field messages are not in the DOM
  document.addEventListener("invalid", bump, true);
};

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const mask = (s: string) => s.replace(/\d/g, "0");
    const ATTRS = ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked", "aria-current", "aria-hidden", "data-state"];
    const state = (e: Element) => ATTRS.map((a) => e.getAttribute(a) ?? "").join("") + (e instanceof HTMLDetailsElement ? String(e.open) : "");
    return {
      url: location.href,
      text: mask(document.body.innerText),
      dialogs: document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open]').length,
      states: [...document.querySelectorAll("[aria-expanded],[aria-pressed],[aria-selected],[aria-checked],[aria-current],[aria-hidden],[data-state],details")].map(state).join(","),
      // a toggle that renames itself (Pause and Play), and rails or galleries that scroll sideways
      labels: [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).join("|"),
      scroll: [...document.querySelectorAll("*")].reduce((n, e) => n + (e.scrollLeft > 0 ? Math.round(e.scrollLeft) : 0), 0),
      inputs: [...document.querySelectorAll("input,textarea,select")].map((i) => ((i as HTMLInputElement).checked ? "1" : "0") + (i as HTMLInputElement).value).join("|"),
      focus: document.activeElement?.tagName ?? "",
      signals: (window as unknown as { __signals: number }).__signals ?? 0,
    };
  });
}

type Snap = Awaited<ReturnType<typeof snapshot>>;
const responded = (a: Snap, b: Snap, textIsStable: boolean) =>
  a.url !== b.url || a.dialogs !== b.dialogs || a.states !== b.states || a.labels !== b.labels || a.scroll !== b.scroll || a.inputs !== b.inputs || a.signals !== b.signals || (textIsStable && a.text !== b.text);

/** Distinct button names visible in a region, in page order. */
async function buttonNames(page: Page, within?: string) {
  const scope = within ? page.locator(within).last() : page.locator("body");
  const names: string[] = [];
  for (const b of await scope.getByRole("button").all()) {
    if (!(await b.isVisible().catch(() => false))) continue;
    const name = ((await b.getAttribute("aria-label")) ?? (await b.innerText().catch(() => ""))).trim().replace(/\s+/g, " ");
    if (name && !names.includes(name) && !SKIP_NAMES.test(name)) names.push(name);
  }
  return names.slice(0, MAX_BUTTONS);
}

const button = (page: Page, name: string, within?: string) => (within ? page.locator(within).last() : page.locator("body")).getByRole("button", { name, exact: true }).first();

for (const area of AREAS) {
  test(`every button responds: ${area.name}`, async ({ browser }) => {
    test.setTimeout(45 * 60_000);
    const ctx = area.phone ? await signedIn(browser, area.phone) : await browser.newContext();
    await ctx.addInitScript(SIGNALS);
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    let fileChooser = 0;
    page.on("filechooser", () => fileChooser++);
    page.on("dialog", (d) => d.dismiss().catch(() => undefined));
    const dead: string[] = [];
    const failures: string[] = [];
    let clicked = 0;

    const open = async (target: string) => {
      await page.goto(target, { waitUntil: "load" });
      await page.waitForTimeout(200);
    };

    /** Clicks one button and judges whether anything happened. */
    const tryButton = async (target: string, name: string, within?: string, prepare?: () => Promise<void>) => {
      await open(target);
      if (prepare) await prepare();
      const b = button(page, name, within);
      if (!(await b.isVisible().catch(() => false)) || !(await b.isEnabled().catch(() => false))) return null;
      // an option that is already chosen, or a search re-run with the same query, rightly changes nothing
      const chosen = await b
        .evaluate((el) => {
          const selected = ["aria-pressed", "aria-selected", "aria-checked"].some((a) => el.getAttribute(a) === "true") || (el.getAttribute("aria-current") ?? "false") !== "false";
          const form = el.closest("form");
          const search = !!form && form.method === "get" && (el as HTMLButtonElement).type === "submit";
          return selected || search;
        })
        .catch(() => false);
      const t0 = await snapshot(page);
      await page.waitForTimeout(250);
      const t1 = await snapshot(page);
      const textIsStable = t0.text === t1.text;
      errors.length = 0;
      const chooserBefore = fileChooser;
      try {
        await b.click({ timeout: 4000 });
      } catch (e) {
        failures.push(`${target}: "${name}" could not be clicked (${String(e).split("\n")[0]})`);
        return null;
      }
      clicked++;
      await page.waitForTimeout(600);
      if (process.env.E2E_TRACE) console.log(`    clicked "${name}"${within ? " in dialog" : ""} -> ${page.url()} cookies: ${(await page.context().cookies()).filter((c) => c.name.startsWith("bb_")).length}`);
      const t2 = await snapshot(page).catch(() => null);
      for (const e of errors) failures.push(`${target}: "${name}": ${e}`);
      const ok = !t2 || fileChooser > chooserBefore || responded(t1, t2, textIsStable);
      if (!ok && !chosen) dead.push(`${target}: "${name}"${within ? " (in dialog)" : ""}`);
      return t2;
    };

    const visited = await crawl(page, area, { perDynamic: 1, max: 120 }, async (target) => {
      const path = new URL(target, "http://x").pathname;
      await open(target);
      if (process.env.E2E_TRACE) console.log(`  visiting ${target} -> ${page.url()}`);
      if (API_PAGES.test(path)) return;
      const names = await buttonNames(page);
      for (const name of names) {
        const after = await tryButton(target, name);
        // a dialog opened: try what is inside it too
        if (after && after.dialogs > 0) {
          const inner = (await buttonNames(page, '[role="dialog"],[role="alertdialog"]')).filter((n) => n !== name && !/^close/i.test(n));
          for (const innerName of inner) {
            await tryButton(target, innerName, '[role="dialog"],[role="alertdialog"]', async () => {
              await button(page, name).click({ timeout: 4000 });
              await page.waitForTimeout(300);
            });
          }
        }
      }
      await open(target);
    });

    console.log(`${area.name}: ${visited} pages, ${clicked} clicks, ${dead.length} buttons with no response, ${failures.length} errors`);
    for (const d of dead) console.log(`  no response: ${d}`);
    for (const f of failures) console.log(`  error: ${f}`);
    await ctx.close();
    expect.soft(failures, "errors").toEqual([]);
    expect(dead, "buttons with no visible response").toEqual([]);
  });
}
