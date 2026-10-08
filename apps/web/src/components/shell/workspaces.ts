import { Headset, ShieldCheck, Store, Truck, UserRound, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Workspace {
  key: "store" | "account" | "seller" | "admin" | "logistics" | "support";
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  audience: string;
}

/** Every AltasGoods surface. Used by the workspace switcher and the /portals launcher. */
export const WORKSPACES: Workspace[] = [
  { key: "store", name: "Storefront", description: "Browse, search and buy across every category", href: "/", icon: Store, audience: "Shoppers" },
  { key: "account", name: "My Account", description: "Orders, returns, wallet, addresses and rewards", href: "/account", icon: UserRound, audience: "Shoppers" },
  { key: "seller", name: "Seller Hub", description: "Listings, orders, payments, ads and account health", href: "/seller", icon: Warehouse, audience: "Sellers and brands" },
  { key: "admin", name: "AltasGoods Control", description: "Marketplace operations, catalog, finance and risk", href: "/admin", icon: ShieldCheck, audience: "AltasGoods staff" },
  { key: "logistics", name: "Hub Console", description: "Hubs, shipments, delivery runs, NDR and COD", href: "/logistics", icon: Truck, audience: "Hub and fleet teams" },
  { key: "support", name: "Care Desk", description: "Tickets, customer context, refunds and SLAs", href: "/support", icon: Headset, audience: "Support agents" },
];
