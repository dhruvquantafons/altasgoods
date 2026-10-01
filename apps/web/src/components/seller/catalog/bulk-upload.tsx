"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { cn, formatDate } from "@/lib/utils";

interface Template {
  id: string;
  category: string;
  version: string;
  updated: string;
  fields: number;
  required: number;
}

interface UploadError {
  row: number;
  sku: string;
  field: string;
  issue: string;
  fix: string;
}

type Phase = "idle" | "validating" | "done";

/** Template download, file upload and a mocked validation report with row-level errors. */
export function BulkUpload({ templates, errors }: { templates: Template[]; errors: UploadError[] }) {
  const [tpl, setTpl] = useState(templates[0]!.id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const toast = useToast();
  const chosen = templates.find((t) => t.id === tpl)!;

  function start(name: string) {
    setFile(name);
    setPhase("validating");
    setTimeout(() => setPhase("done"), 1400);
  }

  const total = 42;
  const ok = total - errors.length;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader title="1. Download a template" description="Each category has its own columns. Use the latest version so required fields are not missed." />
        <div className="flex flex-col gap-4 p-5">
          <Field label="Category" htmlFor="bu-tpl">
            <Select id="bu-tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.category}
                </option>
              ))}
            </Select>
          </Field>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 px-4 py-3 text-[13px]">
            <div>
              <dt className="text-xs text-ink-500">Version</dt>
              <dd className="mt-0.5 font-mono text-ink-900">{chosen.version}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Updated</dt>
              <dd className="mt-0.5 text-ink-900">{formatDate(chosen.updated)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Columns</dt>
              <dd className="mt-0.5 text-ink-900 tabular-nums">{chosen.fields}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Required</dt>
              <dd className="mt-0.5 text-ink-900 tabular-nums">{chosen.required}</dd>
            </div>
          </dl>
          <Button variant="secondary" icon={Download} onClick={() => toast.show(`${chosen.category} template (${chosen.version}) downloaded as an Excel file.`)}>
            Download template
          </Button>
          <p className="text-xs leading-relaxed text-ink-500">Up to 5,000 rows per file. Use one row per variant; group variants with the same parent SKU.</p>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader title="2. Upload your file" description="We validate every row before anything changes on BluBuy. Rows without errors are processed; rows with errors are skipped." />
        <div className="p-5">
          {phase === "idle" ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                start(e.dataTransfer.files[0]?.name ?? "listings.xlsx");
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                drag ? "border-brand-400 bg-brand-50/60" : "border-line-strong hover:border-brand-300 hover:bg-ink-50",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Upload size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-3 text-sm font-medium text-ink-900">Drop your file here, or browse</span>
              <span className="mt-1 text-xs text-ink-500">Excel (.xlsx) or CSV, up to 25 MB</span>
              <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => start(e.target.files?.[0]?.name ?? "listings.xlsx")} />
            </label>
          ) : (
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <FileSpreadsheet size={22} className="shrink-0 text-success-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{file}</p>
                  <p className="text-xs text-ink-500">{chosen.category} template, {chosen.version}</p>
                </div>
                {phase === "done" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={RotateCcw}
                    onClick={() => {
                      setPhase("idle");
                      setFile(null);
                    }}
                  >
                    Upload another
                  </Button>
                )}
              </div>
              {phase === "validating" ? (
                <div className="mt-5" role="status">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-ink-700">Validating rows</span>
                    <span className="text-ink-500">Checking images, prices, HSN and brand approvals</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[
                      { label: "Rows read", value: total, icon: FileSpreadsheet, tone: "text-ink-500" },
                      { label: "Ready to process", value: ok, icon: CircleCheck, tone: "text-success-600" },
                      { label: "Rows with errors", value: errors.length, icon: CircleAlert, tone: "text-danger-600" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-line px-4 py-3">
                        <s.icon size={16} className={s.tone} aria-hidden="true" />
                        <p className="mt-2 text-xl font-semibold text-ink-900 tabular-nums">{s.value}</p>
                        <p className="text-xs text-ink-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                    <table className="w-full min-w-[40rem] text-left text-[13px]">
                      <thead className="bg-ink-50/70 text-[12px] text-ink-500">
                        <tr>
                          <th className="px-4 py-2.5 text-right font-medium">Row</th>
                          <th className="px-4 py-2.5 font-medium">SKU</th>
                          <th className="px-4 py-2.5 font-medium">Column</th>
                          <th className="px-4 py-2.5 font-medium">Problem and fix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {errors.map((e) => (
                          <tr key={e.row} className="align-top">
                            <td className="px-4 py-3 text-right text-ink-700 tabular-nums">{e.row}</td>
                            <td className="px-4 py-3 font-mono whitespace-nowrap text-ink-900">{e.sku}</td>
                            <td className="px-4 py-3 font-mono text-[12px] whitespace-nowrap text-ink-600">{e.field}</td>
                            <td className="px-4 py-3">
                              <p className="flex items-start gap-1.5 text-ink-900">
                                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger-600" aria-hidden="true" />
                                {e.issue}
                              </p>
                              <p className="mt-0.5 pl-5 text-xs text-ink-500">{e.fix}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" icon={Download} onClick={() => toast.show("Error report downloaded. Fix the highlighted cells and upload again.")}>
                      Download error report
                    </Button>
                    <Button onClick={() => toast.show(`${ok} rows submitted. New products go to review; offer updates go live within 15 minutes.`)}>
                      Process {ok} valid rows
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
      {toast.node}
    </div>
  );
}
