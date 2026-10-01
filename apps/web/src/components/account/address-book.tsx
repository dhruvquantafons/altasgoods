"use client";

import { useState } from "react";
import { Building2, Home, MapPin, MapPinned, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

export interface BookAddress {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
  isDefault?: boolean;
  instructions?: string;
  weekendDelivery: boolean;
}

type Draft = Omit<BookAddress, "id" | "phone"> & { id?: string; mobile: string };

const TYPES: { key: BookAddress["type"]; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "work", label: "Work", icon: Building2 },
  { key: "other", label: "Other", icon: MapPin },
];

const empty: Draft = { name: "", mobile: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "", type: "home", isDefault: false, instructions: "", weekendDelivery: true };

function toDraft(a: BookAddress): Draft {
  const { phone, ...rest } = a;
  return { ...rest, mobile: phone.replace(/^\+91/, "").replace(/\D/g, "") };
}

function formatMobile(digits: string) {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function AddressBook({
  initial,
  pincodes,
  states,
}: {
  initial: BookAddress[];
  pincodes: Record<string, { city: string; state: string; locality: string }>;
  states: string[];
}) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [removing, setRemoving] = useState<BookAddress | null>(null);
  const toast = useToast();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const onPincode = (raw: string) => {
    const pin = raw.replace(/\D/g, "").slice(0, 6);
    const hit = pincodes[pin];
    setDraft((d) => ({ ...d, pincode: pin, ...(hit ? { city: hit.city, state: hit.state, line2: d.line2 || hit.locality } : {}) }));
  };

  const edit = (a?: BookAddress) => {
    setDraft(a ? toDraft(a) : { ...empty, isDefault: items.length === 0 });
    setErrors({});
    setOpen(true);
  };

  const save = () => {
    const e: typeof errors = {};
    if (draft.name.trim().length < 2) e.name = "Enter the full name of the person receiving the order.";
    if (!/^[6-9]\d{9}$/.test(draft.mobile)) e.mobile = "Enter a 10 digit mobile number.";
    if (!/^[1-9]\d{5}$/.test(draft.pincode)) e.pincode = "Enter a 6 digit pincode.";
    if (draft.line1.trim().length < 3) e.line1 = "Enter your flat, house number or building.";
    if (!draft.line2?.trim()) e.line2 = "Enter the area, street or locality.";
    if (!draft.city.trim()) e.city = "Enter the town or city.";
    if (!draft.state) e.state = "Choose a state.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const { mobile, ...rest } = draft;
    const saved: BookAddress = { ...rest, id: draft.id ?? `addr-${Date.now().toString(36)}`, phone: formatMobile(mobile) };
    setItems((list) => {
      const next = draft.id ? list.map((a) => (a.id === draft.id ? saved : a)) : [...list, saved];
      return saved.isDefault ? next.map((a) => ({ ...a, isDefault: a.id === saved.id })) : next;
    });
    setOpen(false);
    toast.show(draft.id ? "Address updated" : "Address added");
  };

  const sorted = [...items].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <button
          type="button"
          onClick={() => edit()}
          className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong bg-surface/60 p-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Plus size={20} aria-hidden="true" />
          </span>
          <span className="text-[14px] font-semibold text-ink-900">Add a new address</span>
          <span className="max-w-[16rem] text-xs text-ink-500">Pincode first, and we will fill in the city and state for you</span>
        </button>

        {sorted.map((a) => {
          const T = TYPES.find((t) => t.key === a.type)!;
          return (
            <article key={a.id} className={cn("flex flex-col rounded-[var(--radius-card)] border bg-surface p-5 shadow-card", a.isDefault ? "border-brand-200 ring-1 ring-brand-100" : "border-line")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                    <T.icon size={12} aria-hidden="true" />
                    {T.label}
                  </span>
                  {a.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100 ring-inset">Default</span>}
                </div>
              </div>
              <p className="mt-3 text-[14px] font-semibold text-ink-900">{a.name}</p>
              <address className="mt-1 text-[13px] leading-relaxed text-ink-600 not-italic">
                {a.line1}
                {a.line2 && (
                  <>
                    <br />
                    {a.line2}
                  </>
                )}
                {a.landmark && (
                  <>
                    <br />
                    {a.landmark}
                  </>
                )}
                <br />
                {a.city}, {a.state} {a.pincode}
              </address>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-600">
                <Phone size={13} className="text-ink-400" aria-hidden="true" />
                {a.phone}
              </p>
              {a.instructions && <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{a.instructions}</p>}
              <p className="mt-2 text-xs text-ink-500">{a.weekendDelivery ? "Weekend delivery available" : "No deliveries on Saturday and Sunday"}</p>
              <div className="flex-1" />
              <div className="mt-4 -mx-2 flex flex-wrap items-center gap-1 border-t border-line px-0 pt-3">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => edit(a)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoving(a)}>
                  Remove
                </Button>
                {!a.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={MapPinned}
                    className="ml-auto text-brand-700"
                    onClick={() => {
                      setItems((list) => list.map((x) => ({ ...x, isDefault: x.id === a.id })));
                      toast.show("Default address updated");
                    }}
                  >
                    Set as default
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={draft.id ? "Edit address" : "Add a new address"}
        description="We use this for delivery and for return pickups."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{draft.id ? "Save changes" : "Save address"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="ad-name" required error={errors.name} className="sm:col-span-2">
            <Input id="ad-name" autoComplete="name" value={draft.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Mobile number" htmlFor="ad-mobile" required error={errors.mobile} hint="For delivery updates and the delivery OTP">
            <div className="flex">
              <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-ink-50 px-3 text-sm text-ink-600">+91</span>
              <Input
                id="ad-mobile"
                inputMode="numeric"
                autoComplete="tel-national"
                className="min-w-0 flex-1 rounded-l-none"
                value={draft.mobile}
                onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                aria-invalid={Boolean(errors.mobile)}
              />
            </div>
          </Field>
          <Field label="Pincode" htmlFor="ad-pin" required error={errors.pincode} hint={pincodes[draft.pincode] ? `${pincodes[draft.pincode]!.locality}, ${pincodes[draft.pincode]!.city}` : "6 digits"}>
            <Input id="ad-pin" inputMode="numeric" autoComplete="postal-code" value={draft.pincode} onChange={(e) => onPincode(e.target.value)} aria-invalid={Boolean(errors.pincode)} />
          </Field>
          <Field label="Flat, house number, building" htmlFor="ad-l1" required error={errors.line1} className="sm:col-span-2">
            <Input id="ad-l1" autoComplete="address-line1" value={draft.line1} onChange={(e) => set("line1", e.target.value)} aria-invalid={Boolean(errors.line1)} />
          </Field>
          <Field label="Area, street, locality" htmlFor="ad-l2" required error={errors.line2} className="sm:col-span-2">
            <Input id="ad-l2" autoComplete="address-line2" value={draft.line2 ?? ""} onChange={(e) => set("line2", e.target.value)} aria-invalid={Boolean(errors.line2)} />
          </Field>
          <Field label="Landmark" htmlFor="ad-lm" hint="Optional, helps the associate find you" className="sm:col-span-2">
            <Input id="ad-lm" value={draft.landmark ?? ""} onChange={(e) => set("landmark", e.target.value)} placeholder="For example, near Gunjur Lake" />
          </Field>
          <Field label="Town or city" htmlFor="ad-city" required error={errors.city}>
            <Input id="ad-city" autoComplete="address-level2" value={draft.city} onChange={(e) => set("city", e.target.value)} aria-invalid={Boolean(errors.city)} />
          </Field>
          <Field label="State" htmlFor="ad-state" required error={errors.state}>
            <Select id="ad-state" value={draft.state} onChange={(e) => set("state", e.target.value)} aria-invalid={Boolean(errors.state)}>
              <option value="">Choose a state</option>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Address type</legend>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={draft.type === t.key}
                  onClick={() => set("type", t.key)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
                    draft.type === t.key ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-line-strong text-ink-700 hover:border-ink-400",
                  )}
                >
                  <t.icon size={15} aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Delivery instructions" htmlFor="ad-ins" hint="Optional. Shared with the delivery associate" className="sm:col-span-2">
            <Textarea id="ad-ins" className="min-h-20" maxLength={200} value={draft.instructions ?? ""} onChange={(e) => set("instructions", e.target.value)} placeholder="For example, leave with the security desk" />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <Checkbox
              checked={draft.weekendDelivery}
              onChange={(e) => set("weekendDelivery", e.target.checked)}
              label="Deliver on weekends"
              description={draft.type === "work" ? "Turn off if your office is closed on Saturday and Sunday" : "Saturday and Sunday deliveries where available"}
            />
            <Checkbox checked={Boolean(draft.isDefault)} onChange={(e) => set("isDefault", e.target.checked)} label="Make this my default address" />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        size="sm"
        title="Remove this address?"
        description={removing ? `${removing.name}, ${removing.line1}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setItems((list) => list.filter((a) => a.id !== removing?.id));
                setRemoving(null);
                toast.show("Address removed");
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">Orders already on their way to this address will still be delivered there.</p>
      </Modal>
      {toast.node}
    </>
  );
}
