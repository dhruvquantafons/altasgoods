import Link from "next/link";
import { BadgeCheck, Info } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { AnswerQuestion, FeedbackResponse, ReportReview } from "@/components/seller/feedback/feedback-client";
import { AutoSubmitSelect } from "@/components/seller/client-kit";
import { Callout, MiniStat, StatStrip } from "@/components/seller/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { getListing, listingReviews, SELLER, sellerFeedback, customerQuestions } from "@/lib/mock/seller-extra";
import { cn, formatDate, formatNumber, timeAgo } from "@/lib/utils";

export const metadata = { title: "Reviews and questions" };

const TABS = [
  { key: "reviews", label: "Product reviews" },
  { key: "feedback", label: "Seller feedback" },
  { key: "questions", label: "Customer questions" },
] as const;

function Breakdown({ ratings, average, label }: { ratings: number[]; average: number; label: string }) {
  const counts = [5, 4, 3, 2, 1].map((s) => ratings.filter((r) => r === s).length);
  const max = Math.max(1, ...counts);
  return (
    <Card>
      <div className="p-5">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-[36px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{average.toFixed(1)}</p>
          <p className="pb-1 text-sm text-ink-500">of 5</p>
        </div>
        <Stars value={average} size={16} className="mt-2" />
        <ul className="mt-5 flex flex-col gap-2">
          {[5, 4, 3, 2, 1].map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[13px]">
              <span className="w-10 text-ink-600 tabular-nums">{s} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                <span className={cn("block h-full rounded-full", s >= 4 ? "bg-success-500" : s === 3 ? "bg-accent-400" : "bg-danger-500")} style={{ width: `${(counts[i]! / max) * 100}%` }} />
              </span>
              <span className="w-8 text-right text-ink-700 tabular-nums">{counts[i]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink-500">Based on {formatNumber(ratings.length)} recent ratings shown here.</p>
      </div>
    </Card>
  );
}

export default async function FeedbackPage(props: PageProps<"/seller/feedback">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = TABS.find((t) => t.key === one(sp.tab))?.key ?? "reviews";
  const stars = Number(one(sp.stars)) || 0;

  const reviews = listingReviews.filter((r) => r.status !== "removed" && (!stars || r.rating === stars));
  const unanswered = customerQuestions.filter((q) => !q.answer);
  const negative = sellerFeedback.filter((f) => f.rating <= 2 && !f.struck);
  const avgReview = listingReviews.reduce((a, r) => a + r.rating, 0) / listingReviews.length;
  const avgFeedback = sellerFeedback.reduce((a, f) => a + f.rating, 0) / sellerFeedback.length;

  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: `?tab=${t.key}`,
    count: t.key === "reviews" ? listingReviews.length : t.key === "feedback" ? sellerFeedback.length : unanswered.length,
  }));

  return (
    <>
      <PageHeader title="Reviews and questions" description="What customers say about your products and about you as a seller, plus questions waiting for an answer." />

      <StatStrip className="mb-6">
        <MiniStat label="Product rating" value={`${avgReview.toFixed(1)} of 5`} hint={`${formatNumber(listingReviews.length)} reviews on your listings`} />
        <MiniStat label="Seller rating" value={`${SELLER.rating.toFixed(1)} of 5`} hint={`${formatNumber(SELLER.ratingCount)} ratings, last 12 months`} />
        <MiniStat label="Negative feedback, 60 days" value={negative.length} hint="1 or 2 stars, counts toward ODR" tone={negative.length ? "warning" : undefined} />
        <MiniStat label="Questions to answer" value={unanswered.length} hint="Answer within 24 hours" tone={unanswered.length ? "warning" : undefined} />
      </StatStrip>

      <TabLinks items={tabs} active={tab} className="mb-6" />

      {tab === "reviews" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6">
            <Breakdown ratings={listingReviews.map((r) => r.rating)} average={avgReview} label="Average product rating" />
            <Callout tone="neutral" icon={Info} title="Review rules">
              You may send one neutral review request per order, 5 to 30 days after delivery. Never ask for positive reviews, offer anything in return, or contact customers to change a review.
            </Callout>
          </div>
          <Card className="overflow-hidden xl:col-span-2">
            <form method="get" className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <input type="hidden" name="tab" value="reviews" />
              <p className="text-[13px] text-ink-600">
                {formatNumber(reviews.length)} {reviews.length === 1 ? "review" : "reviews"}
              </p>
              <AutoSubmitSelect name="stars" defaultValue={stars ? String(stars) : ""} selectSize="sm" className="w-40" aria-label="Filter by rating">
                <option value="">All ratings</option>
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>
                    {s} star
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            <ul className="divide-y divide-line">
              {reviews.slice(0, 14).map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <ProductImage src={r.image} alt="" size={40} rounded="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Stars value={r.rating} size={13} />
                        <p className="text-[13px] font-semibold text-ink-900">{r.title}</p>
                        {r.status === "pending" && <Badge size="sm" tone="info">In moderation</Badge>}
                        {r.status === "flagged" && <Badge size="sm" tone="warning">Reported</Badge>}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{r.body}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                        <span>{r.author}</span>
                        {r.verified && (
                          <span className="inline-flex items-center gap-1 text-success-700">
                            <BadgeCheck size={12} aria-hidden="true" /> Verified purchase
                          </span>
                        )}
                        <span>{formatDate(r.createdAt)}</span>
                        <span>{r.helpful} found it helpful</span>
                        <Link href={`/seller/catalog/${r.productId}`} className="max-w-[16rem] truncate hover:text-brand-700">
                          {r.productTitle}
                        </Link>
                      </p>
                    </div>
                    {r.rating <= 2 && <ReportReview id={r.id} />}
                  </div>
                </li>
              ))}
            </ul>
            {reviews.length > 14 && <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Showing the latest 14 of {reviews.length}.</p>}
          </Card>
        </div>
      )}

      {tab === "feedback" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6">
            <Breakdown ratings={sellerFeedback.map((f) => f.rating)} average={avgFeedback} label="Seller feedback, last 30 days" />
            <Callout tone="neutral" icon={Info} title="How feedback affects ODR">
              1 and 2 star feedback counts toward your order defect rate for 60 days. Feedback about delivery on BluBuy Fulfilled orders is struck through and excluded, because BluBuy handled it.
            </Callout>
          </div>
          <Card className="xl:col-span-2">
            <CardHeader title="Recent feedback" description="Customers can leave feedback for 90 days after delivery and remove it within 60 days of posting" />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {sellerFeedback.map((f) => (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={f.rating} size={13} />
                    <span className="text-xs text-ink-500">
                      {/* sample feedback: order ids are not real orders, so they are shown, not linked */}
                      {f.buyer}, {timeAgo(f.at)}, order <span className="font-mono">{f.orderId}</span>
                    </span>
                    {f.rating <= 2 && !f.struck && <Badge size="sm" tone="warning">Counts toward ODR</Badge>}
                    {f.struck && <Badge size="sm" tone="neutral">Excluded, delivery by BluBuy</Badge>}
                  </div>
                  <p className={cn("mt-1.5 text-[13px] leading-relaxed text-ink-700", f.struck && "text-ink-500 line-through")}>{f.comment}</p>
                  {f.response ? (
                    <div className="mt-3 rounded-lg border-l-2 border-brand-300 bg-brand-50/40 px-3 py-2 text-[13px] text-ink-700">
                      <span className="block text-xs font-medium text-brand-700">Your public response</span>
                      {f.response}
                    </div>
                  ) : (
                    f.rating <= 3 && !f.struck && <FeedbackResponse id={f.id} canRemove={f.rating <= 2} />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "questions" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Waiting for an answer" description="Questions from shoppers on your product pages. Good answers lift conversion." />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {unanswered.map((q) => {
                const l = getListing(q.productId)!;
                return (
                  <li key={q.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <ProductImage src={l.image} alt="" size={40} rounded="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">{q.question}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {q.askedBy}, {timeAgo(q.askedAt)}, {q.votes} {q.votes === 1 ? "person has" : "people have"} the same question, on {l.title.split(/[,(]/)[0]!.trim()}
                        </p>
                        <AnswerQuestion id={q.id} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Answered" description="Published on product pages" />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {customerQuestions
                .filter((q) => q.answer)
                .map((q) => (
                  <li key={q.id} className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-ink-900">{q.question}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{q.answer}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {q.votes} helpful votes, answered {formatDate(q.answeredAt!)}
                    </p>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
