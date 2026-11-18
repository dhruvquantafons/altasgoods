"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { saveProduct, uploadProductImage, type ProductInput } from "@/app/actions/admin-catalog";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch, useToast } from "@/components/ui/interactive";
import type { AdminBrand, AdminCategory, AdminProduct } from "@/lib/api/types";
import { gstDraft, GstFields, gstFromDraft, inheritHints, type GstDraft } from "@/components/admin/gst-fields";
import { slugProblem } from "@/lib/product-slug";
import { cn, formatINR } from "@/lib/utils";

type Spec = { group: string; items: { label: string; value: string }[] };
type Variant = { name: string; values: string };

const TAGS = [
  { key: "bestseller", label: "Bestseller" },
  { key: "new", label: "New arrival" },
  { key: "deal", label: "Deal" },
  { key: "limited", label: "Limited stock" },
] as const;

const rupees = (paise?: number) => (paise ? String(paise / 100) : "");
const toPaise = (v: string) => Math.round(Number(v || 0) * 100);

/** Create or edit a product, its price and stock, images, specifications and variants. */
/** With canEdit false (an Auditor) every field is read only and there is no save button. */
export function ProductForm({ product, categories, brands, canEdit = true }: { product?: AdminProduct; categories: AdminCategory[]; brands: AdminBrand[]; canEdit?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(product?.title ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [highlights, setHighlights] = useState((product?.highlights ?? []).join("\n"));
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [subcategory, setSubcategory] = useState(product?.subcategory ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [price, setPrice] = useState(rupees(product?.pricePaise));
  const [mrp, setMrp] = useState(rupees(product?.mrpPaise));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [deliveryDays, setDeliveryDays] = useState(String(product?.deliveryDays ?? 3));
  const [returnDays, setReturnDays] = useState(String(product?.returnWindowDays ?? 7));
  const [cod, setCod] = useState(product?.codAvailable ?? true);
  const [gst, setGst] = useState<GstDraft>(() => gstDraft(product?.gstRateBp ?? null, product?.hsn ?? null));
  const [legal, setLegal] = useState({
    manufacturer: product?.legal?.manufacturer ?? "",
    packer: product?.legal?.packer ?? "",
    importer: product?.legal?.importer ?? "",
    consumerCare: product?.legal?.consumerCare ?? "",
    countryOfOrigin: product?.legal?.countryOfOrigin ?? "",
  });
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [active, setActive] = useState(product?.active ?? true);
  const [specs, setSpecs] = useState<Spec[]>(product?.specs ?? []);
  const [variants, setVariants] = useState<Variant[]>((product?.variants ?? []).map((v) => ({ name: v.name, values: v.values.map((x) => x.label).join(", ") })));

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const archived = product?.status === "ARCHIVED";
  const slugChanged = !!product && slug !== product.slug;
  const slugError = slugChanged ? slugProblem(slug) : null;
  const category = categories.find((c) => c.id === categoryId);
  const subs = category?.subcategories ?? [];
  // what the product is taxed at when it sets nothing itself: the server's answer for the saved placement, the category's otherwise
  const inherited = (() => {
    if (product && categoryId === product.categoryId && (subcategory || subs[0]?.name || "") === product.subcategory) return product.inheritedGst;
    if (!category) return null;
    return {
      gstRateBp: category.gstRateBp ?? category.inheritedGst.gstRateBp,
      rateFrom: category.gstRateBp !== null ? category.name : category.inheritedGst.rateFrom,
      hsn: category.hsn ?? category.inheritedGst.hsn,
      hsnFrom: category.hsn !== null ? category.name : category.inheritedGst.hsnFrom,
    };
  })();
  const pricePaise = toPaise(price);
  const mrpPaise = toPaise(mrp);
  const off = mrpPaise > pricePaise && pricePaise > 0 ? Math.floor(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;
  const priceTooHigh = pricePaise > 0 && mrpPaise > 0 && pricePaise > mrpPaise;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of [...files].slice(0, 8 - images.length)) {
      const form = new FormData();
      form.set("file", file);
      const r = await uploadProductImage(form);
      if (!r.ok) toast.show(`${file.name}: ${r.error}`);
      else setImages((cur) => [...cur, r.data.url]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const move = (i: number, by: number) =>
    setImages((cur) => {
      const next = [...cur];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x!);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    if (slugError) return setErrors({ slug: slugError });
    const taxes = gstFromDraft(gst, { allowInherit: true });
    if (!taxes.ok) return setErrors({ gstRateBp: taxes.error });
    const input: ProductInput = {
      gstRateBp: taxes.gstRateBp,
      hsn: taxes.hsn,
      legal: Object.fromEntries(Object.entries(legal).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
      ...(slugChanged ? { slug } : {}),
      title: title.trim(),
      sku: sku.trim(),
      description: description.trim(),
      highlights: highlights
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean),
      images,
      categoryId,
      subcategory: subcategory || subs[0]?.name || "",
      brandId,
      pricePaise,
      mrpPaise,
      stock: Number(stock) || 0,
      deliveryDays: Number(deliveryDays) || 3,
      returnWindowDays: Number(returnDays) || 0,
      codAvailable: cod,
      tags: tags as ProductInput["tags"],
      active,
      specs: specs
        .map((g) => ({ group: g.group.trim(), items: g.items.filter((it) => it.label.trim() && it.value.trim()).map((it) => ({ label: it.label.trim(), value: it.value.trim() })) }))
        .filter((g) => g.group && g.items.length),
      variants: variants
        .filter((v) => v.name.trim() && v.values.trim())
        .map((v) => ({
          name: v.name.trim(),
          values: v.values
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((label) => ({ label, available: true })),
        })),
    };
    // an archived product is restored first; the switch is not sent for it
    if (archived) delete (input as { active?: boolean }).active;
    setSaving(true);
    const r = await saveProduct(product?.id ?? null, input);
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      setErrors(r.fields ?? {});
      return;
    }
    toast.show(product ? "Saved. The store shows the changes now." : "Product added to the store.");
    if (!product) router.push(`/admin/catalog/${r.data.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* a disabled fieldset turns every input and button in it off at once */}
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Basics" />
            <CardBody className="space-y-4">
              <Field label="Title" htmlFor="pf-title" required error={errors.title} hint="Brand, product, key detail: for example Hearth Brass Table Lamp, Warm White">
                <Input id="pf-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SKU" htmlFor="pf-sku" required error={errors.sku} hint="Your own stock code">
                  <Input id="pf-sku" value={sku} maxLength={64} onChange={(e) => setSku(e.target.value)} aria-invalid={!!errors.sku} />
                </Field>
                {product && (
                  <Field label="Store address" htmlFor="pf-slug" error={errors.slug ?? slugError ?? undefined} hint={slugChanged ? "The old address will keep working and lead to the new one" : `Shown as /p/${slug || "address"}. Lowercase letters, numbers and hyphens, 3 to 80 characters`}>
                    <Input id="pf-slug" value={slug} maxLength={80} onChange={(e) => setSlug(e.target.value.trim().toLowerCase())} aria-invalid={!!(errors.slug ?? slugError)} />
                  </Field>
                )}
              </div>
              <Field label="Description" htmlFor="pf-desc" error={errors.description}>
                <Textarea id="pf-desc" rows={5} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Field label="Highlights" htmlFor="pf-hl" hint="One per line, up to 10. Shown as bullet points next to the photos." error={errors.highlights}>
                <Textarea id="pf-hl" rows={4} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Images" description="The first image is the main photo. PNG, JPG or WebP, up to 4 MB each, at most 8." />
            <CardBody>
              {errors.images && <p className="mb-3 text-xs text-danger-600">{errors.images}</p>}
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((src, i) => (
                  <li key={src} className="group relative">
                    <ProductImage src={src} alt={`Image ${i + 1}`} rounded="lg" sizes="160px" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-ink-900/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        <Star size={11} aria-hidden="true" /> Main
                      </span>
                    )}
                    <div className="mt-1.5 flex justify-center gap-1">
                      <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move image ${i + 1} earlier`}>
                        <ArrowUp size={15} />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move image ${i + 1} later`}>
                        <ArrowDown size={15} />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setImages((cur) => cur.filter((x) => x !== src))} aria-label={`Remove image ${i + 1}`}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </li>
                ))}
                {images.length < 8 && (
                  <li>
                    <label
                      className={cn(
                        "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-line-strong text-[13px] text-ink-500 hover:border-brand-300 hover:text-brand-700",
                        uploading && "pointer-events-none opacity-60",
                      )}
                    >
                      {uploading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
                      {uploading ? "Uploading" : "Add images"}
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Add product images" />
                    </label>
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Specifications"
              description="Grouped key facts shown in the product details table."
              action={
                <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setSpecs((s) => [...s, { group: "General", items: [{ label: "", value: "" }] }])}>
                  Add group
                </Button>
              }
            />
            <CardBody className="space-y-4">
              {specs.length === 0 && <p className="text-[13px] text-ink-500">No specifications yet.</p>}
              {specs.map((g, gi) => (
                <div key={gi} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    <Input aria-label="Group name" inputSize="sm" value={g.group} placeholder="Group, for example Dimensions" onChange={(e) => setSpecs((s) => s.map((x, i) => (i === gi ? { ...x, group: e.target.value } : x)))} />
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setSpecs((s) => s.filter((_, i) => i !== gi))} aria-label={`Remove group ${g.group || gi + 1}`}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {g.items.map((it, ii) => (
                      <div key={ii} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                        <Input aria-label="Label" inputSize="sm" placeholder="Label" value={it.label} onChange={(e) => setSpecs((s) => s.map((x, i) => (i === gi ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, label: e.target.value } : y)) } : x)))} />
                        <Input aria-label="Value" inputSize="sm" placeholder="Value" value={it.value} onChange={(e) => setSpecs((s) => s.map((x, i) => (i === gi ? { ...x, items: x.items.map((y, j) => (j === ii ? { ...y, value: e.target.value } : y)) } : x)))} />
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setSpecs((s) => s.map((x, i) => (i === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)))} aria-label="Remove row">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" size="xs" variant="ghost" icon={Plus} onClick={() => setSpecs((s) => s.map((x, i) => (i === gi ? { ...x, items: [...x.items, { label: "", value: "" }] } : x)))}>
                      Add row
                    </Button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Variants"
              description="Options a shopper picks, such as Colour or Size. Separate values with commas."
              action={
                variants.length < 3 && (
                  <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setVariants((v) => [...v, { name: "", values: "" }])}>
                    Add option
                  </Button>
                )
              }
            />
            <CardBody className="space-y-2">
              {variants.length === 0 && <p className="text-[13px] text-ink-500">This product comes in one version.</p>}
              {variants.map((v, vi) => (
                <div key={vi} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                  <Input aria-label="Option name" inputSize="sm" placeholder="Colour" value={v.name} onChange={(e) => setVariants((s) => s.map((x, i) => (i === vi ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label="Option values" inputSize="sm" placeholder="Black, White, Sage" value={v.values} onChange={(e) => setVariants((s) => s.map((x, i) => (i === vi ? { ...x, values: e.target.value } : x)))} />
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setVariants((s) => s.filter((_, i) => i !== vi))} aria-label={`Remove option ${v.name || vi + 1}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Legal declarations (Legal Metrology)" description="Shown on the product page. Anything left empty shows as 'To be added by the store'." />
            <CardBody className="space-y-4">
              <Field label="Manufacturer" htmlFor="pf-legal-mfr" error={errors["legal.manufacturer"]} hint="Name and full postal address of the manufacturer">
                <Textarea id="pf-legal-mfr" rows={2} maxLength={300} value={legal.manufacturer} onChange={(e) => setLegal((l) => ({ ...l, manufacturer: e.target.value }))} />
              </Field>
              <Field label="Packer" htmlFor="pf-legal-packer" error={errors["legal.packer"]} hint="Name and address of whoever packed it. Empty uses your company details from Settings, once those are filled in">
                <Textarea id="pf-legal-packer" rows={2} maxLength={300} value={legal.packer} onChange={(e) => setLegal((l) => ({ ...l, packer: e.target.value }))} />
              </Field>
              <Field label="Importer" htmlFor="pf-legal-importer" error={errors["legal.importer"]} hint="For imported goods: name and address of the importer. Empty reads 'Not applicable' for goods made in India">
                <Textarea id="pf-legal-importer" rows={2} maxLength={300} value={legal.importer} onChange={(e) => setLegal((l) => ({ ...l, importer: e.target.value }))} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Consumer care" htmlFor="pf-legal-care" error={errors["legal.consumerCare"]} hint="Email and phone number a customer can reach about this product">
                  <Input id="pf-legal-care" maxLength={300} value={legal.consumerCare} onChange={(e) => setLegal((l) => ({ ...l, consumerCare: e.target.value }))} />
                </Field>
                <Field label="Country of origin" htmlFor="pf-legal-origin" error={errors["legal.countryOfOrigin"]} hint="For example India">
                  <Input id="pf-legal-origin" maxLength={300} value={legal.countryOfOrigin} onChange={(e) => setLegal((l) => ({ ...l, countryOfOrigin: e.target.value }))} />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Status" />
            <CardBody>
              {archived ? (
                <p className="text-[13px] text-ink-600">Archived: hidden from the store. Restore it below to put it back on sale.</p>
              ) : (
                <Switch checked={active} onChange={setActive} label="On sale" description={active ? "Shown in the store and can be ordered" : "Hidden from the store; existing orders are not affected"} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Price and stock" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Selling price" htmlFor="pf-price" required error={errors.pricePaise ?? (priceTooHigh ? "More than the MRP" : undefined)}>
                  <Input id="pf-price" type="number" min="1" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="₹" aria-invalid={priceTooHigh || !!errors.pricePaise} />
                </Field>
                <Field label="MRP" htmlFor="pf-mrp" required error={errors.mrpPaise}>
                  <Input id="pf-mrp" type="number" min="1" step="0.01" inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} suffix="₹" />
                </Field>
              </div>
              {pricePaise > 0 && !priceTooHigh && (
                <p className="text-[13px] text-ink-600">
                  Shoppers see {formatINR(pricePaise / 100)}
                  {off > 0 && <span className="font-medium text-success-700"> ({off}% off {formatINR(mrpPaise / 100)})</span>}, inclusive of GST.
                </p>
              )}
              <Field label="Units in stock" htmlFor="pf-stock" error={errors.stock} hint={Number(stock) === 0 ? "Shown as out of stock" : undefined}>
                <Input id="pf-stock" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where it appears" />
            <CardBody className="space-y-4">
              <Field label="Category" htmlFor="pf-cat" required error={errors.categoryId}>
                <Select
                  id="pf-cat"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategory("");
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Subcategory"
                htmlFor="pf-sub"
                required
                error={errors.subcategory}
                hint={
                  subs.length ? undefined : (
                    <>
                      Add subcategories on the{" "}
                      <Link href="/admin/categories" className="font-medium text-brand-700 hover:underline">
                        Categories
                      </Link>{" "}
                      page.
                    </>
                  )
                }
              >
                {subs.length ? (
                  <Select id="pf-sub" value={subcategory || subs[0]!.name} onChange={(e) => setSubcategory(e.target.value)}>
                    {subs.map((s) => (
                      <option key={s.id}>{s.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input id="pf-sub" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
                )}
              </Field>
              <Field
                label="Brand"
                htmlFor="pf-brand"
                required
                error={errors.brandId}
                hint={
                  <>
                    Missing one?{" "}
                    <Link href="/admin/brands" className="font-medium text-brand-700 hover:underline">
                      Add a brand
                    </Link>
                  </>
                }
              >
                <Select id="pf-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-invalid={!!errors.brandId}>
                  <option value="">Choose a brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-700">Tags</legend>
                <div className="grid grid-cols-2 gap-2">
                  {TAGS.map((t) => (
                    <Checkbox key={t.key} label={t.label} checked={tags.includes(t.key)} onChange={(e) => setTags((cur) => (e.target.checked ? [...cur, t.key] : cur.filter((x) => x !== t.key)))} />
                  ))}
                </div>
            </fieldset>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Delivery and returns" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery days" htmlFor="pf-dd" error={errors.deliveryDays}>
                <Input id="pf-dd" type="number" min="1" max="30" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} />
              </Field>
              <Field label="Return window" htmlFor="pf-rw" error={errors.returnWindowDays} hint="Days; 0 means not returnable">
                <Input id="pf-rw" type="number" min="0" max="90" value={returnDays} onChange={(e) => setReturnDays(e.target.value)} />
              </Field>
            </div>
            <Checkbox label="Pay on delivery available" checked={cod} onChange={(e) => setCod(e.target.checked)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="GST" description="Prices include GST. Leave both empty to use the category's rate and code." />
          <CardBody className="space-y-4">
            <GstFields idPrefix="pf" value={gst} onChange={setGst} inherit={inherited ? inheritHints(inherited) : { rate: "Inherits the category's rate", hsn: "Inherits the category's HSN code" }} rateError={errors.gstRateBp} hsnError={errors.hsn} />
          </CardBody>
        </Card>

        {error && (
          <p role="alert" className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {canEdit && (
            <Button type="submit" disabled={saving || uploading || priceTooHigh || !!slugError} className="flex-1">
              {saving ? "Saving" : product ? "Save changes" : "Add product"}
            </Button>
          )}
          {product && active && !archived && (
            <Link href={`/p/${product.slug}`} target="_blank" className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-800 hover:bg-ink-50">
              View in store
            </Link>
          )}
        </div>
      </div>
      </fieldset>
      {toast.node}
    </form>
  );
}
