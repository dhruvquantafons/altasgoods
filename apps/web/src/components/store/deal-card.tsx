import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import type { DealSlot } from "@/lib/mock/store-extra";
import { cn, formatINR } from "@/lib/utils";
import { WishlistButton } from "./cart-buttons";
import { DealTimer } from "./countdown";
import { featuredOffer } from "./product-card";
import { percentOff } from "./price";

/**
 * Deal tile: the price shown is the live deal price; the claimed bar and the
 * timer come from real allocation data and the real deal end time.
 */
export function DealCard({ product: p, deal, showTimer = true, className }: { product: Product; deal: DealSlot; showTimer?: boolean; className?: string }) {
  const offer = featuredOffer(p);
  const off = percentOff(offer.price, offer.mrp);
  const brand = p.brandName;
  return (
    <article className={cn("group relative flex flex-col rounded-2xl border border-line bg-white p-3 transition-shadow hover:shadow-raised", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-50">
        <Image src={p.image} alt={p.title} fill sizes="(min-width: 1024px) 16vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        {off > 0 && <span className="absolute top-2.5 left-2.5 rounded-md bg-accent-400 px-2 py-0.5 text-xs font-bold text-ink-950 tabular-nums">{off}% off</span>}
        <WishlistButton productId={p.id} title={p.title} size="sm" className="absolute top-2 right-2" />
      </div>
      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <p className="truncate text-xs font-semibold text-ink-500">{brand}</p>
        <h3 className="mt-0.5 text-sm leading-5 text-ink-800">
          <Link href={`/p/${p.slug}`} title={p.title} className="line-clamp-2 after:absolute after:inset-0 after:z-[1] after:rounded-2xl">
            {p.title}
          </Link>
        </h3>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="sr-only">Deal price</span>
          <span className="text-lg font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(offer.price)}</span>
          {off > 0 && (
            <span className="text-[13px] text-ink-500 tabular-nums">
              <span className="sr-only">M.R.P. </span>
              <span className="line-through">{formatINR(offer.mrp)}</span>
            </span>
          )}
        </p>
        <div className="mt-auto pt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-accent-100"
            role="progressbar"
            aria-valuenow={deal.claimedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${deal.claimedPct}% of this deal claimed`}
          >
            <div className="h-full rounded-full bg-accent-600" style={{ width: `${deal.claimedPct}%` }} />
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-xs whitespace-nowrap sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <span className="font-medium text-ink-600 tabular-nums">{deal.claimedPct}% claimed</span>
            {showTimer && <DealTimer endsAt={deal.endsAt} compact className="font-semibold text-accent-800" />}
          </div>
        </div>
      </div>
    </article>
  );
}
