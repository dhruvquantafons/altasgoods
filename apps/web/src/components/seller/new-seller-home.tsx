import Link from "next/link";
import { ArrowRight, CircleCheck, GraduationCap, Package, PackagePlus, ShoppingCart, Store, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";

/** Seller Hub home for a seller who has just been approved and has no sales history yet. */
export function NewSellerHome({ firstName, store, counts }: { firstName: string; store: string; counts: { toConfirm: number; toPack: number; awaitingPickup: number } }) {
  const steps = [
    { done: true, icon: CircleCheck, title: "KYC verified", body: "Business, PAN, bank account and documents approved by BluBuy." },
    { done: false, icon: PackagePlus, title: "Create your first listing", body: "Match an existing product or create a new one. It goes live after a quality check.", href: "/seller/catalog/new", cta: "Add a product" },
    { done: false, icon: Truck, title: "Book a pickup test", body: "BluBuy Logistics visits your pickup address once to verify it before your first order.", href: "/seller/settings?tab=pickup", cta: "Pickup settings" },
    { done: false, icon: Store, title: "Set up your store page", body: "Add a logo, banner and description customers see on your store page.", href: "/seller/settings", cta: "Store settings" },
    { done: false, icon: GraduationCap, title: "Learn the basics", body: "A 12 minute Seller Academy lesson on listing, pricing and dispatch.", href: "/seller/support", cta: "Start lesson" },
  ];
  const tiles = [
    { label: "Orders to confirm", value: counts.toConfirm, icon: ShoppingCart, href: "/seller/orders?tab=new", tone: "brand" as const },
    { label: "Ready to pack", value: counts.toPack, icon: Package, href: "/seller/orders?tab=to_pack", tone: "info" as const },
    { label: "Awaiting pickup", value: counts.awaitingPickup, icon: Truck, href: "/seller/orders?tab=ready", tone: "accent" as const },
  ];
  return (
    <>
      <PageHeader
        title={`Welcome to Seller Hub, ${firstName}`}
        description={`${store} is approved. A few steps stand between you and your first order.`}
        actions={
          <ButtonLink href="/seller/catalog/new" icon={PackagePlus}>
            Add a product
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Get ready to sell" description={`${steps.filter((s) => s.done).length} of ${steps.length} done`} />
          <ol className="mt-2 divide-y divide-line border-t border-line">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className={s.done ? "text-success-600" : "text-ink-400"}>
                  <s.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={s.done ? "text-[13px] font-medium text-ink-500" : "text-[13px] font-semibold text-ink-900"}>
                    {i + 1}. {s.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">{s.body}</p>
                </div>
                {s.href && (
                  <ButtonLink href={s.href} size="sm" variant={i === 1 ? "primary" : "secondary"} iconRight={ArrowRight}>
                    {s.cta}
                  </ButtonLink>
                )}
              </li>
            ))}
          </ol>
        </Card>
        <div className="flex flex-col gap-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-200">
              <IconTile icon={t.icon} tone={t.tone} />
              <span className="flex-1">
                <span className="block text-2xl font-semibold text-ink-900 tabular-nums">{t.value}</span>
                <span className="block text-[13px] text-ink-600">{t.label}</span>
              </span>
              <ArrowRight size={16} className="text-ink-400" aria-hidden="true" />
            </Link>
          ))}
          <p className="text-xs leading-relaxed text-ink-500">Orders appear here the moment a customer buys from you. Confirm them before the accept-by time to keep your account healthy.</p>
        </div>
      </div>
    </>
  );
}
