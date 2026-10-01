"use client";

import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Zap } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart, useWishlist } from "./cart-context";

export function WishlistButton({ productId, title, className, size = "md" }: { productId: string; title: string; className?: string; size?: "sm" | "md" }) {
  const { has, toggle } = useWishlist();
  const { notify } = useCart();
  const on = has(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      onClick={(e) => {
        e.preventDefault();
        toggle(productId);
        notify(on ? { message: "Removed from wishlist" } : { message: "Saved to your wishlist", action: { label: "View", href: "/account/wishlist" } });
      }}
      className={cn(
        "relative z-10 flex items-center justify-center rounded-full bg-white/95 shadow-raised ring-1 ring-ink-900/5 transition-transform hover:scale-105 active:scale-95",
        size === "sm" ? "size-8" : "size-9",
        className,
      )}
    >
      <Heart
        size={size === "sm" ? 15 : 17}
        strokeWidth={2}
        className={cn("transition-colors", on ? "fill-danger-500 text-danger-500" : "text-ink-600")}
        aria-hidden="true"
      />
    </button>
  );
}

export function AddToCartButton({
  productId,
  sellerId,
  variant,
  qty = 1,
  disabled,
  label = "Add to cart",
  size = "sm",
  style = "secondary",
  className,
  icon = true,
}: {
  productId: string;
  sellerId: string;
  variant?: string;
  qty?: number;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  style?: "primary" | "secondary" | "outline" | "soft";
  className?: string;
  icon?: boolean;
}) {
  const { add } = useCart();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        add({ productId, sellerId, variant, qty });
      }}
      className={cn(buttonClasses({ variant: style, size }), "relative z-10 disabled:opacity-60", className)}
    >
      {icon && <ShoppingCart size={size === "lg" ? 18 : 15} strokeWidth={1.9} aria-hidden="true" />}
      {label}
    </button>
  );
}

export function BuyNowButton({
  productId,
  sellerId,
  variant,
  qty = 1,
  disabled,
  size = "lg",
  className,
}: {
  productId: string;
  sellerId: string;
  variant?: string;
  qty?: number;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        // Buy now checks out just this item; the cart is left untouched.
        const sp = new URLSearchParams({ buy: productId, seller: sellerId, qty: String(qty) });
        if (variant) sp.set("variant", variant);
        router.push(`/checkout?${sp}`);
      }}
      className={cn(buttonClasses({ variant: "accent", size }), "disabled:opacity-60", className)}
    >
      <Zap size={size === "lg" ? 18 : 15} strokeWidth={2} aria-hidden="true" />
      Buy now
    </button>
  );
}
