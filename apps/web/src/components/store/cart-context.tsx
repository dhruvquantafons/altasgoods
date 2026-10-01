"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { loadServerCart, syncCart, type LineInput } from "@/app/actions/store";
import { CircleCheck } from "lucide-react";
import type { CartLine } from "./types";
import { DEFAULT_PINCODE } from "./delivery";
import { lineKey } from "./pricing";

/* ------------------------------------------------------------------------
 * Tiny persisted stores. useSyncExternalStore renders the deterministic
 * default on the server and during hydration (getServerSnapshot), then
 * switches to the localStorage value right after, so SSR and the first
 * client render always match.
 * ---------------------------------------------------------------------- */

function createPersistedStore<T>(key: string, fallback: T, sanitize: (raw: unknown) => T | null) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache !== null) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (sanitize(JSON.parse(raw)) ?? fallback) : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const write = (next: T) => {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage can be unavailable (private mode); keep the in-memory value */
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const server = () => fallback;
  return { subscribe, read, write, server };
}

type PersistedStore<T> = ReturnType<typeof createPersistedStore<T>>;

function usePersisted<T>(store: PersistedStore<T>) {
  return useSyncExternalStore(store.subscribe, store.read, store.server);
}

/* --------------------------------- Cart --------------------------------- */

export interface CartState {
  lines: CartLine[];
  coupon: string | null;
}


/** A new browser starts with an empty cart; a signed-in account's cart is merged in after sign in. */
const DEFAULT_CART: CartState = { lines: [], coupon: null };

/** Union of two carts by line, keeping the larger quantity. */
function mergeLines(local: CartLine[], server: LineInput[]): CartLine[] {
  const byKey = new Map(local.map((l) => [l.key, l]));
  for (const s of server) {
    const key = lineKey(s.productId, s.sellerId, s.variant);
    const mine = byKey.get(key);
    byKey.set(key, mine ? { ...mine, qty: Math.max(mine.qty, s.qty) } : { key, productId: s.productId, sellerId: s.sellerId, qty: s.qty, variant: s.variant, saved: s.saved });
  }
  return [...byKey.values()];
}

const cartStore = createPersistedStore<CartState>("blubuy.cart.v1", DEFAULT_CART, (raw) => {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as CartState).lines)) return null;
  const r = raw as CartState;
  return {
    coupon: typeof r.coupon === "string" ? r.coupon : null,
    lines: r.lines
      .filter((l) => l && typeof l.productId === "string" && typeof l.sellerId === "string")
      .map((l) => ({ ...l, qty: Math.max(1, Math.min(10, Number(l.qty) || 1)), key: lineKey(l.productId, l.sellerId, l.variant) })),
  };
});

const wishlistStore = createPersistedStore<string[]>("blubuy.wishlist.v1", ["p-bag-leather", "p-camera-mirrorless", "p-chair-lounge"], (raw) =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : null,
);

const pincodeStore = createPersistedStore<string>("blubuy.pincode.v1", DEFAULT_PINCODE, (raw) => (typeof raw === "string" && /^[1-8]\d{5}$/.test(raw) ? raw : null));

export const MAX_QTY = 10;

/* ------------------------------- Context -------------------------------- */

interface Toast {
  id: number;
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface CartApi {
  lines: CartLine[];
  active: CartLine[];
  saved: CartLine[];
  coupon: string | null;
  count: number;
  add: (input: { productId: string; sellerId: string; qty?: number; variant?: string; silent?: boolean }) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  saveForLater: (key: string) => void;
  moveToCart: (key: string) => void;
  applyCoupon: (code: string | null) => void;
  removePurchased: () => void;
  notify: (t: Omit<Toast, "id">) => void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children, signedIn = false }: { children: ReactNode; signedIn?: boolean }) {
  const state = usePersisted(cartStore);
  const [toast, setToast] = useState<Toast | null>(null);
  const [merged, setMerged] = useState(false);
  const merging = useRef(false);

  // After sign in: merge the account's cart into this browser's cart once.
  useEffect(() => {
    if (!signedIn || merging.current) return;
    merging.current = true;
    loadServerCart().then((r) => {
      if (r.ok) cartStore.write({ ...cartStore.read(), lines: mergeLines(cartStore.read().lines, r.data) });
      setMerged(true);
    });
  }, [signedIn]);

  // Then mirror every change to the account, so the app and other devices see it.
  useEffect(() => {
    if (!signedIn || !merged) return;
    const t = setTimeout(() => {
      syncCart(state.lines.map((l) => ({ productId: l.productId, sellerId: l.sellerId, qty: l.qty, variant: l.variant, saved: l.saved })));
    }, 600);
    return () => clearTimeout(t);
  }, [state.lines, signedIn, merged]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((t: Omit<Toast, "id">) => setToast({ ...t, id: Date.now() }), []);

  const api = useMemo<CartApi>(() => {
    const update = (fn: (s: CartState) => CartState) => cartStore.write(fn(cartStore.read()));
    const active = state.lines.filter((l) => !l.saved);
    return {
      lines: state.lines,
      active,
      saved: state.lines.filter((l) => l.saved),
      coupon: state.coupon,
      count: active.reduce((a, l) => a + l.qty, 0),
      add: ({ productId, sellerId, qty = 1, variant, silent }) => {
        const key = lineKey(productId, sellerId, variant);
        update((s) => {
          const existing = s.lines.find((l) => l.key === key);
          if (existing)
            return {
              ...s,
              lines: s.lines.map((l) => (l.key === key ? { ...l, saved: false, qty: Math.min(MAX_QTY, (l.saved ? 0 : l.qty) + qty) } : l)),
            };
          return { ...s, lines: [{ key, productId, sellerId, qty: Math.min(MAX_QTY, qty), variant }, ...s.lines] };
        });
        if (!silent) notify({ message: "Added to your cart", action: { label: "View cart", href: "/cart" } });
      },
      setQty: (key, qty) => update((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : l)) })),
      remove: (key) => {
        const before = cartStore.read();
        update((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));
        notify({ message: "Item removed", action: { label: "Undo", onClick: () => cartStore.write(before) } });
      },
      saveForLater: (key) => update((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, saved: true } : l)) })),
      moveToCart: (key) => update((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, saved: false } : l)) })),
      applyCoupon: (code) => update((s) => ({ ...s, coupon: code })),
      removePurchased: () => update((s) => ({ lines: s.lines.filter((l) => l.saved), coupon: null })),
      notify,
    };
  }, [state, notify]);

  return (
    <CartContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-6">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink-900 py-2.5 pr-2.5 pl-3.5 text-sm text-white shadow-pop animate-fade-in"
          >
            <CircleCheck size={17} className="text-success-500" aria-hidden="true" />
            <span className="font-medium">{toast.message}</span>
            {toast.action &&
              (toast.action.href ? (
                <Link href={toast.action.href} className="rounded-lg px-2.5 py-1 font-semibold text-brand-200 hover:bg-white/10">
                  {toast.action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick?.();
                    setToast(null);
                  }}
                  className="rounded-lg px-2.5 py-1 font-semibold text-brand-200 hover:bg-white/10"
                >
                  {toast.action.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/* ------------------------- Wishlist and pincode ------------------------- */

export function useWishlist() {
  const ids = usePersisted(wishlistStore);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const cur = wishlistStore.read();
      wishlistStore.write(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]);
    },
  };
}

export function usePincode() {
  const pincode = usePersisted(pincodeStore);
  return { pincode, setPincode: (p: string) => pincodeStore.write(p) };
}
