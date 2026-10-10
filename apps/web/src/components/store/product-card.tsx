import Image from "next/image";
import Link from "next/link";
import { Truck } from "lucide-react";
import type { Product } from "@/lib/types";
import { dealFor } from "@/lib/mock/store-extra";
import { cn } from "@/lib/utils";
import { AddToCartButton, WishlistButton } from "./cart-buttons";
import { DealTimer } from "./countdown";
import { DEFAULT_PINCODE, FREE_DELIVERY_THRESHOLD, lookupPincode, promiseDays, promiseLabel } from "./delivery";
import { AssuredMark, PriceRow, RatingChip } from "./price";

const defaultPin = lookupPincode(DEFAULT_PINCODE);

/** The store's offer for a product. */
export function featuredOffer(p: Product) {
  return p.offers.find((o) => o.sellerId === p.featuredSellerId && o.stock > 0) ?? p.offers.find((o) => o.stock > 0) ?? p.offers[0]!;
}

export function cardBadge(p: Product, deal?: boolean): { label: string; className: string } | null {
  if (deal || p.tags.includes("deal")) return { label: "Deal", className: "bg-accent-400 text-ink-950" };
  if (p.tags.includes("bestseller")) return { label: "Bestseller", className: "bg-ink-900 text-white" };
  if (p.tags.includes("new")) return { label: "New", className: "bg-brand-600 text-white" };
  return null;
}

/** "Free delivery by Sat, 3 Oct" for the default pincode. */
export function deliveryLine(p: Product) {
  const offer = featuredOffer(p);
  const days = promiseDays(offer.deliveryDays, defaultPin);
  const free = offer.price >= FREE_DELIVERY_THRESHOLD;
  const when = promiseLabel(days);
  return { free, when, days, text: `${free ? "Free delivery" : "Delivery"} ${days <= 1 ? when : `by ${when}`}` };
}

function variantSummary(p: Product) {
  const colour = p.variants.find((v) => v.name === "Colour");
  const size = p.variants.find((v) => v.name === "Size");
  const storage = p.variants.find((v) => v.name === "Storage");
  if (storage) return `${storage.values.length} storage options, ${colour?.values.length ?? 1} colours`;
  if (size) return `Sizes ${size.values[0]!.label} to ${size.values.at(-1)!.label}`;
  if (colour) return `${colour.values.length} colours`;
  return null;
}

export function ProductCard({
  product: p,
  showAdd = false,
  priority = false,
  className,
  sizes = "(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw",
}: {
  product: Product;
  showAdd?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const brand = p.brandName;
  const offer = featuredOffer(p);
  const available = offer.stock > 0;
  const deal = dealFor(p.id);
  const badge = cardBadge(p, !!deal);
  const delivery = deliveryLine(p);
  const lowStock = available && offer.stock > 0 && offer.stock <= 8;
  const vs = variantSummary(p);

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-ink-50">
        <Image
          src={p.image}
          alt={p.title}
          fill
          sizes={sizes}
          loading={priority ? "eager" : undefined}
          className={cn("object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]", !available && "opacity-60 grayscale-[30%]")}
        />
        {badge && (
          <span className={cn("absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide", badge.className)}>{badge.label}</span>
        )}
        <WishlistButton productId={p.id} title={p.title} className="absolute top-2 right-2" />
        {!available && (
          <span className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-white/95 py-1.5 text-center text-xs font-semibold text-ink-700 shadow-xs">Currently unavailable</span>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <p className="truncate text-[13px] font-semibold text-ink-900">{brand}</p>
        <h3 className="mt-0.5 text-sm leading-5 font-normal text-ink-700">
          <Link href={`/p/${p.slug}`} title={p.title} className="line-clamp-2 after:absolute after:inset-0 after:z-[1] after:rounded-xl hover:text-ink-900">
            {p.title}
          </Link>
        </h3>
        {vs && <p className="mt-1 truncate text-xs text-ink-500">{vs}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <RatingChip rating={p.rating} count={p.ratingCount} />
          {p.assured && <AssuredMark />}
        </div>
        <PriceRow price={offer.price} mrp={offer.mrp} className="mt-1.5" />
        {deal ? (
          <p className="mt-1 text-xs font-medium text-accent-800">
            <DealTimer endsAt={deal.endsAt} compact />
          </p>
        ) : null}
        {available ? (
          <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-ink-700">
            <Truck size={14} strokeWidth={1.8} className="shrink-0 text-ink-500" aria-hidden="true" />
            <span>
              {delivery.free ? <span className="font-medium">{delivery.text}</span> : delivery.text}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-500">Back in stock soon</p>
        )}
        {lowStock && <p className="mt-0.5 text-xs font-medium text-warning-700">Only {offer.stock} left</p>}
        {showAdd && (
          <div className="mt-auto pt-3">
            {available && !p.variants.length ? (
              <AddToCartButton productId={p.id} className="w-full" />
            ) : (
              <Link
                href={`/p/${p.slug}`}
                className="relative z-10 flex h-8 w-full items-center justify-center rounded-lg border border-line-strong text-[13px] font-medium text-ink-800 transition-colors hover:bg-ink-50"
              >
                {available ? "Choose options" : "See similar"}
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
