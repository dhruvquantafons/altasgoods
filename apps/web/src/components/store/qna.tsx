"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { BadgeCheck, MessageCircleQuestion, Plus, Search, ShoppingCart, ThumbsUp } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import { useCart } from "./cart-context";

/* ---------------------------------- Q&A ---------------------------------- */

export interface QnaItem {
  id: string;
  question: string;
  askedBy: string;
  askedOn: string;
  votes: number;
  answers: { by: string; role: "seller" | "brand" | "buyer"; body: string; on: string; helpful: number }[];
}

const roleLabel = { seller: "AltasGoods", brand: "Brand", buyer: "Verified buyer" };

export function QnaSection({ items, productTitle }: { items: QnaItem[]; productTitle: string }) {
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const id = useId();
  const list = items.filter((q) => !query.trim() || `${q.question} ${q.answers.map((a) => a.body).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor={`${id}-s`} className="sr-only">
            Search questions and answers
          </label>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id={`${id}-s`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Have a question? Search answers first"
            className="h-11 w-full rounded-xl border border-line-strong bg-white pr-3 pl-9 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAsking((a) => !a);
            setSent(false);
          }}
          aria-expanded={asking}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-ink-800 hover:bg-ink-50"
        >
          <MessageCircleQuestion size={17} aria-hidden="true" /> Ask a question
        </button>
      </div>

      {asking && (
        <form
          className="mt-4 rounded-2xl border border-line bg-ink-25 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim().length < 10) return;
            setSent(true);
            setDraft("");
          }}
        >
          {sent ? (
            <p className="text-sm text-ink-700">
              <span className="font-semibold text-ink-900">Thanks, your question is in review.</span> Once approved, our team, the brand and buyers of this product can answer. We
              will notify you when it is answered.
            </p>
          ) : (
            <>
              <label htmlFor={`${id}-q`} className="text-sm font-medium text-ink-900">
                Your question about {productTitle.split(/[,(]/)[0]}
              </label>
              <textarea
                id={`${id}-q`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="For example: does it come with a carry case?"
                className="mt-2 w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-500">Do not share phone numbers or personal details. {300 - draft.length} characters left.</p>
                <button type="submit" disabled={draft.trim().length < 10} className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-brand-300">
                  Post question
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {list.length === 0 ? (
        <p className="py-8 text-sm text-ink-500">No answers match &ldquo;{query}&rdquo;. Ask the community instead.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {list.map((q) => (
            <li key={q.id} className="grid gap-3 py-5 sm:grid-cols-[88px_1fr]">
              <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                <button
                  type="button"
                  aria-pressed={!!votes[q.id]}
                  aria-label={`Mark question as useful, ${q.votes + (votes[q.id] ? 1 : 0)} votes`}
                  onClick={() => setVotes((v) => ({ ...v, [q.id]: !v[q.id] }))}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium tabular-nums transition-colors",
                    votes[q.id] ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line-strong text-ink-600 hover:bg-ink-50",
                  )}
                >
                  <ThumbsUp size={13} aria-hidden="true" />
                  {q.votes + (votes[q.id] ? 1 : 0)}
                </button>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">
                  <span className="mr-1.5 text-ink-400">Q.</span>
                  {q.question}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Asked by {q.askedBy} on {q.askedOn}
                </p>
                {q.answers.map((a, i) => (
                  <div key={i} className="mt-3 rounded-xl bg-ink-50 px-4 py-3">
                    <p className="text-sm leading-relaxed text-ink-700">
                      <span className="mr-1.5 font-semibold text-ink-400">A.</span>
                      {a.body}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span className="font-medium text-ink-700">{a.by}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-px font-medium",
                          a.role === "buyer" ? "bg-success-50 text-success-700" : "bg-brand-50 text-brand-700",
                        )}
                      >
                        {a.role !== "buyer" && <BadgeCheck size={12} aria-hidden="true" />}
                        {roleLabel[a.role]}
                      </span>
                      <span>{a.on}</span>
                      <span>{a.helpful} found this helpful</span>
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------- Frequently bought together ---------------------- */

export interface FbtItem {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
  inStock: boolean;
}

/** Opt-in bundle: add-ons start unticked, nothing is added without a tap. */
export function FrequentlyBoughtTogether({ items }: { items: FbtItem[] }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const { add, notify } = useCart();
  const [main, ...addons] = items;
  if (!main) return null;
  const chosen = [main, ...addons.filter((a) => picked[a.id])];
  const total = chosen.reduce((s, x) => s + x.price, 0);
  const mrp = chosen.reduce((s, x) => s + x.mrp, 0);

  return (
    <div className="grid gap-6 rounded-2xl border border-line p-5 lg:grid-cols-[1fr_300px] lg:items-center lg:p-6">
      <ul className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        {items.map((it, i) => {
          const isMain = i === 0;
          const on = isMain || !!picked[it.id];
          return (
            <li key={it.id} className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:items-stretch">
              {i > 0 && (
                <span className="hidden size-7 shrink-0 items-center justify-center self-center rounded-full bg-ink-100 text-ink-500 sm:-mx-1 sm:my-0 sm:flex" aria-hidden="true">
                  <Plus size={14} />
                </span>
              )}
              <label
                className={cn(
                  "flex flex-1 cursor-pointer gap-3 rounded-xl border p-3 transition-colors sm:flex-col",
                  on ? "border-brand-300 bg-brand-50/40" : "border-line hover:border-line-strong",
                  isMain && "cursor-default",
                )}
              >
                <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-ink-50 sm:aspect-square sm:size-auto sm:w-full">
                  <Image src={it.image} alt="" fill sizes="160px" className="object-cover" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={isMain || !it.inStock}
                      onChange={() => setPicked((p) => ({ ...p, [it.id]: !p[it.id] }))}
                      className="mt-0.5 size-4 shrink-0 accent-brand-600"
                      aria-label={isMain ? "This item, always included" : `Add ${it.title}`}
                    />
                    <span className="line-clamp-2 text-[13px] leading-snug text-ink-800">
                      {isMain && <span className="font-semibold">This item: </span>}
                      {isMain ? (
                        it.title
                      ) : (
                        <Link href={`/p/${it.slug}`} className="hover:underline">
                          {it.title}
                        </Link>
                      )}
                    </span>
                  </span>
                  <span className="mt-1.5 pl-6 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(it.price)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl bg-ink-50 p-4">
        <p className="text-sm text-ink-600">
          Total for {chosen.length} item{chosen.length === 1 ? "" : "s"}
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(total)}</span>
          {mrp > total && <span className="text-[13px] text-ink-500 line-through tabular-nums">{formatINR(mrp)}</span>}
        </p>
        <p className="mt-1 text-xs text-ink-500">Tick the items you want. Nothing is added unless you choose it.</p>
        <button
          type="button"
          onClick={() => {
            chosen.forEach((c) => add({ productId: c.id, silent: true }));
            notify({ message: `${chosen.length} item${chosen.length === 1 ? "" : "s"} added to your cart`, action: { label: "View cart", href: "/cart" } });
          }}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <ShoppingCart size={17} aria-hidden="true" />
          {chosen.length === 1 ? "Add this item to cart" : `Add ${chosen.length} items to cart`}
        </button>
      </div>
    </div>
  );
}
