import Link from "next/link";
import { Star } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { loadAdminReviews } from "@/lib/api/admin-system";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Reviews" };

const PAGE_SIZE = 25;
const TABS = [
  { key: "PENDING", label: "Waiting for approval" },
  { key: "PUBLISHED", label: "Published" },
  { key: "HIDDEN", label: "Hidden" },
  { key: "all", label: "All" },
] as const;
const TONE = { PENDING: "info", PUBLISHED: "success", HIDDEN: "neutral" } as const;

export default async function ReviewsPage(props: PageProps<"/admin/reviews">) {
  const params = await props.searchParams;
  const q = sp(params, "q")?.trim() ?? "";
  const rating = sp(params, "rating") ?? "all";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);
  const first = await loadAdminReviews({ pageSize: 1 });
  // open on the approval queue when there is one
  const tab = TABS.find((t) => t.key === sp(params, "status"))?.key ?? (first.counts.PENDING ? "PENDING" : "all");
  const data = await loadAdminReviews({ status: tab === "all" ? undefined : tab, rating: rating === "all" ? undefined : Number(rating), q: q || undefined, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const current = { status: tab, q: q || undefined, rating: rating === "all" ? undefined : rating };
  const all = data.counts.PENDING + data.counts.PUBLISHED + data.counts.HIDDEN;

  return (
    <>
      <PageHeader title="Reviews" description="Customer reviews, all from delivered orders. Whether new reviews go live straight away or wait here is set in Settings." />

      <TabLinks
        className="mb-5"
        active={tab}
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: t.key === "all" ? all : data.counts[t.key], href: `/admin/reviews?status=${t.key}` }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/reviews"
            q={q}
            placeholder="Product, title or customer email"
            keep={{ status: tab }}
            selects={[{ name: "rating", label: "Stars", value: rating, className: "sm:w-36", options: [{ value: "all", label: "Any rating" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` }))] }]}
          />
        </div>
        {data.items.length === 0 ? (
          <EmptyState icon={Star} title={tab === "PENDING" ? "Nothing waiting for approval" : "No reviews here"} description="Customers can review a product once it has been delivered to them." />
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((r) => (
              <li key={r.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row">
                <Link href={`/p/${r.product.slug}#reviews`} className="flex w-full shrink-0 items-start gap-3 lg:w-64">
                  <ProductImage src={r.product.image} alt="" size={44} rounded="md" />
                  <span className="line-clamp-2 text-[13px] font-medium text-ink-800 hover:text-brand-700">{r.product.title}</span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={14} />
                    <p className="text-[14px] font-semibold text-ink-900">{r.title}</p>
                    <Badge size="sm" tone={TONE[r.status]} dot>
                      {r.status === "PENDING" ? "Waiting" : r.status === "PUBLISHED" ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  {r.body && <p className="mt-1 text-[13px] whitespace-pre-line text-ink-700">{r.body}</p>}
                  <p className="mt-1.5 text-xs text-ink-500">
                    <Link href={`/admin/customers/${r.customer.id}`} className="hover:text-brand-700">
                      {r.customer.name ?? r.customer.email}
                    </Link>
                    , {formatDateTime(r.createdAt)}
                    {r.updatedAt !== r.createdAt && ", edited"}
                  </p>
                  {r.reply && <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">Your reply: {r.reply}</p>}
                  {r.adminNote && <p className="mt-1 text-xs text-ink-500">Team note: {r.adminNote}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-1 lg:justify-end">
                  <ReviewModeration id={r.id} slug={r.product.slug} status={r.status} reply={r.reply} adminNote={r.adminNote} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager path="/admin/reviews" params={current} label="reviews" page={page} pages={pages} from={from} to={Math.min(page * PAGE_SIZE, data.total)} total={data.total} />
      </Card>
    </>
  );
}
