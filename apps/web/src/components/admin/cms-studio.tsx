"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Monitor, Smartphone } from "lucide-react";
import { CMS_STATUS } from "@/components/admin/admin-status";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { Price } from "@/components/ui/misc";
import type { HeroBanner, HomeSlot } from "@/lib/mock/admin-extra";
import { cn, formatDateShort } from "@/lib/utils";

export interface StudioProduct {
  id: string;
  title: string;
  image: string;
  price: number;
  mrp: number;
}

const BANNER_IMAGES = ["hero-festive", "hero-electronics", "hero-fashion", "hero-home", "promo-beauty", "promo-sports"].map((k) => `/images/banners/${k}.jpg`);
const SLOT_LABEL: Record<HomeSlot["type"], string> = {
  hero_carousel: "Hero carousel",
  deal_strip: "Deal strip",
  category_tiles: "Category tiles",
  product_rail: "Product rail",
  banner_pair: "Banner pair",
  brand_spotlight: "Brand spotlight",
};
const PERSONAS = [
  { key: "everyone", label: "Guest or any customer" },
  { key: "new", label: "New customer" },
];

function visibleFor(slot: HomeSlot, persona: string) {
  if (slot.audience === "Signed-in customers") return persona !== "everyone";
  return true;
}

/** Storefront merchandising: slot order, persona preview and a banner editor with a live preview. */
export function CmsStudio({ slots, banners, products, categories }: { slots: HomeSlot[]; banners: HeroBanner[]; products: Record<string, StudioProduct>; categories: { id: string; name: string; image: string }[] }) {
  const id = useId();
  const [order, setOrder] = useState(slots.map((s) => s.id));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [persona, setPersona] = useState("everyone");
  const [drafts, setDrafts] = useState(false);
  const [bannerId, setBannerId] = useState(banners[0]!.id);
  const [edits, setEdits] = useState<Record<string, Partial<HeroBanner>>>({});
  const [dirty, setDirty] = useState(false);
  const { show, node } = useToast();

  const banner = { ...banners.find((b) => b.id === bannerId)!, ...edits[bannerId] };
  const set = (patch: Partial<HeroBanner>) => {
    setEdits((e) => ({ ...e, [bannerId]: { ...e[bannerId], ...patch } }));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setOrder((o) => {
      const n = [...o];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });
    setDirty(true);
  };
  const errors = {
    title: !banner.title.trim() ? "Headline is required" : banner.title.length > 44 ? `${banner.title.length} of 44 characters` : undefined,
    subtitle: banner.subtitle.length > 110 ? `${banner.subtitle.length} of 110 characters` : undefined,
    cta: !banner.cta.trim() ? "Button label is required" : banner.cta.length > 22 ? "Keep it under 22 characters" : undefined,
    dates: banner.endsAt < banner.startsAt ? "End must be after start" : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const ordered = order.map((sid) => slots.find((s) => s.id === sid)!);
  const preview = ordered.filter((s) => (drafts || s.status === "live") && visibleFor(s, persona));
  const mobile = device === "mobile";

  const rail = (s: HomeSlot) => (
    <section key={s.id}>
      <div className="mb-2 flex items-baseline justify-between">
        <p className={cn("font-display font-semibold text-ink-900", mobile ? "text-[12px]" : "text-[13px]")}>{s.name}</p>
      </div>
      <div className={cn("grid gap-2", mobile ? "grid-flow-col auto-cols-[42%] overflow-hidden" : "grid-cols-6")}>
        {(s.productIds ?? []).map((pid) => products[pid]).filter(Boolean).map((p) => (
          <div key={p!.id} className="min-w-0 rounded-lg border border-line bg-white p-1.5">
            <div className="relative aspect-square overflow-hidden rounded-md bg-ink-50">
              <Image src={p!.image} alt="" fill sizes="120px" className="object-cover" />
            </div>
            <p className="mt-1 truncate text-[10px] text-ink-700">{p!.title}</p>
            <Price price={p!.price} mrp={p!.mrp} size="sm" className="[&_span]:text-[10px] [&>span:first-child]:text-[11px]" />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader title="Homepage slots" description="Top to bottom. Reorder, then publish; changes are audited." />
          <ol className="mt-3 divide-y divide-line border-t border-line">
            {ordered.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-5 text-right text-xs font-medium text-ink-400 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-900">
                    {s.name}
                    <StatusBadge meta={CMS_STATUS[s.status]} size="sm" />
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {SLOT_LABEL[s.type]}, {s.audience}, {s.source}
                    {s.startsAt ? `, ${formatDateShort(s.startsAt)} to ${formatDateShort(s.endsAt!)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${s.name} up`} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === ordered.length - 1} aria-label={`Move ${s.name} down`} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-30">
                    <ArrowDown size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader title="Hero banners" description="Select a banner to edit. The preview updates as you type." />
          <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-thin">
            {banners.map((b) => (
              <button key={b.id} type="button" onClick={() => setBannerId(b.id)} aria-pressed={b.id === bannerId} className={cn("w-36 shrink-0 rounded-xl border p-1.5 text-left transition-colors", b.id === bannerId ? "border-brand-500 ring-2 ring-brand-100" : "border-line hover:border-line-strong")}>
                <span className="relative block aspect-[16/7] overflow-hidden rounded-lg bg-ink-100">
                  <Image src={(edits[b.id]?.image as string) ?? b.image} alt="" fill sizes="140px" className="object-cover" />
                </span>
                <span className="mt-1.5 block truncate px-0.5 text-xs font-medium text-ink-900">{edits[b.id]?.title ?? b.title}</span>
                <span className="mt-0.5 flex items-center justify-between px-0.5">
                  <StatusBadge meta={CMS_STATUS[b.status]} size="sm" />
                  <span className="text-[11px] text-ink-500 tabular-nums">{b.ctr ? `${b.ctr}% CTR` : ""}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 border-t border-line px-5 pt-4 pb-5 sm:grid-cols-2">
            <Field label="Headline" required className="sm:col-span-2" htmlFor={`${id}-t`} error={errors.title}>
              <Input id={`${id}-t`} value={banner.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={Boolean(errors.title)} />
            </Field>
            <Field label="Supporting line" className="sm:col-span-2" htmlFor={`${id}-s`} error={errors.subtitle}>
              <Textarea id={`${id}-s`} value={banner.subtitle} onChange={(e) => set({ subtitle: e.target.value })} className="min-h-16" aria-invalid={Boolean(errors.subtitle)} />
            </Field>
            <Field label="Button label" required htmlFor={`${id}-c`} error={errors.cta}>
              <Input id={`${id}-c`} value={banner.cta} onChange={(e) => set({ cta: e.target.value })} aria-invalid={Boolean(errors.cta)} />
            </Field>
            <Field label="Link" htmlFor={`${id}-l`}>
              <Input id={`${id}-l`} value={banner.href} onChange={(e) => set({ href: e.target.value })} className="font-mono" />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium text-ink-700">Image</p>
              <div className="grid grid-cols-6 gap-1.5">
                {BANNER_IMAGES.map((src) => (
                  <button key={src} type="button" onClick={() => set({ image: src })} aria-label={`Use ${src.split("/").pop()}`} aria-pressed={banner.image === src} className={cn("relative aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1", banner.image === src ? "ring-brand-500" : "ring-transparent")}>
                    <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <Field label="Audience" htmlFor={`${id}-a`} className="sm:col-span-2">
              <Select id={`${id}-a`} value={banner.audience} onChange={(e) => set({ audience: e.target.value })}>
                {["Everyone", "New customers", "Women, metro cities", "Electronics shoppers"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <Field label="Starts" htmlFor={`${id}-st`}>
                <Input id={`${id}-st`} type="date" value={banner.startsAt.slice(0, 10)} onChange={(e) => set({ startsAt: `${e.target.value}T00:00:00+05:30` })} />
              </Field>
              <Field label="Ends" htmlFor={`${id}-en`} error={errors.dates}>
                <Input id={`${id}-en`} type="date" value={banner.endsAt.slice(0, 10)} onChange={(e) => set({ endsAt: `${e.target.value}T23:59:00+05:30` })} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {dirty && <span className="mr-auto text-xs text-ink-500">Unsaved changes</span>}
            <Button variant="ghost" size="sm" disabled={!valid} onClick={() => { setDirty(false); show("Saved as draft"); }}>
              Save draft
            </Button>
            <Button variant="secondary" size="sm" disabled={!valid} onClick={() => { setDirty(false); show(`Scheduled for ${formatDateShort(banner.startsAt)}`); }}>
              Schedule
            </Button>
            <Button size="sm" disabled={!valid} onClick={() => { setDirty(false); show("Published to the homepage. Recorded in the audit log."); }}>
              Publish
            </Button>
          </div>
        </Card>
      </div>

      <Card className="min-w-0 self-start xl:sticky xl:top-24">
        <CardHeader
          title="Preview"
          description="Live-ish render of the homepage for a persona"
          action={
            <div role="radiogroup" aria-label="Device" className="inline-flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={device === d} aria-label={d === "desktop" ? "Desktop" : "Mobile"} onClick={() => setDevice(d)} className={cn("flex h-7 w-8 items-center justify-center rounded-md", device === d ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}>
                  {d === "desktop" ? <Monitor size={15} /> : <Smartphone size={15} />}
                </button>
              ))}
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-3 px-5 pt-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            Persona
            <Select selectSize="sm" value={persona} onChange={(e) => setPersona(e.target.value)} className="w-52">
              {PERSONAS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            <input type="checkbox" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} className="size-4 accent-brand-600" />
            Include scheduled and drafts
          </label>
        </div>
        <div className="p-5">
          <div className={cn("mx-auto overflow-hidden rounded-xl border border-line-strong bg-canvas shadow-raised", mobile ? "max-w-[300px] rounded-[28px] border-[6px] border-ink-900" : "w-full")}>
            <div className={cn("flex items-center gap-2 border-b border-line bg-white px-3", mobile ? "h-9" : "h-10")}>
              <span className="font-display text-[13px] font-bold text-brand-700">AltasGoods</span>
              <span className="h-5 flex-1 rounded-md bg-ink-100" aria-hidden="true" />
            </div>
            <div className={cn("flex flex-col gap-4 p-3", mobile && "gap-3 p-2.5")}>
              {preview.map((s) => {
                if (s.type === "hero_carousel")
                  return (
                    <section key={s.id} className={cn("relative overflow-hidden rounded-lg bg-ink-900", mobile ? "aspect-[4/3]" : "aspect-[21/8]")}>
                      <Image src={banner.image} alt="" fill sizes="600px" className="object-cover opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/80 via-ink-950/35 to-transparent" />
                      <div className={cn("absolute inset-y-0 left-0 flex flex-col justify-center", mobile ? "max-w-[85%] p-3" : "max-w-[55%] p-5")}>
                        <p className={cn("font-display leading-tight font-bold text-white", mobile ? "text-[15px]" : "text-xl")}>{banner.title || "Headline"}</p>
                        <p className={cn("mt-1 text-white/85", mobile ? "line-clamp-2 text-[10px]" : "text-xs")}>{banner.subtitle}</p>
                        <span className={cn("mt-2.5 inline-flex w-fit items-center rounded-md bg-white font-semibold text-ink-900", mobile ? "h-6 px-2 text-[10px]" : "h-7 px-3 text-[11px]")}>{banner.cta || "Button"}</span>
                      </div>
                      <div className="absolute right-2 bottom-2 flex gap-1" aria-hidden="true">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className={cn("size-1.5 rounded-full", d === 0 ? "bg-white" : "bg-white/40")} />
                        ))}
                      </div>
                    </section>
                  );
                if (s.type === "category_tiles")
                  return (
                    <section key={s.id}>
                      <p className={cn("mb-2 font-display font-semibold text-ink-900", mobile ? "text-[12px]" : "text-[13px]")}>{s.name}</p>
                      <div className={cn("grid gap-2", mobile ? "grid-cols-4" : "grid-cols-8")}>
                        {categories.slice(0, mobile ? 8 : 8).map((c) => (
                          <div key={c.id} className="min-w-0 text-center">
                            <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full bg-white ring-1 ring-line">
                              <Image src={c.image} alt="" fill sizes="64px" className="object-cover" />
                            </div>
                            <p className="mt-1 truncate text-[9px] text-ink-600">{c.name}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                if (s.type === "deal_strip")
                  return (
                    <div key={s.id} className="rounded-lg bg-accent-50 p-2 ring-1 ring-accent-100">
                      <p className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-accent-800">
                        <span>Deal ends {s.endsAt ? formatDateShort(s.endsAt) : "soon"}</span>
                      </p>
                      {rail(s)}
                    </div>
                  );
                if (s.type === "product_rail") return rail(s);
                if (s.type === "banner_pair")
                  return (
                    <section key={s.id} className={cn("grid gap-2", mobile ? "grid-cols-1" : "grid-cols-2")}>
                      {["/images/banners/hero-fashion.jpg", "/images/banners/promo-beauty.jpg"].map((src, i) => (
                        <div key={src} className="relative aspect-[16/6] overflow-hidden rounded-lg bg-ink-200">
                          <Image src={src} alt="" fill sizes="300px" className="object-cover" />
                          <span className="absolute bottom-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink-900">{i === 0 ? "The festive edit" : "Beauty Fest"}</span>
                        </div>
                      ))}
                    </section>
                  );
                return (
                  <section key={s.id} className="flex items-center justify-between rounded-lg border border-dashed border-line-strong bg-white px-3 py-3">
                    <span className="text-[11px] font-semibold text-ink-800">{s.name}</span>
                  </section>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-ink-500">
            {preview.length} of {slots.length} slots shown for this persona.
          </p>
        </div>
      </Card>
      {node}
    </div>
  );
}
