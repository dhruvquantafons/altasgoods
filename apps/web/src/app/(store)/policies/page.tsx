import type { Metadata } from "next";
import { HelpBand, InfoHero, PolicyCard } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { getStorePolicies } from "@/lib/store-content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const policies = await getStorePolicies();
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Policies" }]}
        eyebrow="Policies"
        title="Clear rules, written plainly"
        description="Everything about returns, delivery, payments, your data and your rights as an AltasGoods customer, in one place."
      />
      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((p) => (
            <PolicyCard key={p.slug} policy={p} />
          ))}
        </div>
        {policies.length === 0 && <p className="rounded-2xl border border-line p-8 text-center text-sm text-ink-500">Our policies are not available right now. Please try again in a moment.</p>}
        <div className="mt-14">
          <HelpBand />
        </div>
      </div>
    </div>
  );
}
