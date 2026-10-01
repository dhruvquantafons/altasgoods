import { ActionButton, ToastButton } from "@/components/admin/action-button";
import { MODERATION_TYPE, RISK_LEVEL } from "@/components/admin/admin-status";
import { Mono } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { ageLabel, hrefWith, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { categories, sellers } from "@/lib/mock";
import { CATALOG_QUEUE_TOTAL, moderationQueue, opsSnapshot, suppressedListings } from "@/lib/mock/admin-extra";
import { formatNumber, NOW } from "@/lib/utils";

export const metadata = { title: "Catalog moderation" };

export default async function CatalogPage(props: PageProps<"/admin/catalog">) {
  const params = await props.searchParams;
  const tab = sp(params, "tab") === "suppressed" ? "suppressed" : "queue";
  const q = sp(params, "q")?.trim() ?? "";
  const category = sp(params, "category") ?? "all";
  const type = sp(params, "type") ?? "all";
  const risk = sp(params, "risk") ?? "all";
  const current = { tab: tab === "queue" ? undefined : tab, q: q || undefined, category: category === "all" ? undefined : category, type: type === "all" ? undefined : type, risk: risk === "all" ? undefined : risk };
  const needle = q.toLowerCase();

  const queue = moderationQueue
    .filter((m) => {
      if (needle && !`${m.title} ${m.bsin} ${m.sellerName} ${m.brand}`.toLowerCase().includes(needle)) return false;
      if (category !== "all" && m.categoryId !== category) return false;
      if (type !== "all" && m.type !== type) return false;
      if (risk !== "all" && m.risk !== risk) return false;
      return true;
    })
    .sort((a, b) => +new Date(a.slaDueAt) - +new Date(b.slaDueAt));
  const suppressed = suppressedListings.filter((s) => !needle || `${s.title} ${s.bsin}`.toLowerCase().includes(needle));
  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const sellerName = (id: string) => sellers.find((s) => s.id === id)?.displayName ?? id;
  const breached = moderationQueue.filter((m) => new Date(m.slaDueAt).getTime() < NOW.getTime()).length;

  return (
    <>
      <PageHeader title="Catalog moderation" description="Listing QC for new products, gated brands and edits to live listings. Auto checks run first; you decide with reason codes (spec 9.3.3 and 11.9)." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Pending review", value: CATALOG_QUEUE_TOTAL, hint: `${moderationQueue.length} shown, oldest first` },
          { label: "High risk", value: moderationQueue.filter((m) => m.risk === "high").length, hint: "counterfeit, duplicate or MRP flags", href: "/admin/catalog?risk=high" },
          { label: "Oldest submission", value: `${opsSnapshot.oldestQcHours} h`, hint: `${breached} past the 48 h target` },
          { label: "Approved today", value: formatNumber(1846), hint: "62% auto approved" },
          { label: "Suppressed listings", value: suppressedListings.length, hint: "hidden until fixed", href: "/admin/catalog?tab=suppressed" },
        ]}
      />

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "queue", label: "Review queue", count: CATALOG_QUEUE_TOTAL, href: hrefWith("/admin/catalog", { ...current, tab: undefined }) },
          { key: "suppressed", label: "Suppressed and blocked", count: suppressedListings.length, href: hrefWith("/admin/catalog", { q: current.q, tab: "suppressed" }) },
        ]}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/catalog"
            q={q}
            placeholder="Title, BSIN, brand or seller"
            keep={{ tab: current.tab }}
            selects={
              tab === "queue"
                ? [
                    { name: "category", label: "Category", value: category, options: [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
                    { name: "type", label: "Submission type", value: type, options: [{ value: "all", label: "All types" }, ...Object.entries(MODERATION_TYPE).map(([k, v]) => ({ value: k, label: v }))] },
                    { name: "risk", label: "Risk", value: risk, className: "sm:w-36", options: [{ value: "all", label: "Any risk" }, ...Object.entries(RISK_LEVEL).map(([k, v]) => ({ value: k, label: v.label }))] },
                  ]
                : []
            }
          />
        </div>

        {tab === "queue" ? (
          <ModerationQueue items={queue} categoryNames={categoryNames} initialOpenId={sp(params, "review")} />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Listing</TH>
                  <TH className="hidden md:table-cell">Seller</TH>
                  <TH>Reason</TH>
                  <TH className="hidden lg:table-cell">Since</TH>
                  <TH align="right" className="hidden lg:table-cell">
                    Views lost, 7 days
                  </TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {suppressed.map((s) => (
                  <TR key={s.bsin}>
                    <TD>
                      <div className="flex max-w-[300px] items-center gap-3">
                        <ProductImage src={s.image} alt="" size={40} rounded="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink-900">{s.title}</span>
                          <Mono className="text-xs text-ink-500">{s.bsin}</Mono>
                        </span>
                      </div>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">{sellerName(s.sellerId)}</TD>
                    <TD className="max-w-[300px] whitespace-normal">
                      <p className="text-[13px] text-ink-800">{s.reason}</p>
                      <p className="text-xs text-ink-500">{s.trigger}</p>
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{ageLabel(s.since)} ago</TD>
                    <TD align="right" className="hidden lg:table-cell">
                      {formatNumber(s.views7d)}
                    </TD>
                    <TD>
                      <StatusBadge meta={s.status === "blocked" ? { label: "Blocked", tone: "danger" } : { label: "Suppressed", tone: "warning" }} size="sm" />
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1.5">
                        <ToastButton label="Notify seller" icon="mail" size="xs" variant="ghost" toast="Seller notified with fix guidance" doneLabel="Notified" />
                        {s.status === "suppressed" ? (
                          <ActionButton label="Unsuppress" icon="unlock" size="xs" title="Unsuppress listing" description="Only when the issue is fixed; the listing returns to Approved and goes live if stock allows." reasons={["Issue fixed by seller", "False positive from automated check"]} note="optional" toast="Listing unsuppressed" doneLabel="Live" />
                        ) : (
                          <ActionButton label="Review appeal" icon="file" size="xs" title="Blocked listing" description="Blocked listings return to Pending review only when an appeal is accepted." reasons={["Appeal accepted", "Appeal rejected, archive listing"]} note="required" toast="Decision recorded" />
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
