import Link from "next/link";
import { Star } from "lucide-react";
import { DeleteReviewButton } from "@/components/account/review-actions";
import { Panel } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { ReviewButton } from "@/components/store/review-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reviews" };

const STATUS = {
  PUBLISHED: { label: "Live on the product page", tone: "success" as const },
  PENDING: { label: "Being checked", tone: "info" as const },
  HIDDEN: { label: "Not shown", tone: "neutral" as const },
};

export default async function ReviewsPage(props: PageProps<"/account/reviews">) {
  const sp = await props.searchParams;
  const write = typeof sp.write === "string" ? sp.write : "";
  const client = await api();
  const [toReview, mine] = await Promise.all([client.GET("/v1/me/reviewable").then((r) => r.data ?? []), client.GET("/v1/me/reviews").then((r) => r.data ?? [])]);

  return (
    <>
      <PageHeader title="Reviews" description="Tell other shoppers about the products you received. Every review here is a verified purchase." />

      <Panel title="Waiting for your review" description={toReview.length ? "Products delivered to you that you have not reviewed yet" : undefined} className="mb-6">
        {toReview.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing to review right now. Products show up here once they are delivered.</p>
        ) : (
          <ul className="divide-y divide-line">
            {toReview.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <Link href={`/p/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ProductImage src={p.image} alt="" size={48} rounded="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-ink-900">{p.title}</span>
                    <span className="block text-xs text-ink-500">Delivered {formatDate(p.deliveredAt)}</span>
                  </span>
                </Link>
                <ReviewButton productId={p.id} slug={p.slug} productTitle={p.title} autoOpen={write === p.id || write === p.slug} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Your reviews">
        {mine.length === 0 ? (
          <EmptyState icon={Star} title="No reviews yet" description="Reviews you write appear here, so you can edit or delete them." />
        ) : (
          <ul className="divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
                <ProductImage src={r.product.image} alt="" size={48} rounded="md" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${r.product.slug}#reviews`} className="text-[13px] text-ink-500 hover:text-brand-700">
                    {r.product.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={14} />
                    <p className="text-[14px] font-semibold text-ink-900">{r.title}</p>
                  </div>
                  {r.body && <p className="mt-1 line-clamp-3 text-[13px] text-ink-700">{r.body}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <Badge size="sm" tone={STATUS[r.status].tone} dot>
                      {STATUS[r.status].label}
                    </Badge>
                    {formatDate(r.createdAt)}
                  </p>
                  {r.reply && <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">AltasGoods replied: {r.reply}</p>}
                </div>
                <div className="flex gap-1">
                  <ReviewButton productId={r.product.id} slug={r.product.slug} productTitle={r.product.title} existing={r} label="Edit" variant="ghost" />
                  <DeleteReviewButton id={r.id} slug={r.product.slug} productTitle={r.product.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
