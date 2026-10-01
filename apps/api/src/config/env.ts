import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default("postgres://localhost:5432/blubuy_dev"),
  TEST_DATABASE_URL: z.string().url().default("postgres://localhost:5432/blubuy_test"),
  REDIS_URL: z.string().default("redis://localhost:6379/5"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
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

/** The database this process should use (tests always use the test database). */
export const databaseUrl = () => (env().NODE_ENV === "test" ? env().TEST_DATABASE_URL : env().DATABASE_URL);
