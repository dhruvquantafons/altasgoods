/** Dependency injection tokens. Every injection is explicit (@Inject(TOKEN)), so the app
 * runs under tsx, Vitest and tsc alike without relying on decorator metadata. */
export const DB = Symbol("DB");
export const DB_POOL = Symbol("DB_POOL");
export const REDIS = Symbol("REDIS");
export const SMS_PROVIDER = Symbol("SMS_PROVIDER");
export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
export const KYC_PROVIDER = Symbol("KYC_PROVIDER");
export const FILE_STORE = Symbol("FILE_STORE");
export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");
export const CLOCK = Symbol("CLOCK");
