"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Copy, PackageCheck, TriangleAlert } from "lucide-react";
import { CHECK_RESULT, MODERATION_TYPE, RISK_LEVEL } from "@/components/admin/admin-status";
import { CheckMark, SlaText } from "@/components/admin/bits";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { EmptyState, Price } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { ModerationItem } from "@/lib/mock/admin-extra";
import { cn } from "@/lib/utils";

const REASONS: { code: string; label: string; check?: string }[] = [
  { code: "IMAGE_QUALITY", label: "Image quality below guidelines", check: "image" },
  { code: "WATERMARK_OR_TEXT", label: "Watermark, text or contact details on images", check: "watermark" },
  { code: "TITLE_FORMAT", label: "Title format or promotional text", check: "title" },
  { code: "PROHIBITED_CONTENT", label: "Prohibited, counterfeit or misleading content", check: "prohibited" },
  { code: "MRP_INFLATED", label: "M.R.P. inflated or price above M.R.P.", check: "mrp" },
  { code: "MISSING_LEGAL_METROLOGY", label: "Missing Legal Metrology declarations", check: "legal" },
  { code: "DUPLICATE_BSIN", label: "Duplicate of an existing BSIN", check: "duplicate" },
  { code: "BRAND_NOT_AUTHORISED", label: "Brand not authorised for this seller", check: "brand" },
  { code: "WRONG_CATEGORY", label: "Listed in the wrong category" },
];

type Decision = "approved" | "rejected" | "changes";

function checkSummary(m: ModerationItem) {
  const fail = m.checks.filter((c) => c.result === "fail").length;
  const warn = m.checks.filter((c) => c.result === "warn").length;
  if (!fail && !warn) return { result: "pass" as const, text: `All ${m.checks.length} passed` };
  return { result: fail ? ("fail" as const) : ("warn" as const), text: [fail && `${fail} failed`, warn && `${warn} to review`].filter(Boolean).join(", ") };
}

/** Listing QC queue (spec 9.3.3) with bulk actions and a right-side review drawer. */
export function ModerationQueue({ items, categoryNames, initialOpenId }: { items: ModerationItem[]; categoryNames: Record<string, string>; initialOpenId?: string }) {
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [mode, setMode] = useState<"review" | "reject" | "changes">("review");
  const [codes, setCodes] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [bulkReject, setBulkReject] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);
  const { show, node } = useToast();

  const rows = items.filter((m) => !decided[m.id]);
  const item = items.find((m) => m.id === openId);
  const selectedRows = rows.filter((m) => selected.includes(m.id));
  const allLow = selectedRows.length > 0 && selectedRows.every((m) => m.risk === "low");
  const doneCount = Object.keys(decided).length;

  function open(m: ModerationItem) {
    setOpenId(m.id);
    setMode("review");
    setImageIdx(0);
    setNote("");
    setCodes(REASONS.filter((r) => m.checks.some((c) => c.key === r.check && c.result === "fail")).map((r) => r.code));
  }

  function decide(ids: string[], d: Decision, toast: string) {
    setDecided((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, d])) }));
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    setOpenId(null);
    setBulkReject(false);
    show(toast);
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const reasonPicker = (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-medium text-ink-700">
        Reason codes<span className="ml-0.5 text-danger-600">*</span>
      </legend>
      {REASONS.map((r) => (
        <Checkbox
          key={r.code}
          checked={codes.includes(r.code)}
          onChange={(e) => setCodes((c) => (e.target.checked ? [...c, r.code] : c.filter((x) => x !== r.code)))}
          label={r.label}
          description={r.code}
        />
      ))}
    </fieldset>
  );

  return (
    <>
      {selectedRows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50/60 px-5 py-2.5">
          <span className="text-[13px] font-medium text-ink-900">{selectedRows.length} selected</span>
          <Button size="xs" disabled={!allLow} onClick={() => decide(selectedRows.map((m) => m.id), "approved", `${selectedRows.length} listings approved`)}>
            Approve selected
          </Button>
          <Button size="xs" variant="secondary" onClick={() => { setCodes([]); setNote(""); setBulkReject(true); }}>
            Reject selected
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
          {!allLow && <span className="text-xs text-ink-600">Bulk approve is limited to low risk listings</span>}
        </div>
      ) : (
        doneCount > 0 && <p className="border-b border-line px-5 py-2.5 text-[13px] text-ink-600">{doneCount} decided in this session. Decisions are written to the audit log.</p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Queue clear" description="Nothing matches these filters. New submissions arrive continuously during the sale." />
      ) : (
        <TableContainer>
          <Table>
            <THead className="border-t-0">
              <TR>
                <TH className="w-10 pr-0">
                  <Checkbox aria-label="Select all on this page" checked={selected.length > 0 && rows.every((m) => selected.includes(m.id))} onChange={(e) => setSelected(e.target.checked ? rows.map((m) => m.id) : [])} />
                </TH>
                <TH>Listing</TH>
                <TH className="hidden md:table-cell">Seller and type</TH>
                <TH className="hidden sm:table-cell">Auto checks</TH>
                <TH className="hidden sm:table-cell">Risk</TH>
                <TH className="hidden lg:table-cell">Review SLA</TH>
                <TH align="right" className="hidden sm:table-cell">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((m) => {
                const sum = checkSummary(m);
                const sel = selected.includes(m.id);
                return (
                  <TR key={m.id} className={cn(sel && "bg-brand-50/50 hover:bg-brand-50/70")}>
                    <TD className="w-10 pr-0">
                      <Checkbox aria-label={`Select ${m.title}`} checked={sel} onChange={() => toggle(m.id)} />
                    </TD>
                    <TD>
                      <button type="button" onClick={() => open(m)} className="group flex max-w-[250px] items-center gap-3 text-left sm:max-w-[300px]">
                        <ProductImage src={m.image} alt="" size={40} rounded="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink-900 group-hover:text-brand-700">{m.title}</span>
                          <span className="block truncate text-xs text-ink-500">
                            <span className="font-mono">{m.bsin}</span>, {categoryNames[m.categoryId]} / {m.subcategory}
                          </span>
                          <span className="mt-1 block sm:hidden">
                            <StatusBadge meta={RISK_LEVEL[m.risk]} size="sm" />
                          </span>
                        </span>
                      </button>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="text-[13px] text-ink-800">{m.sellerName}</p>
                      <p className="text-xs text-ink-500">{MODERATION_TYPE[m.type]}</p>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-[13px] text-ink-700">
                        <CheckMark result={sum.result} />
                        {sum.text}
                      </span>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <StatusBadge meta={RISK_LEVEL[m.risk]} size="sm" />
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <SlaText dueAt={m.slaDueAt} warnWithinMins={8 * 60} />
                    </TD>
                    <TD align="right" className="hidden sm:table-cell">
                      <Button size="xs" variant="secondary" onClick={() => open(m)}>
                        Review
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {/* Review drawer */}
      <Modal
        open={Boolean(item)}
        onClose={() => setOpenId(null)}
        side="right"
        size="lg"
        title="Review listing"
        description={item ? `${item.id}, ${MODERATION_TYPE[item.type].toLowerCase()} from ${item.sellerName}` : undefined}
        footer={
          item &&
          (mode === "review" ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50" onClick={() => setMode("reject")}>
                Reject
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setMode("changes")}>
                  Request changes
                </Button>
                <Button size="sm" onClick={() => decide([item.id], "approved", "Listing approved and published to the catalog")}>
                  Approve
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                Back
              </Button>
              {mode === "reject" ? (
                <Button variant="danger" size="sm" disabled={!codes.length} onClick={() => decide([item.id], "rejected", `Listing rejected with ${codes.length} reason ${codes.length === 1 ? "code" : "codes"}`)}>
                  Reject listing
                </Button>
              ) : (
                <Button size="sm" disabled={!codes.length} onClick={() => decide([item.id], "changes", "Change request sent to the seller")}>
                  Send to seller
                </Button>
              )}
            </>
          ))
        }
      >
        {item && (
          <div className="flex flex-col gap-5">
            {mode !== "review" && (
              <div className={cn("rounded-xl border p-4", mode === "reject" ? "border-danger-100 bg-danger-50/50" : "border-warning-100 bg-warning-50/50")}>
                <p className="mb-3 text-[13px] text-ink-700">{mode === "reject" ? "The seller sees each reason code with guidance to fix and resubmit." : "The listing returns to the seller as Rejected with editable fields; resubmission re-enters this queue."}</p>
                {reasonPicker}
                <Field label="Note to seller" className="mt-4" htmlFor="mod-note">
                  <Textarea id="mod-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" placeholder="Replace image 2; remove the phone number from the packaging photo." />
                </Field>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-ink-50 ring-1 ring-line ring-inset">
                  <Image src={item.gallery[imageIdx] ?? item.image} alt={item.title} fill sizes="220px" className="object-cover" />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {item.gallery.map((g, i) => (
                    <button key={i} type="button" onClick={() => setImageIdx(i)} aria-label={`Show image ${i + 1}`} className={cn("rounded-lg ring-2 ring-offset-1", i === imageIdx ? "ring-brand-500" : "ring-transparent")}>
                      <ProductImage src={g} alt="" size={48} rounded="md" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[15px] leading-snug font-semibold text-ink-900">{item.title}</p>
                <p className="mt-1 text-[13px] text-ink-500">
                  {item.brand}, {categoryNames[item.categoryId]} / {item.subcategory}
                </p>
                <Price price={item.price} mrp={item.mrp} size="md" className="mt-3" />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  <div>
                    <dt className="text-xs text-ink-500">Proposed BSIN</dt>
                    <dd className="font-mono text-[12.5px] text-ink-900">{item.bsin}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Auto score</dt>
                    <dd className="font-semibold text-ink-900 tabular-nums">{item.autoScore} of 100</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Risk</dt>
                    <dd>
                      <StatusBadge meta={RISK_LEVEL[item.risk]} size="sm" />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Review SLA</dt>
                    <dd>
                      <SlaText dueAt={item.slaDueAt} />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {item.flags.length > 0 && (
              <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-danger-700">
                  <TriangleAlert size={15} aria-hidden="true" />
                  Content flags
                </p>
                <ul className="flex flex-col gap-1 pl-6 text-[13px] text-danger-700">
                  {item.flags.map((f) => (
                    <li key={f} className="list-disc">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.changes && (
              <section>
                <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Changes in this revision</h3>
                <p className="mb-2 text-xs text-ink-500">The live listing keeps its current content until this revision is approved.</p>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {item.changes.map((c) => (
                    <li key={c.field} className="px-4 py-2.5 text-[13px]">
                      <p className="text-xs font-medium text-ink-500">{c.field}</p>
                      <p className="mt-0.5 text-ink-500 line-through">{c.from}</p>
                      <p className="flex items-start gap-1.5 text-ink-900">
                        <ArrowRight size={13} className="mt-1 shrink-0 text-ink-400" aria-hidden="true" />
                        {c.to}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Quality checks</h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {item.checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-3 px-4 py-2.5">
                    <CheckMark result={c.result} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-900">{c.label}</p>
                      <p className="text-xs text-ink-500">{c.detail}</p>
                    </div>
                    <span className={cn("shrink-0 text-xs font-medium", c.result === "pass" ? "text-success-700" : c.result === "warn" ? "text-warning-700" : "text-danger-700")}>{CHECK_RESULT[c.result].label}</span>
                  </li>
                ))}
              </ul>
            </section>

            {item.duplicate && (
              <section>
                <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Duplicate BSIN detection</h3>
                <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                  <ProductImage src={item.duplicate.image} alt="" size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-900">{item.duplicate.title}</p>
                    <p className="text-xs text-ink-500">
                      <span className="font-mono">{item.duplicate.bsin}</span>, live, featured offer by {item.duplicate.sellerName}
                    </p>
                  </div>
                  <span className={cn("text-right text-[13px] font-semibold tabular-nums", item.duplicate.similarity >= 95 ? "text-danger-700" : "text-warning-700")}>
                    {item.duplicate.similarity}%
                    <span className="block text-[11px] font-normal text-ink-500">similar</span>
                  </span>
                </div>
                <Button size="xs" variant="secondary" icon={Copy} className="mt-2" onClick={() => decide([item.id], "approved", `Offer merged into ${item.duplicate!.bsin}`)}>
                  Merge offer into {item.duplicate.bsin}
                </Button>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Attributes</h3>
              <dl className="divide-y divide-line rounded-xl border border-line">
                {item.attributes.map((at) => (
                  <div key={at.label} className="flex items-baseline justify-between gap-4 px-4 py-2 text-[13px]">
                    <dt className="text-ink-500">{at.label}</dt>
                    <dd className={cn("text-right", at.missing ? "font-medium text-danger-700" : "text-ink-900")}>{at.missing ? "Missing, mandatory" : at.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}
      </Modal>

      {/* Bulk reject */}
      <Modal
        open={bulkReject}
        onClose={() => setBulkReject(false)}
        title={`Reject ${selectedRows.length} listings`}
        description="The same reason codes and note go to every seller."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setBulkReject(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled={!codes.length} onClick={() => decide(selectedRows.map((m) => m.id), "rejected", `${selectedRows.length} listings rejected`)}>
              Reject listings
            </Button>
          </>
        }
      >
        {reasonPicker}
        <Field label="Note to sellers" className="mt-4" htmlFor="bulk-note">
          <Textarea id="bulk-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
      </Modal>
      {node}
    </>
  );
}
