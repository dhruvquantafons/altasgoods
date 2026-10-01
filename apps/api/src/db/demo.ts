/** The demo shopper (Ananya Sharma). Sign in with this number to see her orders. */
export const DEMO_CUSTOMER_PHONE = "+919845012345";
/** The demo seller account (Rohan Mehta, owner of Apex Retail) for Seller Hub. */
export const DEMO_SELLER_PHONE = "+919820011223";
/** BluBuy staff (Kavya Iyer, Super Admin) for BluBuy Control, including seller application reviews. */
export const DEMO_STAFF_PHONE = "+919811012345";
/** Care Desk supervisor (Arvind Menon): approves refunds above an agent's limit. */
export const DEMO_SUPERVISOR_PHONE = "+919811020099";
/** Care agents sign in as +91 98110 20001 (Revathi Subramanian, L2) onwards. */
export const careAgentPhone = (i: number) => `+9198110200${String(i + 1).padStart(2, "0")}`;
/** Applicant whose application is waiting on changes; sign in to fix and resubmit it. */
export const DEMO_APPLICANT_PHONE = "+919700011004";
