import Link from "next/link";
import { CircleAlert, MessageSquareText, Star, ThumbsUp } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { dateLabel, dayLabel, deliveredAt } from "@/components/account/lib";
import { AskQuestion, WriteReview } from "@/components/account/review-forms";
import { Notice, Panel } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { getProduct } from "@/lib/mock";
import { accountOrders, myQuestions, myReviews, productBySlug } from "@/lib/mock/account-extra";
import type { StatusMeta } from "@/lib/status";

export const metadata = { title: "Reviews and Q&A" };

const REVIEW_STATUS: Record<"published" | "pending" | "rejected", StatusMeta> = {
  published: { label: "Published", tone: "success" },
  pending: { label: "In moderation", tone: "info" },
  rejected: { label: "Not published", tone: "danger" },
};

export default async function ReviewsPage(props: PageProps<"/account/reviews">) {
  const sp = await props.searchParams;
  const write = typeof sp.write === "string" ? sp.write : undefined;
  const tab = sp.tab === "reviews" || sp.tab === "questions" ? sp.tab : "pending";

  const reviewed = new Set(myReviews.map((r) => r.slug));
  const seen = new Set<string>();
  const pending = accountOrders
    .filter((o) => o.status === "delivered")
    .flatMap((o) => o.items.map((it) => ({ order: o, item: it, product: getProduct(it.productId) })))
    .filter(({ product }) => {
      if (!product || reviewed.has(product.slug) || seen.has(product.slug)) return false;
      seen.add(product.slug);
      return true;
    });
  const writeTarget = write && !pending.some((p) => p.product!.slug === write) ? productBySlug(write) : undefined;
  const questionProducts = [...new Set(accountOrders.flatMap((o) => o.items.map((i) => i.productId)))].slice(0, 4).flatMap((id) => {
    const p = getProduct(id);
    return p ? [{ slug: p.slug, title: p.title, image: p.image }] : [];
  });

  return (
    <>
      <PageHeader title="Reviews and Q&A" description="Rate what you bought, keep track of your reviews and see answers to your questions." />

      <TabLinks
        className="mb-6"
        active={tab}
        items={[
          { key: "pending", label: "To review", href: "/account/reviews", count: pending.length },
          { key: "reviews", label: "Your reviews", href: "/account/reviews?tab=reviews", count: myReviews.length },
          { key: "questions", label: "Questions", href: "/account/reviews?tab=questions", count: myQuestions.length },
        ]}
      />

      {tab === "pending" && (
        <>
          {writeTarget && (
            <Panel className="mb-5">
              <div className="flex items-center gap-4">
                <ProductImage src={writeTarget.image} alt="" size={56} rounded="md" />
                <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink-900">{writeTarget.title}</p>
                <WriteReview product={{ slug: writeTarget.slug, title: writeTarget.title, image: writeTarget.image }} autoOpen />
              </div>
            </Panel>
          )}
          {pending.length === 0 ? (
            <Panel>
              <EmptyState icon={Star} title="You are all caught up" description="Items you receive will show up here so you can rate them." />
            </Panel>
          ) : (
            <Panel title="How was it?" description="Tap a star to rate. Reviews help other shoppers and help us choose what to stock." bodyClassName="px-0 pb-1 sm:px-0">
              <ul className="divide-y divide-line">
                {pending.map(({ order, item, product }) => (
                  <li key={product!.slug} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <ProductImage src={item.image} alt="" size={60} rounded="lg" />
                      <div className="min-w-0">
                        <Link href={`/p/${product!.slug}`} className="line-clamp-2 text-[13.5px] font-medium text-ink-900 hover:text-brand-700">
                          {item.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">Delivered on {dayLabel(deliveredAt(order)!)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:shrink-0">
                      <WriteReview product={{ slug: product!.slug, title: item.title, image: item.image }} inline autoOpen={write === product!.slug} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {tab === "reviews" && (
        <div className="flex flex-col gap-4">
          {myReviews.map((r) => {
            const p = productBySlug(r.slug);
            if (!p) return null;
            return (
              <article key={r.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <ProductImage src={p.image} alt="" size={64} rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/p/${p.slug}`} className="line-clamp-1 text-[13px] text-ink-600 hover:text-brand-700">
                        {p.title}
                      </Link>
                      <StatusBadge meta={REVIEW_STATUS[r.status]} size="sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Stars value={r.rating} size={15} />
                      <p className="text-[14px] font-semibold text-ink-900">{r.title}</p>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-700">{r.body}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span>Reviewed on {dateLabel(r.createdAt)}</span>
                      <Badge size="sm" tone="neutral">
                        Verified purchase
                      </Badge>
                      {r.helpful > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp size={12} aria-hidden="true" />
                          {r.helpful} people found this helpful
                        </span>
                      )}
                    </p>
                    {r.status === "rejected" && "rejectionReason" in r && (
                      <Notice tone="danger" icon={CircleAlert} className="mt-3">
                        {r.rejectionReason}
                      </Notice>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1">
                      <WriteReview product={{ slug: p.slug, title: p.title, image: p.image }} edit={{ rating: r.rating, title: r.title, body: r.body }} />
                      <ActionButton
                        label="Delete"
                        icon="trash"
                        variant="ghost"
                        toast="Review deleted"
                        doneLabel="Deleted"
                        confirm={{ title: "Delete this review?", body: "It will be removed from the product page. You can write a new one later.", confirmLabel: "Delete review", danger: true }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "questions" && (
        <Panel title="Your questions" description="Answers come from AltasGoods, brands and buyers who own the product." action={<AskQuestion products={questionProducts} />}>
          <ul className="flex flex-col divide-y divide-line">
            {myQuestions.map((q) => {
              const p = productBySlug(q.slug);
              return (
                <li key={q.id} className="py-5 first:pt-1 last:pb-0">
                  <div className="flex items-start gap-3.5">
                    {p && <ProductImage src={p.image} alt="" size={44} rounded="md" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-ink-500">{p?.title}</p>
                      <p className="mt-1 text-[14px] font-semibold text-ink-900">Q. {q.question}</p>
                      <p className="mt-0.5 text-xs text-ink-500">Asked on {dateLabel(q.askedAt)}</p>
                      {q.answers.length ? (
                        <ul className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-4">
                          {q.answers.map((a, i) => (
                            <li key={i}>
                              <p className="text-[13.5px] text-ink-800">{a.body}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                                {a.by}
                                <Badge size="sm" tone={a.role === "AltasGoods" ? "brand" : "success"}>
                                  {a.role}
                                </Badge>
                                <span>{dateLabel(a.at)}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                          <MessageSquareText size={13} aria-hidden="true" />
                          Waiting for an answer. We have asked our team and recent buyers.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
