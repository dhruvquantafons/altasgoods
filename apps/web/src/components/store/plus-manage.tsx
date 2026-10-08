"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Manage Plus: auto-renew toggle and a one-step, neutral cancellation (no confirm shaming). */
export function PlusManage({ renewsOn, refundNote }: { renewsOn: string; refundNote: string }) {
  const [auto, setAuto] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  if (cancelled)
    return (
      <div className="rounded-xl bg-white/10 p-4 text-sm text-white ring-1 ring-white/15">
        <p className="font-semibold">Your membership is cancelled</p>
        <p className="mt-1 text-brand-100">
          Benefits stay active until {renewsOn}. {refundNote} You can rejoin any time.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
        <div>
          <p id="plus-auto" className="text-sm font-medium text-white">
            Auto-renew
          </p>
          <p className="mt-0.5 text-[13px] text-brand-100">{auto ? `Renews on ${renewsOn}. We remind you 7 days before.` : `Ends on ${renewsOn}. No further charges.`}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          aria-labelledby="plus-auto"
          onClick={() => setAuto((a) => !a)}
          className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", auto ? "bg-brand-400" : "bg-white/25")}
        >
          <span className={cn("inline-block size-5 rounded-full bg-white shadow-xs transition-transform", auto ? "translate-x-[22px]" : "translate-x-0.5")} />
        </button>
      </div>
      {confirming ? (
        <div className="rounded-xl bg-white p-4 text-sm text-ink-700">
          <p className="font-semibold text-ink-900">Cancel AltasGoods Plus?</p>
          <p className="mt-1">
            Benefits continue until {renewsOn}. {refundNote}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setCancelled(true)} className="h-9 rounded-lg bg-ink-900 px-4 text-[13px] font-semibold text-white hover:bg-ink-800">
              Cancel membership
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="h-9 rounded-lg border border-line-strong px-4 text-[13px] font-semibold text-ink-800 hover:bg-ink-50">
              Go back
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-[13px] font-semibold text-brand-100 underline-offset-4 hover:underline">
          Cancel membership
        </button>
      )}
    </div>
  );
}
