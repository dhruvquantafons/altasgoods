import { execFileSync } from "node:child_process";
import path from "node:path";
import { ACCOUNTS, API, apiAs, apiSession, E2E_PASSWORD, paidOrder } from "./support";

const API_DIR = path.resolve(__dirname, "../../../api");

/** Staff accounts are made the way real ones are: with the admin:create script, against the API's database. */
function staffAccount(email: string, name: string, role: string) {
  execFileSync("npm", ["--prefix", API_DIR, "run", "-s", "admin:create", "--", "--email", email, "--name", name, "--role", role], {
    // the API under test's database when it is given, never whatever apps/api/.env points at
    env: { ...process.env, ADMIN_PASSWORD: E2E_PASSWORD, ...(process.env.E2E_DATABASE_URL ? { DATABASE_URL: process.env.E2E_DATABASE_URL } : {}) },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/**
 * Fresh rate limits, then the accounts the suite signs in as. Every step is
 * safe to repeat, so the suite runs again and again on one database.
 */
export default async function globalSetup() {
  const r = await fetch(`${API}/v1/dev/rate-limits/reset`, { method: "POST" });
  if (!r.ok) throw new Error(`Could not reset rate limits on ${API}: ${r.status}. Is the API running outside production?`);

  staffAccount(ACCOUNTS.staff, "E2E Admin", "SUPER_ADMIN");
  staffAccount(ACCOUNTS.revathi, "Revathi Subramanian", "SUPPORT_SPECIALIST");
  staffAccount(ACCOUNTS.megha, "Megha Pillai", "SUPPORT_SPECIALIST");

  const signup = await fetch(`${API}/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ananya Sharma", email: ACCOUNTS.shopper, password: E2E_PASSWORD }),
  });
  if (!signup.ok && signup.status !== 409) throw new Error(`Could not create the e2e shopper: ${signup.status} ${await signup.text()}`);

  // a contact number (call backs are prefilled with it), an address for checkout, and an order for Care Desk tickets
  const shopper = apiAs(await apiSession(ACCOUNTS.shopper));
  await shopper.patch("/v1/me", { phone: "9845012345" });
  const addresses = await shopper.get<unknown[]>("/v1/me/addresses");
  if (!addresses.length) {
    await shopper.post("/v1/me/addresses", {
      name: "Ananya Sharma",
      phone: "9845012345",
      line1: "12, 4th Cross, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      type: "HOME",
      isDefault: true,
    });
  }
  const orders = await shopper.get<{ items: unknown[] }>("/v1/me/orders?pageSize=1");
  if (!orders.items.length) await paidOrder(shopper, "headphones-studio");
}
