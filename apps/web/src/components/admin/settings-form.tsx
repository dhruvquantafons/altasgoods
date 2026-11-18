"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { saveSettings, type SettingsInput } from "@/app/actions/admin-system";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { areasToText, parseAreas, type AreasText } from "./delivery-areas";
import { Switch, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/** Amounts are edited in rupees and saved in paise. */
const toRupees = (p: number) => String(p / 100);
const toPaise = (r: string) => Math.round(Number(r || 0) * 100);

type Form = Omit<SettingsInput, "delivery" | "cod"> & { delivery: { fee: string; freeFrom: string }; areas: AreasText; cod: { maxOrder: string } };

function fromSettings(s: SettingsInput): Form {
  return {
    ...s,
    delivery: { fee: toRupees(s.delivery.feePaise), freeFrom: toRupees(s.delivery.freeFromPaise) },
    areas: areasToText(s.delivery.areas),
    cod: { maxOrder: toRupees(s.cod.maxOrderPaise) },
  };
}

function toSettings(f: Form, areas: SettingsInput["delivery"]["areas"]): SettingsInput {
  return {
    company: f.company,
    grievance: f.grievance,
    reviews: f.reviews,
    notice: f.notice,
    delivery: { feePaise: toPaise(f.delivery.fee), freeFromPaise: toPaise(f.delivery.freeFrom), areas },
    cod: { maxOrderPaise: toPaise(f.cod.maxOrder) },
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 px-5 pt-4 pb-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

/** Store-wide settings. Saving takes effect on the storefront and at checkout straight away. */
/** With canEdit false (an Auditor) the settings show read only, with no save bar. */
export function SettingsForm({ initial, savedNote, canEdit = true }: { initial: SettingsInput; savedNote?: string; canEdit?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => fromSettings(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(fromSettings(initial)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const dirty = JSON.stringify(form) !== saved;

  const set = <G extends keyof Form>(group: G, field: keyof Form[G], value: unknown) => setForm((f) => ({ ...f, [group]: { ...(f[group] as object), [field]: value } }));
  const err = (path: string) => errors[path];

  const text = (group: "company" | "grievance", field: string, label: string, opts: { hint?: string; type?: string; wide?: boolean } = {}) => {
    const path = `${group}.${field}`;
    return (
      <Field label={label} htmlFor={`st-${group}-${field}`} error={err(path)} hint={opts.hint} className={opts.wide ? "sm:col-span-2" : undefined}>
        <Input
          id={`st-${group}-${field}`}
          type={opts.type ?? "text"}
          value={String((form[group] as Record<string, unknown>)[field] ?? "")}
          onChange={(e) => set(group, field as never, opts.type === "number" ? Number(e.target.value) : e.target.value)}
          aria-invalid={Boolean(err(path))}
        />
      </Field>
    );
  };

  const money = (group: "delivery" | "cod", field: string, path: string, label: string, hint: string) => (
    <Field label={label} htmlFor={`st-${group}-${field}`} error={err(path)} hint={hint}>
      <div className="flex">
        <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-ink-50 px-3 text-sm text-ink-600">₹</span>
        <Input
          id={`st-${group}-${field}`}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-l-none"
          value={(form[group] as Record<string, string>)[field]}
          onChange={(e) => set(group, field as never, e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={Boolean(err(path))}
        />
      </div>
    </Field>
  );

  const areaField = (key: keyof AreasText, label: string, placeholder: string, hint: string) => (
    <Field label={label} htmlFor={`st-areas-${key}`} error={err(`delivery.areas.${key}`) ?? Object.entries(errors).find(([p]) => p.startsWith(`delivery.areas.${key}.`))?.[1]} hint={hint}>
      <Textarea
        id={`st-areas-${key}`}
        className="min-h-28 font-mono text-[13px]"
        value={form.areas[key]}
        onChange={(e) => setForm((f) => ({ ...f, areas: { ...f.areas, [key]: e.target.value } }))}
        placeholder={placeholder}
        aria-invalid={Boolean(err(`delivery.areas.${key}`))}
      />
    </Field>
  );

  const save = async () => {
    const parsed = parseAreas(form.areas);
    if (!parsed.ok) {
      setErrors(Object.fromEntries(Object.entries(parsed.errors).map(([k, v]) => [`delivery.areas.${k}`, v])));
      return toast.show("Fix the delivery areas first");
    }
    setBusy(true);
    const r = await saveSettings(toSettings(form, parsed.areas));
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    setErrors({});
    const next = fromSettings(r.data);
    setForm(next);
    setSaved(JSON.stringify(next));
    toast.show("Settings saved");
    router.refresh();
  };

  return (
    // a disabled fieldset turns every field in it off at once
    <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-6 pb-24">
      <Section title="Delivery" description="What customers pay for delivery. Checked again at checkout.">
        {money("delivery", "fee", "delivery.feePaise", "Delivery fee", "Charged on orders below the free delivery amount")}
        {money("delivery", "freeFrom", "delivery.freeFromPaise", "Free delivery from", "Orders at or above this amount ship free")}
      </Section>

      <Section
        title="Delivery areas"
        description="Where we do not deliver, where cash on delivery is off, and where delivery takes longer. One entry per line: a 6 digit pincode, or the first 2 to 5 digits to cover a whole area. Checked on the product page, the cart and at checkout."
      >
        {areaField("blocked", "Do not deliver to", "6825\n744101", "Customers cannot order to these pincodes.")}
        {areaField("noCod", "No cash on delivery", "79\n190001", "These pincodes can still pay online.")}
        {areaField("extraDays", "Extra delivery days", "6825 3\n79 4", "Prefix, a space and the days to add (0 to 15). The longest matching prefix wins.")}
      </Section>

      <Section title="Cash on delivery">
        {money("cod", "maxOrder", "cod.maxOrderPaise", "Largest cash on delivery order", "Above this total, customers must pay online")}
      </Section>

      <Section title="Reviews">
        <div className="sm:col-span-2">
          <Switch
            checked={form.reviews.autoPublish}
            onChange={(v) => set("reviews", "autoPublish", v)}
            label="Publish reviews straight away"
            description="When off, new customer reviews wait in Reviews until someone approves them."
          />
        </div>
      </Section>

      <Section title="Storefront notice" description="A bar across the top of every storefront page, for holidays, delays or maintenance.">
        <div className="sm:col-span-2">
          <Switch checked={form.notice.enabled} onChange={(v) => set("notice", "enabled", v)} label="Show the notice" />
        </div>
        <Field label="Message" htmlFor="st-notice" error={err("notice.message")} hint={`${form.notice.message.length} of 200 characters`} className="sm:col-span-2">
          <Textarea id="st-notice" className="min-h-16" maxLength={200} value={form.notice.message} onChange={(e) => set("notice", "message", e.target.value)} placeholder="For example: Orders placed on 1 and 2 November ship on 3 November." />
        </Field>
      </Section>

      <Section title="Company" description="Shown in the storefront footer, on Contact, Help, About and product pages, as the e-commerce rules require.">
        {text("company", "legalName", "Legal name", { wide: true })}
        {text("company", "registeredOffice", "Registered office", { wide: true })}
        {text("company", "cin", "CIN")}
        {text("company", "gstin", "GSTIN")}
        {text("company", "customerCare", "Customer care number")}
        {text("company", "customerCareHours", "Customer care hours")}
        {text("company", "email", "Customer care email", { type: "email" })}
        {text("company", "website", "Website")}
      </Section>

      <Section title="Grievance officer" description="Required by the Consumer Protection (E-Commerce) Rules, 2020.">
        {text("grievance", "name", "Name")}
        {text("grievance", "designation", "Designation")}
        {text("grievance", "email", "Email", { type: "email" })}
        {text("grievance", "phone", "Phone")}
        {text("grievance", "hours", "Hours", { wide: true })}
        {text("grievance", "address", "Address", { wide: true })}
        {text("grievance", "ackHours", "Acknowledge complaints within (hours)", { type: "number" })}
        {text("grievance", "resolutionDays", "Resolve complaints within (days)", { type: "number" })}
      </Section>

      <div className={cn("fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur lg:left-64", !canEdit && "hidden")}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-[13px] text-ink-500">{dirty ? "You have unsaved changes." : (savedNote ?? "All changes saved.")}</p>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="secondary" onClick={() => setForm(JSON.parse(saved) as Form)}>
                Discard
              </Button>
            )}
            <Button icon={Save} disabled={!dirty || busy} onClick={save}>
              {busy ? "Saving" : "Save settings"}
            </Button>
          </div>
        </div>
      </div>
      {toast.node}
    </fieldset>
  );
}
