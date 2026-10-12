import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default("postgres://localhost:5432/altasgoods_dev"),
  TEST_DATABASE_URL: z.string().url().default("postgres://localhost:5432/altasgoods_test"),
  REDIS_URL: z.string().default("redis://localhost:6379/5"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  /** Which payment gateway takes online payments: the local sandbox or Razorpay. */
  PAYMENTS_PROVIDER: z.enum(["sandbox", "razorpay"]).default("sandbox"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /** Who ships orders: a simulated courier (scans driven by hand) or Shiprocket. */
  LOGISTICS_PROVIDER: z.enum(["simulated", "shiprocket"]).default("simulated"),
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  /** The nickname of the pickup address in Shiprocket (Settings > Pickup Addresses) */
  SHIPROCKET_PICKUP_LOCATION: z.string().optional(),
  /** Optional: the token set on the Shiprocket webhook; tracking is polled either way */
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  /** Box size in centimetres, length x breadth x height, used for every parcel */
  SHIPPING_BOX_CM: z.string().regex(/^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/, "Use LxBxH in cm, for example 20x15x10").default("20x15x10"),
}).superRefine((v, ctx) => {
  if (v.PAYMENTS_PROVIDER === "razorpay") {
    for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when PAYMENTS_PROVIDER is razorpay" });
    }
  }
  if (v.LOGISTICS_PROVIDER === "shiprocket") {
    for (const key of ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPROCKET_PICKUP_LOCATION"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when LOGISTICS_PROVIDER is shiprocket" });
    }
  }
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment. Fails fast at startup with a readable message. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    // tests get safe defaults so they never need a .env file
    ...(process.env.NODE_ENV === "test"
      ? {
          JWT_SECRET: process.env.JWT_SECRET ?? "test-secret-test-secret-test-secret-1234",
          PAYMENTS_WEBHOOK_SECRET: process.env.PAYMENTS_WEBHOOK_SECRET ?? "test-webhook-secret-1234",
          // tests drive payments through the sandbox, never a live gateway
          PAYMENTS_PROVIDER: "sandbox",
          // and ship through the simulated courier, never a real one
          LOGISTICS_PROVIDER: "simulated",
        }
      : {}),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/**
 * Demo data is made with the payment sandbox and the simulated courier, so
 * seeding never charges a card or books a real parcel. For seed scripts only.
 */
export function useDemoProviders() {
  cached = { ...env(), PAYMENTS_PROVIDER: "sandbox", LOGISTICS_PROVIDER: "simulated" };
}

/** The database this process should use (tests always use the test database). */
export const databaseUrl = () => (env().NODE_ENV === "test" ? env().TEST_DATABASE_URL : env().DATABASE_URL);
