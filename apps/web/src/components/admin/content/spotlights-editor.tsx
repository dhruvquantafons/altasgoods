"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ImageUp, Pencil, Search, Trash2 } from "lucide-react";
import { uploadProductImage } from "@/app/actions/admin-catalog";
import { deleteSpotlight, findProducts, reorderSpotlights, saveSpotlight } from "@/app/actions/admin-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import type { ContentSpotlight } from "@/lib/api/admin-content";
import { ConfirmRemove, Lane, MoveButtons, useAction } from "./bits";

type Product = { id: string; title: string; brand: string; image: string; status: string };

function SpotlightEditor({ item, readOnly, onClose, onSaved }: { item?: ContentSpotlight; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [tagline, setTagline] = useState(item?.tagline ?? "");
  const [tone, setTone] = useState(item?.tone ?? "#f1efea");
  const [image, setImage] = useState(item?.image ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [product, setProduct] = useState<{ id: string; title: string } | null>(item?.productId ? { id: item.productId, title: item.productTitle ?? item.productId } : null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Product[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // search as you type, after a short pause
  useEffect(() => {
    if (readOnly || q.trim().length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      const r = await findProducts(q);
      if (!stale && r.ok) setHits(r.data);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, readOnly]);

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    setUploading(true);
    const r = await uploadProductImage(form);
    setUploading(false);
    if (!r.ok) return toast.show(r.error);
    setImage(r.data.url);
  };

  const save = async () => {
    setBusy(true);
    const r = await saveSpotlight(item?.id ?? null, { brand: brand.trim(), tagline: tagline.trim(), productId: product?.id ?? null, tone, image, active });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(item ? "Spotlight saved" : "Spotlight added");
    onClose();
  };

  const shown = q.trim().length >= 2 ? hits : [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.brand}` : "New brand spotlight"}
      description="A card in Brands in the spotlight on the homepage. It links to the brand store of the product you pick."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || uploading || !brand.trim() || !image || !product}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="sp-brand" required error={errors.brand}>
          <Input id="sp-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label="Card colour" htmlFor="sp-tone" error={errors.tone} hint="Background of the card">
          <div className="flex items-center gap-2">
            <input id="sp-tone" type="color" value={tone} onChange={(e) => setTone(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-white p-1" />
            <Input value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Card colour code" className="flex-1" />
          </div>
        </Field>
        <Field label="Tagline" htmlFor="sp-tag" error={errors.tagline} className="sm:col-span-2">
          <Input id="sp-tag" value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-ink-700">
            Product <span className="text-danger-600">*</span>
          </p>
          {product ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-50 px-3 py-2 text-sm">
              <span className="truncate text-ink-900">{product.title}</span>
              {!readOnly && (
                <Button size="xs" variant="ghost" onClick={() => setProduct(null)}>
                  Change
                </Button>
              )}
            </div>
          ) : (
            <>
              <Input icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products by name or SKU" aria-label="Search products" />
              {shown.length > 0 && (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setProduct({ id: p.id, title: p.title });
                          if (!brand.trim()) setBrand(p.brand);
                          if (!image) setImage(p.image.startsWith("/") ? p.image : "");
                          setQ("");
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink-900">{p.title}</span>
                          <span className="block text-xs text-ink-500">{p.brand}</span>
                        </span>
                        {p.status !== "ACTIVE" && <Badge size="sm">{p.status.toLowerCase()}</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="mt-1.5 text-xs text-ink-500">{errors.productId ?? "The card shows only while this product is on sale. Archiving or switching it off hides the card."}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-ink-700">Image</p>
          <div className="flex items-center gap-3">
            {image ? (
              <span className="relative block h-16 w-20 overflow-hidden rounded-lg bg-ink-100">
                <Image src={image} alt="" fill sizes="80px" className="object-cover" />
              </span>
            ) : (
              <span className="flex h-16 w-20 items-center justify-center rounded-lg border border-dashed border-line-strong text-xs text-ink-400">No image</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
            <Button variant="secondary" size="sm" icon={ImageUp} disabled={uploading || readOnly} onClick={() => fileRef.current?.click()}>
              {uploading ? "Uploading" : image ? "Replace image" : "Upload image"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">{errors.image ?? "A 4:3 picture works best. PNG, JPG or WebP up to 4 MB."}</p>
        </div>
        <div className="sm:col-span-2">
          <Switch checked={active} onChange={setActive} label="Show on the homepage" />
        </div>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

/** Brands in the spotlight on the homepage. */
export function SpotlightsEditor({ items, canEdit }: { items: ContentSpotlight[]; canEdit: boolean }) {
  const { run, busy, toast, router } = useAction();
  const [editing, setEditing] = useState<ContentSpotlight | "new" | null>(null);
  const [removing, setRemoving] = useState<ContentSpotlight | null>(null);
  const move = (i: number, by: -1 | 1) => {
    const ids = items.map((s) => s.id);
    [ids[i], ids[i + by]] = [ids[i + by]!, ids[i]!];
    void run(() => reorderSpotlights(ids), "Order saved");
  };
  const why = (s: ContentSpotlight) => {
    if (!s.active) return { label: "Hidden", tone: "neutral" as const };
    if (!s.productId) return { label: "Needs a product", tone: "warning" as const };
    if (s.productStatus !== "LIVE") return { label: `Product is ${s.productStatus?.toLowerCase()}`, tone: "warning" as const };
    return { label: "Showing", tone: "success" as const };
  };
  return (
    <Lane title="Brand spotlights" description="Cards in Brands in the spotlight on the homepage, in this order" onAdd={canEdit ? () => setEditing("new") : undefined} addLabel="Add spotlight">
      <ol className="divide-y divide-line">
        {items.map((s, i) => {
          const st = why(s);
          return (
            <li key={s.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <span className="relative block h-14 w-[72px] shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: s.tone }}>
                <Image src={s.image} alt="" fill sizes="72px" className="object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{s.brand}</p>
                <p className="truncate text-xs text-ink-500">
                  {s.tagline ? `${s.tagline}, ` : ""}
                  {s.productTitle ?? "no product"}
                </p>
                <Badge tone={st.tone} size="sm" dot className="mt-1">
                  {st.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {canEdit && <MoveButtons index={i} count={items.length} busy={busy} label={s.brand} onMove={(by) => move(i, by)} />}
                {canEdit && (
                  <Button size="xs" variant="ghost" icon={s.active ? EyeOff : Eye} disabled={busy} onClick={() => run(() => saveSpotlight(s.id, { brand: s.brand, tagline: s.tagline, productId: s.productId, tone: s.tone, image: s.image, active: !s.active }), s.active ? "Hidden from the homepage" : "Showing on the homepage")}>
                    {s.active ? "Hide" : "Show"}
                  </Button>
                )}
                <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(s)} aria-label={`${canEdit ? "Edit" : "View"} ${s.brand}`}>
                  {canEdit ? "Edit" : "View"}
                </Button>
                {canEdit && (
                  <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving(s)} aria-label={`Remove ${s.brand}`}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">None yet. The homepage hides the section.</li>}
      </ol>
      {editing && <SpotlightEditor item={editing === "new" ? undefined : editing} readOnly={!canEdit} onClose={() => setEditing(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} />}
      {removing && (
        <ConfirmRemove
          title={`Remove "${removing.brand}"?`}
          description="It comes off the homepage straight away. To take it off for a while, hide it instead."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing;
            setRemoving(null);
            await run(() => deleteSpotlight(r.id), "Spotlight removed");
          }}
        />
      )}
      {toast.node}
    </Lane>
  );
}
