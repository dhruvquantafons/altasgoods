/**
 * Creates an AltasGoods Control account, or gives an existing account a staff
 * role. Shoppers sign up on the website; staff are only ever made here.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name" [--role SUPER_ADMIN]
 *
 * The password is asked for without echoing it. Where there is no terminal
 * (a hosting console, for example), set ADMIN_PASSWORD for the one run instead.
 * An existing account keeps its password unless a new one is given.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { hashPassword } from "../modules/auth/password.js";
import { createDb } from "./client.js";
import { STAFF_ROLES, users, type StaffRole } from "./schema.js";

function ask(question: string, hidden: boolean) {
  return new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // print the prompt, then swallow the characters typed after it
      const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.startsWith(question)) write.call(rl, question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "SUPER_ADMIN" } } });
const email = values.email?.trim().toLowerCase() ?? fail('Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role SUPER_ADMIN]');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address");
const role = values.role as StaffRole;
if (!STAFF_ROLES.includes(role)) fail(`--role must be one of ${STAFF_ROLES.join(", ")}`);

const { db, pool } = createDb();
const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);

let password = process.env.ADMIN_PASSWORD;
if (password === undefined && process.stdin.isTTY) {
  const hint = existing ? " (leave empty to keep the current one)" : "";
  password = await ask(`Password for ${email}${hint}: `, true);
  if (password && (await ask("Type it again: ", true)) !== password) fail("The passwords do not match");
}
if (password && (password.length < 8 || password.length > 128)) fail("Use a password of 8 to 128 characters");
if (!existing && !password) fail("A new account needs a password: run this in a terminal, or set ADMIN_PASSWORD");

const passwordHash = password ? await hashPassword(password) : undefined;
if (existing) {
  const staffRoles = [...new Set([...existing.staffRoles, role])];
  await db.update(users).set({ staffRoles, status: "ACTIVE", ...(values.name ? { name: values.name } : {}), ...(passwordHash ? { passwordHash } : {}) }).where(sql`${users.id} = ${existing.id}`);
  console.log(`${email} now has: ${staffRoles.join(", ")}${passwordHash ? ". Password updated." : ""}`);
} else {
  await db.insert(users).values({ email, name: values.name ?? null, passwordHash, staffRoles: [role], emailVerifiedAt: new Date() });
  console.log(`Created ${role} ${email}. Sign in at /login?as=staff`);
}
await pool.end();
