"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageUp, Pencil, Plus, Trash2 } from "lucide-react";
import { uploadProductImage } from "@/app/actions/admin-catalog";
import { deleteBanner, reorderBanners, saveBanner, setBannerActive, type BannerInput } from "@/app/actions/admin-system";
import { HeroCarousel } from "@/components/store/hero-carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import type { AdminBanner } from "@/lib/api/admin-system";
import { cn, formatDateTime } from "@/lib/utils";

type Placement = "HERO" | "PROMO";

type Form = {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  image: string;
  alt: string;
  align: "left" | "right";
  theme: "dark" | "light";
  position: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const blank = (): Form => ({ eyebrow: "", title: "", body: "", ctaLabel: "Shop now", href: "/deals", image: "", alt: "", align: "left", theme: "dark", position: "center", active: true, startsAt: "", endsAt: "" });
const fromBanner = (b: AdminBanner): Form => ({ ...b, startsAt: toLocalInput(b.startsAt), endsAt: toLocalInput(b.endsAt) });

/** Live, scheduled, ended or hidden, from the switch and the schedule. */
function status(b: AdminBanner) {
  const now = Date.now();
  if (!b.active) return { label: "Hidden", tone: "neutral" as const };
  if (b.startsAt && Date.parse(b.startsAt) > now) return { label: `Starts ${formatDateTime(b.startsAt)}`, tone: "info" as const };
  if (b.endsAt && Date.parse(b.endsAt) <= now) return { label: "Ended", tone: "neutral" as const };
  return { label: b.endsAt ? `Showing until ${formatDateTime(b.endsAt)}` : "Showing", tone: "success" as const };
}

function BannerEditor({ placement, banner, onClose, onSaved }: { placement: Placement; banner?: AdminBanner; onClose: () => void; onSaved: (message: string) => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => (banner ? fromBanner(banner) : blank()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const hero = placement === "HERO";

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    setUploading(true);
    const r = await uploadProductImage(form);
    setUploading(false);
    if (!r.ok) return toast.show(r.error);
    set("image", r.data.url);
  };

  const save = async () => {
    const input: BannerInput = {
      placement,
      eyebrow: f.eyebrow.trim(),
      title: f.title.trim(),
      body: f.body.trim(),
      ctaLabel: hero ? f.ctaLabel.trim() : "",
      href: f.href.trim(),
      image: f.image,
      alt: f.alt.trim(),
      align: f.align,
      theme: f.theme,
      position: f.position.trim() || "center",
      active: f.active,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    };
    setBusy(true);
    const r = await saveBanner(banner?.id ?? null, input);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    // the dialog closes, so the list shows the confirmation
    onSaved(banner ? "Banner saved" : "Banner added");
    router.refresh();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={banner ? `Edit ${hero ? "hero slide" : "promo tile"}` : `New ${hero ? "hero slide" : "promo tile"}`}
      description={hero ? "The large rotating banner at the top of the homepage." : "One of the two image tiles further down the homepage."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || uploading || !f.image}>
            {busy ? "Saving" : banner ? "Save" : "Add to homepage"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {hero && f.image && (
          <div className="overflow-hidden rounded-xl border border-line">
            <HeroCarousel slides={[{ id: "preview", image: f.image, alt: f.alt, eyebrow: f.eyebrow, title: f.title || "Your headline", body: f.body, cta: f.ctaLabel || "Shop now", href: "#", align: f.align, theme: f.theme, position: f.position }]} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-ink-700">Image</p>
            <div className="flex items-center gap-3">
              {f.image ? (
                <span className="relative block h-16 w-28 overflow-hidden rounded-lg bg-ink-100">
                  <Image src={f.image} alt="" fill sizes="112px" className="object-cover" />
                </span>
              ) : (
                <span className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-line-strong text-xs text-ink-400">No image</span>
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
              <Button variant="secondary" size="sm" icon={ImageUp} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading" : f.image ? "Replace image" : "Upload image"}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-ink-500">{errors.image ?? (hero ? "A wide photo, at least 1600 pixels across. PNG, JPG or WebP up to 4 MB." : "PNG, JPG or WebP up to 4 MB.")}</p>
          </div>
          <Field label="Small heading" htmlFor="bn-eyebrow" error={errors.eyebrow} hint="Optional, above the headline">
            <Input id="bn-eyebrow" value={f.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Diwali, live now" />
          </Field>
          <Field label="Headline" htmlFor="bn-title" required error={errors.title}>
            <Input id="bn-title" value={f.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Text" htmlFor="bn-body" error={errors.body} className="sm:col-span-2">
            <Textarea id="bn-body" className="min-h-16" maxLength={200} value={f.body} onChange={(e) => set("body", e.target.value)} />
          </Field>
          <Field label="Links to" htmlFor="bn-href" required error={errors.href} hint="A storefront path such as /deals or /c/home">
            <Input id="bn-href" value={f.href} onChange={(e) => set("href", e.target.value)} />
          </Field>
          {hero && (
            <Field label="Button text" htmlFor="bn-cta" error={errors.ctaLabel}>
              <Input id="bn-cta" value={f.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
            </Field>
          )}
          <Field label="Image description" htmlFor="bn-alt" error={errors.alt} hint="For screen readers, for example Lit diyas on a dark background" className="sm:col-span-2">
            <Input id="bn-alt" value={f.alt} onChange={(e) => set("alt", e.target.value)} />
          </Field>
          <Field label="Text position" htmlFor="bn-align">
            <Select id="bn-align" value={f.align} onChange={(e) => set("align", e.target.value as Form["align"])}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </Select>
          </Field>
          {hero && (
            <Field label="Text colour" htmlFor="bn-theme" hint="Light text suits dark photos">
              <Select id="bn-theme" value={f.theme} onChange={(e) => set("theme", e.target.value as Form["theme"])}>
                <option value="dark">Light text, dark photo</option>
                <option value="light">Dark text, light photo</option>
              </Select>
            </Field>
          )}
          <Field label="Show from" htmlFor="bn-start" error={errors.startsAt} hint="Optional">
            <Input id="bn-start" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </Field>
          <Field label="Show until" htmlFor="bn-end" error={errors.endsAt} hint="Optional">
            <Input id="bn-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={f.active} onChange={(v) => set("active", v)} label="Show on the homepage" />
          </div>
        </div>
      </div>
      {toast.node}
    </Modal>
  );
}

function Lane({ placement, title, description, items }: { placement: Placement; title: string; description: string; items: AdminBanner[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<AdminBanner | "new" | null>(null);
  const [removing, setRemoving] = useState<AdminBanner | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.show(r.error ?? "Something went wrong");
    toast.show(done);
    router.refresh();
  };
  const move = (i: number, by: -1 | 1) => {
    const ids = items.map((b) => b.id);
    [ids[i], ids[i + by]] = [ids[i + by]!, ids[i]!];
    void run(() => reorderBanners(placement, ids), "Order saved");
  };

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
        <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
          Add {placement === "HERO" ? "slide" : "tile"}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-[13px] text-ink-500">None yet. Until you add one, the homepage shows its built-in {placement === "HERO" ? "slides" : "tiles"}.</p>
      ) : (
        <ol className="divide-y divide-line">
          {items.map((b, i) => {
            const st = status(b);
            return (
              <li key={b.id} className={cn("flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center", !b.showing && "opacity-70")}>
                <span className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                  <Image src={b.image} alt="" fill sizes="96px" className="object-cover" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink-900">{b.title}</p>
                  <p className="truncate text-xs text-ink-500">
                    {b.eyebrow ? `${b.eyebrow}, ` : ""}links to {b.href}
                  </p>
                  <Badge tone={st.tone} size="sm" dot className="mt-1">
                    {st.label}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="xs" variant="ghost" icon={ArrowUp} disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${b.title} up`} />
                  <Button size="xs" variant="ghost" icon={ArrowDown} disabled={busy || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${b.title} down`} />
                  <Button size="xs" variant="ghost" icon={b.active ? EyeOff : Eye} disabled={busy} onClick={() => run(() => setBannerActive(b.id, !b.active), b.active ? "Hidden from the homepage" : "Showing on the homepage")}>
                    {b.active ? "Hide" : "Show"}
                  </Button>
                  <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(b)} aria-label={`Edit ${b.title}`}>
                    Edit
                  </Button>
                  <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving(b)} aria-label={`Remove ${b.title}`}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {editing && <BannerEditor placement={placement} banner={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={toast.show} />}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        size="sm"
        title={`Remove "${removing?.title}"?`}
        description="It comes off the homepage straight away. To take it off for a while, hide it instead."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                const b = removing!;
                setRemoving(null);
                await run(() => deleteBanner(b.id), "Removed from the homepage");
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <span />
      </Modal>
      {toast.node}
    </section>
  );
}

/** Storefront CMS: what the homepage shows, in order, with schedules. */
export function BannerStudio({ banners }: { banners: AdminBanner[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Lane placement="HERO" title="Hero slides" description="Rotate every 6 seconds at the top of the homepage, in this order" items={banners.filter((b) => b.placement === "HERO")} />
      <Lane placement="PROMO" title="Promo tiles" description="The image tiles further down the homepage; the first two showing are used" items={banners.filter((b) => b.placement === "PROMO")} />
    </div>
  );
}
