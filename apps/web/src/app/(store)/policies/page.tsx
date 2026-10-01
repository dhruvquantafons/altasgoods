import type { Metadata } from "next";
import { HelpBand, InfoHero, PolicyCard } from "@/components/store/info-page";
import { STORE_CONTAINER } from "@/components/store/store-header";
import { POLICIES } from "@/lib/mock/company";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <div className="pb-16 lg:pb-24">
      <InfoHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Policies" }]}
        eyebrow="Policies"
        title="Clear rules, written plainly"
        description="Everything about returns, delivery, payments, your data and your rights as a BluBuy customer, in one place."
      />
      <div className={cn(STORE_CONTAINER, "mt-10 lg:mt-14")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {POLICIES.map((p) => (
            <PolicyCard key={p.slug} policy={p} />
          ))}
        </div>
        <div className="mt-14">
          <HelpBand />
        </div>
      </div>
    </div>
  );
}
