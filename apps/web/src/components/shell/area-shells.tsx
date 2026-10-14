"use client";

import type { ReactNode } from "react";
import {
  Activity,
  BadgePercent,
  Image as ImageIcon,
  Inbox,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  Users,
} from "lucide-react";
import type { Notification } from "@/lib/types";
import { DashboardShell, WorkspaceSwitcher, type NavGroup } from "./dashboard-shell";
import { WORKSPACES } from "./workspaces";

type Counts = Record<string, number | undefined>;

interface AreaShellProps {
  children: ReactNode;
  notifications?: Notification[];
  counts?: Counts;
}

/* ------------------------------ Admin Console -------------------------- */

export function adminNav(c: Counts = {}): NavGroup[] {
  return [
    { items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true }] },
    {
      label: "Commerce",
      items: [
        { label: "Orders", href: "/admin/orders", icon: ShoppingCart, badge: c.toAccept },
        { label: "Returns and refunds", href: "/admin/returns", icon: RotateCcw, badge: c.returns },
        { label: "Customers", href: "/admin/customers", icon: Users },
      ],
    },
    {
      label: "Catalog",
      items: [
        { label: "Products", href: "/admin/catalog", icon: Package },
        { label: "Categories", href: "/admin/categories", icon: Layers },
        { label: "Brands", href: "/admin/brands", icon: Tags },
      ],
    },
    {
      label: "Finance",
      items: [{ label: "Payments", href: "/admin/payments", icon: IndianRupee }],
    },
    {
      label: "Growth",
      items: [
        { label: "Coupons and sales", href: "/admin/promotions", icon: BadgePercent },
        { label: "Storefront CMS", href: "/admin/cms", icon: ImageIcon },
      ],
    },
    {
      label: "Trust",
      items: [{ label: "Reviews", href: "/admin/reviews", icon: Star }],
    },
    {
      label: "System",
      items: [
        { label: "Audit log", href: "/admin/audit", icon: Activity },
        { label: "Settings", href: "/admin/settings", icon: Settings },
      ],
    },
  ];
}

export function AdminShell({ children, notifications, counts, user = { name: "AltasGoods staff", role: "AltasGoods Control" } }: AreaShellProps & { user?: { name: string; role: string } }) {
  return (
    <DashboardShell
      workspace="admin"
      nav={adminNav(counts)}
      user={user}
      notifications={notifications}
      searchPlaceholder="Search orders, customers, AWB"
      searchAction="/admin/orders"
      context={<WorkspaceSwitcher current={WORKSPACES.find((w) => w.key === "admin")!} />}
    >
      {children}
    </DashboardShell>
  );
}

/* ------------------------------- Logistics ----------------------------- */

export function logisticsNav(c: Counts = {}): NavGroup[] {
  return [
    { items: [{ label: "Overview", href: "/logistics", icon: LayoutDashboard, exact: true }] },
    { label: "Shipping", items: [{ label: "Shipments", href: "/logistics/shipments", icon: Package, badge: c.attention }] },
  ];
}

export function LogisticsShell({ children, counts, user = { name: "AltasGoods staff", role: "Shipping" } }: AreaShellProps & { user?: { name: string; role: string } }) {
  return (
    <DashboardShell
      workspace="logistics"
      nav={logisticsNav(counts)}
      user={user}
      searchPlaceholder="Search AWB, order ID or product"
      searchAction="/logistics/shipments"
      context={<WorkspaceSwitcher current={WORKSPACES.find((w) => w.key === "logistics")!} />}
    >
      {children}
    </DashboardShell>
  );
}

/* -------------------------------- Support ------------------------------ */

export function supportNav(c: Counts = {}): NavGroup[] {
  return [
    { items: [{ label: "Overview", href: "/support", icon: LayoutDashboard, exact: true }] },
    {
      label: "Work",
      items: [
        { label: "Ticket inbox", href: "/support/tickets", icon: Inbox, badge: c.open },
        { label: "Customer lookup", href: "/support/customers", icon: Users },
        { label: "Order lookup", href: "/support/orders", icon: ShoppingCart },
      ],
    },
  ];
}

export function SupportShell({ children, notifications, counts, user = { name: "Care Desk agent", role: "AltasGoods Care Desk" } }: AreaShellProps & { user?: { name: string; role: string } }) {
  return (
    <DashboardShell
      workspace="support"
      nav={supportNav(counts)}
      user={user}
      notifications={notifications}
      searchPlaceholder="Search tickets, customers, orders"
      searchAction="/support/tickets"
      context={<WorkspaceSwitcher current={WORKSPACES.find((w) => w.key === "support")!} />}
    >
      {children}
    </DashboardShell>
  );
}
