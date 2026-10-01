import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against a running web app and API. Set E2E_BASE_URL (and
 * E2E_API_URL) to test servers you already run; otherwise both are started.
 * Tests create their own orders and applicants, so they can run repeatedly
 * against the seeded development database.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const apiURL = process.env.E2E_API_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 3,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1366, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: "npm --prefix ../api run dev", url: `${apiURL}/health`, reuseExistingServer: true, timeout: 120_000 },
        { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
      ],
});
