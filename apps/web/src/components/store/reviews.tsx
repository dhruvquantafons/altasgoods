"use client";

import Link from "next/link";
import { useState } from "react";
import { Flag, MessageSquareReply, PenLine, ShieldCheck, Star, ThumbsUp } from "lucide-react";
import { Stars } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  sortKey: number;
  verified: boolean;
  helpful: number;
  variant?: string;
  response?: string;
}

const SORTS = [
  { key: "helpful", label: "Most helpful" },
  { key: "recent", label: "Most recent" },
  { key: "high", label: "Highest rating" },
  { key: "low", label: "Lowest rating" },
] as const;

export function ReviewsSection({
  rating,
  ratingCount,
  reviewCount,
  histogram,
  aspects,
  reviews,
  sellerName,
}: {
  rating: number;
  ratingCount: number;
  reviewCount: number;
  histogram: { stars: number; count: number; pct: number }[];
  aspects: { label: string; value: number }[];
  reviews: ReviewItem[];
  sellerName: string;
}) {
  const [star, setStar] = useState<number | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("helpful");
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const list = reviews
    .filter((r) => star === null || r.rating === star)
    .sort((a, b) =>
      sort === "recent" ? b.sortKey - a.sortKey : sort === "high" ? b.rating - a.rating : sort === "low" ? a.rating - b.rating : b.helpful - a.helpful,
    );

  return (
    <div className="grid gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
      <div>
        <div className="flex items-end gap-3">
          <p className="font-display text-5xl leading-none font-semibold tracking-tight text-ink-900">{rating.toFixed(1)}</p>
          <div className="pb-1">
            <Stars value={rating} size={18} />
            <p className="mt-1 text-[13px] text-ink-500">
              {formatNumber(ratingCount)} ratings and {formatNumber(reviewCount)} reviews
            </p>
          </div>
        </div>

        {ratingCount > 5 && (
          <div className="mt-6" role="radiogroup" aria-label="Filter reviews by star rating">
            {histogram.map((h) => {
              const on = star === h.stars;
              return (
                <button
                  key={h.stars}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStar(on ? null : h.stars)}
                  className={cn("group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors", on ? "bg-brand-50" : "hover:bg-ink-50")}
                >
                  <span className={cn("flex w-9 shrink-0 items-center gap-1 text-[13px] font-medium", on ? "text-brand-700" : "text-ink-700")}>
                    {h.stars}
                    <Star size={12} className="fill-current" aria-hidden="true" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span className={cn("block h-full rounded-full", on ? "bg-brand-600" : "bg-ink-700")} style={{ width: `${h.pct}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-ink-500 tabular-nums">{formatNumber(h.count)}</span>
                  <span className="sr-only">
                    {h.pct}% of ratings are {h.stars} stars. {on ? "Selected." : "Select to filter reviews."}
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

        <div className="mt-7 border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900">What buyers say about</p>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {aspects.map((a) => (
              <li key={a.label} className="rounded-xl bg-ink-50 px-3.5 py-3">
                <p className="text-xs text-ink-500">{a.label}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-ink-900 tabular-nums">
                  {a.value.toFixed(1)} <Star size={13} className="fill-accent-400 text-accent-400" aria-hidden="true" />
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <PenLine size={16} className="text-ink-500" aria-hidden="true" /> Bought this product?
          </p>
          <p className="mt-1 text-[13px] text-ink-500">Only customers who bought it on AltasGoods can review it. Reviews are checked before they appear.</p>
          <Link href="/account/orders" className="mt-3 inline-flex h-9 items-center rounded-lg border border-line-strong px-3.5 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
            Write a review
          </Link>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-ink-600">
            {star === null ? "Top reviews" : `${star} star reviews`} <span className="text-ink-400">({list.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort reviews">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "h-8 rounded-full px-3 text-[13px] font-medium transition-colors",
                  sort === s.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500">No written reviews with {star} stars yet. Ratings without text still count in the summary.</p>
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
                    {r.variant && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{r.variant}</span>
                      </>
                    )}
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 font-medium text-success-700">
                        <ShieldCheck size={13} aria-hidden="true" /> Verified purchase
                      </span>
                    )}
                  </p>
                  <p className={cn("mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-700", long && !open && "line-clamp-6")}>{r.body}</p>
                  {long && (
                    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [r.id]: !open }))} className="mt-1 text-[13px] font-semibold text-brand-700">
                      {open ? "Show less" : "Read more"}
                    </button>
                  )}
                  {r.response && (
                    <div className="mt-3 max-w-2xl rounded-xl bg-ink-50 px-4 py-3 text-[13px]">
                      <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <MessageSquareReply size={14} className="text-ink-500" aria-hidden="true" /> Response from {sellerName}
                      </p>
                      <p className="mt-1 leading-relaxed text-ink-700">{r.response}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-[13px]">
                    <button
                      type="button"
                      aria-pressed={!!voted[r.id]}
                      onClick={() => setVoted((v) => ({ ...v, [r.id]: !v[r.id] }))}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors",
                        voted[r.id] ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line-strong text-ink-700 hover:bg-ink-50",
                      )}
                    >
                      <ThumbsUp size={14} aria-hidden="true" /> Helpful ({r.helpful + (voted[r.id] ? 1 : 0)})
                    </button>
                    <button
                      type="button"
                      disabled={reported[r.id]}
                      onClick={() => setReported((v) => ({ ...v, [r.id]: true }))}
                      className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-800 disabled:text-ink-400"
                    >
                      <Flag size={13} aria-hidden="true" /> {reported[r.id] ? "Reported, thank you" : "Report"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
