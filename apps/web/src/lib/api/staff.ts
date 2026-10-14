/** Display names for AltasGoods staff roles, and who counts as an admin. */
export const STAFF_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_ADMIN: "Operations Admin",
  CATALOG_MANAGER: "Catalog Manager",
  AUDITOR: "Auditor",
  SUPPORT_AGENT: "Support Agent L1",
  SUPPORT_SPECIALIST: "Support Specialist L2",
  SUPPORT_SUPERVISOR: "Care Desk Supervisor",
};

/** Shipping and the workspace launcher are for admins: the shipping API needs Ops Admin, and Super Admin passes every check. */
export const isAdmin = (roles: readonly string[]) => roles.includes("SUPER_ADMIN") || roles.includes("OPS_ADMIN");

export const roleLabel = (roles: readonly string[], fallback: string) => roles.map((r) => STAFF_ROLE_LABEL[r] ?? r).join(", ") || fallback;
