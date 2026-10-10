"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Info, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

export interface SettingsData {
  returnWindows: { categoryId: string; name: string; days: number; resolution: string }[];
  cod: { maxOrderValue: number; maxUndelivered: number; pincodeRtoThreshold: number; refusalsToDisable: number };
  delivery: { freeAbove: number; fee: number; platformFee: number };
  grievance: { name: string; designation: string; email: string; phone: string; address: string };
  maintenance: { enabled: boolean; message: string; audience: string };
}

const SECTIONS = [
  { id: "returns", label: "Return windows" },
  { id: "payments", label: "Payments and COD" },
  { id: "delivery", label: "Delivery and fees" },
  { id: "grievance", label: "Grievance officer" },
  { id: "maintenance", label: "Maintenance banner" },
];

const INITIAL_METHODS: Record<string, boolean> = { UPI: true, "Credit and debit cards": true, "Net banking": true, Wallets: true, "Card EMI": true, "Cash on delivery": true, "AltasGoods Pay Later": false };

function Rupee(props: ComponentProps<typeof Input>) {
  return <Input type="number" min={0} suffix="INR" {...props} />;
}

/** Platform settings with a sticky save bar; money-impacting changes go to a Finance Manager (maker-checker). */
export function SettingsForm({ data }: { data: SettingsData }) {
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [maintenance, setMaintenance] = useState(data.maintenance.enabled);
  const [message, setMessage] = useState(data.maintenance.message);
  const [methods, setMethods] = useState(INITIAL_METHODS);
  const { show, node } = useToast();
  const touch = () => setDirty(true);

  const section = (id: string, title: string, description: string, money: boolean, children: ReactNode) => (
    <Card id={id} className="scroll-mt-24">
      <CardHeader
        title={title}
        description={description}
        action={money ? <span className="rounded-md border border-warning-100 bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-warning-700">Maker-checker</span> : undefined}
      />
      <div className="px-5 pt-4 pb-5">{children}</div>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-24 flex flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-white hover:text-ink-900">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <form key={version} onChange={touch} onSubmit={(e) => e.preventDefault()} className="flex max-w-3xl min-w-0 flex-col gap-6 pb-24">
        {section(
          "returns",
          "Return windows",
          "Counted from the delivery date. Damaged, defective or wrong items can always be reported within the window or 7 days, whichever is longer.",
          false,
          <div className="divide-y divide-line rounded-xl border border-line">
            {data.returnWindows.map((r) => (
              <div key={r.categoryId} className="flex items-center gap-4 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink-900">{r.name}</p>
                  <p className="truncate text-xs text-ink-500">{r.resolution}</p>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-ink-600">
                  <span className="sr-only">Return window for {r.name} in days</span>
                  <Input type="number" min={0} max={30} defaultValue={r.days} inputSize="sm" className="w-20 text-right" />
                  days
                </label>
              </div>
            ))}
          </div>,
        )}

        {section(
          "payments",
          "Payments and cash on delivery",
          "No COD surcharge or payment handling fee is ever charged to customers (dark patterns guidelines).",
          true,
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="COD maximum order value" hint="Orders above this are prepaid only">
                <Rupee defaultValue={data.cod.maxOrderValue} />
              </Field>
              <Field label="Undelivered COD shipments allowed" hint="Per customer at one time">
                <Input type="number" min={1} defaultValue={data.cod.maxUndelivered} />
              </Field>
              <Field label="Disable COD for a pincode above" hint="30 day COD RTO rate">
                <Input type="number" min={5} max={60} defaultValue={data.cod.pincodeRtoThreshold} suffix="%" />
              </Field>
              <Field label="COD refusals before COD is disabled" hint="In 90 days; re-enabled after 3 prepaid deliveries">
                <Input type="number" min={1} defaultValue={data.cod.refusalsToDisable} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-700">Payment methods at checkout</p>
              <div className="grid gap-x-6 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-2">
                {Object.entries(methods).map(([m, on]) => (
                  <Switch
                    key={m}
                    label={m}
                    description={m === "AltasGoods Pay Later" ? "Phase 2, NBFC partner onboarding" : undefined}
                    checked={on}
                    disabled={m === "AltasGoods Pay Later"}
                    onChange={(v) => {
                      setMethods((x) => ({ ...x, [m]: v }));
                      touch();
                    }}
                  />
                ))}
              </div>
            </div>
          </div>,
        )}

        {section(
          "delivery",
          "Delivery and platform fees",
          "Any customer fee must be shown on the product page and cart from the first price display; no drip pricing.",
          true,
          <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Free delivery above" hint="Per seller shipment">
              <Rupee defaultValue={data.delivery.freeAbove} />
            </Field>
            <Field label="Delivery fee below" hint="Per shipment">
              <Rupee defaultValue={data.delivery.fee} />
            </Field>
            <Field label="Platform fee per order" hint="Currently not charged">
              <Rupee defaultValue={data.delivery.platformFee} />
            </Field>
          </div>,
        )}

        {section(
          "grievance",
          "Grievance officer",
          "Required by the Consumer Protection (E-Commerce) Rules, 2020. Shown in the storefront footer and Help. Complaints are acknowledged within 48 hours and resolved within 1 month.",
          false,
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input defaultValue={data.grievance.name} />
            </Field>
            <Field label="Designation">
              <Input defaultValue={data.grievance.designation} />
            </Field>
            <Field label="Email">
              <Input type="email" defaultValue={data.grievance.email} />
            </Field>
            <Field label="Phone">
              <Input defaultValue={data.grievance.phone} />
            </Field>
            <Field label="Postal address" className="sm:col-span-2">
              <Textarea defaultValue={data.grievance.address} className="min-h-16" />
            </Field>
          </div>,
        )}

        {section(
          "maintenance",
          "Maintenance banner",
          "A site-wide notice above the storefront header. Use for planned downtime or payment degradation only.",
          false,
          <div className="flex flex-col gap-4">
            <Switch
              label="Show the banner"
              description="Visible on web and in the apps within 2 minutes"
              checked={maintenance}
              onChange={(v) => {
                setMaintenance(v);
                touch();
              }}
            />
            <Field label="Message">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-16" maxLength={160} />
            </Field>
            <Field label="Audience">
              <Select defaultValue={data.maintenance.audience}>
                <option>Everyone</option>
                <option>App users only</option>
                <option>Web users only</option>
              </Select>
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-500">Preview</p>
              <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]", maintenance ? "bg-ink-900 text-white" : "border border-dashed border-line-strong text-ink-500")}>
                <Megaphone size={15} className="shrink-0" aria-hidden="true" />
                {maintenance ? message : "Banner is off"}
              </div>
            </div>
          </div>,
        )}
      </form>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-md lg:left-64">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-ink-600">
              <Info size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
              Unsaved changes. Money-impacting settings go to a Finance Manager for approval before they take effect.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // the form key resets uncontrolled fields; controlled ones (switches, banner text) are reset here
                setVersion((v) => v + 1);
                setMethods(INITIAL_METHODS);
                setMaintenance(data.maintenance.enabled);
                setMessage(data.maintenance.message);
                setDirty(false);
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDirty(false);
                show("Saved. Changes needing approval were sent to Finance.");
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      )}
      {node}
    </div>
  );
}
