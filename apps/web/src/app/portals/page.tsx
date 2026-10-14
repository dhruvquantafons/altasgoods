import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Headset, PackageCheck, ShoppingCart, Truck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { WORKSPACES } from "@/components/shell/workspaces";
import { IconTile } from "@/components/ui/misc";
import { currentUser } from "@/lib/api/server";
import { isAdmin } from "@/lib/api/staff";

export const metadata: Metadata = { title: "Workspaces" };

const keyPages: Record<string, { label: string; href: string }[]> = {
  store: [
    { label: "Home", href: "/" },
    { label: "Search", href: "/s" },
    { label: "Cart and checkout", href: "/cart" },
  ],
  account: [
    { label: "Overview", href: "/account" },
    { label: "Orders and tracking", href: "/account/orders" },
    { label: "Returns and refunds", href: "/account/returns" },
  ],
  admin: [
    { label: "Orders", href: "/admin/orders" },
    { label: "Returns", href: "/admin/returns" },
    { label: "Products", href: "/admin/catalog" },
  ],
  logistics: [
    { label: "Overview and courier status", href: "/logistics" },
    { label: "Shipments", href: "/logistics/shipments" },
  ],
  support: [
    { label: "Ticket inbox", href: "/support/tickets" },
    { label: "Customer lookup", href: "/support/customers" },
  ],
};

const lifecycle = [
  { icon: ShoppingCart, title: "A customer orders", body: "They find a product, check out and pay online or choose cash on delivery.", where: "Storefront", href: "/" },
  { icon: PackageCheck, title: "The store packs it", body: "Accept, pack and mark the line ready to ship. That books the courier.", where: "AltasGoods Control", href: "/admin/orders" },
  { icon: Truck, title: "The courier delivers", body: "The courier picks up and delivers, and its tracking scans update the order.", where: "Shipping", href: "/logistics/shipments" },
  { icon: Headset, title: "Returns and help", body: "Customers ask for returns and talk to support. Refunds go back to how they paid.", where: "My Account and Care Desk", href: "/support/tickets" },
];

/** A launcher for admins: every workspace and how an order moves between them. */
export default async function PortalsPage() {
  const user = await currentUser();
  if (!user || !isAdmin(user.staffRoles)) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Logo label="Workspaces" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
            Go to the store
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="max-w-2xl">
          <h1 className="text-[30px] leading-[1.15] font-semibold text-ink-900 sm:text-[36px]">Workspaces</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">Everything that runs AltasGoods, one click away.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WORKSPACES.map((w) => (
            <div key={w.key} className="flex flex-col rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-raised">
              <div className="flex items-start justify-between">
                <IconTile icon={w.icon} tone="brand" size="lg" />
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-600">{w.audience}</span>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink-900">{w.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-ink-500">{w.description}</p>
              <ul className="mt-5 flex flex-1 flex-col border-t border-line pt-3">
                {keyPages[w.key]?.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} className="flex items-center justify-between rounded-lg py-1.5 text-[13px] text-ink-700 hover:text-brand-700">
                      {p.label}
                      <ArrowRight size={14} className="text-ink-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={w.href}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink-900 text-sm font-medium text-white transition-colors hover:bg-ink-800"
              >
                Open {w.name}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-16" aria-labelledby="lifecycle">
          <h2 id="lifecycle" className="text-xl font-semibold text-ink-900">
            How an order moves through AltasGoods
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lifecycle.map((s, i) => (
              <li key={s.title}>
                <Link href={s.href} className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-raised">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <s.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-ink-400">0{i + 1}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-ink-900">{s.title}</p>
                  <p className="mt-1 flex-1 text-[13px] leading-relaxed text-ink-500">{s.body}</p>
                  <p className="mt-4 text-xs font-medium text-brand-700">{s.where}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
