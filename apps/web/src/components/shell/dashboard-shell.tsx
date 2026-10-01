"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronsUpDown, CircleHelp, LayoutGrid, LogOut, Menu, Search, Settings, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar, Kbd } from "@/components/ui/misc";
import { Popover } from "@/components/ui/interactive";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";
import { WORKSPACES, type Workspace } from "./workspaces";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  /** only active on an exact path match (use for the overview item) */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface ShellProps {
  workspace: Workspace["key"];
  nav: NavGroup[];
  user: { name: string; role: string };
  notifications?: Notification[];
  searchPlaceholder?: string;
  /** where the top bar search submits (as ?q=), e.g. "/seller/orders" */
  searchAction?: string;
  /** context block under the logo, e.g. the seller's store or the current hub */
  context?: ReactNode;
  /** pinned at the bottom of the sidebar above the user */
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarNav({ nav, pathname, onNavigate }: { nav: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6">
      {nav.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">{group.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.8} className={cn("shrink-0", active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600")} aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                          active ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher({ current }: { current: Workspace }) {
  return (
    <Popover
      align="start"
      className="w-72"
      trigger={(open) => (
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-2 text-left transition-colors hover:bg-ink-50",
            open && "bg-ink-50",
          )}
          aria-label="Switch workspace"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <current.icon size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink-900">{current.name}</span>
            <span className="block truncate text-[11px] text-ink-500">{current.audience}</span>
          </span>
          <ChevronsUpDown size={15} className="text-ink-400" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">BluBuy workspaces</p>
          {WORKSPACES.map((w) => (
            <Link
              key={w.key}
              href={w.href}
              onClick={close}
              className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-ink-50", w.key === current.key && "bg-ink-50")}
            >
              <w.icon size={17} strokeWidth={1.8} className="text-ink-500" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink-900">{w.name}</span>
                <span className="block truncate text-[11px] text-ink-500">{w.description}</span>
              </span>
            </Link>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <Link href="/portals" onClick={close} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-ink-50">
              <LayoutGrid size={16} className="text-ink-500" aria-hidden="true" />
              All workspaces
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}

function Notifications({ items }: { items: Notification[] }) {
  const unread = items.filter((n) => !n.read).length;
  return (
    <Popover
      className="w-[22rem] p-0"
      trigger={() => (
        <button className="relative flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label={`Notifications, ${unread} unread`}>
          <Bell size={18} strokeWidth={1.8} />
          {unread > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-danger-500 ring-2 ring-white" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{unread} new</span>}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto scrollbar-thin">
            {items.map((n) => {
              const body = (
                <>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink-900">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-400">{timeAgo(n.at)}</span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} onClick={close} className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Popover>
  );
}

/**
 * The shared frame for Seller Central, Admin, Logistics and Support:
 * fixed sidebar on desktop, slide-in drawer on mobile, sticky top bar.
 */
export function DashboardShell({ workspace, nav, user, notifications = [], searchPlaceholder = "Search", searchAction, context, sidebarFooter, children }: ShellProps) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const current = WORKSPACES.find((w) => w.key === workspace)!;
  const searchRef = useRef<HTMLInputElement>(null);
  const accountHref = `${current.href}/account`;
  const signOutHref = `/signed-out?from=${workspace}`;
  const searchHref = searchAction ?? current.href;

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  // Ctrl+K or Cmd+K focuses the search box from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo href={current.href} label={current.name} size="sm" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-6 scrollbar-thin">
        <div className="mb-5 px-0.5">{context ?? <WorkspaceSwitcher current={current} />}</div>
        <SidebarNav nav={nav} pathname={pathname} onNavigate={onNavigate} />
      </div>
      {sidebarFooter && <div className="px-3 pb-3">{sidebarFooter}</div>}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-[11px] text-ink-500">{user.role}</p>
          </div>
          <form action={signOut.bind(null, signOutHref)}>
            <button type="submit" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{sidebar()}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop animate-slide-in">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar(() => setDrawer(false))}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button onClick={() => setDrawer(true)} className="-ml-1.5 rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <form action={searchHref} method="get" role="search" className="relative hidden max-w-md flex-1 md:block">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              name="q"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-transparent bg-ink-100/70 pr-14 pl-9 text-[13px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 flex -translate-y-1/2 gap-1">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href={searchHref} className="flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800 md:hidden" aria-label="Search">
              <Search size={18} strokeWidth={1.8} />
            </Link>
            <Link href="/portals" className="hidden size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800 sm:flex" aria-label="All workspaces">
              <LayoutGrid size={18} strokeWidth={1.8} />
            </Link>
            <Link href="/help" className="flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label="Help">
              <CircleHelp size={18} strokeWidth={1.8} />
            </Link>
            <Notifications items={notifications} />
            <div className="mx-2 hidden h-6 w-px bg-line sm:block" />
            <Popover
              trigger={() => (
                <button className="flex items-center gap-2.5 rounded-lg py-1 pr-1.5 pl-1 hover:bg-ink-100" aria-label="Account menu">
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-[13px] leading-tight font-semibold text-ink-900">{user.name}</span>
                    <span className="block text-[11px] leading-tight text-ink-500">{user.role}</span>
                  </span>
                </button>
              )}
            >
              {(close) => (
                <div>
                  <div className="px-2.5 pt-1.5 pb-2">
                    <p className="text-[13px] font-semibold text-ink-900">{user.name}</p>
                    <p className="text-xs text-ink-500">{user.role}</p>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link href={accountHref} onClick={close} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                    <UserRound size={16} className="text-ink-400" aria-hidden="true" />
                    Profile
                  </Link>
                  <Link
                    href={`${accountHref}?tab=preferences`}
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900"
                  >
                    <Settings size={16} className="text-ink-400" aria-hidden="true" />
                    Preferences
                  </Link>
                  <div className="my-1 h-px bg-line" />
                  <form action={signOut.bind(null, signOutHref)}>
                    <button type="submit" onClick={close} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-danger-700 hover:bg-danger-50">
                      <LogOut size={16} aria-hidden="true" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </Popover>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export { WorkspaceSwitcher };
