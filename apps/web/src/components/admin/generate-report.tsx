"use client";

import { useId, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Radio, Select } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";

export interface ReportOption {
  id: string;
  name: string;
  formats: string[];
  group: string;
}

const PERIODS = ["September 2026", "August 2026", "Quarter 2, FY 2026-27 (Jul to Sep)", "Last 7 days", "Custom range"];

/** Button plus dialog to generate or schedule a report export. */
export function GenerateReport({
  reports,
  reportId,
  label = "Generate",
  variant = "secondary",
  size = "sm",
  defaultOpen = false,
}: {
  reports: ReportOption[];
  reportId?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm";
  defaultOpen?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState(reportId ?? reports[0]!.id);
  const [period, setPeriod] = useState(PERIODS[0]!);
  const [delivery, setDelivery] = useState<"download" | "email" | "schedule">("download");
  const { show, node } = useToast();
  const report = reports.find((r) => r.id === selected)!;
  const tax = report.group === "Tax and compliance";

  return (
    <>
      <Button variant={variant} size={size} icon={variant === "primary" ? FileDown : undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Generate report"
        description="Exports run in the background and appear under Recent exports. Personal data is masked unless your role allows export."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                show(delivery === "schedule" ? `${report.name} scheduled` : `${report.name} for ${period} queued`);
              }}
            >
              {delivery === "schedule" ? "Create schedule" : "Generate"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Report" htmlFor={`${id}-r`}>
            <Select id={`${id}-r`} value={selected} onChange={(e) => setSelected(e.target.value)}>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Period" htmlFor={`${id}-p`}>
              <Select id={`${id}-p`} value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Format" htmlFor={`${id}-f`}>
              <Select id={`${id}-f`} key={report.id} defaultValue={report.formats[0]}>
                {report.formats.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </Select>
            </Field>
          </div>
          {period === "Custom range" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="From" htmlFor={`${id}-from`}>
                <Input id={`${id}-from`} type="date" defaultValue="2026-09-01" />
              </Field>
              <Field label="To" htmlFor={`${id}-to`}>
                <Input id={`${id}-to`} type="date" defaultValue="2026-09-30" />
              </Field>
            </div>
          )}
          <Field label={tax ? "GSTIN or state" : "Scope"} htmlFor={`${id}-s`} hint={tax ? "AltasGoods files GSTR-8 per state registration" : undefined}>
            <Select id={`${id}-s`} defaultValue="all">
              <option value="all">{tax ? "All state registrations" : "Whole marketplace"}</option>
              {tax ? ["Karnataka", "Maharashtra", "Delhi", "Uttar Pradesh", "Telangana"].map((s) => <option key={s}>{s}</option>) : ["Electronics", "Fashion", "Home & Furniture"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Delivery</legend>
            <div className="flex flex-col gap-2.5">
              <Radio name={`${id}-d`} checked={delivery === "download"} onChange={() => setDelivery("download")} label="Download when ready" description="Usually under 5 minutes" />
              <Radio name={`${id}-d`} checked={delivery === "email"} onChange={() => setDelivery("email")} label="Email a secure link" description="Link expires in 7 days" />
              <Radio name={`${id}-d`} checked={delivery === "schedule"} onChange={() => setDelivery("schedule")} label="Schedule a recurring export" description="Monthly on the 2nd at 6:00 am" />
            </div>
          </fieldset>
        </div>
      </Modal>
      {node}
    </>
  );
}
