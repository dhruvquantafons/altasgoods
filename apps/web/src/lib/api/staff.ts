/** Display names for AltasGoods staff roles, who counts as an admin, and who may see or change each area. */
export const STAFF_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPS_ADMIN: "Operations Admin",
  CATALOG_MANAGER: "Catalog Manager",
  AUDITOR: "Auditor",
  SUPPORT_AGENT: "Support Agent L1",
  SUPPORT_SPECIALIST: "Support Specialist L2",
  SUPPORT_SUPERVISOR: "Care Desk Supervisor",
};

/** What each role is for, shown when adding staff or editing their roles. */
export const STAFF_ROLE_HINT: Record<string, string> = {
  SUPER_ADMIN: "Everything, including adding and removing staff",
  OPS_ADMIN: "Orders, returns, payments, customers, promotions, settings and shipping",
  CATALOG_MANAGER: "Products, categories, brands, the storefront CMS, page content and reviews",
  AUDITOR: "Reads every admin area and the audit log; cannot change anything",
  SUPPORT_AGENT: "Care Desk tickets, with a small refund limit",
  SUPPORT_SPECIALIST: "Care Desk tickets, with a larger refund limit",
  SUPPORT_SUPERVISOR: "Care Desk, and approves refunds above an agent's limit",
};

/** Shipping and the workspace launcher are for admins: the shipping API needs Ops Admin, and Super Admin passes every check. */
export const isAdmin = (roles: readonly string[]) => roles.includes("SUPER_ADMIN") || roles.includes("OPS_ADMIN");

export const roleLabel = (roles: readonly string[], fallback: string) => roles.map((r) => STAFF_ROLE_LABEL[r] ?? r).join(", ") || fallback;

/* ------------------------------ Areas and roles ------------------------------ */

/** Pages of AltasGoods Control, named by their first path segment under /admin ("overview" is /admin itself). */
export const ADMIN_AREAS = ["overview", "orders", "returns", "customers", "catalog", "categories", "brands", "payments", "promotions", "cms", "content", "reviews", "audit", "settings", "staff", "account"] as const;
export type AdminArea = (typeof ADMIN_AREAS)[number];
/** Every staff area: the admin pages, Shipping, the workspace launcher and the Care Desk. */
export type Area = AdminArea | "logistics" | "portals" | "support";

const OPS = ["OPS_ADMIN"] as const;
const CATALOG = ["OPS_ADMIN", "CATALOG_MANAGER"] as const;
const CARE = ["SUPPORT_AGENT", "SUPPORT_SPECIALIST", "SUPPORT_SUPERVISOR"] as const;
const opsArea = { see: [...OPS, "AUDITOR"], edit: OPS };
const catalogArea = { see: [...CATALOG, "AUDITOR"], edit: CATALOG };

/**
 * Who may see (open the page) and edit (use its buttons) each area, Super
 * Admin aside: Super Admin passes every check, as in the API. This mirrors
 * the @StaffOnly lists on the API controllers; the API stays the real check.
 * A new admin page needs an entry here, or only Super Admins can open it.
 */
export const AREA_ROLES: Record<Area, { see: readonly string[]; edit: readonly string[] }> = {
  overview: opsArea,
  orders: opsArea,
  returns: opsArea,
  customers: opsArea,
  payments: opsArea,
  promotions: opsArea,
  settings: opsArea,
  audit: opsArea,
  catalog: catalogArea,
  categories: catalogArea,
  brands: catalogArea,
  cms: catalogArea,
  content: catalogArea,
  reviews: catalogArea,
  // Super Admin only
  staff: { see: [], edit: [] },
  // your own staff profile: anyone who works in AltasGoods Control
  account: { see: [...CATALOG, "AUDITOR"], edit: [...CATALOG, "AUDITOR"] },
  logistics: { see: OPS, edit: OPS },
  portals: { see: OPS, edit: OPS },
  support: { see: CARE, edit: CARE },
};

const passes = (roles: readonly string[], allowed: readonly string[]) => roles.includes("SUPER_ADMIN") || roles.some((r) => allowed.includes(r));

/** Whether these roles may open the area. */
export const canSee = (roles: readonly string[], area: Area) => passes(roles, AREA_ROLES[area].see);

/** Whether these roles may change things in the area. Pages hide their mutation buttons when this is false (an Auditor, say). */
export const canEdit = (roles: readonly string[], area: Area) => passes(roles, AREA_ROLES[area].edit);

/** The admin areas these roles can open, in sidebar order (the account page is not in the sidebar). */
export const navFor = (roles: readonly string[]): AdminArea[] => ADMIN_AREAS.filter((a) => a !== "account" && canSee(roles, a));

/**
 * The staff area a path belongs to, null for pages that are not staff areas,
 * or "unmapped" for an /admin page missing from AREA_ROLES (Super Admin only).
 */
export function areaForPath(path: string): Area | "unmapped" | null {
  const [, top, sub] = path.split("/");
  if (top === "logistics" || top === "portals" || top === "support") return top;
  if (top !== "admin") return null;
  if (!sub) return "overview";
  return (ADMIN_AREAS as readonly string[]).includes(sub) && sub !== "overview" ? (sub as AdminArea) : "unmapped";
}

/** Whether these roles may open the path. Paths outside the staff areas are not checked here. */
export function canSeePath(path: string, roles: readonly string[]) {
  const area = areaForPath(path);
  if (area === null) return true;
  if (area === "unmapped") return roles.includes("SUPER_ADMIN");
  return canSee(roles, area);
}

const hrefFor = (area: AdminArea) => (area === "overview" ? "/admin" : `/admin/${area}`);

/** Where these roles land in AltasGoods Control: the overview, or their first area. Null when they have none. */
export function adminHome(roles: readonly string[]) {
  const first = navFor(roles)[0];
  return first ? hrefFor(first) : null;
}

/** Where a staff member starts work: AltasGoods Control, else the Care Desk, else the storefront. */
export const staffHome = (roles: readonly string[]) => adminHome(roles) ?? (canSee(roles, "support") ? "/support" : "/");
