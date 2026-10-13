import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** scrypt with OWASP's recommended cost (N=2^17, r=8, p=1): about 64 MB and 100 ms per hash. */
const PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;

const derive = (password: string, salt: Buffer, o: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((resolve, reject) => {
    const options: ScryptOptions = { ...o, maxmem: 256 * o.N * o.r };
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });

/** Stored as scrypt$N$r$p$salt$hash, so the cost can rise later without breaking old hashes. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A real hash of nothing, checked when the email is unknown so a miss takes as long as a wrong password. */
let decoy: Promise<string> | undefined;
export const decoyHash = () => (decoy ??= hashPassword(randomBytes(16).toString("hex")));
