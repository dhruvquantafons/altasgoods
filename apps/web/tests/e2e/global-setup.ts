import { API } from "./support";

/** Fresh sign in rate limits, so the demo accounts can be signed in as often as the suite needs. */
export default async function globalSetup() {
  const r = await fetch(`${API}/v1/dev/rate-limits/reset`, { method: "POST" });
  if (!r.ok) throw new Error(`Could not reset rate limits on ${API}: ${r.status}. Is the API running outside production?`);
}
