"use client";

import Link from "next/link";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { useCart, useWishlist } from "@/components/store/cart-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { formatINR } from "@/lib/utils";

export interface SavedProduct {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
  inStock: boolean;
}

/** The products saved with the heart buttons, which this browser keeps (like the cart). */
export function SavedItems({ products }: { products: SavedProduct[] }) {
  const { ids, toggle } = useWishlist();
  const { add, notify } = useCart();
  const byId = new Map(products.map((p) => [p.id, p]));
  // products taken off sale since they were saved drop out quietly
  const saved = ids.flatMap((id) => byId.get(id) ?? []);

  if (!saved.length) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here for later."
        action={<ButtonLink href="/s">Browse products</ButtonLink>}
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-[13px] text-ink-500">
        {saved.length} saved {saved.length === 1 ? "item" : "items"}. Your wishlist is kept on this device.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {saved.map((p) => (
          <li key={p.id} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <Link href={`/p/${p.slug}`} className="shrink-0">
              <ProductImage src={p.image} alt="" size={88} rounded="lg" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/p/${p.slug}`} className="line-clamp-2 text-[13.5px] font-medium text-ink-900 hover:text-brand-700">
                {p.title}
              </Link>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="text-[15px] font-semibold text-ink-900 tabular-nums">{formatINR(p.price)}</span>
                {p.mrp > p.price && <span className="text-xs text-ink-400 line-through tabular-nums">{formatINR(p.mrp)}</span>}
              </p>
              {!p.inStock && <p className="mt-1 text-xs font-medium text-danger-600">Out of stock</p>}
              <div className="mt-auto flex flex-wrap items-center gap-1 pt-3">
                <Button
                  size="sm"
                  icon={ShoppingCart}
                  disabled={!p.inStock}
                  onClick={() => {
                    add({ productId: p.id, silent: true });
                    toggle(p.id);
                    notify({ message: "Moved to your cart", action: { label: "View cart", href: "/cart" } });
                  }}
                >
                  Move to cart
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => toggle(p.id)} aria-label={`Remove ${p.title} from wishlist`}>
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
