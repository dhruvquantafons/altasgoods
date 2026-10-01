"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, ImagePlus, Lock, PackagePlus, Plus, Search, ShieldCheck, X } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { Stepper } from "@/components/ui/misc";
import type { RateCard } from "@/lib/mock/seller-extra";
import { LISTING_STATUS } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";
import { AmountRows } from "../primitives";
import { CHANNEL_LABEL, type Channel } from "../shared";
import { estimateFees } from "./fees";

export interface CatalogEntry {
  id: string;
  title: string;
  image: string;
  brand: string;
  category: string;
  categoryId: string;
  subcategory: string;
  bsin: string;
  price: number;
  mrp: number;
  sellers: number;
  mine: boolean;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  commission: number;
  image?: string;
  children: { id: string; name: string }[];
}

const GATED_BRANDS = ["Meridian", "Keystone"];

const ATTRIBUTES: Record<string, { key: string; label: string; placeholder?: string; required?: boolean }[]> = {
  mobiles: [
    { key: "model", label: "Model number", placeholder: "NT-A5G-256", required: true },
    { key: "ram", label: "RAM", placeholder: "12 GB", required: true },
    { key: "storage", label: "Storage", placeholder: "256 GB", required: true },
    { key: "display", label: "Display size (inch)", placeholder: "6.7" },
    { key: "bis", label: "BIS registration number (CRS)", placeholder: "R-41012345", required: true },
  ],
  electronics: [
    { key: "model", label: "Model number", placeholder: "AUR-STD-ANC", required: true },
    { key: "connectivity", label: "Connectivity", placeholder: "Bluetooth 5.4, USB-C" },
    { key: "battery", label: "Battery life (hours)", placeholder: "40" },
    { key: "warranty", label: "Warranty (months)", placeholder: "12", required: true },
  ],
  appliances: [
    { key: "model", label: "Model number", required: true },
    { key: "wattage", label: "Wattage (W)", placeholder: "1500", required: true },
    { key: "capacity", label: "Capacity (litres)", placeholder: "12" },
    { key: "warranty", label: "Warranty (years)", placeholder: "2", required: true },
  ],
  home: [
    { key: "material", label: "Material", placeholder: "Linen", required: true },
    { key: "dimensions", label: "Dimensions (cm)", placeholder: "45 x 45" },
    { key: "care", label: "Care instructions", placeholder: "Machine wash cold" },
  ],
  fashion: [
    { key: "fabric", label: "Fabric", placeholder: "100% cotton", required: true },
    { key: "fit", label: "Fit", placeholder: "Regular" },
    { key: "pattern", label: "Pattern", placeholder: "Solid" },
  ],
  beauty: [
    { key: "net", label: "Net quantity", placeholder: "30 ml", required: true },
    { key: "skin", label: "Skin type", placeholder: "All" },
    { key: "shelf", label: "Shelf life (months)", placeholder: "24", required: true },
  ],
  grocery: [
    { key: "net", label: "Net quantity", placeholder: "500 g", required: true },
    { key: "fssai", label: "FSSAI licence number", placeholder: "11521999000123", required: true },
    { key: "shelf", label: "Best before (months)", placeholder: "9" },
  ],
  books: [
    { key: "author", label: "Author", required: true },
    { key: "isbn", label: "ISBN", placeholder: "978-93-xxxxx", required: true },
    { key: "language", label: "Language", placeholder: "English" },
  ],
  sports: [
    { key: "material", label: "Material", required: true },
    { key: "size", label: "Size", placeholder: "6 mm" },
    { key: "warranty", label: "Warranty (months)", placeholder: "6" },
  ],
  toys: [
    { key: "age", label: "Age range", placeholder: "3 years and up", required: true },
    { key: "bis", label: "BIS licence (IS 9873)", placeholder: "CM/L-1234567", required: true },
    { key: "material", label: "Material" },
  ],
};

const THEMES: Record<string, string[]> = {
  none: [],
  colour: ["Colour"],
  size: ["Size"],
  colour_size: ["Colour", "Size"],
  storage: ["Storage"],
};

type Flow = "start" | "offer" | "create" | "done";

const CREATE_STEPS = [
  { label: "Category" },
  { label: "Details" },
  { label: "Images" },
  { label: "Variants" },
  { label: "Offer" },
  { label: "Compliance" },
  { label: "Review" },
];

interface OfferState {
  price: number;
  mrp: number;
  stock: number;
  channel: Channel;
  handling: number;
  sku: string;
}

function OfferForm({ v, set, rateCard, categoryId, mrpLocked, heavy }: { v: OfferState; set: (p: Partial<OfferState>) => void; rateCard: RateCard; categoryId: string; mrpLocked?: boolean; heavy?: boolean }) {
  const fees = estimateFees(rateCard, { price: v.price, categoryId, channel: v.channel, heavy });
  const priceError = v.price && v.mrp && v.price > v.mrp ? "Your price must be at or below the M.R.P." : undefined;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <Field label="Your price" htmlFor="w-price" required error={priceError} hint="Inclusive of GST">
          <Input id="w-price" inputMode="numeric" value={v.price || ""} onChange={(e) => set({ price: Number(e.target.value.replace(/\D/g, "")) })} suffix="INR" aria-invalid={Boolean(priceError)} />
        </Field>
        <Field label="M.R.P." htmlFor="w-mrp" required hint={mrpLocked ? "From the catalog product" : "As printed on the package"}>
          <Input id="w-mrp" inputMode="numeric" value={v.mrp || ""} disabled={mrpLocked} onChange={(e) => set({ mrp: Number(e.target.value.replace(/\D/g, "")) })} suffix="INR" />
        </Field>
        <Field label="Seller SKU" htmlFor="w-sku" hint="Your own code; shown on labels and reports">
          <Input id="w-sku" value={v.sku} onChange={(e) => set({ sku: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} />
        </Field>
        <Field label={v.channel === "fulfilled" ? "Units to send to a fulfilment centre" : "Stock at Andheri warehouse"} htmlFor="w-stock" required>
          <Input id="w-stock" inputMode="numeric" value={v.stock || ""} onChange={(e) => set({ stock: Number(e.target.value.replace(/\D/g, "")) })} suffix="units" />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium text-ink-700">Fulfilment channel</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(["ship", "fulfilled"] as Channel[]).map((c) => (
              <label key={c} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors", v.channel === c ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                <input type="radio" name="w-channel" checked={v.channel === c} onChange={() => set({ channel: c })} className="mt-1 accent-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-ink-900">{CHANNEL_LABEL[c]}</span>
                  <span className="block text-xs text-ink-500">{c === "fulfilled" ? "BluBuy stores, packs and ships. Pick and pack ₹14 per unit." : "You pack, BluBuy Logistics picks up. No storage fee."}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {v.channel === "ship" && (
          <Field label="Handling time" htmlFor="w-handling" hint="Orders before 2:00 PM count as day 0" className="sm:col-span-2">
            <Select id="w-handling" value={v.handling} onChange={(e) => set({ handling: Number(e.target.value) })}>
              <option value={0}>Same day</option>
              <option value={1}>1 business day</option>
              <option value={2}>2 business days</option>
              <option value={3}>3 business days</option>
            </Select>
          </Field>
        )}
      </div>
      <div className="h-fit rounded-xl border border-line bg-ink-50/60 p-4">
        <p className="text-xs font-medium text-ink-500">You receive per unit</p>
        <p className="mt-1 text-[24px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{fees ? formatINR(fees.net) : "Enter a price"}</p>
        {fees ? (
          <>
            <p className="mt-1.5 text-xs text-ink-500">{fees.pct === 0 ? "0% commission on items up to ₹999" : `${fees.pct}% commission for this category`}</p>
            <AmountRows className="mt-3 border-t border-line pt-2 text-[12px]" rows={fees.rows.map((r) => ({ label: r.label, value: r.value, muted: r.label.startsWith("T") }))} />
          </>
        ) : (
          <p className="mt-2 text-xs text-ink-500">The fee estimate updates as you type.</p>
        )}
      </div>
    </div>
  );
}

function StepFooter({ onBack, onNext, nextLabel = "Continue", disabled, hint }: { onBack?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; hint?: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button variant="ghost" icon={ArrowLeft} onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {hint && <p className="text-xs text-ink-500 sm:text-right">{hint}</p>}
        <Button iconRight={nextLabel === "Continue" ? ArrowRight : undefined} onClick={onNext} disabled={disabled}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[17px] font-semibold text-ink-900">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-ink-500">{description}</p>}
    </div>
  );
}

export function AddProductWizard({
  catalog,
  categories,
  approved,
  rateCard,
  initialFlow = "start",
}: {
  catalog: CatalogEntry[];
  categories: CategoryNode[];
  approved: string[];
  rateCard: RateCard;
  initialFlow?: "start" | "create";
}) {
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [offerStep, setOfferStep] = useState(0);
  const [step, setStep] = useState(0);
  const [doneKind, setDoneKind] = useState<"offer" | "new">("offer");
  const toast = useToast();

  const [topCat, setTopCat] = useState<string>(categories[1]?.id ?? categories[0]!.id);
  const [leaf, setLeaf] = useState<string>("");
  const [details, setDetails] = useState({ title: "", brand: "", bullets: ["", "", ""], description: "", attrs: {} as Record<string, string> });
  const [images, setImages] = useState<number>(0);
  const [theme, setTheme] = useState("none");
  const [values, setValues] = useState<Record<string, string[]>>({ Colour: ["Graphite", "Silver"], Size: ["S", "M", "L"], Storage: ["128 GB", "256 GB"] });
  // the value being typed and any duplicate warning, per axis (colour and size each have their own box)
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const [valueNote, setValueNote] = useState<Record<string, string>>({});
  const [offer, setOffer] = useState<OfferState>({ price: 0, mrp: 0, stock: 0, channel: "ship", handling: 1, sku: "APX-NEW-0001" });
  const [compliance, setCompliance] = useState({ hsn: "", gst: 18, origin: "India", manufacturer: "", packer: "Apex Retail Private Limited, Unit 14, Marol Industrial Estate, Andheri East, Mumbai 400072", gtin: "", exempt: false });
  const [agree, setAgree] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 6);
    return catalog.filter((c) => `${c.title} ${c.brand} ${c.bsin} ${c.subcategory}`.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, query]);

  const cat = categories.find((c) => c.id === topCat)!;
  const leafName = cat.children.find((c) => c.id === leaf)?.name;
  const attrs = ATTRIBUTES[cat.slug] ?? [];
  const catGated = !approved.includes(cat.id);
  const variantAxes = THEMES[theme] ?? [];
  const combos = variantAxes.length === 0 ? [] : variantAxes.length === 1 ? (values[variantAxes[0]!] ?? []).map((a) => [a]) : (values[variantAxes[0]!] ?? []).flatMap((a) => (values[variantAxes[1]!] ?? []).map((b) => [a, b]));

  const setOfferPartial = (p: Partial<OfferState>) => setOffer((o) => ({ ...o, ...p }));
  const offerValid = offer.price > 0 && offer.mrp > 0 && offer.price <= offer.mrp && offer.stock > 0;

  const valid = [
    Boolean(leaf) && !catGated,
    details.title.trim().length >= 10 && details.brand.trim().length > 0 && details.bullets.filter((b) => b.trim()).length >= 2 && attrs.filter((a) => a.required).every((a) => (details.attrs[a.key] ?? "").trim()),
    images >= 1,
    theme === "none" || combos.length > 0,
    offerValid,
    /^\d{4,8}$/.test(compliance.hsn) && compliance.manufacturer.trim().length > 5 && (compliance.exempt || /^\d{8,14}$/.test(compliance.gtin)),
    agree,
  ];

  function startOffer(p: CatalogEntry) {
    setPicked(p);
    setOffer({ price: p.price, mrp: p.mrp, stock: 0, channel: "ship", handling: 1, sku: `APX-${p.brand.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-NEW` });
    setOfferStep(0);
    setFlow("offer");
  }

  /* --------------------------------- Done -------------------------------- */
  if (flow === "done")
    return (
      <Card className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-success-50 text-success-600">
            <CircleCheck size={24} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink-900">{doneKind === "offer" ? "Your offer is approved" : "Submitted for review"}</h2>
          <div className="mt-2">
            <StatusBadge meta={doneKind === "offer" ? LISTING_STATUS.live : LISTING_STATUS.pending_review} />
          </div>
          <p className="mt-3 max-w-md text-sm text-ink-600">
            {doneKind === "offer"
              ? `Your offer on ${picked?.title.split(/[,(]/)[0]} passed the automatic checks and goes live within 15 minutes once stock is available.`
              : "Our catalog team reviews new products within 24 hours: images, attributes, compliance and brand. We will notify you, and you can track it under Listings, In review."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink href={doneKind === "offer" ? "/seller/catalog?tab=live" : "/seller/catalog?tab=pending_review"} variant="secondary">
              Go to listings
            </ButtonLink>
            <Button
              icon={Plus}
              onClick={() => {
                setFlow("start");
                setStep(0);
                setQuery("");
              }}
            >
              Add another product
            </Button>
          </div>
        </div>
      </Card>
    );

  /* ------------------------------- Start -------------------------------- */
  if (flow === "start")
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="p-5">
            <SectionTitle title="Find your product in the BluBuy catalog" description="If it already exists, you only add an offer: price, stock and fulfilment. No new content or review needed." />
            <Input icon={Search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by product name, brand, model or BSIN (for example B0E6D981QD)" aria-label="Search the BluBuy catalog" inputSize="lg" />
            <p className="mt-2 text-xs text-ink-500">{query ? `${results.length} ${results.length === 1 ? "match" : "matches"}` : "Popular in your categories"}</p>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {results.map((p) => {
              const brandGated = GATED_BRANDS.includes(p.brand);
              const catLocked = !approved.includes(p.categoryId);
              return (
                <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <ProductImage src={p.image} alt="" size={56} rounded="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{p.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                      <span>{p.brand}</span>
                      <span className="font-mono">{p.bsin}</span>
                      <span>{p.subcategory}</span>
                      <span>
                        {p.sellers} {p.sellers === 1 ? "seller" : "sellers"}, from {formatINR(p.price)}
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.mine && <Badge tone="success" size="sm">You sell this</Badge>}
                      {catLocked && (
                        <Badge tone="warning" size="sm" icon={Lock}>
                          {p.category} needs approval
                        </Badge>
                      )}
                      {!catLocked && brandGated && (
                        <Badge tone="warning" size="sm" icon={Lock}>
                          Brand authorisation needed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {p.mine ? (
                      <ButtonLink href={`/seller/catalog/${p.id}`} size="sm" variant="secondary">
                        Edit your offer
                      </ButtonLink>
                    ) : catLocked || brandGated ? (
                      <Button size="sm" variant="secondary" onClick={() => toast.show(catLocked ? `Approval request for ${p.category} opened. Upload the documents listed in Settings.` : `Upload a ${p.brand} authorisation letter or distributor invoices to request approval.`)}>
                        Request approval
                      </Button>
                    ) : (
                      <Button size="sm" variant="soft" onClick={() => startOffer(p)}>
                        Sell this product
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-ink-500">
                Nothing matches &quot;{query}&quot;. Check the BSIN or create a new product.
              </li>
            )}
          </ul>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <div className="p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <PackagePlus size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[15px] font-semibold text-ink-900">Not in the catalog?</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
                Create a new product with its category, attributes, images, variants, offer and compliance details. New products are reviewed before they go live.
              </p>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => setFlow("create")}>
                Create a new product
              </Button>
            </div>
          </Card>
          <Card>
            <div className="p-5">
              <h2 className="text-[15px] font-semibold text-ink-900">Adding many products?</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-600">Use a category template to upload up to 5,000 rows at once.</p>
              <Link href="/seller/catalog/bulk" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                Go to bulk upload <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </Card>
        </div>
        {toast.node}
      </div>
    );

  /* --------------------------- Offer on existing ------------------------- */
  if (flow === "offer" && picked)
    return (
      <Card>
        <div className="border-b border-line px-5 py-5">
          <Stepper steps={[{ label: "Choose product" }, { label: "Your offer" }, { label: "Review" }]} current={offerStep + 1} className="mx-auto max-w-lg" />
        </div>
        <div className="flex items-center gap-4 border-b border-line bg-ink-50/50 px-5 py-4">
          <ProductImage src={picked.image} alt="" size={52} rounded="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{picked.title}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              <span className="font-mono">{picked.bsin}</span>, {picked.subcategory}, {picked.sellers} other {picked.sellers === 1 ? "seller" : "sellers"}
            </p>
          </div>
          <button type="button" onClick={() => setFlow("start")} className="ml-auto shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
            Change
          </button>
        </div>
        <div className="p-5">
          {offerStep === 0 ? (
            <OfferForm v={offer} set={setOfferPartial} rateCard={rateCard} categoryId={picked.categoryId} mrpLocked heavy={["Laptops", "Monitors"].includes(picked.subcategory)} />
          ) : (
            <div className="max-w-xl">
              <SectionTitle title="Review your offer" description="Offers on existing products are approved automatically when they pass price and stock checks." />
              <AmountRows
                rows={[
                  { label: "Your price", value: offer.price },
                  { label: "M.R.P.", value: offer.mrp },
                ]}
              />
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[13px]">
                <dt className="text-ink-500">Stock</dt>
                <dd className="text-right text-ink-900">{offer.stock} units</dd>
                <dt className="text-ink-500">Channel</dt>
                <dd className="text-right text-ink-900">{CHANNEL_LABEL[offer.channel]}</dd>
                <dt className="text-ink-500">Seller SKU</dt>
                <dd className="text-right font-mono text-ink-900">{offer.sku}</dd>
              </dl>
            </div>
          )}
        </div>
        <StepFooter
          onBack={() => (offerStep === 0 ? setFlow("start") : setOfferStep(0))}
          onNext={() => {
            if (offerStep === 0) setOfferStep(1);
            else {
              setDoneKind("offer");
              setFlow("done");
            }
          }}
          nextLabel={offerStep === 0 ? "Continue" : "Create offer"}
          disabled={!offerValid}
          hint={!offerValid ? "Enter a price at or below M.R.P. and stock above zero" : undefined}
        />
      </Card>
    );

  /* ----------------------------- Create new ------------------------------ */
  const hints = [
    catGated ? `${cat.name} needs category approval first` : "Choose a leaf category",
    "Add a title of 10 or more characters, the brand, 2 key features and the required attributes",
    "Add at least one image",
    "Add at least one value for each variation",
    "Enter a price at or below M.R.P. and stock above zero",
    "Enter the HSN code, manufacturer and a GTIN (or claim an exemption)",
    "Accept the declaration to submit",
  ];

  return (
    <Card>
      <div className="overflow-x-auto border-b border-line px-5 py-5 scrollbar-none">
        <Stepper steps={CREATE_STEPS} current={step} className="min-w-[36rem]" />
      </div>
      <div className="p-5">
        {step === 0 && (
          <>
            <SectionTitle title="Choose a category" description="Pick the most specific category. It decides the attributes, commission and any approval needed." />
            <div className="grid overflow-hidden rounded-xl border border-line md:grid-cols-2">
              <ul className="max-h-80 overflow-y-auto border-b border-line scrollbar-thin md:border-r md:border-b-0" aria-label="Top categories">
                {categories.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTopCat(c.id);
                        setLeaf("");
                      }}
                      className={cn("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] transition-colors", topCat === c.id ? "bg-brand-50 font-medium text-brand-800" : "text-ink-700 hover:bg-ink-50")}
                    >
                      <span>{c.name}</span>
                      {!approved.includes(c.id) && <Lock size={13} className="text-ink-400" aria-label="Approval needed" />}
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="max-h-80 overflow-y-auto scrollbar-thin" aria-label={`${cat.name} subcategories`}>
                {cat.children.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setLeaf(c.id)}
                      className={cn("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] transition-colors", leaf === c.id ? "bg-brand-50 font-medium text-brand-800" : "text-ink-700 hover:bg-ink-50")}
                    >
                      {c.name}
                      {leaf === c.id && <Check size={15} className="text-brand-600" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <span className="text-ink-500">
                Selected: <span className="font-medium text-ink-900">{leafName ? `${cat.name} > ${leafName}` : "None yet"}</span>
              </span>
              <span className="text-ink-500">
                Commission: <span className="font-medium text-ink-900">0% up to ₹999, then {cat.commission}%</span>
              </span>
            </div>
            {catGated && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-warning-100 bg-warning-50/80 px-4 py-3 sm:flex-row sm:items-center">
                <Lock size={16} className="shrink-0 text-warning-700" aria-hidden="true" />
                <p className="flex-1 text-[13px] text-ink-700">
                  <span className="font-semibold text-warning-700">{cat.name} needs approval.</span> You are approved for Electronics, Mobiles, Appliances and Home. Apply with the required licences to list here.
                </p>
                <Button size="sm" variant="secondary" onClick={() => toast.show(`Approval request for ${cat.name} started. Upload documents in Settings.`)}>
                  Request approval
                </Button>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <div className="max-w-3xl">
            <SectionTitle title="Product details" description={`Attributes for ${leafName ?? cat.name}. Required fields are marked.`} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product title" htmlFor="c-title" required className="sm:col-span-2" hint={`${details.title.length} of 200. Brand, model, key spec, colour.`}>
                <Input id="c-title" value={details.title} maxLength={200} onChange={(e) => setDetails({ ...details, title: e.target.value })} placeholder="Auralis Studio Mini ANC Wireless Headphones, Graphite" />
              </Field>
              <Field label="Brand" htmlFor="c-brand" required hint="Selling another company's brand needs their authorisation">
                <Input id="c-brand" value={details.brand} onChange={(e) => setDetails({ ...details, brand: e.target.value })} placeholder="Auralis" />
              </Field>
              {attrs.map((a) => (
                <Field key={a.key} label={a.label} htmlFor={`c-${a.key}`} required={a.required}>
                  <Input id={`c-${a.key}`} value={details.attrs[a.key] ?? ""} placeholder={a.placeholder} onChange={(e) => setDetails({ ...details, attrs: { ...details.attrs, [a.key]: e.target.value } })} />
                </Field>
              ))}
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[13px] font-medium text-ink-700">
                  Key features<span className="ml-0.5 text-danger-600">*</span>
                </p>
                <div className="flex flex-col gap-2">
                  {details.bullets.map((b, i) => (
                    <Input
                      key={i}
                      aria-label={`Key feature ${i + 1}`}
                      value={b}
                      placeholder={["40 hour battery with fast charging", "Hybrid active noise cancellation", "Multipoint Bluetooth 5.4"][i] ?? `Feature ${i + 1}`}
                      onChange={(e) => setDetails({ ...details, bullets: details.bullets.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                  ))}
                </div>
                {details.bullets.length < 5 && (
                  <button type="button" onClick={() => setDetails({ ...details, bullets: [...details.bullets, ""] })} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                    <Plus size={14} aria-hidden="true" /> Add a feature
                  </button>
                )}
              </div>
              <Field label="Description" htmlFor="c-desc" className="sm:col-span-2">
                <Textarea id="c-desc" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} placeholder="What it is, who it is for, what is in the box." />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_17rem]">
            <div>
              <SectionTitle title="Images" description="Upload up to 8 images. The first is the main image shown in search." />
              <div className="grid content-start grid-cols-3 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) =>
                  i < images ? (
                    <div key={i} className="relative">
                      <ProductImage src={cat.image ?? "/images/products/headphones-studio.jpg"} alt={`Uploaded image ${i + 1}`} rounded="xl" className="ring-1 ring-line" />
                      {i === 0 && <span className="absolute top-2 left-2 rounded-md bg-ink-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Main</span>}
                      <button type="button" onClick={() => setImages(images - 1)} className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-ink-600 shadow-xs hover:text-danger-600" aria-label={`Remove image ${i + 1}`}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : i === images ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImages(images + 1)}
                      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      <ImagePlus size={19} aria-hidden="true" />
                      {i === 0 ? "Add main image" : "Add image"}
                    </button>
                  ) : (
                    <div key={i} className="aspect-square rounded-xl border border-dashed border-line" aria-hidden="true" />
                  ),
                )}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-ink-50/60 p-4">
              <p className="text-[13px] font-semibold text-ink-900">Image guidelines</p>
              <ul className="mt-3 flex flex-col gap-2.5 text-[13px] text-ink-700">
                {["Pure white background for the main image", "1000 px or more on the longest side", "Product fills 85% of the frame", "JPEG, PNG or TIFF; no text, logos or watermarks", "Real photos, not illustrations"].map((g) => (
                  <li key={g} className="flex gap-2">
                    <CircleCheck size={15} className={cn("mt-0.5 shrink-0", images ? "text-success-600" : "text-ink-300")} aria-hidden="true" />
                    {g}
                  </li>
                ))}
              </ul>
              {images > 0 && <p className="mt-3 text-xs text-success-700">Main image passed all automatic checks.</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-3xl">
            <SectionTitle title="Variants" description="Each variant gets its own BSIN, SKU, price and stock. Skip this if the product comes in one version." />
            <Field label="Variation theme" htmlFor="c-theme">
              <Select id="c-theme" value={theme} onChange={(e) => setTheme(e.target.value)} className="sm:max-w-xs">
                <option value="none">No variants</option>
                <option value="colour">Colour</option>
                <option value="size">Size</option>
                <option value="colour_size">Colour and size</option>
                <option value="storage">Storage</option>
              </Select>
            </Field>
            {variantAxes.map((axis) => (
              <div key={axis} className="mt-5">
                <p className="mb-2 text-[13px] font-medium text-ink-700">{axis} values</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(values[axis] ?? []).map((val) => (
                    <span key={val} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pr-1.5 pl-3 text-[13px] text-ink-800">
                      {val}
                      <button type="button" onClick={() => setValues({ ...values, [axis]: (values[axis] ?? []).filter((x) => x !== val) })} className="rounded-full p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label={`Remove ${val}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = (newValue[axis] ?? "").trim().replace(/\s+/g, " ");
                      if (!v) return setValueNote({ ...valueNote, [axis]: "Type a value first" });
                      // values double as variant names and keys, so an exact repeat (any case) is not added twice
                      const existing = (values[axis] ?? []).find((x) => x.toLowerCase() === v.toLowerCase());
                      if (existing) return setValueNote({ ...valueNote, [axis]: `${existing} is already added` });
                      setValues({ ...values, [axis]: [...(values[axis] ?? []), v] });
                      setNewValue({ ...newValue, [axis]: "" });
                      setValueNote({ ...valueNote, [axis]: "" });
                    }}
                  >
                    <Input
                      inputSize="sm"
                      value={newValue[axis] ?? ""}
                      onChange={(e) => {
                        setNewValue({ ...newValue, [axis]: e.target.value });
                        if (valueNote[axis]) setValueNote({ ...valueNote, [axis]: "" });
                      }}
                      placeholder={`Add ${axis.toLowerCase()}`}
                      aria-label={`Add ${axis.toLowerCase()} value`}
                      className="w-36"
                    />
                    <Button type="submit" size="sm" variant="ghost" icon={Plus}>
                      Add
                    </Button>
                  </form>
                </div>
                {valueNote[axis] && (
                  <p className="mt-1.5 text-xs text-warning-700" role="status">
                    {valueNote[axis]}
                  </p>
                )}
              </div>
            ))}
            {combos.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[30rem] text-left text-[13px]">
                  <thead className="bg-ink-50/70 text-[12px] text-ink-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Variant</th>
                      <th className="px-4 py-2.5 font-medium">Seller SKU</th>
                      <th className="px-4 py-2.5 text-right font-medium">Price</th>
                      <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {combos.map((c, i) => (
                      <tr key={JSON.stringify(c)}>
                        <td className="px-4 py-2.5 text-ink-900">{c.join(", ")}</td>
                        <td className="px-4 py-2.5 font-mono text-ink-700">{`APX-NEW-${String(i + 1).padStart(2, "0")}`}</td>
                        <td className="px-4 py-2.5 text-right text-ink-500">Set in Offer</td>
                        <td className="px-4 py-2.5 text-right text-ink-500">Set in Offer</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <>
            <SectionTitle title="Offer" description={combos.length ? `Applies to all ${combos.length} variants. You can fine-tune each variant after approval.` : "Price, stock and how you will fulfil orders."} />
            <OfferForm v={offer} set={setOfferPartial} rateCard={rateCard} categoryId={cat.id} />
          </>
        )}

        {step === 5 && (
          <div className="max-w-3xl">
            <SectionTitle title="Compliance" description="Needed for your tax invoice and the Legal Metrology declarations shown on the product page." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="HSN code" htmlFor="c-hsn" required hint="4 to 8 digits">
                <Input id="c-hsn" inputMode="numeric" value={compliance.hsn} onChange={(e) => setCompliance({ ...compliance, hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="8518" />
              </Field>
              <Field label="GST rate" htmlFor="c-gst" required>
                <Select id="c-gst" value={compliance.gst} onChange={(e) => setCompliance({ ...compliance, gst: Number(e.target.value) })}>
                  {[0, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="GTIN (EAN or UPC)" htmlFor="c-gtin" required={!compliance.exempt} hint={compliance.exempt ? "Exemption requested for unbranded or private label goods" : "8 to 14 digits from the barcode"}>
                <Input id="c-gtin" inputMode="numeric" disabled={compliance.exempt} value={compliance.gtin} onChange={(e) => setCompliance({ ...compliance, gtin: e.target.value.replace(/\D/g, "").slice(0, 14) })} />
              </Field>
              <Field label="Country of origin" htmlFor="c-origin" required>
                <Select id="c-origin" value={compliance.origin} onChange={(e) => setCompliance({ ...compliance, origin: e.target.value })}>
                  {["India", "China", "Vietnam", "Taiwan", "Thailand"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Checkbox
                  checked={compliance.exempt}
                  onChange={(e) => setCompliance({ ...compliance, exempt: e.target.checked, gtin: "" })}
                  label="This product has no barcode"
                  description="Request a GTIN exemption for unbranded, handmade or private label products"
                />
              </div>
              <Field label="Manufacturer name and address" htmlFor="c-mfr" required className="sm:col-span-2">
                <Textarea id="c-mfr" className="min-h-16" value={compliance.manufacturer} onChange={(e) => setCompliance({ ...compliance, manufacturer: e.target.value })} />
              </Field>
              <Field label="Packer or importer name and address" htmlFor="c-packer" className="sm:col-span-2">
                <Textarea id="c-packer" className="min-h-16" value={compliance.packer} onChange={(e) => setCompliance({ ...compliance, packer: e.target.value })} />
              </Field>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="max-w-3xl">
            <SectionTitle title="Review and submit" description="New products are checked by the BluBuy catalog team, usually within 24 hours." />
            <div className="divide-y divide-line rounded-xl border border-line">
              {[
                { s: 0, label: "Category", value: `${cat.name} > ${leafName}` },
                { s: 1, label: "Title", value: details.title },
                { s: 1, label: "Brand", value: details.brand },
                { s: 2, label: "Images", value: `${images} uploaded` },
                { s: 3, label: "Variants", value: combos.length ? `${combos.length} (${variantAxes.join(" and ").toLowerCase()})` : "None" },
                { s: 4, label: "Offer", value: `${formatINR(offer.price)} (M.R.P. ${formatINR(offer.mrp)}), ${offer.stock} units, ${CHANNEL_LABEL[offer.channel]}` },
                { s: 5, label: "Compliance", value: `HSN ${compliance.hsn}, GST ${compliance.gst}%, made in ${compliance.origin}` },
              ].map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-ink-500">{r.label}</p>
                    <p className="mt-0.5 text-[13px] text-ink-900">{r.value}</p>
                  </div>
                  <button type="button" onClick={() => setStep(r.s)} className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
                    Edit
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-ink-50 px-4 py-3">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
              <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label="I confirm the product is genuine, the information is accurate, and I have the right to sell this brand in India." />
            </div>
          </div>
        )}
      </div>
      <StepFooter
        onBack={() => (step === 0 ? setFlow("start") : setStep(step - 1))}
        onNext={() => {
          if (step < 6) setStep(step + 1);
          else {
            setDoneKind("new");
            setFlow("done");
          }
        }}
        nextLabel={step < 6 ? "Continue" : "Submit for review"}
        disabled={!valid[step]}
        hint={!valid[step] ? hints[step] : undefined}
      />
      {toast.node}
    </Card>
  );
}
