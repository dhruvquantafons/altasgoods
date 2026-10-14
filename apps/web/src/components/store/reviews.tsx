"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquareReply, PenLine, ShieldCheck, Star } from "lucide-react";
import { Stars } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";
import { ReviewButton } from "./review-form";

export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  sortKey: number;
  reply: string | null;
}

const SORTS = [
  { key: "recent", label: "Most recent" },
  { key: "high", label: "Highest rating" },
  { key: "low", label: "Lowest rating" },
] as const;

/**
 * Ratings and reviews on a product page. The summary is the product's overall
 * rating; the breakdown and the list are the published written reviews.
 */
export function ReviewsSection({
  rating,
  ratingCount,
  breakdown,
  reviews,
  writtenCount,
  product,
  canReview,
  signedIn,
}: {
  rating: number;
  ratingCount: number;
  breakdown: { stars: number; count: number }[];
  reviews: ReviewItem[];
  writtenCount: number;
  product: { id: string; slug: string; title: string };
  canReview: boolean;
  signedIn: boolean;
}) {
  const [star, setStar] = useState<number | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("recent");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const written = breakdown.reduce((a, b) => a + b.count, 0);

  const list = reviews
    .filter((r) => star === null || r.rating === star)
    .sort((a, b) => (sort === "high" ? b.rating - a.rating || b.sortKey - a.sortKey : sort === "low" ? a.rating - b.rating || b.sortKey - a.sortKey : b.sortKey - a.sortKey));

  return (
    <div className="grid gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
      <div>
        <div className="flex items-end gap-3">
          <p className="font-display text-5xl leading-none font-semibold tracking-tight text-ink-900">{ratingCount ? rating.toFixed(1) : "–"}</p>
          <div className="pb-1">
            <Stars value={rating} size={18} />
            <p className="mt-1 text-[13px] text-ink-500">
              {ratingCount ? `${formatNumber(ratingCount)} rating${ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
              {writtenCount ? `, ${formatNumber(writtenCount)} written review${writtenCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>

        {written > 0 && (
          <div className="mt-6" role="radiogroup" aria-label="Filter reviews by star rating">
            {breakdown.map((h) => {
              const on = star === h.stars;
              const pct = written ? Math.round((h.count / written) * 100) : 0;
              return (
                <button
                  key={h.stars}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!h.count}
                  onClick={() => setStar(on ? null : h.stars)}
                  className={cn("group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-60", on ? "bg-brand-50" : "hover:bg-ink-50")}
                >
                  <span className={cn("flex w-9 shrink-0 items-center gap-1 text-[13px] font-medium", on ? "text-brand-700" : "text-ink-700")}>
                    {h.stars}
                    <Star size={12} className="fill-current" aria-hidden="true" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className={cn("block h-full rounded-full", on ? "bg-brand-600" : "bg-ink-700")} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-ink-500 tabular-nums">{formatNumber(h.count)}</span>
                  <span className="sr-only">
                    {h.count} written review{h.count === 1 ? "" : "s"} with {h.stars} stars. {on ? "Selected." : "Select to filter reviews."}
                  </span>
                </button>
              );
            })}
            {star !== null && (
              <button type="button" onClick={() => setStar(null)} className="mt-2 px-2 text-[13px] font-semibold text-brand-700 hover:underline">
                Clear star filter
              </button>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <PenLine size={16} className="text-ink-500" aria-hidden="true" /> {canReview ? "How was it?" : "Bought this product?"}
          </p>
          <p className="mt-1 text-[13px] text-ink-500">Only customers who received it from AltasGoods can review it, so every review is a verified purchase.</p>
          <div className="mt-3">
            {canReview ? (
              <ReviewButton productId={product.id} slug={product.slug} productTitle={product.title} />
            ) : signedIn ? (
              <Link href="/account/reviews" className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
                Your reviews
              </Link>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/p/${product.slug}#reviews`)}`} className="inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
                Sign in to review
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-ink-600">
            {star === null ? "Reviews" : `${star} star reviews`} <span className="text-ink-400">({list.length})</span>
          </p>
          {reviews.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort reviews">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={sort === s.key}
                  onClick={() => setSort(s.key)}
                  className={cn("h-8 rounded-full px-3 text-[13px] font-medium transition-colors", sort === s.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500">
            {reviews.length === 0 ? "No written reviews yet. Customers who receive this product can be the first to review it." : `No written reviews with ${star} stars yet.`}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => {
              const long = r.body.length > 220;
              const open = expanded[r.id];
              return (
                <li key={r.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={15} />
                    <p className="text-[15px] font-semibold text-ink-900">{r.title}</p>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                    <span className="font-medium text-ink-700">{r.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>{r.date}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-success-700">
                      <ShieldCheck size={13} aria-hidden="true" /> Verified purchase
                    </span>
                  </p>
                  {r.body && <p className={cn("mt-2.5 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-ink-700", long && !open && "line-clamp-6")}>{r.body}</p>}
                  {long && (
                    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [r.id]: !open }))} className="mt-1 text-[13px] font-semibold text-brand-700">
                      {open ? "Show less" : "Read more"}
                    </button>
                  )}
                  {r.reply && (
                    <div className="mt-3 max-w-2xl rounded-xl bg-ink-50 px-4 py-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <MessageSquareReply size={14} className="text-ink-500" aria-hidden="true" /> Response from AltasGoods
                      </p>
                      <p className="mt-1 leading-relaxed whitespace-pre-line text-ink-700">{r.reply}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
