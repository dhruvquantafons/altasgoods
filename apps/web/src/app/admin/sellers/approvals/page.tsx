import { KycQueue } from "@/components/admin/kyc-queue";
import { sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { categories } from "@/lib/mock";
import { kycApplications, type KycApplication } from "@/lib/mock/admin-extra";
import { NOW } from "@/lib/utils";

export const metadata = { title: "Seller applications" };

const TABS: { key: string; label: string; match: (a: KycApplication) => boolean }[] = [
  { key: "open", label: "Open", match: (a) => ["submitted", "under_review", "action_required"].includes(a.status) },
  { key: "in_progress", label: "In progress", match: (a) => a.status === "kyc_in_progress" },
  { key: "decided", label: "Decided", match: (a) => a.status === "approved" || a.status === "rejected" },
];

export default async function ApprovalsPage(props: PageProps<"/admin/sellers/approvals">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp(params, "tab"))?.key ?? "open";
  const apps = kycApplications.filter(TABS.find((t) => t.key === tab)!.match).sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt));
  const open = kycApplications.filter(TABS[0]!.match);
  const awaiting = open.filter((a) => a.status !== "action_required");
  const oldest = Math.max(...awaiting.map((a) => (NOW.getTime() - new Date(a.submittedAt).getTime()) / 3_600_000));
  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sellers", href: "/admin/sellers" }, { label: "Applications" }]}
        title="Seller applications"
        description="KYC and onboarding review. GSTIN, PAN and bank penny drop run automatically on submission; you verify documents, category gates and risk flags."
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Awaiting review", value: awaiting.length, hint: "submitted or under review" },
          { label: "Waiting on seller", value: open.filter((a) => a.status === "action_required").length, hint: "action required" },
          { label: "Oldest in queue", value: `${Math.round(oldest)} h`, hint: "target 72 h" },
          { label: "Approval rate, 30 days", value: "82%", hint: "of decided applications" },
        ]}
      />

      <Card>
        <CardHeader title="Review queue" description="Oldest first. Approving moves the account to Approved; it becomes Active after the first listing passes QC." />
        <TabLinks
          className="mt-2 px-5"
          active={tab}
          items={TABS.map((t) => ({ key: t.key, label: t.label, count: kycApplications.filter(t.match).length, href: t.key === "open" ? "/admin/sellers/approvals" : `/admin/sellers/approvals?tab=${t.key}` }))}
        />
        <KycQueue apps={apps} categoryNames={categoryNames} decided={tab === "decided"} initialOpenId={sp(params, "review")} />
      </Card>
    </>
  );
}
