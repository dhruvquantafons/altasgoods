"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Building2, CircleCheck, CircleX, Clock, ExternalLink, FileText, History, Landmark, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";
import { approveApplication, loadReview, rejectApplication, reopenApplication, requestApplicationChanges } from "@/app/actions/review";
import { KYC_DOC_STATUS, KYC_STATUS, VERIFY_RESULT } from "@/components/admin/admin-status";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { ApplicationReview, ApplicationSummary } from "@/lib/api/types";
import { CONSTITUTION_LABEL, formatPhone } from "@/lib/onboarding";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const REJECT_REASONS = [
  "GSTIN cancelled or inactive",
  "PAN name does not match the business",
  "Bank verification failed",
  "Linked to a suspended or rejected account",
  "Prohibited business category",
  "Incomplete application after 30 days",
];

/** Sections a verifier can send back; matches the API's section keys. */
const SECTIONS: { key: string; label: string }[] = [
  { key: "business", label: "Business details" },
  { key: "pan", label: "PAN" },
  { key: "store", label: "Store" },
  { key: "pickup", label: "Pickup address" },
  { key: "bank", label: "Bank account" },
  { key: "categories", label: "Categories" },
  { key: "brand", label: "Brand registry" },
];

const severityTone = { LOW: "text-ink-600", MEDIUM: "text-warning-700", HIGH: "text-danger-700" } as const;
const resultKey = (r: "VERIFIED" | "PARTIAL" | "FAILED" | null | undefined) => (r ? (r.toLowerCase() as "verified" | "partial" | "failed") : "pending");
const statusKey = (s: ApplicationSummary["status"]) => s.toLowerCase() as keyof typeof KYC_STATUS;

function Section({ title, icon: Icon, result, children }: { title: string; icon: typeof Building2; result?: keyof typeof VERIFY_RESULT; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          <Icon size={15} className="text-ink-400" aria-hidden="true" />
          {title}
        </h3>
        {result && <StatusBadge meta={VERIFY_RESULT[result]} size="sm" />}
      </header>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

function Row({ label, value, mono, warn }: { label: string; value: ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-[13px]">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className={cn("min-w-0 text-right font-medium break-words", mono && "font-mono text-[12.5px]", warn ? "text-warning-700" : "text-ink-900")}>{value || "Not provided"}</dd>
    </div>
  );
}

/** Time left on the review SLA, against the real clock. */
function Sla({ dueAt, now }: { dueAt: string; now: number }) {
  const mins = Math.round((new Date(dueAt).getTime() - now) / 60_000);
  const overdue = mins < 0;
  const abs = Math.abs(mins);
  const text = abs >= 1440 ? `${Math.floor(abs / 1440)} d ${Math.floor((abs % 1440) / 60)} h` : `${Math.floor(abs / 60)} h ${abs % 60} min`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium tabular-nums", overdue ? "text-danger-700" : mins < 24 * 60 ? "text-warning-700" : "text-ink-700")}>
      {overdue ? <TriangleAlert size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}
      {overdue ? `${text} overdue` : `${text} left`}
    </span>
  );
}

function CheckDots({ checks }: { checks: ApplicationSummary["checks"] }) {
  const dot = (r: string | null) => (r === "VERIFIED" ? "bg-success-500" : r === "PARTIAL" ? "bg-warning-500" : r === "FAILED" ? "bg-danger-500" : "bg-ink-200");
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-500">
      {(["gst", "pan", "bank"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1" title={`${k.toUpperCase()}: ${checks[k] ?? "not run"}`}>
          <span className={cn("size-2 rounded-full", dot(checks[k]))} aria-hidden="true" />
          {k === "gst" ? "GST" : k === "pan" ? "PAN" : "Bank"}
        </span>
      ))}
    </span>
  );
}

/** Seller application review queue with a right-side review panel (spec 9.3.2, 11.8). */
export function KycQueue({ items, decided, initialOpenId, categories }: { items: ApplicationSummary[]; decided: boolean; initialOpenId?: string; categories: { id: string; name: string; gated?: string }[] }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  // a deep link (?review=SA-50001) opens that application straight away
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [review, setReview] = useState<ApplicationReview | null>(null);
  const [loading, setLoading] = useState(!!initialOpenId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; list?: string[] } | null>(null);
  const [mode, setMode] = useState<"review" | "changes" | "reject">("review");
  const [flags, setFlags] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { show, node } = useToast();

  async function open(id: string) {
    setOpenId(id);
    setReview(null);
    setMode("review");
    setFlags([]);
    setMessage("");
    setReason("");
    setNote("");
    setError(null);
    setLoading(true);
    const r = await loadReview(id);
    setLoading(false);
    if (r.ok) setReview(r.data);
    else setError({ message: r.error });
  }

  useEffect(() => {
    if (!initialOpenId) return;
    loadReview(initialOpenId).then((r) => {
      setLoading(false);
      if (r.ok) setReview(r.data);
      else setError({ message: r.error });
    });
  }, [initialOpenId]);

  async function decide(fn: () => ReturnType<typeof approveApplication>, toast: string) {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError({ message: r.error, list: r.errors?.map((e) => e.message) });
    setReview(r.data);
    setMode("review");
    show(toast);
    router.refresh();
  }

  if (!items.length) return <EmptyState icon={Building2} title="No applications here" description="Applications arrive here once the seller submits and the automatic checks finish." />;

  const app = review;
  const gatedOf = (id: string) => categories.find((c) => c.id === id);
  const flaggable = app ? [...SECTIONS, ...app.requiredDocuments.map((d) => ({ key: d.kind, label: d.label }))] : [];

  return (
    <>
      <TableContainer>
        <Table>
          <THead className="border-t-0">
            <TR>
              <TH>Application</TH>
              <TH className="hidden md:table-cell">Business</TH>
              <TH>Status</TH>
              <TH className="hidden sm:table-cell">{decided ? "Decided" : "Review SLA"}</TH>
              <TH className="hidden xl:table-cell">Checks</TH>
              <TH className="hidden lg:table-cell">Risk flags</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {items.map((a) => {
              const worst = a.riskFlags.some((f) => f.severity === "HIGH") ? "HIGH" : a.riskFlags.some((f) => f.severity === "MEDIUM") ? "MEDIUM" : a.riskFlags.length ? "LOW" : null;
              const view = decided || a.status === "KYC_IN_PROGRESS";
              return (
                <TR key={a.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={a.storeName ?? a.id} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink-900">{a.storeName ?? "Store name not set"}</span>
                        <span className="block font-mono text-xs text-ink-500">{a.id}</span>
                      </span>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <p className="max-w-[240px] truncate text-[13px] text-ink-800">{a.legalName ?? "Not verified yet"}</p>
                    <p className="text-xs text-ink-500">{[a.constitution ? CONSTITUTION_LABEL[a.constitution] : null, a.city].filter(Boolean).join(", ")}</p>
                  </TD>
                  <TD>
                    <StatusBadge meta={KYC_STATUS[statusKey(a.status)]} size="sm" />
                  </TD>
                  <TD className="hidden sm:table-cell">
                    {a.decidedAt ? (
                      <span className="text-[13px] text-ink-600">{formatDate(a.decidedAt)}</span>
                    ) : a.status === "KYC_IN_PROGRESS" ? (
                      <span className="text-[13px] text-ink-500">Not submitted</span>
                    ) : a.status === "ACTION_REQUIRED" ? (
                      <span className="text-[13px] text-ink-600">Waiting on seller</span>
                    ) : a.slaDueAt ? (
                      <Sla dueAt={a.slaDueAt} now={now} />
                    ) : null}
                  </TD>
                  <TD className="hidden xl:table-cell">
                    <CheckDots checks={a.checks} />
                  </TD>
                  <TD className="hidden lg:table-cell">
                    {worst ? (
                      <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", severityTone[worst])}>
                        <ShieldAlert size={14} aria-hidden="true" />
                        {a.riskFlags.length} {worst.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-400">None</span>
                    )}
                  </TD>
                  <TD align="right">
                    <Button size="xs" variant={view ? "ghost" : "secondary"} onClick={() => open(a.id)}>
                      {view ? "View" : "Review"}
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        side="right"
        size="lg"
        title={app?.store.name ?? openId ?? ""}
        description={app ? `${app.id}${app.submittedAt ? `, submitted ${formatDateTime(app.submittedAt)}` : ", not submitted yet"}` : undefined}
        footer={
          app && app.status === "UNDER_REVIEW" ? (
            mode === "review" ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50" onClick={() => setMode("reject")}>
                  Reject
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode("changes")}>
                    Request changes
                  </Button>
                  <Button size="sm" disabled={app.blockers.length > 0 || busy} onClick={() => decide(() => approveApplication(app.id), `${app.store.name} approved. The seller account is ready.`)}>
                    {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                    Approve
                  </Button>
                </div>
              </div>
            ) : mode === "changes" ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                  Back
                </Button>
                <Button size="sm" disabled={!flags.length || message.trim().length < 5 || busy} onClick={() => decide(() => requestApplicationChanges(app.id, flags, message.trim()), `Change request sent for ${flags.length} ${flags.length === 1 ? "item" : "items"}`)}>
                  Send request
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                  Back
                </Button>
                <Button variant="danger" size="sm" disabled={!reason || busy} onClick={() => decide(() => rejectApplication(app.id, reason, note.trim()), `${app.store.name} rejected. Reopening needs a 30 day cool-off.`)}>
                  Reject application
                </Button>
              </>
            )
          ) : app && app.status === "ACTION_REQUIRED" ? (
            mode === "reject" ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                  Back
                </Button>
                <Button variant="danger" size="sm" disabled={!reason || busy} onClick={() => decide(() => rejectApplication(app.id, reason, note.trim()), `${app.store.name} rejected.`)}>
                  Reject application
                </Button>
              </>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <p className="text-xs text-ink-500">Waiting for the seller to fix the flagged items.</p>
                <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50" onClick={() => setMode("reject")}>
                  Reject
                </Button>
              </div>
            )
          ) : app && app.status === "REJECTED" ? (
            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-xs text-ink-500">Rejected applications can be reopened 30 days after the decision.</p>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => decide(() => reopenApplication(app.id), `${app.store.name ?? app.id} reopened`)}>
                Reopen
              </Button>
            </div>
          ) : undefined
        }
      >
        {loading && (
          <p className="flex items-center gap-2 text-[13px] text-ink-500">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Loading application
          </p>
        )}
        {error && (
          <div role="alert" className="mb-4 flex gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
            <TriangleAlert size={16} className="mt-px shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">{error.message}</p>
              {error.list?.length ? <p>{error.list.join(". ")}.</p> : null}
            </div>
          </div>
        )}
        {app && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge meta={KYC_STATUS[statusKey(app.status)]} />
              <span className="text-[13px] text-ink-500">{[app.business.constitution ? CONSTITUTION_LABEL[app.business.constitution] : null, app.pickup?.city, app.pickup?.state].filter(Boolean).join(", ")}</span>
            </div>

            {mode === "changes" && (
              <div className="rounded-xl border border-warning-100 bg-warning-50/60 p-4">
                <p className="text-[13px] font-medium text-warning-700">Select what the seller must fix. They get 30 days before the application closes.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {flaggable.map((f) => (
                    <Checkbox key={f.key} label={f.label} checked={flags.includes(f.key)} onChange={(e) => setFlags((d) => (e.target.checked ? [...d, f.key] : d.filter((x) => x !== f.key)))} />
                  ))}
                </div>
                <Field label="Message to seller" required className="mt-4" htmlFor="kyc-msg" hint="The seller sees this message">
                  <Textarea id="kyc-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please upload a cancelled cheque in the business name..." />
                </Field>
              </div>
            )}

            {mode === "reject" && (
              <div className="rounded-xl border border-danger-100 bg-danger-50/60 p-4">
                <Field label="Rejection reason" required htmlFor="kyc-reason" hint="The seller sees the reason">
                  <Select id="kyc-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="" disabled>
                      Choose a reason
                    </option>
                    {REJECT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Internal note" className="mt-3" htmlFor="kyc-note" hint="Only BluBuy staff see this">
                  <Textarea id="kyc-note" className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context for Risk and the audit log" />
                </Field>
              </div>
            )}

            {mode === "review" && app.blockers.length > 0 && (
              <div className="flex gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                <TriangleAlert size={16} className="mt-px shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Approval is blocked</p>
                  <p>{app.blockers.join(". ")}. Request changes or reject.</p>
                </div>
              </div>
            )}

            {app.status === "ACTION_REQUIRED" && app.reviewerMessage && (
              <div className="rounded-xl border border-warning-100 bg-warning-50/60 px-4 py-3 text-[13px]">
                <p className="font-medium text-warning-700">Changes requested: {app.flaggedItems.map((f) => f.label).join(", ")}</p>
                <p className="mt-1 text-ink-700">{app.reviewerMessage}</p>
              </div>
            )}

            <Section title="Business summary" icon={Building2}>
              <dl>
                <Row label="Legal name" value={app.business.legalName} />
                <Row label="Owner" value={app.owner.name} />
                <Row label="Mobile" value={formatPhone(app.owner.phone)} mono />
                <Row label="Email" value={app.owner.email} />
                <Row label="Customer care" value={app.store.careNumber} />
                <Row label="Grievance officer" value={app.store.grievanceContact} />
                <Row label="Pickup address" value={app.pickup ? `${app.pickup.line1}${app.pickup.line2 ? `, ${app.pickup.line2}` : ""}, ${app.pickup.city} ${app.pickup.pincode}` : ""} />
                <Row label="Pickup contact" value={app.pickup ? `${app.pickup.contactName}, ${formatPhone(app.pickup.contactPhone)}` : ""} />
              </dl>
            </Section>

            {app.business.gstExempt ? (
              <Section title="GST" icon={FileText}>
                <p className="text-[13px] text-ink-700">GST exempt seller. Registered address: {app.business.registeredAddress}</p>
              </Section>
            ) : (
              <Section title="GSTIN verification" icon={FileText} result={resultKey(app.checks.gst?.result)}>
                <dl>
                  <Row label="GSTIN" value={app.business.gstin} mono />
                  <Row label="Portal status" value={app.checks.gst?.portalStatus} warn={app.checks.gst?.portalStatus !== "ACTIVE"} />
                  <Row label="Legal name on portal" value={app.checks.gst?.legalName} />
                  <Row label="Trade name" value={app.checks.gst?.tradeName} />
                  <Row label="Constitution on portal" value={app.checks.gst ? CONSTITUTION_LABEL[app.checks.gst.constitution] : ""} warn={!!app.checks.gst && app.checks.gst.constitution !== app.business.constitution} />
                  <Row label="Registered on" value={app.checks.gst?.registeredOn} />
                  <Row label="Filing status" value={app.checks.gst?.filing} warn={/cancel/i.test(app.checks.gst?.filing ?? "")} />
                </dl>
              </Section>
            )}

            <Section title="PAN verification" icon={FileText} result={resultKey(app.checks.pan?.result)}>
              <dl>
                <Row label="PAN" value={app.business.pan} mono />
                <Row label="Holder name (PAN database)" value={app.checks.pan?.holderName} />
                <Row label="Holder type" value={app.checks.pan?.holderType} />
                <Row label="Name match" value={app.checks.pan ? `${app.checks.pan.nameMatchScore}%` : ""} warn={!!app.checks.pan && app.checks.pan.result !== "VERIFIED"} />
                <Row label="Aadhaar linked" value={app.checks.pan ? (app.checks.pan.aadhaarLinked ? "Yes" : "No") : ""} warn={app.checks.pan?.aadhaarLinked === false} />
              </dl>
            </Section>

            <Section title="Bank account, penny drop" icon={Landmark} result={resultKey(app.checks.bank?.result)}>
              <dl>
                <Row label="Bank and IFSC" value={app.checks.bank ? `${app.checks.bank.bankName}, ${app.checks.bank.ifsc}` : ""} />
                <Row label="Account" value={app.bank?.accountMasked} mono />
                <Row label="Holder entered" value={app.bank?.holder} />
                <Row label="Name returned by bank" value={app.checks.bank?.beneficiaryName} warn={!!app.checks.bank && app.checks.bank.result !== "VERIFIED"} />
                <Row label="Reference" value={app.checks.bank?.reference} mono />
                <Row label="Verified at" value={app.checks.bank ? formatDateTime(app.checks.bank.checkedAt) : ""} />
              </dl>
              {app.checks.bank && (
                <div className="mt-2.5">
                  <div className="mb-1 flex justify-between text-xs text-ink-500">
                    <span>Name match score</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{app.checks.bank.nameMatchScore}%</span>
                  </div>
                  <Progress value={app.checks.bank.nameMatchScore} size="sm" tone={app.checks.bank.nameMatchScore >= 85 ? "success" : app.checks.bank.nameMatchScore >= 60 ? "warning" : "danger"} label="Bank name match score" />
                </div>
              )}
            </Section>

            <Section title="Documents" icon={FileText}>
              <ul className="-my-1 divide-y divide-line">
                {app.requiredDocuments.map((r) => {
                  const d = app.documents.find((x) => x.kind === r.kind);
                  return (
                    <li key={r.kind} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink-800">
                          {r.label}
                          {!r.required && <span className="text-ink-400"> (optional)</span>}
                        </span>
                        {d ? (
                          <a href={`/admin/sellers/approvals/${app.id}/documents/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                            {d.fileName} <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="block text-xs text-ink-500">Not uploaded</span>
                        )}
                        {d?.note && <span className="block text-xs text-danger-700">{d.note}</span>}
                      </span>
                      <StatusBadge meta={KYC_DOC_STATUS[d ? (d.status.toLowerCase() as "pending" | "verified" | "rejected") : "missing"]} size="sm" />
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Categories" icon={CircleCheck}>
              <ul className="-my-1 divide-y divide-line">
                {app.categories.map((id) => {
                  const c = gatedOf(id);
                  return (
                    <li key={id} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink-800">{c?.name ?? id}</span>
                        {c?.gated && <span className="block text-xs text-ink-500">{c.gated}</span>}
                      </span>
                      <span className={cn("text-[13px] font-medium", c?.gated ? "text-info-700" : "text-ink-500")}>{c?.gated ? "Approval after onboarding" : "Not gated"}</span>
                    </li>
                  );
                })}
              </ul>
              {app.brand?.ownBrand && (
                <p className="mt-2 text-xs text-ink-600">
                  Brand Registry: {app.brand.brandName}, trademark {app.brand.trademark}
                  {app.brand.trademarkClass ? `, class ${app.brand.trademarkClass}` : ""}
                </p>
              )}
            </Section>

            <Section title="Risk screening" icon={ShieldAlert}>
              {app.riskFlags.length ? (
                <ul className="flex flex-col gap-2">
                  {app.riskFlags.map((f) => (
                    <li key={f.code + f.message} className={cn("flex items-start gap-2 text-[13px]", severityTone[f.severity])}>
                      {f.severity === "LOW" ? <CircleCheck size={15} className="mt-px shrink-0" aria-hidden="true" /> : <CircleX size={15} className="mt-px shrink-0" aria-hidden="true" />}
                      <span>
                        <span className="font-medium capitalize">{f.severity.toLowerCase()}:</span> {f.message}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-success-700">
                  <CircleCheck size={15} aria-hidden="true" />
                  {app.submittedAt ? "No duplicate PAN, GSTIN or bank account found" : "Runs when the seller submits"}
                </p>
              )}
            </Section>

            {app.notes.length > 0 && (
              <Section title="Reviewer notes" icon={FileText}>
                <ul className="flex flex-col gap-3">
                  {app.notes.map((n, i) => (
                    <li key={`${i}-${n.at}`} className="text-[13px]">
                      <p className="text-ink-800">{n.body}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {n.byName ?? "BluBuy staff"}, {formatDateTime(n.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="History" icon={History}>
              <ol className="flex flex-col gap-2.5">
                {app.events.map((e, i) => (
                  <li key={i} className="text-[13px]">
                    <p className="font-medium text-ink-900">
                      {KYC_STATUS[statusKey(e.toStatus)].label}
                      <span className="font-normal text-ink-500">
                        {" "}
                        by {e.actor === "STAFF" ? (e.actorName ?? "BluBuy staff") : e.actor === "SYSTEM" ? "automatic checks" : "the seller"}, {formatDateTime(e.at)}
                      </span>
                    </p>
                    {e.note && <p className="text-xs text-ink-600">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
