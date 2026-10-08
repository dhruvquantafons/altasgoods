"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { BellRing, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/interactive";
import { cn, formatINR, formatDate } from "@/lib/utils";

export interface PlusPlanLite {
  id: string;
  name: string;
  price: number;
  period: string;
  perMonth: number;
}

/** signed_out: link to sign in; join and switch: explain and take a reminder request; current: the member's plan */
export type PlusPlanMode = "signed_out" | "join" | "switch" | "current";

// there is no membership purchase API yet, so a "Notify me" request is kept on this device only
const KEY = "bb_plus_notify";
const EVENT = "bb-plus-notify";

function readRequest() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function parse(raw: string | null): { plan: string; at: string } | null {
  try {
    const v = raw ? (JSON.parse(raw) as { plan?: unknown; at?: unknown }) : null;
    return v && typeof v.plan === "string" && typeof v.at === "string" ? { plan: v.plan, at: v.at } : null;
  } catch {
    return null;
  }
}

/** The call to action on a Plus plan card. */
export function PlusPlanAction({ plan, mode, best }: { plan: PlusPlanLite; mode: PlusPlanMode; best?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const request = parse(useSyncExternalStore(subscribe, readRequest, () => null));
  const requested = request?.plan === plan.id;

  const look = cn(
    "mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
    mode === "current" ? "bg-ink-100 text-ink-500" : best ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-line-strong text-ink-800 hover:bg-ink-50",
  );

  if (mode === "current")
    return (
      <button type="button" disabled className={look}>
        Your current plan
      </button>
    );
  if (mode === "signed_out")
    return (
      <Link href="/login?next=/plus" className={look}>
        Join for {formatINR(plan.price)}
      </Link>
    );

  function notify() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ plan: plan.id, at: new Date().toISOString() }));
      window.dispatchEvent(new Event(EVENT));
      setError("");
    } catch {
      setError("Your browser did not let us save this. Please check that site data is allowed and try again.");
    }
  }

  const name = plan.name.toLowerCase();
  const price = `${formatINR(plan.price)} a ${plan.period}${plan.perMonth < plan.price ? `, ${formatINR(plan.perMonth)} a month` : ""}, GST included`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={look}>
        {requested && <BellRing size={16} aria-hidden="true" />}
        {requested ? "Reminder set" : mode === "switch" ? `Switch to ${name}` : `Join for ${formatINR(plan.price)}`}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "switch" ? `Switch to the ${name} plan` : `Join AltasGoods Plus, ${name} plan`}
        description={price}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {requested ? "Done" : "Not now"}
            </Button>
            {!requested && (
              <Button icon={BellRing} onClick={notify}>
                Notify me
              </Button>
            )}
          </>
        }
      >
        {requested ? (
          <div className="flex gap-3 rounded-xl bg-success-50 px-4 py-3.5 text-sm text-success-800">
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
            <p>
              Noted on {formatDate(request.at)}: you want the {name} plan. Nothing has been charged. This page shows your request on this device, and you can join in one step
              once membership payments open.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-700">
            <p>
              {mode === "switch"
                ? `The ${name} plan is ${price}. Your current plan stays as it is until you switch.`
                : `Free delivery on every order, one-day delivery in top cities, 24 hour early sale access and 2x AltasCoins, for ${price}.`}
            </p>
            <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-[13px] text-ink-600">
              {mode === "switch" ? "Plan changes" : "Membership payments"} open with the AltasGoods Plus launch, so nothing can be charged today. Tap Notify me and we will keep your request.
            </p>
          </div>
        )}
        {error && (
          <p className="mt-3 text-[13px] text-danger-700" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
