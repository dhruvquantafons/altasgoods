import { KycQueue } from "@/components/admin/kyc-queue";
import { sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { api, unwrap } from "@/lib/api/server";
import { ONBOARDING_CATEGORIES } from "@/lib/mock/seller-extra";

export const metadata = { title: "Seller applications" };

const TABS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "decided", label: "Decided" },
] as const;

export default async function ApprovalsPage(props: PageProps<"/admin/sellers/approvals">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp(params, "tab"))?.key ?? "open";
  const q = sp(params, "q")?.trim() || undefined;
  const queue = unwrap(await (await api()).GET("/v1/admin/seller-applications", { params: { query: { tab, q, page: 1, pageSize: 60 } } }));
  const c = queue.counts;
  const oldestHours = queue.oldestOpenSubmittedAt ? Math.max(0, Math.round((Date.parse(new Date().toISOString()) - Date.parse(queue.oldestOpenSubmittedAt)) / 3_600_000)) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sellers", href: "/admin/sellers" }, { label: "Applications" }]}
        title="Seller applications"
        description="KYC and onboarding review. GSTIN, PAN and the ₹1 penny drop run automatically when a seller submits; you verify documents, category gates and risk flags."
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Awaiting review", value: c.awaitingReview, hint: "submitted or under review" },
          { label: "Waiting on seller", value: c.waitingOnSeller, hint: "action required" },
          { label: "Oldest in queue", value: oldestHours === null ? "None" : `${oldestHours} h`, hint: "target 72 h" },
          { label: "Approval rate, 30 days", value: queue.approvalRate30d === null ? "No decisions" : `${Math.round(queue.approvalRate30d * 100)}%`, hint: "of decided applications" },
        ]}
      />

      <Card>
        <CardHeader title="Review queue" description="Oldest first. Approving creates the seller account; it becomes Active after the first listing passes QC." />
        <TabLinks
          className="mt-2 px-5"
          active={tab}
          items={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.key === "open" ? c.open : t.key === "in_progress" ? c.inProgress : c.decided,
            href: t.key === "open" ? "/admin/sellers/approvals" : `/admin/sellers/approvals?tab=${t.key}`,
          }))}
        />
        <KycQueue key={tab} items={queue.items} decided={tab === "decided"} initialOpenId={sp(params, "review")} categories={ONBOARDING_CATEGORIES} />
      </Card>
    </>
  );
}
