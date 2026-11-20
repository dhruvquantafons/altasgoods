import { isIP } from "node:net";
import { z } from "zod";

/** What Express's "trust proxy" setting takes: trust everything or nothing, a number of hops, or addresses. */
export type TrustProxy = boolean | number | string[];

const TRUST_NAMES = new Set(["loopback", "linklocal", "uniquelocal"]);

const validTrustItem = (item: string) => {
  if (TRUST_NAMES.has(item)) return true;
  const [addr = "", range, ...rest] = item.split("/");
  const family = isIP(addr);
  if (!family || rest.length) return false;
  if (range === undefined) return true;
  // a prefix length, or (IPv4) a netmask such as 255.255.0.0
  if (/^\d+$/.test(range)) return Number(range) <= (family === 4 ? 32 : 128);
  return family === 4 && isIP(range) === 4;
};

/**
 * Reads TRUST_PROXY the way Express understands "trust proxy": "true" or
 * "false", a number of hops, or a comma list of addresses, CIDR ranges and the
 * names loopback, linklocal and uniquelocal.
 */
export function parseTrustProxy(raw: string): TrustProxy {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  const items = value.split(",").map((s) => s.trim());
  const bad = items.find((i) => !validTrustItem(i));
  if (bad !== undefined) throw new Error(`"${bad}" is not an address, a CIDR range or one of loopback, linklocal, uniquelocal`);
  return items;
}

const schema = z.object({
  /** Required, no default: a forgotten value must fail startup, not quietly run as development. */
  NODE_ENV: z.enum(["development", "test", "production"], "NODE_ENV must be set to development, test or production"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default("postgres://localhost:5432/altasgoods_dev"),
  TEST_DATABASE_URL: z.string().url().default("postgres://localhost:5432/altasgoods_test"),
  REDIS_URL: z.string().default("redis://localhost:6379/5"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  /**
   * Which peers may say who the client is through X-Forwarded-For (Express
   * "trust proxy"). Sign in limits count per client address, so this must
   * cover the web server, and nothing a shopper can reach directly.
   */
  TRUST_PROXY: z
    .string()
    .default("loopback")
    .transform((v, ctx) => {
      try {
        return parseTrustProxy(v);
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
        return z.NEVER;
      }
    }),
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
  /** Optional: the pincode parcels leave from. Lets Shiprocket check delivery pincodes; the admin rules apply without it */
  SHIPROCKET_PICKUP_PINCODE: z.string().regex(/^[1-9]\d{5}$/, "Use a 6 digit pincode").optional(),
  /** Optional: the token set on the Shiprocket webhook; tracking is polled either way */
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  /** Box size in centimetres, length x breadth x height, used for every parcel */
  SHIPPING_BOX_CM: z.string().regex(/^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/, "Use LxBxH in cm, for example 20x15x10").default("20x15x10"),
  /** How email goes out: written to the log (development) or sent over SMTP. */
  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** true for implicit TLS (usually port 465); false upgrades with STARTTLS (587) */
  SMTP_SECURE: z.enum(["true", "false", ""]).optional().transform((v) => (v ? v === "true" : undefined)),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** The sender shoppers see, for example: AltasGoods <no-reply@altasgoods.in> */
  EMAIL_FROM: z.string().optional(),
  /** Vercel only: the secret Vercel Cron sends as "Authorization: Bearer <CRON_SECRET>" to /v1/cron/tick. Unset, that endpoint stays closed. */
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
}).superRefine((v, ctx) => {
  if (v.PAYMENTS_PROVIDER === "razorpay") {
    for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when PAYMENTS_PROVIDER is razorpay" });
    }
  }
  if (v.EMAIL_PROVIDER === "smtp") {
    for (const key of ["SMTP_HOST", "EMAIL_FROM"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when EMAIL_PROVIDER is smtp" });
    }
  } else if (v.NODE_ENV === "production") {
    // the console provider would write password reset codes to the log
    ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "Use smtp in production" });
  }
  if (v.LOGISTICS_PROVIDER === "shiprocket") {
    for (const key of ["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD", "SHIPROCKET_PICKUP_LOCATION"] as const) {
      if (!v[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when LOGISTICS_PROVIDER is shiprocket" });
    }
  }
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validates a raw environment. Throws a readable message listing every problem. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse({
    ...raw,
    // tests get safe defaults so they never need a .env file
    ...(raw.NODE_ENV === "test"
      ? {
          JWT_SECRET: raw.JWT_SECRET ?? "test-secret-test-secret-test-secret-1234",
          PAYMENTS_WEBHOOK_SECRET: raw.PAYMENTS_WEBHOOK_SECRET ?? "test-webhook-secret-1234",
          // tests drive payments through the sandbox, never a live gateway
          PAYMENTS_PROVIDER: "sandbox",
          // and ship through the simulated courier, never a real one
          LOGISTICS_PROVIDER: "simulated",
          // and never send real email
          EMAIL_PROVIDER: "console",
        }
      : {}),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Validated environment. Fails fast at startup with a readable message. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/** Running as a Vercel Function: no process outlives a request, so timers are off and Vercel Cron calls /v1/cron/tick instead. */
export const onVercel = () => !!process.env.VERCEL;

/** One-time codes in API responses and the dev endpoints' extras: development only, never test or production. */
export const devToolsEnabled = () => env().NODE_ENV === "development";

/**
 * Demo data is made with the payment sandbox and the simulated courier, so
 * seeding never charges a card or books a real parcel. For seed scripts only.
 */
export function useDemoProviders() {
  cached = { ...env(), PAYMENTS_PROVIDER: "sandbox", LOGISTICS_PROVIDER: "simulated" };
}

/** The database this process should use (tests always use the test database). */
export const databaseUrl = () => (env().NODE_ENV === "test" ? env().TEST_DATABASE_URL : env().DATABASE_URL);
