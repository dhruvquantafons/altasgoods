"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AccountStep,
  BankStep,
  BrandStep,
  BusinessStep,
  CategoriesStep,
  PAN_RE,
  PanStep,
  PickupStep,
  ReviewStep,
  SignatureStep,
  StoreStep,
  type RegisterState,
} from "./steps";

const STEPS = [
  { title: "Account", hint: "Mobile and email OTP" },
  { title: "Business details", hint: "GSTIN and legal name" },
  { title: "PAN", hint: "For TDS and KYC" },
  { title: "Store", hint: "Name customers see" },
  { title: "Pickup address", hint: "Where we collect orders" },
  { title: "Bank account", hint: "Verified with ₹1" },
  { title: "Signature", hint: "For tax invoices" },
  { title: "Categories", hint: "What you will sell" },
  { title: "Brand registry", hint: "Optional" },
  { title: "Review and submit", hint: "Check and agree" },
];

const EMPTY: RegisterState = {
  mobile: "",
  mobileOtpSent: false,
  mobileOtp: "",
  mobileVerified: false,
  email: "",
  emailOtpSent: false,
  emailOtp: "",
  emailVerified: false,
  password: "",
  constitution: "",
  exempt: false,
  gstin: "",
  gstVerified: false,
  legalName: "",
  registeredAddress: "",
  gstState: "",
  pan: "",
  storeName: "",
  storeDescription: "",
  care: "",
  grievance: "",
  logo: false,
  line1: "",
  line2: "",
  landmark: "",
  pincode: "",
  city: "",
  state: "",
  contact: "",
  slot: "4:00 to 6:00 PM",
  holder: "",
  account: "",
  account2: "",
  ifsc: "",
  bankVerified: false,
  signature: "none",
  categories: [],
  ownBrand: false,
  brandName: "",
  trademark: "",
  tmClass: "21",
  reseller: false,
  agree: false,
};

/** A filled-in example used when a deep link opens a later step (for demos and reviews). */
const SAMPLE: RegisterState = {
  ...EMPTY,
  mobile: "9822011834",
  mobileOtpSent: true,
  mobileOtp: "482913",
  mobileVerified: true,
  email: "meera@sahyadrihome.in",
  emailOtpSent: true,
  emailOtp: "771204",
  emailVerified: true,
  password: "Sahyadri@2026",
  constitution: "Limited liability partnership (LLP)",
  gstin: "27AAKFS4410M1Z2",
  gstVerified: true,
  legalName: "Sahyadri Home Essentials LLP",
  registeredAddress: "Plot 12, Sector 7, Bhosari MIDC, Pune 411026",
  gstState: "Maharashtra",
  pan: "AAKFS4410M",
  storeName: "Sahyadri Home",
  storeDescription: "Handpicked cookware and home essentials from Pune, packed with care.",
  care: "+91 20 4012 8821",
  grievance: "Meera Kulkarni, grievance@sahyadrihome.in",
  line1: "Plot 12, Sector 7",
  line2: "Bhosari MIDC",
  landmark: "Near Telco Road signal",
  pincode: "411026",
  city: "Pune",
  state: "Maharashtra",
  contact: "Ravi Patil, +91 98220 11834",
  holder: "Sahyadri Home Essentials LLP",
  account: "50200041234821",
  account2: "50200041234821",
  ifsc: "HDFC0001234",
  bankVerified: true,
  signature: "uploaded",
  categories: ["cat-home", "cat-appliances", "cat-grocery"],
  ownBrand: true,
  brandName: "Sahyadri Home",
  trademark: "5281934",
};

function validFor(step: number, s: RegisterState) {
  switch (step) {
    case 0:
      return s.mobileVerified && s.emailVerified && s.password.length >= 8;
    case 1:
      return Boolean(s.constitution) && (s.exempt || s.gstVerified);
    case 2:
      return PAN_RE.test(s.pan);
    case 3:
      return s.storeName.trim().length >= 3 && s.care.trim().length >= 8 && s.grievance.trim().length > 3;
    case 4:
      return s.line1.trim().length > 3 && /^\d{6}$/.test(s.pincode) && Boolean(s.city) && Boolean(s.state) && s.contact.trim().length > 3;
    case 5:
      return s.bankVerified;
    case 6:
      return s.signature !== "none";
    case 7:
      return s.categories.length > 0;
    case 8:
      return !s.ownBrand || (s.brandName.trim().length > 1 && s.trademark.length >= 6);
    case 9:
      return s.agree;
    default:
      return false;
  }
}

const HINT = [
  "Verify your mobile and email, and set a password of 8 or more characters",
  "Choose a business type and verify your GSTIN",
  "Enter a valid PAN",
  "Add a store name, customer care number and grievance officer",
  "Complete the address, pincode and pickup contact",
  "Verify your bank account with ₹1",
  "Draw or upload your signature",
  "Choose at least one category",
  "Add your brand name and trademark number, or turn off brand registry",
  "Accept the agreement to submit",
];

export function RegisterWizard({
  initialStep = 0,
  constitutions,
  states,
  categories,
}: {
  initialStep?: number;
  constitutions: string[];
  states: string[];
  categories: { id: string; name: string; commission: number; gated?: string }[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [s, setS] = useState<RegisterState>(initialStep > 0 ? { ...SAMPLE, agree: false } : EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const set = (p: Partial<RegisterState>) => setS((prev) => ({ ...prev, ...p }));

  const completed = STEPS.filter((_, i) => i < step && validFor(i, s)).length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const canNext = validFor(step, s);
  // a step is reachable when every step before it is valid
  const reachable = (i: number) => STEPS.slice(0, i).every((_, j) => validFor(j, s));

  function next() {
    if (!canNext) return;
    if (step === STEPS.length - 1) {
      setSubmitting(true);
      router.push("/seller/register/status");
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const content = [
    <AccountStep key="0" s={s} set={set} />,
    <BusinessStep key="1" s={s} set={set} constitutions={constitutions} />,
    <PanStep key="2" s={s} set={set} />,
    <StoreStep key="3" s={s} set={set} />,
    <PickupStep key="4" s={s} set={set} states={states} />,
    <BankStep key="5" s={s} set={set} />,
    <SignatureStep key="6" s={s} set={set} />,
    <CategoriesStep key="7" s={s} set={set} categories={categories} />,
    <BrandStep key="8" s={s} set={set} />,
    <ReviewStep key="9" s={s} set={set} goTo={setStep} categories={categories} />,
  ][step];

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
          <p className="mt-1 text-[13px] text-ink-500">About 15 minutes. We save your progress as you go.</p>
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-ink-700">
                {completed} of {STEPS.length} complete
              </span>
              <span className="text-ink-500">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Registration progress">
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ol className="mt-6 flex flex-col">
            {STEPS.map((st, i) => {
              const isDone = i < step && validFor(i, s);
              const current = i === step;
              const can = reachable(i) || i < step;
              return (
                <li key={st.title} className="relative pb-1 last:pb-0">
                  {i < STEPS.length - 1 && <span className={cn("absolute top-8 left-[15px] h-[calc(100%-1.25rem)] w-px", isDone ? "bg-brand-300" : "bg-line-strong")} aria-hidden="true" />}
                  <button
                    type="button"
                    disabled={!can}
                    onClick={() => setStep(i)}
                    aria-current={current ? "step" : undefined}
                    className={cn("relative flex w-full items-start gap-3 rounded-xl px-0 py-1.5 text-left", can ? "cursor-pointer" : "cursor-not-allowed")}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-canvas",
                        isDone ? "bg-brand-600 text-white" : current ? "border-2 border-brand-600 bg-white text-brand-700" : "border border-line-strong bg-white text-ink-500",
                      )}
                    >
                      {isDone ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : !can ? <Lock size={12} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className="min-w-0 pt-1">
                      <span className={cn("block text-[13px] font-medium", current ? "text-ink-900" : isDone ? "text-ink-700" : "text-ink-500")}>{st.title}</span>
                      <span className="block text-xs text-ink-500">{st.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      {/* Step content */}
      <Card className="min-w-0 self-start">
        <div className="p-5 sm:p-8">
          <div className="max-w-2xl">{content}</div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          {step > 0 ? (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {!canNext && <p className="text-xs text-ink-500 sm:max-w-xs sm:text-right">{HINT[step]}</p>}
            <Button size="lg" disabled={!canNext || submitting} onClick={next} iconRight={step === STEPS.length - 1 ? Send : ArrowRight}>
              {step === STEPS.length - 1 ? (submitting ? "Submitting" : "Submit for verification") : step === 8 && !s.ownBrand && !s.reseller ? "Skip for now" : "Save and continue"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
