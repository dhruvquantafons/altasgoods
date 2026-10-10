/** The demo shopper (Ananya Sharma). Sign in with this number to see her orders. */
export const DEMO_CUSTOMER_PHONE = "+919845012345";
/** AltasGoods staff (Kavya Iyer, Super Admin) for AltasGoods Control: orders, returns and the catalog. */
export const DEMO_STAFF_PHONE = "+919811012345";
/** Care Desk supervisor (Arvind Menon): approves refunds above an agent's limit. */
export const DEMO_SUPERVISOR_PHONE = "+919811020099";
/** Care agents sign in as +91 98110 20001 (Revathi Subramanian, L2) onwards. */
export const careAgentPhone = (i: number) => `+9198110200${String(i + 1).padStart(2, "0")}`;
