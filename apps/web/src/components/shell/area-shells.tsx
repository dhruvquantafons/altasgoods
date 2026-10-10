"use client";

import type { ReactNode } from "react";
import {
  Activity,
  BadgePercent,
  BookOpen,
  ChartColumn,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Inbox,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Map,
  Package,
  PackageOpen,
  Receipt,
  RotateCcw,
  Route,
  Settings,
  ShoppingCart,
  Smartphone,
  Star,
  Tags,
  Truck,
  Undo2,
  UserCog,
  Users,
  Warehouse,
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
        { label: "Reports", href: "/admin/reports", icon: FileText },
        { label: "Team and roles", href: "/admin/team", icon: UserCog },
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
    { items: [{ label: "Hub overview", href: "/logistics", icon: LayoutDashboard, exact: true }] },
    {
      label: "Last mile",
      items: [
        { label: "Shipments", href: "/logistics/shipments", icon: Package },
        { label: "Inbound and sorting", href: "/logistics/inbound", icon: PackageOpen },
        { label: "Delivery runs", href: "/logistics/runs", icon: Route },
        { label: "Delivery associates", href: "/logistics/associates", icon: Users },
        { label: "NDR", href: "/logistics/ndr", icon: ClipboardList, badge: c.ndr },
        { label: "Reverse and RTO", href: "/logistics/reverse", icon: Undo2 },
        { label: "COD remittance", href: "/logistics/cod", icon: Receipt },
      ],
    },
    {
      label: "Network",
      items: [
        { label: "Fulfilment centres", href: "/logistics/fulfilment", icon: Warehouse },
        { label: "Hubs and line haul", href: "/logistics/network", icon: Map },
        { label: "Associate app", href: "/logistics/associate-app", icon: Smartphone },
      ],
    },
  ];
}

export function LogisticsShell({ children, notifications, counts, hub }: AreaShellProps & { hub: { code: string; name: string } }) {
  return (
    <DashboardShell
      workspace="logistics"
      nav={logisticsNav(counts)}
      user={{ name: "Naveen Kumar", role: "Hub Manager" }}
      notifications={notifications}
      searchPlaceholder="Search AWB, order ID, pincode"
      searchAction="/logistics/shipments"
      context={
        <div className="rounded-xl border border-line bg-gradient-to-br from-white to-ink-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
            <Truck size={13} aria-hidden="true" />
            Current hub
          </span>
          <span className="mt-1 block truncate text-[13px] font-semibold text-ink-900">{hub.name}</span>
          <span className="block font-mono text-[11px] text-ink-500">{hub.code}, Morning shift</span>
        </div>
      }
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
    {
      label: "Knowledge",
      items: [
        { label: "Macros and policies", href: "/support/knowledge", icon: BookOpen },
        { label: "Team performance", href: "/support/performance", icon: ChartColumn },
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
