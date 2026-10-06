"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, CircleX, ImagePlus, Info, PencilLine } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import type { RateCard } from "@/lib/mock/seller-extra";
import { cn, formatINR } from "@/lib/utils";
import { AmountRows } from "../primitives";
import { CHANNEL_LABEL, type Channel } from "../shared";
import { estimateFees } from "./fees";

export interface EditableListing {
  id: string;
  title: string;
  brand: string;
  image: string;
  categoryId: string;
  subcategory: string;
  price: number;
  mrp: number;
  stock: number;
  channel: Channel;
  handlingDays: number;
  bullets: string[];
  description: string;
  keywords: string;
  hsn: string;
  gst: number;
  weightKg: number;
  dims: [number, number, number];
  origin: string;
  manufacturer: string;
  packer: string;
  imageChecks: { label: string; passed: boolean }[];
  imageCount: number;
  featuredPrice: number;
  heavy: boolean;
}

type Tab = "offer" | "details" | "images" | "compliance";
const TABS: { key: Tab; label: string }[] = [
  { key: "offer", label: "Offer" },
  { key: "details", label: "Product details" },
  { key: "images", label: "Images" },
  { key: "compliance", label: "Compliance" },
];

export function ListingEditor({ initial, rateCard, initialTab = "offer" }: { initial: EditableListing; rateCard: RateCard; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const toast = useToast();

  const set = <K extends keyof EditableListing>(k: K, val: EditableListing[K]) => setV((p) => ({ ...p, [k]: val }));
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const qcChanged = v.title !== saved.title || v.bullets.join() !== saved.bullets.join() || v.description !== saved.description;
  const priceError = v.price <= 0 ? "Enter a price above zero" : v.price > v.mrp ? `Price must be at or below M.R.P. (${formatINR(v.mrp)})` : null;
  const fees = estimateFees(rateCard, { price: v.price, categoryId: v.categoryId, channel: v.channel, heavy: v.heavy });

  function save() {
    if (priceError) {
      setTab("offer");
      toast.show(priceError);
      return;
    }
    setSaved(v);
    toast.show(qcChanged ? "Saved. Content changes were submitted as a revision; the current version stays live until it is approved." : "Saved. Price and stock changes are live within 15 minutes.");
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div role="tablist" aria-label="Listing sections" className="flex gap-6 overflow-x-auto border-b border-line px-5 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn("relative h-12 shrink-0 text-sm font-medium transition-colors", tab === t.key ? "text-ink-900" : "text-ink-500 hover:text-ink-800")}
            >
              {t.label}
              {t.key === "offer" && priceError && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-danger-500 align-middle" aria-label="Has an error" />}
              {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </div>

        <div className="p-5" role="tabpanel">
          {tab === "offer" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <Field label="Your price" htmlFor="le-price" error={priceError ?? undefined} hint={v.price > v.featuredPrice * 1.05 ? `More than 5% above the featured offer (${formatINR(v.featuredPrice)})` : "Inclusive of GST"} required>
                  <Input id="le-price" inputMode="numeric" value={v.price || ""} onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")))} aria-invalid={Boolean(priceError)} suffix="INR" />
                </Field>
                <Field label="M.R.P." htmlFor="le-mrp" hint="Printed on the pack; your price can never exceed it">
                  <Input id="le-mrp" inputMode="numeric" value={v.mrp || ""} onChange={(e) => set("mrp", Number(e.target.value.replace(/\D/g, "")))} suffix="INR" />
                </Field>
                <Field
                  label="Stock at Andheri warehouse"
                  htmlFor="le-stock"
                  hint={v.channel === "fulfilled" ? <>Managed by the fulfilment centre. <Link href="/seller/inventory" className="text-brand-700 hover:underline">Send more stock</Link></> : "Units you can ship today"}
                >
                  <Input id="le-stock" inputMode="numeric" disabled={v.channel === "fulfilled"} value={v.stock} onChange={(e) => set("stock", Number(e.target.value.replace(/\D/g, "")))} suffix="units" />
                </Field>
                <Field label="Handling time" htmlFor="le-handling" hint="Business days from order to dispatch; drives the delivery promise">
                  <Select id="le-handling" value={v.handlingDays} onChange={(e) => set("handlingDays", Number(e.target.value))} disabled={v.channel === "fulfilled"}>
                    <option value={0}>Same day (orders before 2:00 PM)</option>
                    <option value={1}>1 business day</option>
                    <option value={2}>2 business days</option>
                    <option value={3}>3 business days</option>
                  </Select>
                </Field>
                <fieldset className="sm:col-span-2">
                  <legend className="mb-2 text-[13px] font-medium text-ink-700">Fulfilment channel</legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(["fulfilled", "ship"] as Channel[]).map((c) => (
                      <label
                        key={c}
                        className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors", v.channel === c ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}
                      >
                        <input type="radio" name="le-channel" checked={v.channel === c} onChange={() => set("channel", c)} className="mt-1 accent-brand-600" />
                        <span>
                          <span className="block text-sm font-medium text-ink-900">{CHANNEL_LABEL[c]}</span>
                          <span className="block text-xs text-ink-500">
                            {c === "fulfilled" ? "Stored, packed and shipped by AltasGoods. Assured badge, faster delivery." : "You pack; AltasGoods Logistics picks up from your warehouse."}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="h-fit rounded-xl border border-line bg-ink-50/60 p-4">
                <p className="text-xs font-medium text-ink-500">You receive per unit</p>
                <p className="mt-1 text-[24px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{fees ? formatINR(fees.net) : "Not available"}</p>
                {fees && (
                  <>
                    <p className="mt-1.5 text-xs text-ink-500">{Math.round((fees.net / v.price) * 1000) / 10}% of your price, {rateCard.tier} tier</p>
                    <AmountRows className="mt-3 border-t border-line pt-2 text-[12px]" rows={fees.rows.map((r) => ({ label: r.label, value: r.value, muted: r.label.startsWith("T") }))} />
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "details" && (
            <div className="flex max-w-3xl flex-col gap-5">
              <div className="flex items-start gap-2.5 rounded-xl border border-info-100 bg-info-50/60 px-4 py-3 text-[13px] text-ink-700">
                <Info size={16} className="mt-0.5 shrink-0 text-info-600" aria-hidden="true" />
                Title, bullet and description changes go to quality review. Your current content stays live until the revision is approved, usually within 24 hours.
              </div>
              <Field label="Title" htmlFor="le-title" hint={`${v.title.length} of 200 characters. Brand, model, key spec, colour.`} required>
                <Input id="le-title" value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">Key features</p>
                <div className="flex flex-col gap-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Input
                      key={i}
                      aria-label={`Key feature ${i + 1}`}
                      placeholder={`Feature ${i + 1}`}
                      value={v.bullets[i] ?? ""}
                      onChange={(e) => {
                        const next = [...v.bullets];
                        next[i] = e.target.value;
                        set("bullets", next);
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-500">Five clear bullets lift conversion. Avoid claims like &quot;best&quot; or &quot;number one&quot;.</p>
              </div>
              <Field label="Description" htmlFor="le-desc">
                <Textarea id="le-desc" value={v.description} onChange={(e) => set("description", e.target.value)} className="min-h-32" />
              </Field>
              <Field label="Search keywords" htmlFor="le-kw" hint="Separate with commas. Include regional names; do not repeat the title or use competitor brands.">
                <Input id="le-kw" value={v.keywords} onChange={(e) => set("keywords", e.target.value)} />
              </Field>
            </div>
          )}

          {tab === "images" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
              <div className="grid content-start grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) =>
                  i < v.imageCount ? (
                    <div key={i} className="relative">
                      <ProductImage src={v.image} alt={i === 0 ? `${v.title}, main image` : `${v.title}, image ${i + 1}`} rounded="xl" className="ring-1 ring-line" />
                      {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Main</span>}
                    </div>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toast.show("Choose a JPEG, PNG or TIFF of at least 1000 px on the longest side.")}
                      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-xs text-ink-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
                    >
                      <ImagePlus size={18} aria-hidden="true" />
                      Add image
                    </button>
                  ),
                )}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink-900">Main image checks</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {v.imageChecks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2 text-[13px]">
                      {c.passed ? <CircleCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <CircleX size={16} className="mt-px shrink-0 text-danger-600" aria-hidden="true" />}
                      <span className={c.passed ? "text-ink-700" : "text-danger-700"}>
                        {c.label}
                        <span className="sr-only">{c.passed ? ", passed" : ", failed"}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-ink-500">Seven images are recommended: main on pure white, then angles, scale, in use and the box contents. No text, logos, watermarks or props that are not included.</p>
              </div>
            </div>
          )}

          {tab === "compliance" && (
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <Field label="HSN code" htmlFor="le-hsn" hint="4 to 8 digits, printed on your tax invoice" required>
                <Input id="le-hsn" value={v.hsn} onChange={(e) => set("hsn", e.target.value.replace(/\D/g, "").slice(0, 8))} />
              </Field>
              <Field label="GST rate" htmlFor="le-gst" required>
                <Select id="le-gst" value={v.gst} onChange={(e) => set("gst", Number(e.target.value))}>
                  {[0, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Country of origin" htmlFor="le-origin" required>
                <Select id="le-origin" value={v.origin} onChange={(e) => set("origin", e.target.value)}>
                  {["India", "China", "Vietnam", "Taiwan", "Thailand", "Malaysia"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Package weight (kg)" htmlFor="le-weight" hint="Declared weight; the hub re-weighs every package">
                <Input id="le-weight" inputMode="decimal" value={v.weightKg} onChange={(e) => set("weightKg", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Manufacturer name and address" htmlFor="le-mfr" className="sm:col-span-2" required>
                <Textarea id="le-mfr" value={v.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} className="min-h-16" />
              </Field>
              <Field label="Packer or importer name and address" htmlFor="le-packer" className="sm:col-span-2" hint="Required by the Legal Metrology (Packaged Commodities) Rules" required>
                <Textarea id="le-packer" value={v.packer} onChange={(e) => set("packer", e.target.value)} className="min-h-16" />
              </Field>
              <Field label="Package size (cm)" htmlFor="le-l" className="sm:col-span-2" hint={`Volumetric weight ${((v.dims[0] * v.dims[1] * v.dims[2]) / 5000).toFixed(2)} kg. Shipping is charged on the higher of actual and volumetric weight.`}>
                <div className="grid grid-cols-3 gap-2">
                  {(["Length", "Width", "Height"] as const).map((d, i) => (
                    <Input
                      key={d}
                      id={i === 0 ? "le-l" : undefined}
                      aria-label={`${d} in cm`}
                      inputMode="numeric"
                      value={v.dims[i]}
                      onChange={(e) => {
                        const next = [...v.dims] as [number, number, number];
                        next[i] = Number(e.target.value.replace(/\D/g, ""));
                        set("dims", next);
                      }}
                      suffix={d.slice(0, 1)}
                    />
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
      </Card>

      {dirty && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur-sm animate-fade-in">
          <p className="flex items-center gap-2 text-[13px] text-ink-700">
            <PencilLine size={15} className="text-brand-600" aria-hidden="true" />
            {qcChanged ? "Unsaved changes. Content edits will be reviewed before they go live." : "You have unsaved changes."}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setV(saved)}>
              Discard
            </Button>
            <Button size="sm" onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      )}
      {toast.node}
    </>
  );
}
