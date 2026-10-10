import { BadgeCheck, Flag, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { REVIEW_MOD_STATUS } from "@/components/admin/admin-status";
import { hrefWith, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { getProduct, reviews } from "@/lib/mock";
import { reviewClusters, reviewFlags } from "@/lib/mock/admin-extra";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reviews" };

const REMOVE_REASONS = ["Personal information or contact details", "External link or promotion", "Incentivised review", "Written by the seller or related party", "Profanity or abuse", "About delivery or the seller, not the product", "Part of a review ring"];

const TABS: { key: string; label: string; match: (r: Review) => boolean }[] = [
  { key: "flagged", label: "Flagged", match: (r) => r.status === "flagged" },
  { key: "pending", label: "Pending", match: (r) => r.status === "pending" },
  { key: "reported", label: "Reported after publishing", match: (r) => r.status === "published" && reviewFlags.some((f) => f.reviewId === r.id) },
];

export default async function ReviewsPage(props: PageProps<"/admin/reviews">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp(params, "tab"))?.key ?? "flagged";
  const rows = reviews.filter(TABS.find((t) => t.key === tab)!.match);

  return (
    <>
      <PageHeader title="Reviews" description="Review and Q&A moderation. Only customers with a delivered item can review; incentivised, seller-written and PII-bearing reviews are removed (spec 10.12). Target: 48 hours." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Flagged", value: reviews.filter((r) => r.status === "flagged").length, hint: "by filters or reports" },
          { label: "Pending moderation", value: reviews.filter((r) => r.status === "pending").length, hint: "new and edited reviews" },
          { label: "Median time to decision", value: "9 h", hint: "target 48 h" },
          { label: "Removed, 7 days", value: "312", hint: "2.1% of submissions" },
          { label: "Review rings held", value: reviewClusters.filter((c) => c.status !== "Removed, seller warned").length, hint: "linked reviewer clusters" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <TabLinks className="mb-4" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, count: reviews.filter(t.match).length, href: hrefWith("/admin/reviews", {}, { tab: t.key === "flagged" ? undefined : t.key }) }))} />
          {rows.length === 0 ? (
            <Card>
              <EmptyState icon={BadgeCheck} title="Nothing to moderate" description="New reviews appear here when filters or customers flag them." />
            </Card>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((r) => {
                const p = getProduct(r.productId);
                const info = reviewFlags.find((f) => f.reviewId === r.id);
                return (
                  <li key={r.id}>
                    <Card className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {p && <ProductImage src={p.image} alt="" size={40} rounded="md" />}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink-900">{p?.title}</p>
                            <p className="text-xs text-ink-500">
                              <span className="font-mono">{r.id}</span>, {info?.source ?? "Automated filter"}
                              {info?.reports ? `, ${info.reports} reports` : ""}
                            </p>
                          </div>
                        </div>
                        <StatusBadge meta={REVIEW_MOD_STATUS[r.status]} size="sm" />
                      </div>

                      <div className="mt-4 rounded-xl bg-ink-50/70 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars value={r.rating} size={13} />
                          <p className="text-[13px] font-semibold text-ink-900">{r.title}</p>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{r.body}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                          <span>{r.author}</span>
                          <span>{formatDate(r.createdAt)}</span>
                          {r.verified ? (
                            <span className="inline-flex items-center gap-1 text-success-700">
                              <BadgeCheck size={13} aria-hidden="true" />
                              Verified purchase
                            </span>
                          ) : (
                            <span>Not a verified purchase</span>
                          )}
                        </p>
                      </div>

                      {(info?.flags.length ?? 0) > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {info!.flags.map((f) => (
                            <Badge key={f} tone="danger" size="sm" icon={Flag}>
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {info && <p className="mt-2 text-xs text-ink-500">Signals: {info.signals.join(", ")}</p>}

                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                        <ActionButton
                          label="Remove"
                          icon="trash"
                          size="sm"
                          variant="ghost"
                          danger
                          title="Remove review"
                          description="The reviewer is told which guideline was broken and can edit and resubmit."
                          reasons={REMOVE_REASONS}
                          note="optional"
                          toast="Review removed"
                          doneLabel="Removed"
                        />
                        {r.status !== "published" ? (
                          <ActionButton label="Publish" icon="check" size="sm" title="Publish review" description="Publishing makes the review visible and counts it in the product rating." note="none" toast="Review published" doneLabel="Published" />
                        ) : (
                          <ActionButton label="Keep" icon="check" size="sm" title="Keep review" description="Dismisses the reports; the review stays published." reasons={["Report not valid", "Opinion about the product, allowed"]} note="optional" toast="Reports dismissed" doneLabel="Kept" />
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Review rings" description="Clusters detected by rule RR-09" action={<ShieldAlert size={17} className="text-ink-400" aria-hidden="true" />} />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {reviewClusters.map((c) => (
                <li key={c.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-ink-900">{c.product}</p>
                    <span className="shrink-0 font-mono text-xs text-ink-500">{c.id}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-600">{c.signal}</p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    {c.reviews} reviews from {c.accounts} accounts, <span className="font-medium text-ink-700">{c.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Moderation rules" description="Applied by filters before a person reviews" />
            <ul className="flex flex-col gap-2.5 px-5 pt-3 pb-5 text-[13px] text-ink-700">
              {[
                "One review per customer per parent product",
                "Verified purchase when the price paid was at least 50% of the item price",
                "No PII, external links or profanity",
                "No reviews by AltasGoods staff or their relatives",
                "Delivery feedback is kept separate from product reviews",
                "Edits to published reviews are moderated again",
              ].map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
