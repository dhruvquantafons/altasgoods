"use client";

import { useState, type ReactNode } from "react";
import { Building2, CircleCheck, CircleX, FileText, Landmark, ShieldAlert, TriangleAlert } from "lucide-react";
import { KYC_DOC_STATUS, KYC_STATUS, VERIFY_RESULT } from "@/components/admin/admin-status";
import { SlaText } from "@/components/admin/bits";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { KycApplication, KycStatus } from "@/lib/mock/admin-extra";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const REJECT_REASONS = [
  "GSTIN cancelled or inactive",
  "PAN name does not match the business",
  "Bank verification failed",
  "Linked to a suspended or rejected account",
  "Prohibited business category",
  "Incomplete application after 30 days",
];

const severityTone = { low: "text-ink-600", medium: "text-warning-700", high: "text-danger-700" } as const;

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

/** KYC and onboarding review queue with a right-side review panel (spec 9.3.2, 11.8). */
export function KycQueue({ apps, categoryNames, decided, initialOpenId }: { apps: KycApplication[]; categoryNames: Record<string, string>; decided: boolean; initialOpenId?: string }) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [statuses, setStatuses] = useState<Record<string, KycStatus>>({});
  const [mode, setMode] = useState<"review" | "changes" | "reject">("review");
  const [docs, setDocs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const { show, node } = useToast();

  const app = apps.find((a) => a.id === openId);
  const statusOf = (a: KycApplication) => statuses[a.id] ?? a.status;

  function open(id: string) {
    setOpenId(id);
    setMode("review");
    setDocs([]);
    setMessage("");
    setReason("");
  }

  function decide(next: KycStatus, toast: string) {
    if (!app) return;
    setStatuses((s) => ({ ...s, [app.id]: next }));
    setOpenId(null);
    show(toast);
  }

  if (!apps.length) return <EmptyState icon={Building2} title="No applications here" description="New submissions appear after GSTIN, PAN and penny drop checks finish." />;

  const blockers = app
    ? [
        app.gst.result === "failed" && "GSTIN verification failed",
        app.bank.result === "failed" && "Bank penny drop failed",
        app.documents.some((d) => d.status === "rejected" || d.status === "missing") && "Documents rejected or missing",
        app.riskFlags.some((f) => f.severity === "high") && "High severity risk flag",
      ].filter(Boolean)
    : [];
  const terminal = app ? ["approved", "rejected"].includes(statusOf(app)) || app.status === "kyc_in_progress" : false;

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
              <TH className="hidden lg:table-cell">Risk flags</TH>
              <TH className="hidden lg:table-cell">Assignee</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {apps.map((a) => {
              const st = statusOf(a);
              const worst = a.riskFlags.some((f) => f.severity === "high") ? "high" : a.riskFlags.some((f) => f.severity === "medium") ? "medium" : a.riskFlags.length ? "low" : null;
              return (
                <TR key={a.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={a.displayName} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink-900">{a.displayName}</span>
                        <span className="block font-mono text-xs text-ink-500">{a.id}</span>
                      </span>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <p className="max-w-[240px] truncate text-[13px] text-ink-800">{a.legalName}</p>
                    <p className="text-xs text-ink-500">
                      {a.constitution}, {a.city}
                    </p>
                  </TD>
                  <TD>
                    <StatusBadge meta={KYC_STATUS[st]} size="sm" />
                  </TD>
                  <TD className="hidden sm:table-cell">
                    {decided || st === "approved" || st === "rejected" ? (
                      <span className="text-[13px] text-ink-600">{formatDate(a.slaDueAt)}</span>
                    ) : st === "kyc_in_progress" ? (
                      <span className="text-[13px] text-ink-500">Not submitted</span>
                    ) : st === "action_required" ? (
                      <span className="text-[13px] text-ink-600">Waiting on seller</span>
                    ) : (
                      <SlaText dueAt={a.slaDueAt} warnWithinMins={24 * 60} />
                    )}
                  </TD>
                  <TD className="hidden lg:table-cell">
                    {worst ? (
                      <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", severityTone[worst])}>
                        <ShieldAlert size={14} aria-hidden="true" />
                        {a.riskFlags.length} {worst}
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-400">None</span>
                    )}
                  </TD>
                  <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{a.assignee ?? "Unassigned"}</TD>
                  <TD align="right">
                    <Button size="xs" variant={decided || st === "kyc_in_progress" ? "ghost" : "secondary"} onClick={() => open(a.id)}>
                      {decided || st === "kyc_in_progress" ? "View" : "Review"}
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>

      <Modal
        open={Boolean(app)}
        onClose={() => setOpenId(null)}
        side="right"
        size="lg"
        title={app ? app.displayName : ""}
        description={app ? `${app.id}, submitted ${formatDateTime(app.submittedAt)}` : undefined}
        footer={
          app && !terminal ? (
            mode === "review" ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50" onClick={() => setMode("reject")}>
                  Reject
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode("changes")}>
                    Request changes
                  </Button>
                  <Button size="sm" disabled={blockers.length > 0} onClick={() => decide("approved", `${app.displayName} approved. Seller can now list products.`)}>
                    Approve
                  </Button>
                </div>
              </div>
            ) : mode === "changes" ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                  Back
                </Button>
                <Button size="sm" disabled={!docs.length || message.trim().length < 5} onClick={() => decide("action_required", `Change request sent for ${docs.length} ${docs.length === 1 ? "item" : "items"}`)}>
                  Send request
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                  Back
                </Button>
                <Button variant="danger" size="sm" disabled={!reason} onClick={() => decide("rejected", `${app.displayName} rejected. Reopening needs a 30 day cool-off.`)}>
                  Reject application
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {app && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge meta={KYC_STATUS[statusOf(app)]} />
              <span className="text-[13px] text-ink-500">
                {app.constitution}, {app.city}, {app.state}
              </span>
            </div>

            {mode === "changes" && (
              <div className="rounded-xl border border-warning-100 bg-warning-50/60 p-4">
                <p className="text-[13px] font-medium text-warning-700">Select what the seller must fix. They get 30 days before the application closes.</p>
                <div className="mt-3 flex flex-col gap-2">
                  {[...app.documents.map((d) => d.label), "Bank account details", "Category approval evidence"].map((label) => (
                    <Checkbox key={label} label={label} checked={docs.includes(label)} onChange={(e) => setDocs((d) => (e.target.checked ? [...d, label] : d.filter((x) => x !== label)))} />
                  ))}
                </div>
                <Field label="Message to seller" required className="mt-4" htmlFor="kyc-msg">
                  <Textarea id="kyc-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please upload a cancelled cheque in the business name..." />
                </Field>
              </div>
            )}

            {mode === "reject" && (
              <div className="rounded-xl border border-danger-100 bg-danger-50/60 p-4">
                <Field label="Rejection reason" required htmlFor="kyc-reason">
                  <Select id="kyc-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option value="" disabled>
                      Choose a reason
                    </option>
                    {REJECT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Internal note" className="mt-3" htmlFor="kyc-note">
                  <Textarea id="kyc-note" className="min-h-16" placeholder="Context for Risk and the audit log" />
                </Field>
              </div>
            )}

            {mode === "review" && blockers.length > 0 && !terminal && (
              <div className="flex gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">
                <TriangleAlert size={16} className="mt-px shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">Approval is blocked</p>
                  <p>{blockers.join(". ")}. Request changes or reject.</p>
                </div>
              </div>
            )}

            <Section title="Business summary" icon={Building2}>
              <dl>
                <Row label="Legal name" value={app.legalName} />
                <Row label="Owner" value={app.ownerName} />
                <Row label="Expected SKUs" value={String(app.expectedSkus)} />
                <Row label="Pickup address" value={app.pickupAddress} />
              </dl>
            </Section>

            <Section title="GSTIN verification" icon={FileText} result={app.gst.result}>
              <dl>
                <Row label="GSTIN" value={app.gstin} mono />
                <Row label="Legal name on GST portal" value={app.gst.legalNameOnPortal} warn={app.gst.result !== "verified"} />
                <Row label="Name entered" value={app.legalName.toUpperCase()} />
                <Row label="Trade name" value={app.gst.tradeName} warn={app.gst.result === "partial"} />
                <Row label="Registered on" value={app.gst.registeredOn} />
                <Row label="Filing status" value={app.gst.filing} warn={/not filed|cancel/i.test(app.gst.filing)} />
              </dl>
            </Section>

            <Section title="PAN verification" icon={FileText} result={app.panCheck.result}>
              <dl>
                <Row label="PAN" value={app.pan} mono />
                <Row label="Holder name (PAN database)" value={app.panCheck.holderName} />
                <Row label="Name match" value={app.panCheck.score ? `${app.panCheck.score}%` : ""} />
                <Row label="Aadhaar linked" value={app.panCheck.result === "pending" ? "" : app.panCheck.aadhaarLinked ? "Yes" : "No"} />
              </dl>
            </Section>

            <Section title="Bank account, penny drop" icon={Landmark} result={app.bank.result}>
              <dl>
                <Row label="Bank and IFSC" value={app.bank.bankName ? `${app.bank.bankName}, ${app.bank.ifsc}` : ""} />
                <Row label="Account" value={app.bank.account} mono />
                <Row label="Name returned by bank" value={app.bank.beneficiary} warn={app.bank.result !== "verified" && app.bank.result !== "pending"} />
                <Row label="Verified at" value={app.bank.at ? formatDateTime(app.bank.at) : ""} />
              </dl>
              {app.bank.result !== "pending" && (
                <div className="mt-2.5">
                  <div className="mb-1 flex justify-between text-xs text-ink-500">
                    <span>Name match score</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{app.bank.score}%</span>
                  </div>
                  <Progress value={app.bank.score} size="sm" tone={app.bank.score >= 90 ? "success" : app.bank.score >= 70 ? "warning" : "danger"} label="Bank name match score" />
                </div>
              )}
            </Section>

            <Section title="Documents" icon={FileText}>
              <ul className="-my-1 divide-y divide-line">
                {app.documents.map((d) => (
                  <li key={d.key} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-800">{d.label}</span>
                      <span className="block text-xs text-ink-500">{d.note ?? d.file ?? "Not uploaded"}</span>
                    </span>
                    <StatusBadge meta={KYC_DOC_STATUS[d.status]} size="sm" />
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Category approvals" icon={CircleCheck}>
              <ul className="-my-1 divide-y divide-line">
                {app.categoryRequests.map((c) => (
                  <li key={c.categoryId} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-800">{categoryNames[c.categoryId] ?? c.categoryId}</span>
                      <span className="block text-xs text-ink-500">{c.evidence}</span>
                    </span>
                    <span className={cn("text-[13px] font-medium", c.status === "approved" ? "text-success-700" : c.status === "rejected" ? "text-danger-700" : c.status === "pending" ? "text-info-700" : "text-ink-500")}>
                      {c.status === "not_required" ? "Not gated" : c.status === "pending" ? "To review" : c.status === "approved" ? "Approved" : "Rejected"}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Risk screening" icon={ShieldAlert}>
              {app.riskFlags.length ? (
                <ul className="flex flex-col gap-2">
                  {app.riskFlags.map((f) => (
                    <li key={f.label} className={cn("flex items-start gap-2 text-[13px]", severityTone[f.severity])}>
                      {f.severity === "low" ? <CircleCheck size={15} className="mt-px shrink-0" aria-hidden="true" /> : <CircleX size={15} className="mt-px shrink-0" aria-hidden="true" />}
                      <span>
                        <span className="font-medium capitalize">{f.severity}:</span> {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-success-700">
                  <CircleCheck size={15} aria-hidden="true" />
                  No duplicate PAN, bank account or device links found
                </p>
              )}
            </Section>

            {app.notes.length > 0 && (
              <Section title="Reviewer notes" icon={FileText}>
                <ul className="flex flex-col gap-3">
                  {app.notes.map((n) => (
                    <li key={n.at} className="text-[13px]">
                      <p className="text-ink-800">{n.body}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {n.by}, {formatDateTime(n.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </Modal>
      {node}
    </>
  );
}
