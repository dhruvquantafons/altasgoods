/**
 * Accounts made by the test fixtures (seed-demo.ts). They exist only in the
 * test database: development and production start with no accounts.
 */
export const DEMO_PASSWORD = "demo-password-1234";
/** The demo shopper (Ananya Sharma), who owns the seeded addresses and tickets. */
export const DEMO_CUSTOMER_EMAIL = "ananya.sharma@example.com";
/** AltasGoods staff (Kavya Iyer, Super Admin) for AltasGoods Control. */
export const DEMO_STAFF_EMAIL = "kavya.iyer@altasgoods.in";
/** Care Desk supervisor (Arvind Menon): approves refunds above an agent's limit. */
export const DEMO_SUPERVISOR_EMAIL = "arvind.menon@altasgoods.in";
/** Care agents: care1@altasgoods.in (Revathi Subramanian, L2) onwards. */
export const careAgentEmail = (i: number) => `care${i + 1}@altasgoods.in`;
