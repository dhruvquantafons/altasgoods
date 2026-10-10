"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellOff, Copy, Heart, Lock, Plus, Share2, ShoppingCart, Trash2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Field, Input, Radio } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import { EmptyState, RatingPill } from "@/components/ui/misc";
import { cn, formatINR } from "@/lib/utils";

export interface WishItem {
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
  priceWhenAdded: number;
  inStock: boolean;
  rating: number;
  addedLabel: string;
  alert: boolean;
}

export interface WishList {
  id: string;
  name: string;
  isDefault?: boolean;
  visibility: "private" | "shared";
  sharedWith?: number;
  items: WishItem[];
}

export function WishlistView({ initial }: { initial: WishList[] }) {
  const [lists, setLists] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id ?? "");
  const [modal, setModal] = useState<"new" | "share" | null>(null);
  const [newName, setNewName] = useState("");
  const [newVisibility, setNewVisibility] = useState<"private" | "shared">("private");
  const [linkOn, setLinkOn] = useState(true);
  const toast = useToast();

  const list = lists.find((l) => l.id === activeId) ?? lists[0]!;
  const drops = list.items.filter((i) => i.price < i.priceWhenAdded);

  const updateItems = (fn: (items: WishItem[]) => WishItem[]) => setLists((ls) => ls.map((l) => (l.id === list.id ? { ...l, items: fn(l.items) } : l)));
  const shareUrl = `https://altasgoods.in/lists/${list.id.replace("wl-", "")}-ananya`;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setActiveId(l.id)}
              aria-pressed={l.id === list.id}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors",
                l.id === list.id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700 hover:border-line-strong",
              )}
            >
              {l.name}
              <span className={cn("text-xs tabular-nums", l.id === list.id ? "text-ink-300" : "text-ink-400")}>{l.items.length}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setModal("new")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-[13px] font-medium text-ink-600 hover:border-brand-400 hover:text-brand-700"
          >
            <Plus size={15} aria-hidden="true" />
            New list
          </button>
        </div>
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink-900">{list.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600">
                {list.visibility === "private" ? <Lock size={11} aria-hidden="true" /> : <Users size={11} aria-hidden="true" />}
                {list.visibility === "private" ? "Private" : `Shared with ${list.sharedWith ?? 0} people`}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {list.items.length} {list.items.length === 1 ? "item" : "items"}
              {drops.length > 0 && (
                <>
                  {" "}
                  · <span className="font-medium text-success-700">{drops.length} price {drops.length === 1 ? "drop" : "drops"}</span>
                </>
              )}
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={Share2} onClick={() => setModal("share")}>
            Share list
          </Button>
        </div>

        {list.items.length === 0 ? (
          <EmptyState icon={Heart} title="This list is empty" description="Tap the heart on any product to save it here. We will tell you when the price drops." />
        ) : (
          <ul className="grid divide-y divide-line lg:grid-cols-2 lg:divide-y-0">
            {list.items.map((it, i) => {
              const diff = it.priceWhenAdded - it.price;
              return (
                <li key={it.slug} className={cn("flex gap-4 px-5 py-5 sm:px-6", "lg:border-line", i >= 2 && "lg:border-t", i % 2 === 1 && "lg:border-l")}>
                  <Link href={`/p/${it.slug}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                    <ProductImage src={it.image} alt="" size={104} rounded="lg" className={cn(!it.inStock && "opacity-60")} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/p/${it.slug}`} className="line-clamp-2 text-[13.5px] leading-snug font-medium text-ink-900 hover:text-brand-700">
                      {it.title}
                    </Link>
                    <div className="mt-1.5 flex items-center gap-2">
                      <RatingPill value={it.rating} />
                      {!it.inStock && <span className="text-xs font-medium text-danger-700">Out of stock</span>}
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-semibold text-ink-900 tabular-nums">{formatINR(it.price)}</span>
                      {it.mrp > it.price && <span className="text-xs text-ink-400 line-through tabular-nums">{formatINR(it.mrp)}</span>}
                    </p>
                    {diff > 0 ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success-700">
                        <TrendingDown size={13} aria-hidden="true" />
                        {formatINR(diff)} lower since you added it
                      </p>
                    ) : diff < 0 ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
                        <TrendingUp size={13} aria-hidden="true" />
                        {formatINR(-diff)} higher since you added it
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-ink-500">Added {it.addedLabel}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      {it.inStock ? (
                        <Button
                          size="sm"
                          variant="soft"
                          icon={ShoppingCart}
                          onClick={() => {
                            updateItems((items) => items.filter((x) => x.slug !== it.slug));
                            toast.show("Moved to your cart");
                          }}
                        >
                          Move to cart
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" icon={Bell} onClick={() => toast.show("We will let you know when it is back")}>
                          Notify me
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        icon={it.alert ? Bell : BellOff}
                        aria-pressed={it.alert}
                        aria-label={it.alert ? "Turn off price drop alert" : "Turn on price drop alert"}
                        title={it.alert ? "Price drop alert on" : "Price drop alert off"}
                        className={it.alert ? "text-brand-700" : "text-ink-400"}
                        onClick={() => {
                          updateItems((items) => items.map((x) => (x.slug === it.slug ? { ...x, alert: !x.alert } : x)));
                          toast.show(it.alert ? "Price drop alert turned off" : "We will alert you when the price drops");
                        }}
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        icon={Trash2}
                        aria-label={`Remove ${it.title} from ${list.name}`}
                        className="text-ink-400 hover:text-danger-700"
                        onClick={() => {
                          updateItems((items) => items.filter((x) => x.slug !== it.slug));
                          toast.show("Removed from your list");
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={modal === "new"}
        onClose={() => setModal(null)}
        title="Create a list"
        description="Use lists to plan gifts, a home makeover or a festive shopping trip."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim()}
              onClick={() => {
                const id = `wl-${Date.now().toString(36)}`;
                setLists((ls) => [...ls, { id, name: newName.trim(), visibility: newVisibility, sharedWith: 0, items: [] }]);
                setActiveId(id);
                setNewName("");
                setModal(null);
              }}
            >
              Create list
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="List name" htmlFor="list-name">
            <Input id="list-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="For example, Wedding gifts" maxLength={40} />
          </Field>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Who can see it</legend>
            <Radio name="vis" checked={newVisibility === "private"} onChange={() => setNewVisibility("private")} label="Only me" description="Nobody else can see this list" />
            <Radio name="vis" checked={newVisibility === "shared"} onChange={() => setNewVisibility("shared")} label="Anyone with the link" description="Good for gift registries and family shopping" />
          </fieldset>
        </div>
      </Modal>

      <Modal
        open={modal === "share"}
        onClose={() => setModal(null)}
        title={`Share ${list.name}`}
        description="People with the link can view the list and buy items for you. They cannot see your address."
        footer={<Button onClick={() => setModal(null)}>Done</Button>}
      >
        <div className="flex flex-col gap-5">
          <Switch checked={linkOn} onChange={setLinkOn} label="Anyone with the link can view" description="Turn this off to make the list private again" />
          <div className={cn("flex items-center gap-2", !linkOn && "pointer-events-none opacity-50")}>
            <Input readOnly value={shareUrl} aria-label="Share link" className="min-w-0 flex-1 font-mono text-[12px]" />
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
                toast.show("Link copied");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
