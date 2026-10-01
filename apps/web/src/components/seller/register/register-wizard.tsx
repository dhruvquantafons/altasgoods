"use client";

import { useState } from "react";
import { Check, CircleAlert, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Constitution, SellerApplication } from "@/lib/api/types";
import { stepDone, stepForFlag, STEPS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import {
  AccountStep,
  BankStep,
  BrandStep,
  BusinessStep,
  CategoriesStep,
  ChangesBanner,
  DocumentsStep,
  PanStep,
  PickupStep,
  ReviewStep,
  SignatureStep,
  StoreStep,
  type Me,
  type StepProps,
} from "./steps";

/** Where to open: the first flagged step after a change request, otherwise the first unfinished one. */
function startingStep(app: SellerApplication | null, me: Me | null) {
  if (app?.status === "ACTION_REQUIRED" && app.flaggedItems.length) return Math.min(...app.flaggedItems.map((f) => stepForFlag(f.key)));
  const i = STEPS.findIndex((s) => !stepDone(s.key, app, me));
  return i < 0 ? STEPS.length - 1 : i;
}

export function RegisterWizard({
  user,
  application,
  constitutions,
  states,
  categories,
  sandbox,
}: {
  user: Me | null;
  application: SellerApplication | null;
  constitutions: Constitution[];
  states: string[];
  categories: { id: string; name: string; commission: number; gated?: string }[];
  sandbox: boolean;
}) {
  const [app, setApp] = useState(application);
  const [me, setMe] = useState(user);
  const [step, setStep] = useState(() => startingStep(application, user));

  const done = STEPS.map((s) => stepDone(s.key, app, me));
  const completed = done.filter(Boolean).length;
  const pct = Math.round((completed / (STEPS.length - 1)) * 100);
  const flaggedSteps = new Set(app?.status === "ACTION_REQUIRED" ? app.flaggedItems.map((f) => stepForFlag(f.key)) : []);
  // a step opens once every step before it is complete
  const reachable = (i: number) => i <= step || done.slice(0, i).every(Boolean);

  const goTo = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const props: StepProps = {
    app,
    me,
    setApp,
    setMe,
    next: () => goTo(Math.min(step + 1, STEPS.length - 1)),
    back: step > 0 ? () => goTo(step - 1) : undefined,
    goTo,
    sandbox,
  };

  const key = STEPS[step]!.key;
  // every step after the first needs a started application
  const content =
    key !== "account" && !app ? (
      <AccountStep {...props} />
    ) : (
      {
        account: <AccountStep {...props} />,
        business: <BusinessStep {...props} constitutions={constitutions} />,
        pan: <PanStep {...props} />,
        store: <StoreStep {...props} />,
        pickup: <PickupStep {...props} states={states} />,
        bank: <BankStep {...props} />,
        documents: <DocumentsStep {...props} />,
        signature: <SignatureStep {...props} />,
        categories: <CategoriesStep {...props} categories={categories} />,
        brand: <BrandStep {...props} />,
        review: <ReviewStep {...props} categories={categories} />,
      }[key]
    );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10">
      {/* Mobile progress header */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-ink-900">
            Step {step + 1} of {STEPS.length}, {STEPS[step]!.title}
          </p>
          <p className="text-xs text-ink-500">{pct}% done</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Registration progress">
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {/* Step rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <h1 className="font-display text-xl font-semibold text-ink-900">Start selling on BluBuy</h1>
          <p className="mt-1 text-[13px] text-ink-500">About 15 minutes. Every step is saved, so you can finish later.</p>
          {app && <p className="mt-1 font-mono text-xs text-ink-500">Application {app.id}</p>}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink-700">
                {completed} of {STEPS.length - 1} complete
              </span>
              <span className="text-ink-500">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Registration progress">
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ol className="mt-6 flex flex-col">
            {STEPS.map((st, i) => {
              const isDone = done[i] && !flaggedSteps.has(i);
              const flagged = flaggedSteps.has(i);
              const current = i === step;
              const can = reachable(i) && (i === 0 || !!app);
              return (
                <li key={st.key} className="relative pb-1 last:pb-0">
                  {i < STEPS.length - 1 && <span className={cn("absolute top-8 left-[15px] h-[calc(100%-1.25rem)] w-px", isDone ? "bg-brand-300" : "bg-line-strong")} aria-hidden="true" />}
                  <button
                    type="button"
                    disabled={!can}
                    onClick={() => goTo(i)}
                    aria-current={current ? "step" : undefined}
                    className={cn("relative flex w-full items-start gap-3 rounded-xl px-0 py-1.5 text-left", can ? "cursor-pointer" : "cursor-not-allowed")}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-canvas",
                        flagged ? "bg-warning-500 text-white" : isDone ? "bg-brand-600 text-white" : current ? "border-2 border-brand-600 bg-white text-brand-700" : "border border-line-strong bg-white text-ink-500",
                      )}
                    >
                      {flagged ? <CircleAlert size={15} aria-hidden="true" /> : isDone ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : !can ? <Lock size={12} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className={cn("block text-[13px] font-medium", current ? "text-ink-900" : isDone ? "text-ink-700" : "text-ink-500")}>{st.title}</span>
                      <span className={cn("block text-xs", flagged ? "font-medium text-warning-700" : "text-ink-500")}>{flagged ? "Needs changes" : st.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      {/* Step content */}
      <div className="min-w-0">
        {app && <ChangesBanner app={app} goTo={goTo} />}
        <Card className="min-w-0 self-start">
          {/* steps cap their width; the footer spans the card */}
          <div className="p-5 sm:p-8 [&>*:not([data-step-footer])]:max-w-2xl">{content}</div>
        </Card>
      </div>
    </div>
  );
}
