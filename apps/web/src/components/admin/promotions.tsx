"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Pause, Pencil, Play, Plus, Search, Trash2 } from "lucide-react";
import { deleteCoupon, deleteSale, saveCoupon, saveSale, setCouponStatus, setSaleStatus, type CouponInput, type SaleInput } from "@/app/actions/admin-system";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import type { AdminCoupon, AdminSale } from "@/lib/api/admin-system";

/** "2026-11-01T10:00" in the browser's time zone, for datetime-local inputs. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : "");
const inDays = (days: number, hour = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

type Option = { id: string; name: string };

/* ---------------------------------- Sales ---------------------------------- */

type SaleForm = {
  name: string;
  headline: string;
  description: string;
  discountPercent: string;
  scope: "ALL" | "CATEGORIES" | "PRODUCTS";
  categoryIds: string[];
  productIds: string[];
  startsAt: string;
  endsAt: string;
  bannerImage: string;
};

const blankSale = (): SaleForm => ({
  name: "",
  headline: "",
  description: "",
  discountPercent: "20",
  scope: "CATEGORIES",
  categoryIds: [],
  productIds: [],
  // starts now unless changed, so a new sale goes live as soon as it is saved
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: toLocalInput(inDays(7, 23)),
  bannerImage: "",
});

const fromSale = (s: AdminSale): SaleForm => ({
  name: s.name,
  headline: s.headline,
  description: s.description,
  discountPercent: String(s.discountPercent),
  scope: s.scope,
  categoryIds: s.categoryIds,
  productIds: s.productIds,
  startsAt: toLocalInput(s.startsAt),
  endsAt: toLocalInput(s.endsAt),
  bannerImage: s.bannerImage ?? "",
});

function Picker({ label, options, selected, onChange }: { label: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => options.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 200), [options, q]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-700">
        {label} <span className="font-normal text-ink-500">({selected.length} chosen)</span>
      </legend>
      {options.length > 8 && <Input icon={Search} inputSize="sm" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" aria-label={`Filter ${label.toLowerCase()}`} />}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-line p-2">
        <ul className="grid gap-1 sm:grid-cols-2">
          {shown.map((o) => (
            <li key={o.id}>
              <Checkbox checked={selected.includes(o.id)} onChange={() => toggle(o.id)} label={o.name} />
            </li>
          ))}
        </ul>
      </div>
    </fieldset>
  );
}

export function SaleEditor({ sale, categories, products }: { sale?: AdminSale; categories: Option[]; products: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<SaleForm>(blankSale);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = <K extends keyof SaleForm>(k: K, v: SaleForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const start = () => {
    setF(sale ? fromSale(sale) : blankSale());
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const input: SaleInput = {
      name: f.name.trim(),
      headline: f.headline.trim(),
      description: f.description.trim(),
      discountPercent: Number(f.discountPercent),
      scope: f.scope,
      categoryIds: f.scope === "CATEGORIES" ? f.categoryIds : [],
      productIds: f.scope === "PRODUCTS" ? f.productIds : [],
      startsAt: fromLocalInput(f.startsAt),
      endsAt: fromLocalInput(f.endsAt),
      bannerImage: f.bannerImage.trim() || null,
    };
    setBusy(true);
    const r = await saveSale(sale?.id ?? null, input);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    setOpen(false);
    toast.show(sale ? "Sale saved" : "Sale created");
    router.refresh();
  };

  return (
    <>
      {sale ? (
        <Button size="xs" variant="ghost" icon={Pencil} onClick={start} aria-label={`Edit ${sale.name}`}>
          Edit
        </Button>
      ) : (
        <Button icon={Plus} onClick={start}>
          New sale
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={sale ? `Edit ${sale.name}` : "New sale"}
        description="A percentage off everything the sale covers, from its start to its end. Prices change on the storefront within a minute and are charged at checkout."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving" : sale ? "Save sale" : "Create sale"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="sl-name" required error={errors.name} className="sm:col-span-2">
            <Input id="sl-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="For example Diwali Dhamaka" />
          </Field>
          <Field label="Headline" htmlFor="sl-headline" error={errors.headline} hint="One line for the homepage banner" className="sm:col-span-2">
            <Input id="sl-headline" value={f.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Up to 40% off home and kitchen" />
          </Field>
          <Field label="Discount" htmlFor="sl-pct" required error={errors.discountPercent} hint="1 to 90 percent">
            <div className="flex">
              <Input id="sl-pct" inputMode="numeric" className="min-w-0 flex-1 rounded-r-none" value={f.discountPercent} onChange={(e) => set("discountPercent", e.target.value.replace(/\D/g, "").slice(0, 2))} />
              <span className="inline-flex h-10 items-center rounded-r-lg border border-l-0 border-line-strong bg-ink-50 px-3 text-sm text-ink-600">% off</span>
            </div>
          </Field>
          <Field label="Applies to" htmlFor="sl-scope" error={errors.scope}>
            <Select id="sl-scope" value={f.scope} onChange={(e) => set("scope", e.target.value as SaleForm["scope"])}>
              <option value="ALL">Everything in the store</option>
              <option value="CATEGORIES">Chosen categories</option>
              <option value="PRODUCTS">Chosen products</option>
            </Select>
          </Field>
          {f.scope === "CATEGORIES" && <Picker label="Categories" options={categories} selected={f.categoryIds} onChange={(ids) => set("categoryIds", ids)} />}
          {f.scope === "PRODUCTS" && <Picker label="Products" options={products} selected={f.productIds} onChange={(ids) => set("productIds", ids)} />}
          <Field label="Starts" htmlFor="sl-start" required error={errors.startsAt}>
            <Input id="sl-start" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="sl-end" required error={errors.endsAt}>
            <Input id="sl-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
          <Field label="Banner image" htmlFor="sl-banner" error={errors.bannerImage} hint="Optional. An image path, for example /images/banners/hero-festive.jpg, or one uploaded in Storefront CMS" className="sm:col-span-2">
            <Input id="sl-banner" value={f.bannerImage} onChange={(e) => set("bannerImage", e.target.value)} placeholder="/images/banners/hero-festive.jpg" />
          </Field>
          <Field label="Description" htmlFor="sl-desc" error={errors.description} hint="Optional. Shown on the deals page" className="sm:col-span-2">
            <Textarea id="sl-desc" className="min-h-16" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

export function SaleActions({ sale }: { sale: AdminSale }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.show(r.error ?? "Something went wrong");
    toast.show(done);
    setConfirming(false);
    router.refresh();
  };
  return (
    <>
      {sale.status === "ACTIVE" ? (
        <Button size="xs" variant="ghost" icon={Pause} disabled={busy} onClick={() => run(() => setSaleStatus(sale.id, "PAUSED"), "Sale paused")}>
          Pause
        </Button>
      ) : (
        <Button size="xs" variant="ghost" icon={Play} disabled={busy} onClick={() => run(() => setSaleStatus(sale.id, "ACTIVE"), "Sale resumed")}>
          Resume
        </Button>
      )}
      <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setConfirming(true)} aria-label={`Delete ${sale.name}`}>
        Delete
      </Button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        size="sm"
        title={`Delete ${sale.name}?`}
        description="Prices go back to normal straight away. Orders already placed keep the price they were charged."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => deleteSale(sale.id), "Sale deleted")}>
              Delete sale
            </Button>
          </>
        }
      >
        <span />
      </Modal>
      {toast.node}
    </>
  );
}

/* --------------------------------- Coupons --------------------------------- */

type CouponForm = {
  code: string;
  description: string;
  type: "PERCENT" | "FLAT";
  value: string;
  maxDiscount: string;
  minOrder: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  showOnStorefront: boolean;
};

const blankCoupon = (): CouponForm => ({
  code: "",
  description: "",
  type: "PERCENT",
  value: "10",
  maxDiscount: "",
  minOrder: "0",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: toLocalInput(inDays(30, 23)),
  usageLimit: "",
  showOnStorefront: true,
});

const fromCoupon = (c: AdminCoupon): CouponForm => ({
  code: c.code,
  description: c.description,
  type: c.type,
  value: String(c.type === "PERCENT" ? c.value : c.value / 100),
  maxDiscount: c.maxDiscountPaise === null ? "" : String(c.maxDiscountPaise / 100),
  minOrder: String(c.minOrderPaise / 100),
  startsAt: toLocalInput(c.startsAt),
  endsAt: toLocalInput(c.endsAt),
  usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
  showOnStorefront: c.showOnStorefront,
});

const rupees = (v: string) => Math.round(Number(v || 0) * 100);

export function CouponEditor({ coupon }: { coupon?: AdminCoupon }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<CouponForm>(blankCoupon);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const start = () => {
    setF(coupon ? fromCoupon(coupon) : blankCoupon());
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const input: CouponInput = {
      code: f.code.trim(),
      description: f.description.trim(),
      type: f.type,
      value: f.type === "PERCENT" ? Number(f.value) : rupees(f.value),
      maxDiscountPaise: f.type === "PERCENT" && f.maxDiscount ? rupees(f.maxDiscount) : null,
      minOrderPaise: rupees(f.minOrder),
      startsAt: fromLocalInput(f.startsAt),
      endsAt: fromLocalInput(f.endsAt),
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      showOnStorefront: f.showOnStorefront,
    };
    setBusy(true);
    const r = await saveCoupon(coupon?.code ?? null, input);
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    setOpen(false);
    toast.show(coupon ? "Coupon saved" : "Coupon created");
    router.refresh();
  };

  return (
    <>
      {coupon ? (
        <Button size="xs" variant="ghost" icon={Pencil} onClick={start} aria-label={`Edit ${coupon.code}`}>
          Edit
        </Button>
      ) : (
        <Button icon={Plus} onClick={start}>
          New coupon
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={coupon ? `Edit ${coupon.code}` : "New coupon"}
        description="Customers type the code in the cart or at checkout. It applies on top of sale prices."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving" : coupon ? "Save coupon" : "Create coupon"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="cp-code" required error={errors.code} hint={coupon ? "The code cannot change" : "Letters and numbers, for example DIWALI500"}>
            <Input id="cp-code" value={f.code} disabled={!!coupon} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          </Field>
          <Field label="Type" htmlFor="cp-type">
            <Select id="cp-type" value={f.type} onChange={(e) => set("type", e.target.value as CouponForm["type"])}>
              <option value="PERCENT">Percentage off</option>
              <option value="FLAT">Fixed amount off</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="cp-desc" required error={errors.description} hint="What customers see, for example ₹500 off orders over ₹5,000" className="sm:col-span-2">
            <Input id="cp-desc" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field label={f.type === "PERCENT" ? "Percent off" : "Amount off (₹)"} htmlFor="cp-value" required error={errors.value}>
            <Input id="cp-value" inputMode="decimal" value={f.value} onChange={(e) => set("value", e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          {f.type === "PERCENT" && (
            <Field label="Most it can take off (₹)" htmlFor="cp-max" error={errors.maxDiscountPaise} hint="Optional cap">
              <Input id="cp-max" inputMode="decimal" value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value.replace(/[^\d.]/g, ""))} />
            </Field>
          )}
          <Field label="Minimum order (₹)" htmlFor="cp-min" error={errors.minOrderPaise}>
            <Input id="cp-min" inputMode="decimal" value={f.minOrder} onChange={(e) => set("minOrder", e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="Total uses allowed" htmlFor="cp-limit" error={errors.usageLimit} hint="Leave empty for no limit">
            <Input id="cp-limit" inputMode="numeric" value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Starts" htmlFor="cp-start" required error={errors.startsAt}>
            <Input id="cp-start" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="cp-end" required error={errors.endsAt}>
            <Input id="cp-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={f.showOnStorefront} onChange={(v) => set("showOnStorefront", v)} label="Show on the storefront" description="Listed in the cart, at checkout and on the deals page. Hidden codes still work when typed." />
          </div>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

export function CouponActions({ coupon }: { coupon: AdminCoupon }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.show(r.error ?? "Something went wrong");
    toast.show(done);
    router.refresh();
  };
  return (
    <>
      {coupon.status === "ACTIVE" ? (
        <Button size="xs" variant="ghost" icon={Pause} disabled={busy} onClick={() => run(() => setCouponStatus(coupon.code, "PAUSED"), `${coupon.code} paused`)}>
          Pause
        </Button>
      ) : (
        <Button size="xs" variant="ghost" icon={Play} disabled={busy} onClick={() => run(() => setCouponStatus(coupon.code, "ACTIVE"), `${coupon.code} resumed`)}>
          Resume
        </Button>
      )}
      {coupon.usageCount === 0 && (
        <Button size="xs" variant="ghost" icon={Trash2} disabled={busy} onClick={() => run(() => deleteCoupon(coupon.code), `${coupon.code} deleted`)} aria-label={`Delete ${coupon.code}`}>
          Delete
        </Button>
      )}
      {toast.node}
    </>
  );
}
