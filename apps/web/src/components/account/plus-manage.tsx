"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import { cn, formatINR } from "@/lib/utils";

/** One-screen membership management: auto-renew, plan switch and cancel (no dark patterns). */
export function PlusManage({
  planId,
  plans,
  renewsOnLabel,
  renewalMethod,
  autoRenew,
  refundEstimate,
}: {
  planId: string;
  plans: { id: string; name: string; price: number; period: string; note: string }[];
  renewsOnLabel: string;
  renewalMethod: string;
  autoRenew: boolean;
  refundEstimate: number;
}) {
  const [renew, setRenew] = useState(autoRenew);
  const [plan, setPlan] = useState(planId);
  const [modal, setModal] = useState<"plan" | "cancel" | null>(null);
  const [pending, setPending] = useState(planId);
  const [cancelChoice, setCancelChoice] = useState<"end" | "now">("end");
  const [cancelled, setCancelled] = useState<null | "end" | "now">(null);
  const t = useToast();
  const current = plans.find((p) => p.id === plan)!;

  return (
    <>
      <dl className="flex flex-col divide-y divide-line text-[13.5px]">
        <div className="flex items-center justify-between gap-3 pb-3">
          <dt className="text-ink-500">Plan</dt>
          <dd className="font-medium text-ink-900">
            {current.name}, {formatINR(current.price)} a {current.period}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-ink-500">{cancelled ? "Benefits end" : renew ? "Renews on" : "Ends on"}</dt>
          <dd className="font-medium text-ink-900">{cancelled === "now" ? "Today" : renewsOnLabel}</dd>
        </div>
        <div className="py-3">
          <dt className="text-ink-500">Pays with</dt>
          <dd className="mt-0.5 font-medium text-ink-900">{renewalMethod}</dd>
        </div>
        <div className="pt-3">
          <Switch
            checked={renew && !cancelled}
            disabled={Boolean(cancelled)}
            onChange={(v) => {
              setRenew(v);
              t.show(v ? "Auto-renew is on" : `Auto-renew is off. Plus stays active until ${renewsOnLabel}`);
            }}
            label="Auto-renew"
            description={`We remind you 7 days before charging ${formatINR(current.price)}`}
          />
        </div>
      </dl>

      {cancelled ? (
        <p className="mt-5 rounded-lg bg-ink-50 px-3.5 py-3 text-[13px] text-ink-700">
          {cancelled === "end" ? `Your membership is cancelled and will not renew. You keep every benefit until ${renewsOnLabel}.` : refundEstimate > 0 ? `Your membership has ended and ${formatINR(refundEstimate)} is on its way to your card.` : "Your membership has ended. You can rejoin any time."}
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setModal("plan")}>
            Change plan
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setModal("cancel")}>
            Cancel membership
          </Button>
        </div>
      )}

      <Modal
        open={modal === "plan"}
        onClose={() => setModal(null)}
        title="Change your plan"
        description={`The new plan starts when the current one ends on ${renewsOnLabel}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending === plan}
              onClick={() => {
                setPlan(pending);
                setModal(null);
                t.show("Plan updated");
              }}
            >
              Switch plan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {plans.map((p) => (
            <label
              key={p.id}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", pending === p.id ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:border-line-strong")}
            >
              <input type="radio" name="plan" className="mt-0.5 size-4 accent-brand-600" checked={pending === p.id} onChange={() => setPending(p.id)} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-semibold text-ink-900">{p.name}</span>
                  <span className="text-[14px] font-semibold text-ink-900 tabular-nums">
                    {formatINR(p.price)}
                    <span className="text-xs font-normal text-ink-500"> / {p.period}</span>
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-500">{p.note}</p>
              </div>
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel BluBuy Plus"
        description="Choose when your membership should end. You can rejoin any time."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Keep Plus
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCancelled(cancelChoice);
                setRenew(false);
                setModal(null);
              }}
            >
              Cancel membership
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {[
            { key: "end" as const, title: `At the end of this year, on ${renewsOnLabel}`, body: "Keep free delivery, early access and 2x BluCoins until then. Nothing else is charged." },
            {
              key: "now" as const,
              title: refundEstimate > 0 ? "Right away, with a part refund" : "Right away",
              body:
                refundEstimate > 0
                  ? `Benefits stop today and ${formatINR(refundEstimate)} for the unused months goes back to your card in 3 to 5 business days.`
                  : "Benefits stop today. No refund is due because your savings this year are already more than the plan price.",
            },
          ].map((o) => (
            <label key={o.key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", cancelChoice === o.key ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:border-line-strong")}>
              <input type="radio" name="cancel-when" className="mt-0.5 size-4 accent-brand-600" checked={cancelChoice === o.key} onChange={() => setCancelChoice(o.key)} />
              <div>
                <p className="text-[13.5px] font-semibold text-ink-900">{o.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{o.body}</p>
              </div>
            </label>
          ))}
          <p className="mt-1 flex items-start gap-2 text-xs text-ink-500">
            <CircleCheck size={14} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
            Orders already placed keep their free delivery and BluCoins.
          </p>
        </div>
      </Modal>
      {t.node}
    </>
  );
}
