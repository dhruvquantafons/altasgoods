import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CreditCard, PackageCheck, RotateCcw, ShoppingCart, Smartphone, Truck, Wallet, Warehouse } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { WORKSPACES } from "@/components/shell/workspaces";
import { IconTile } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Workspaces" };

const keyPages: Record<string, { label: string; href: string }[]> = {
  store: [
    { label: "Home", href: "/" },
    { label: "Search", href: "/s?q=headphones" },
    { label: "Product page", href: "/p/headphones-studio" },
    { label: "Cart and checkout", href: "/cart" },
  ],
  account: [
    { label: "Overview", href: "/account" },
    { label: "Orders and tracking", href: "/account/orders" },
    { label: "Returns and refunds", href: "/account/returns" },
    { label: "BluCoins and Plus", href: "/account/rewards" },
  ],
  seller: [
    { label: "Dashboard", href: "/seller" },
    { label: "Orders", href: "/seller/orders" },
    { label: "Payments", href: "/seller/payments" },
    { label: "Seller registration", href: "/seller/register" },
  ],
  admin: [
    { label: "Overview", href: "/admin" },
    { label: "Seller approvals", href: "/admin/sellers/approvals" },
    { label: "Catalog moderation", href: "/admin/catalog" },
    { label: "Seller payouts", href: "/admin/payouts" },
  ],
  logistics: [
    { label: "Hub overview", href: "/logistics" },
    { label: "Shipments", href: "/logistics/shipments" },
    { label: "NDR", href: "/logistics/ndr" },
    { label: "Rider app preview", href: "/logistics/associate-app" },
  ],
  support: [
    { label: "Overview", href: "/support" },
    { label: "Ticket inbox", href: "/support/tickets" },
    { label: "Customer lookup", href: "/support/customers" },
    { label: "Macros and policies", href: "/support/knowledge" },
  ],
};

const lifecycle = [
  { icon: ShoppingCart, title: "Customer orders", body: "Search, compare offers, pay by UPI, card, EMI or cash on delivery.", where: "Storefront", href: "/" },
  { icon: PackageCheck, title: "Seller confirms and packs", body: "Accept, print label and invoice, hand over within the dispatch SLA.", where: "Seller Hub", href: "/seller/orders" },
  { icon: Warehouse, title: "Pickup and line haul", body: "First mile pickup, sort centre, line haul to the delivery hub.", where: "Hub Console", href: "/logistics/inbound" },
  { icon: Truck, title: "Last mile delivery", body: "Runsheets, Secure Delivery OTP, COD collection, NDR re-attempts.", where: "Rider app", href: "/logistics/associate-app" },
  { icon: Wallet, title: "Seller gets paid", body: "Fees, GST, TCS and TDS settled after delivery plus the tier hold.", where: "Seller Hub and Control", href: "/seller/payments" },
  { icon: RotateCcw, title: "Returns and support", body: "Doorstep QC pickups, refunds to source or Credits, Care Desk tickets.", where: "Account and Care Desk", href: "/support/tickets" },
];

export default function PortalsPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Logo label="Platform workspaces" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
            Go to the store
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-brand-700 uppercase">One marketplace, six workspaces</p>
          <h1 className="mt-3 text-[34px] leading-[1.15] font-semibold text-ink-900 sm:text-[42px]">Everything that powers BluBuy, in one place</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
            Shoppers, sellers, BluBuy staff, logistics teams and support agents each get a workspace built for their job. They share one design system, one data
            model and one order lifecycle, so the web app today and the Flutter apps next speak the same language.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {WORKSPACES.map((w) => (
            <div key={w.key} className="group flex flex-col rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-raised">
              <div className="flex items-start justify-between">
                <IconTile icon={w.icon} tone="brand" size="lg" />
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-600">{w.audience}</span>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-ink-900">{w.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-ink-500">{w.description}</p>
              <ul className="mt-5 flex flex-col border-t border-line pt-3">
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
            How an order moves through BluBuy
          </h2>
          <p className="mt-1 text-sm text-ink-500">The same order is visible, with the right level of detail, in every workspace it touches.</p>
          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {lifecycle.map((s, i) => (
              <li key={s.title} className="relative">
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

        <section className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            { icon: Smartphone, title: "Flutter ready", body: "Design tokens, status machines and the domain model are documented so the Flutter apps reuse them one to one." },
            { icon: CreditCard, title: "Indian commerce built in", body: "UPI, COD, EMI, GST invoices, TCS and TDS, pincode promises and the Consumer Protection (E-Commerce) Rules." },
            { icon: Wallet, title: "Mock data today, API tomorrow", body: "Every screen reads from one data layer that maps to the planned REST API, so swapping in the backend is mechanical." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-6">
              <IconTile icon={f.icon} tone="neutral" />
              <p className="mt-4 text-[15px] font-semibold text-ink-900">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
