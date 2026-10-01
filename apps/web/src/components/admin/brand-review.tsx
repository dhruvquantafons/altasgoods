"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FileText } from "lucide-react";
import { BRAND_REQUEST_STATUS } from "@/components/admin/admin-status";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { BrandRequest } from "@/lib/mock/admin-extra";
import { formatDateTime } from "@/lib/utils";

const TYPE: Record<BrandRequest["type"], { label: string; effect: string }> = {
  registry: { label: "Brand Registry enrolment", effect: "The seller becomes the registry owner and gets content priority on this brand's BSINs, plus IP complaint tools." },
  authorisation: { label: "Seller authorisation", effect: "The seller may list this gated brand until the authorisation letter expires." },
  new_brand: { label: "New brand", effect: "Creates the brand as unregistered. It can enrol in Brand Registry once the trademark is registered." },
};

const REASONS = {
  info: ["Authorisation letter unsigned or not on letterhead", "Trademark certificate unreadable", "Applicant name differs from trademark owner", "Need product and packaging photos"],
  reject: ["Conflicts with a registered trademark", "Applicant is not the owner or authorised", "Generic or descriptive name", "Prohibited or misleading name"],
};

/** Review drawer for one Brand Registry or authorisation request. */
export function BrandReview({ request: r, sellerName }: { request: BrandRequest; sellerName: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"review" | "info" | "reject">("review");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(r.status);
  const { show, node } = useToast();
  const decided = status === "approved" || status === "rejected";

  function finish(next: BrandRequest["status"], msg: string) {
    setStatus(next);
    setOpen(false);
    show(msg);
  }

  return (
    <>
      <Button size="xs" variant={decided ? "ghost" : "secondary"} onClick={() => { setMode("review"); setReason(""); setOpen(true); }}>
        {decided ? "View" : "Review"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        size="lg"
        title={r.brandName}
        description={`${TYPE[r.type].label}, ${r.id}, from ${sellerName}`}
        footer={
          decided ? undefined : mode === "review" ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50" onClick={() => setMode("reject")}>
                Reject
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setMode("info")}>
                  Request info
                </Button>
                <Button size="sm" onClick={() => finish("approved", `${r.brandName} approved`)}>
                  Approve
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setMode("review")}>
                Back
              </Button>
              <Button variant={mode === "reject" ? "danger" : "primary"} size="sm" disabled={!reason} onClick={() => finish(mode === "reject" ? "rejected" : "info_requested", mode === "reject" ? "Request rejected, seller notified" : "Information requested from the seller")}>
                {mode === "reject" ? "Reject request" : "Send request"}
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge meta={BRAND_REQUEST_STATUS[status]} />
            <span className="text-[13px] text-ink-500">Submitted {formatDateTime(r.submittedAt)}</span>
          </div>

          {mode !== "review" && (
            <div className={mode === "reject" ? "rounded-xl border border-danger-100 bg-danger-50/60 p-4" : "rounded-xl border border-warning-100 bg-warning-50/60 p-4"}>
              <Field label="Reason" required htmlFor={`br-${r.id}`}>
                <Select id={`br-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {REASONS[mode].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Message to seller" className="mt-3" htmlFor={`brm-${r.id}`}>
                <Textarea id={`brm-${r.id}`} className="min-h-16" />
              </Field>
            </div>
          )}

          <p className="rounded-xl border border-line bg-ink-50/60 px-4 py-3 text-[13px] text-ink-700">{TYPE[r.type].effect}</p>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Trademark</h3>
            <dl className="divide-y divide-line rounded-xl border border-line text-[13px]">
              {[
                ["Application or registration no.", <span key="n" className="font-mono">{r.trademarkNo}</span>],
                ["Class", r.trademarkClass],
                ["Status at IP India", r.trademarkStatus],
                [
                  "Owner match",
                  r.ipIndiaMatch ? (
                    <span key="m" className="inline-flex items-center gap-1 text-success-700">
                      <CircleCheck size={14} aria-hidden="true" />
                      Applicant matches the trademark owner
                    </span>
                  ) : (
                    <span key="m" className="inline-flex items-center gap-1 text-danger-700">
                      <CircleX size={14} aria-hidden="true" />
                      No match with the trademark owner
                    </span>
                  ),
                ],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Documents</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {r.documents.map((d) => (
                <li key={d} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-800">
                  <FileText size={15} className="text-ink-400" aria-hidden="true" />
                  {d}
                </li>
              ))}
            </ul>
          </section>

          {r.note && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-900">Reviewer note</h3>
              <p className="text-[13px] text-ink-700">{r.note}</p>
            </section>
          )}
        </div>
      </Modal>
      {node}
    </>
  );
}
