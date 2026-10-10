"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  Package,
  Star,
  Undo2,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type CountKey = "orders" | "returns" | "notifications" | "wishlist" | "reviews";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  count?: CountKey;
}

const groups: { title?: string; items: NavItem[] }[] = [
  { items: [{ href: "/account", label: "Overview", short: "Overview", icon: LayoutGrid }] },
  {
    title: "Orders",
    items: [
      { href: "/account/orders", label: "Your orders", short: "Orders", icon: Package, count: "orders" },
      { href: "/account/returns", label: "Returns and refunds", short: "Returns", icon: Undo2, count: "returns" },
    ],
  },
  {
    title: "Shopping",
    items: [
      { href: "/account/wishlist", label: "Wishlist", short: "Wishlist", icon: Heart, count: "wishlist" },
      { href: "/account/reviews", label: "Reviews and Q&A", short: "Reviews", icon: Star, count: "reviews" },
    ],
  },
  {
    title: "Money and rewards",
    items: [
      { href: "/account/wallet", label: "AltasGoods Credits", short: "Credits", icon: Wallet },
      { href: "/account/payments", label: "Payment methods", short: "Payments", icon: CreditCard },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/account/profile", label: "Profile and security", short: "Profile", icon: UserRound },
      { href: "/account/addresses", label: "Addresses", short: "Addresses", icon: MapPin },
      { href: "/account/notifications", label: "Notifications", short: "Notifications", icon: Bell, count: "notifications" },
    ],
  },
  { title: "Help", items: [{ href: "/account/support", label: "Help and support", short: "Help", icon: LifeBuoy }] },
];

const flat = groups.flatMap((g) => g.items);

export interface AccountNavProps {
  name: string;
  memberSince: string;
  counts: Partial<Record<CountKey, number>>;
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`));
}

/** Desktop account navigation card with the shopper's identity. */
export function AccountSidebar({ name, memberSince, counts }: AccountNavProps) {
  const isActive = useActive();
  return (
    <aside className="hidden lg:block" aria-label="Your account">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <div className="flex items-center gap-3 border-b border-line px-5 py-5">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold text-ink-900">{name}</p>
            <p className="mt-1 text-xs text-ink-500">Customer since {memberSince}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-4 px-3 py-4">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.title && <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{g.title}</p>}
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const count = it.count ? counts[it.count] : undefined;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                          active ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )}
                      >
                        <it.icon size={17} strokeWidth={1.8} aria-hidden="true" className={active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {count ? (
                          <span
                            className={cn(
                              "min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums",
                              active ? "bg-white text-brand-700" : "bg-ink-100 text-ink-600",
                            )}
                          >
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

/** Mobile and tablet: a horizontal scroller of account sections. */
export function AccountMobileNav({ counts }: Pick<AccountNavProps, "counts">) {
  const isActive = useActive();
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[aria-current='page']");
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav aria-label="Your account" className="relative -mx-4 mb-6 sm:-mx-6 lg:hidden">
      <div ref={ref} className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:px-6">
        {flat.map((it) => {
          const active = isActive(it.href);
          const count = it.count ? counts[it.count] : undefined;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                active ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700 hover:border-line-strong",
              )}
            >
              <it.icon size={15} strokeWidth={1.9} aria-hidden="true" />
              {it.short}
              {count ? <span className={cn("text-[11px] font-semibold tabular-nums", active ? "text-ink-300" : "text-ink-400")}>{count}</span> : null}
            </Link>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas" aria-hidden="true" />
    </nav>
  );
}
