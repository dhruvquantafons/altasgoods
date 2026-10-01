"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleAlert,
  CircleCheck,
  Eraser,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  PenLine,
  Send,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { requestOtp, verifyOtp } from "@/app/actions/auth";
import {
  checkStoreName,
  loadApplication,
  removeDocument,
  requestEmailCode,
  saveApplication,
  startApplication,
  submitApplication,
  updateOwnerName,
  uploadDocument,
  verifyBank,
  verifyEmailCode,
  verifyGstin,
  verifyPan,
  type Result,
} from "@/app/actions/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/interactive";
import type { ApplicationDocument, Constitution, DocumentKind, SellerApplication } from "@/lib/api/types";
import { CONSTITUTION_LABEL, constitutionNoun, fileSize, formatPhone, stepForFlag, STEPS } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export type Me = { phone: string; name: string | null; email: string | null; emailVerified: boolean };

export interface StepProps {
  app: SellerApplication | null;
  me: Me | null;
  setApp: (a: SellerApplication) => void;
  setMe: (m: Me) => void;
  next: () => void;
  back?: () => void;
  goTo: (i: number) => void;
  sandbox: boolean;
}

export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PINCODES: Record<string, [string, string]> = {
  "411026": ["Pune", "Maharashtra"],
  "411001": ["Pune", "Maharashtra"],
  "400072": ["Mumbai", "Maharashtra"],
  "560034": ["Bengaluru", "Karnataka"],
  "560103": ["Bengaluru", "Karnataka"],
  "110020": ["New Delhi", "Delhi"],
  "600032": ["Chennai", "Tamil Nadu"],
  "500081": ["Hyderabad", "Telangana"],
  "380015": ["Ahmedabad", "Gujarat"],
  "683503": ["Kochi", "Kerala"],
};
const BANKS: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  FDRL: "Federal Bank",
  IDFB: "IDFC FIRST Bank",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
};

/* -------------------------------- Shared -------------------------------- */

/** Runs a server action, tracking busy state and its error (and field errors). */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  async function run<T>(fn: () => Promise<Result<T>>): Promise<T | null> {
    setBusy(true);
    setError(null);
    setErrors([]);
    const r = await fn();
    setBusy(false);
    if (r.ok) return r.data;
    setError(r.error);
    setErrors((r.errors ?? []).filter((e) => e.path));
    return null;
  }
  const fields: Record<string, string> = Object.fromEntries(errors.map((e) => [e.path, e.message]));
  return { busy, error, errors, fields, run, setError };
}

export function StepTitle({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{description}</p>
    </div>
  );
}

function StepFooter({ back, hint, disabled, busy, label = "Save and continue", icon = ArrowRight, onClick, error }: { back?: () => void; hint?: string; disabled?: boolean; busy?: boolean; label?: string; icon?: typeof ArrowRight; onClick: () => void; error?: string | null }) {
  return (
    <div data-step-footer className="-mx-5 mt-8 -mb-5 flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      {back ? (
        <Button variant="ghost" icon={ArrowLeft} onClick={back}>
          Back
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {error ? (
          <p role="alert" className="text-xs text-danger-700 sm:max-w-sm sm:text-right">
            {error}
          </p>
        ) : (
          disabled && hint && <p className="text-xs text-ink-500 sm:max-w-xs sm:text-right">{hint}</p>
        )}
        <Button size="lg" disabled={disabled || busy} onClick={onClick} iconRight={busy ? undefined : icon}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {busy ? "Saving" : label}
        </Button>
      </div>
    </div>
  );
}

function Notice({ tone, icon: Icon, title, children }: { tone: "success" | "warning" | "danger" | "info"; icon: typeof CircleCheck; title: ReactNode; children?: ReactNode }) {
  const styles = {
    success: "border-success-100 bg-success-50/60 text-success-700",
    warning: "border-warning-100 bg-warning-50/70 text-warning-700",
    danger: "border-danger-100 bg-danger-50/70 text-danger-700",
    info: "border-brand-100 bg-brand-50/60 text-brand-800",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-4", styles)}>
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon size={16} aria-hidden="true" /> {title}
      </p>
      {children && <div className="mt-2 text-[13px] text-ink-700">{children}</div>}
    </div>
  );
}

function SandboxHint({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-accent-300 bg-accent-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-700">
      <FlaskConical size={14} className="mt-px shrink-0 text-accent-800" aria-hidden="true" />
      <span>
        <span className="font-semibold text-accent-800">Sandbox: </span>
        {children}
      </span>
    </p>
  );
}

function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className={cn(k === "Principal place of business" && "sm:col-span-2")}>
          <dt className="text-xs text-ink-500">{k}</dt>
          <dd className="font-medium break-words text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function DevCode({ code, onFill }: { code?: string; onFill: () => void }) {
  if (!code) return null;
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-ink-600">
      Development code <span className="font-mono font-semibold text-ink-900">{code}</span>
      <button type="button" onClick={onFill} className="font-medium text-brand-700 hover:underline">
        Fill it in
      </button>
    </p>
  );
}

/* ------------------------------- 1 Account ------------------------------ */

function PhoneSignIn() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; devCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const a = useAction();
  return (
    <div className="flex flex-col gap-4">
      <Field label="Your full name" htmlFor="rg-owner-new" hint="As on your PAN. Used for your seller account.">
        <Input id="rg-owner-new" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label="Mobile number" htmlFor="rg-mobile" required error={a.fields.phone}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-500">+91</span>
            <Input id="rg-mobile" type="tel" inputMode="numeric" value={mobile} disabled={!!challenge} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98765 43210" style={{ paddingLeft: "3rem" }} />
          </div>
          <Button
            variant="secondary"
            disabled={!MOBILE_RE.test(mobile) || a.busy}
            onClick={async () => {
              const r = await a.run(() => requestOtp(mobile));
              if (r) {
                setChallenge({ id: r.challengeId, devCode: r.devCode });
                setCode("");
              }
            }}
          >
            {challenge ? "Resend" : "Send OTP"}
          </Button>
        </div>
      </Field>
      {challenge && (
        <div className="rounded-xl bg-ink-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Enter the 6 digit OTP" htmlFor="rg-mobile-otp" className="flex-1">
              <Input id="rg-mobile-otp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="font-mono tracking-[0.4em]" autoComplete="one-time-code" />
            </Field>
            <Button
              disabled={code.length !== 6 || a.busy}
              onClick={async () => {
                const ok = await a.run(() => verifyOtp({ challengeId: challenge.id, code, name: name.trim().length >= 2 ? name.trim() : undefined }));
                if (ok) router.refresh();
              }}
            >
              {a.busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Verify and continue
            </Button>
          </div>
          <DevCode code={challenge.devCode} onFill={() => setCode(challenge.devCode ?? "")} />
        </div>
      )}
      {a.error && (
        <p role="alert" className="text-xs text-danger-700">
          {a.error}
        </p>
      )}
      <p className="text-xs text-ink-500">Already a BluBuy shopper? Use the same number; your seller account is added to it.</p>
    </div>
  );
}

export function AccountStep({ app, me, setApp, setMe, next }: StepProps) {
  const [name, setName] = useState(me?.name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const mail = useAction();
  const save = useAction();

  if (!me)
    return (
      <>
        <StepTitle title="Create your seller account" description="Start with your mobile number. We send a one-time code; there is no password to remember." />
        <PhoneSignIn />
      </>
    );

  const emailVerified = me.emailVerified && email.trim().toLowerCase() === (me.email ?? "").toLowerCase();
  const canNext = name.trim().length >= 2 && emailVerified;
  return (
    <>
      <StepTitle title="Your seller account" description="You sign in to Seller Hub with this mobile number. We send verification results and payout notices to your business email." />
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-xs text-ink-500">Mobile number</p>
            <p className="font-mono text-sm font-medium text-ink-900">{formatPhone(me.phone)}</p>
          </div>
          <Badge tone="success" icon={CircleCheck}>
            Verified
          </Badge>
        </div>
        <Field label="Owner's full name" htmlFor="rg-owner" required hint="As on your PAN">
          <Input id="rg-owner" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <div>
          <Field label="Business email" htmlFor="rg-email" required error={mail.fields.email}>
            <div className="flex gap-2">
              <Input
                id="rg-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.trim());
                  setSent(null);
                }}
                placeholder="you@yourbusiness.in"
                className="flex-1"
              />
              {!emailVerified && (
                <Button
                  variant="secondary"
                  disabled={!EMAIL_RE.test(email) || mail.busy}
                  onClick={async () => {
                    const r = await mail.run(() => requestEmailCode(email));
                    if (r) {
                      setSent({ devCode: r.devCode });
                      setCode("");
                    }
                  }}
                >
                  {sent ? "Resend" : "Send code"}
                </Button>
              )}
            </div>
          </Field>
          {emailVerified ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success-700">
              <CircleCheck size={14} aria-hidden="true" /> Verified
            </p>
          ) : (
            sent && (
              <div className="mt-3 rounded-xl bg-ink-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Field label="Code from the email" htmlFor="rg-email-otp" className="flex-1">
                    <Input id="rg-email-otp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="font-mono tracking-[0.4em]" />
                  </Field>
                  <Button
                    disabled={code.length !== 6 || mail.busy}
                    onClick={async () => {
                      const u = await mail.run(() => verifyEmailCode(code));
                      if (u) setMe({ phone: u.phone, name: u.name, email: u.email, emailVerified: u.emailVerified });
                    }}
                  >
                    Verify
                  </Button>
                </div>
                <DevCode code={sent.devCode} onFill={() => setCode(sent.devCode ?? "")} />
              </div>
            )
          )}
          {mail.error && !mail.fields.email && <p className="mt-1.5 text-xs text-danger-700">{mail.error}</p>}
        </div>
      </div>
      <StepFooter
        hint="Add your name and verify your business email"
        disabled={!canNext}
        busy={save.busy}
        error={save.error}
        onClick={async () => {
          if (name.trim() !== (me.name ?? "")) {
            const u = await save.run(() => updateOwnerName(name.trim()));
            if (!u) return;
            setMe({ ...me, name: u.name });
          }
          if (!app) {
            const started = await save.run(() => startApplication());
            if (!started) return;
            setApp(started);
          }
          next();
        }}
      />
    </>
  );
}

/* ------------------------------ 2 Business ------------------------------ */

export function BusinessStep({ app, setApp, next, back, sandbox, constitutions }: StepProps & { constitutions: Constitution[] }) {
  const b = app!.business;
  const [constitution, setConstitution] = useState<Constitution | "">(b.constitution ?? "");
  const [gstin, setGstin] = useState(b.gstin ?? "");
  const [legalName, setLegalName] = useState(b.gstExempt ? (b.legalName ?? "") : "");
  const [address, setAddress] = useState(b.gstExempt ? (b.registeredAddress ?? "") : "");
  const check = useAction();
  const save = useAction();
  const gst = app!.checks.gst;
  const verifiedHere = !!gst && gst.gstin === gstin;
  const formatOk = GSTIN_RE.test(gstin);

  const canNext = !!constitution && (b.gstExempt ? legalName.trim().length >= 3 && address.trim().length >= 5 : verifiedHere && gst!.portalStatus === "ACTIVE");
  return (
    <>
      <StepTitle title="Business details" description="We look your GSTIN up on the GST portal for your legal name and registered address. Sellers of GST exempt goods only, such as books, register with PAN." />
      <fieldset className="mb-6">
        <legend className="mb-2 text-[13px] font-medium text-ink-700">Business type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {constitutions.map((c) => (
            <label key={c} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm", constitution === c ? "border-brand-300 bg-brand-50/50 font-medium text-ink-900" : "border-line text-ink-700 hover:bg-ink-50")}>
              <input type="radio" name="rg-const" checked={constitution === c} onChange={() => setConstitution(c)} className="accent-brand-600" />
              {CONSTITUTION_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <Checkbox
        checked={b.gstExempt}
        disabled={check.busy}
        onChange={async (e) => {
          const r = await check.run(() => saveApplication({ gstExempt: e.target.checked, ...(constitution ? { constitution } : {}) }));
          if (r) {
            setApp(r);
            setGstin("");
          }
        }}
        label="I only sell GST exempt products"
        description="For example printed books. You can add a GSTIN later to sell in other categories."
      />
      {!b.gstExempt ? (
        <div className="mt-5">
          <Field label="GSTIN" htmlFor="rg-gstin" required error={check.fields.gstin ?? (gstin.length === 15 && !formatOk ? "This does not look like a GSTIN. Check the 15 characters." : undefined)} hint="15 characters, for example 27AAKFS4410M1ZX">
            <div className="flex gap-2">
              <Input id="rg-gstin" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="flex-1 font-mono tracking-wider uppercase" />
              {!verifiedHere && (
                <Button
                  variant="secondary"
                  disabled={!formatOk || check.busy}
                  onClick={async () => {
                    const r = await check.run(() => verifyGstin(gstin, constitution || undefined));
                    if (r) setApp(r);
                  }}
                >
                  {check.busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {check.busy ? "Checking" : "Verify GSTIN"}
                </Button>
              )}
            </div>
          </Field>
          {check.error && !check.fields.gstin && <p className="mt-1.5 text-xs text-danger-700">{check.error}</p>}
          {verifiedHere && (
            <div className="mt-4">
              {gst!.portalStatus === "ACTIVE" ? (
                <Notice tone="success" icon={BadgeCheck} title="Active on the GST portal">
                  <Dl
                    rows={[
                      ["Legal name", gst!.legalName],
                      ["Trade name", gst!.tradeName],
                      ["State", gst!.state],
                      ["Registered on", gst!.registeredOn],
                      ["Principal place of business", gst!.principalAddress],
                    ]}
                  />
                  {constitution && gst!.constitution !== constitution && (
                    <p className="mt-3 text-xs text-warning-700">
                      The GST registration says {constitutionNoun(gst!.constitution)}. Choose the type that matches it, or our team will ask you about it.
                    </p>
                  )}
                </Notice>
              ) : (
                <Notice tone="danger" icon={TriangleAlert} title={`This GSTIN is ${gst!.portalStatus.toLowerCase()} on the GST portal`}>
                  {gst!.filing}. Sellers need an active registration. Enter a different GSTIN.
                </Notice>
              )}
            </div>
          )}
          <SandboxHint show={sandbox}>any GSTIN with a valid check character is active. 27AAKFS4410M1ZX is Sahyadri Home Essentials LLP; 29AAGCK7781Q1ZF is a cancelled registration.</SandboxHint>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <Field label="Legal business name" htmlFor="rg-legal" required hint="Exactly as on your PAN">
            <Input id="rg-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </Field>
          <Field label="Registered address" htmlFor="rg-regaddr" required>
            <Textarea id="rg-regaddr" value={address} onChange={(e) => setAddress(e.target.value)} className="min-h-20" />
          </Field>
        </div>
      )}
      <StepFooter
        back={back}
        hint={b.gstExempt ? "Choose a business type and add your legal name and address" : "Choose a business type and verify an active GSTIN"}
        disabled={!canNext}
        busy={save.busy}
        error={save.error}
        onClick={async () => {
          const r = await save.run(() => saveApplication({ constitution: constitution as Constitution, ...(b.gstExempt ? { legalName: legalName.trim(), registeredAddress: address.trim() } : {}) }));
          if (r) {
            setApp(r);
            next();
          }
        }}
      />
    </>
  );
}

/* --------------------------------- 3 PAN -------------------------------- */

export function PanStep({ app, setApp, next, back, sandbox }: StepProps) {
  const b = app!.business;
  const pc = app!.checks.pan;
  const [pan, setPan] = useState(b.pan ?? "");
  const a = useAction();
  const ok = PAN_RE.test(pan);
  const canNext = !!pc?.holderName && pc.result !== "FAILED" && pc.pan === (b.gstExempt ? pan : b.pan);
  return (
    <>
      <StepTitle
        title="PAN"
        description={b.gstExempt ? "Your business PAN. TDS under section 194-O is deposited against it." : "Taken from your GSTIN (characters 3 to 12). TDS under section 194-O is deposited against this PAN."}
      />
      {b.gstExempt ? (
        <Field label="PAN" htmlFor="rg-pan" required error={a.fields.pan ?? (pan.length === 10 && !ok ? "PAN is 5 letters, 4 digits and a letter, for example ABCPS1234K" : undefined)}>
          <div className="flex gap-2 sm:max-w-md">
            <Input id="rg-pan" maxLength={10} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="flex-1 font-mono tracking-wider uppercase" />
            <Button
              variant="secondary"
              disabled={!ok || a.busy || !b.legalName}
              onClick={async () => {
                const r = await a.run(() => verifyPan(pan, b.legalName!));
                if (r) setApp(r);
              }}
            >
              {a.busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              Verify PAN
            </Button>
          </div>
        </Field>
      ) : (
        <div className="rounded-xl border border-line px-4 py-3">
          <p className="text-xs text-ink-500">PAN</p>
          <p className="font-mono text-sm font-semibold tracking-wider text-ink-900">{b.pan ?? "Verify your GSTIN first"}</p>
        </div>
      )}
      {a.error && !a.fields.pan && <p className="mt-1.5 text-xs text-danger-700">{a.error}</p>}
      {pc && (b.gstExempt ? pc.pan === pan : true) && (
        <div className="mt-4">
          <Notice
            tone={pc.result === "VERIFIED" ? "success" : pc.result === "PARTIAL" ? "warning" : "danger"}
            icon={pc.result === "FAILED" ? TriangleAlert : pc.result === "PARTIAL" ? CircleAlert : BadgeCheck}
            title={!pc.holderName ? "This PAN is not in the Income Tax database" : pc.result === "VERIFIED" ? "Name matches your business" : pc.result === "PARTIAL" ? "Name partly matches; our team will check it" : "Name does not match your business"}
          >
            {pc.holderName && (
              <Dl
                rows={[
                  ["Name on PAN", pc.holderName],
                  ["PAN type", pc.holderType],
                  ["Name match", `${pc.nameMatchScore}%`],
                  ["Linked with Aadhaar", pc.aadhaarLinked ? "Yes" : "No"],
                ]}
              />
            )}
          </Notice>
        </div>
      )}
      <SandboxHint show={sandbox && b.gstExempt}>a PAN whose digits are 0000 is not found; 9999 returns a different holder.</SandboxHint>
      <StepFooter back={back} hint={b.gstExempt ? "Verify a PAN whose holder matches your business" : "Verify your GSTIN in the previous step"} disabled={!canNext} onClick={next} label="Continue" />
    </>
  );
}

/* -------------------------------- 4 Store ------------------------------- */

export function StoreStep({ app, setApp, next, back }: StepProps) {
  const s = app!.store;
  const [name, setName] = useState(s.name ?? "");
  const [description, setDescription] = useState(s.description ?? "");
  const [care, setCare] = useState(s.careNumber ?? "");
  const [grievance, setGrievance] = useState(s.grievanceContact ?? "");
  const [availability, setAvailability] = useState<{ name: string; available: boolean; reason?: string } | null>(null);
  const save = useAction();
  const trimmed = name.trim();

  useEffect(() => {
    if (trimmed.length < 3 || trimmed === s.name) return;
    const t = setTimeout(async () => {
      const r = await checkStoreName(trimmed);
      if (r.ok) setAvailability({ name: trimmed, ...r.data });
    }, 400);
    return () => clearTimeout(t);
  }, [trimmed, s.name]);

  const status: { available: boolean; reason?: string } | null = trimmed === s.name ? { available: true } : availability?.name === trimmed ? availability : null;
  const canNext = trimmed.length >= 3 && status?.available !== false && care.trim().length >= 8 && grievance.trim().length >= 4;
  return (
    <>
      <StepTitle title="Your store" description="Customers see your store name on every product you sell and on your store page." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Store display name" htmlFor="rg-store" required className="sm:col-span-2" error={save.fields.storeName ?? (status && !status.available ? status.reason : undefined)}>
          <Input id="rg-store" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Sahyadri Home" />
          {trimmed.length >= 3 && status?.available && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success-700">
              <CircleCheck size={14} aria-hidden="true" /> {trimmed} is available
            </p>
          )}
        </Field>
        <Field label="Store description" htmlFor="rg-desc" className="sm:col-span-2" hint={`${description.length} of 300 characters`}>
          <Textarea id="rg-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Handpicked cookware and home essentials from Pune, packed with care." />
        </Field>
        <Field label="Customer care number" htmlFor="rg-care" required>
          <Input id="rg-care" inputMode="tel" value={care} onChange={(e) => setCare(e.target.value)} placeholder="+91 20 4012 8821" />
        </Field>
        <Field label="Grievance officer" htmlFor="rg-griev" required hint="Name and email, shown on your store page">
          <Input id="rg-griev" value={grievance} onChange={(e) => setGrievance(e.target.value)} placeholder="Meera Kulkarni, grievance@sahyadrihome.in" />
        </Field>
      </div>
      <div className="mt-6 rounded-xl border border-line bg-ink-50/60 p-4">
        <p className="text-xs font-medium text-ink-500">Preview on a product page</p>
        <div className="mt-2 rounded-lg border border-line bg-white px-4 py-3 text-[13px]">
          <p className="text-ink-600">
            Sold by <span className="font-semibold text-brand-700">{trimmed || "Your store"}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-500">New seller on BluBuy, ratings appear after your first orders</p>
        </div>
        <p className="mt-2 text-xs text-ink-500">Add a logo and banner from Seller Hub settings once you are approved.</p>
      </div>
      <StepFooter
        back={back}
        hint="Add an available store name, a customer care number and a grievance officer"
        disabled={!canNext}
        busy={save.busy}
        error={save.fields.storeName ? null : save.error}
        onClick={async () => {
          const r = await save.run(() => saveApplication({ storeName: trimmed, storeDescription: description.trim(), careNumber: care.trim(), grievanceContact: grievance.trim() }));
          if (r) {
            setApp(r);
            next();
          }
        }}
      />
    </>
  );
}

/* ------------------------------- 5 Pickup ------------------------------- */

export function PickupStep({ app, setApp, next, back, states }: StepProps & { states: string[] }) {
  const p = app!.pickup;
  const [f, setF] = useState({
    line1: p?.line1 ?? "",
    line2: p?.line2 ?? "",
    landmark: p?.landmark ?? "",
    pincode: p?.pincode ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    contactName: p?.contactName ?? "",
    contactPhone: (p?.contactPhone ?? "").replace(/^\+91/, ""),
    slot: p?.slot ?? "4:00 to 6:00 PM",
  });
  const save = useAction();
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));
  const gstState = app!.business.gstExempt ? null : app!.business.gstState;
  const canNext = f.line1.trim().length >= 3 && /^[1-8]\d{5}$/.test(f.pincode) && f.city.trim().length >= 2 && !!f.state && f.contactName.trim().length >= 2 && MOBILE_RE.test(f.contactPhone);
  return (
    <>
      <StepTitle title="Pickup address" description="BluBuy Logistics collects your packages from here. Add more locations later from Settings." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" htmlFor="rg-l1" required className="sm:col-span-2">
          <Input id="rg-l1" value={f.line1} onChange={(e) => set({ line1: e.target.value })} placeholder="Building, unit, street" />
        </Field>
        <Field label="Address line 2" htmlFor="rg-l2">
          <Input id="rg-l2" value={f.line2} onChange={(e) => set({ line2: e.target.value })} placeholder="Area or industrial estate" />
        </Field>
        <Field label="Landmark" htmlFor="rg-lm">
          <Input id="rg-lm" value={f.landmark} onChange={(e) => set({ landmark: e.target.value })} placeholder="Near Telco Road signal" />
        </Field>
        <Field label="Pincode" htmlFor="rg-pin" required hint={PINCODES[f.pincode] ? "City and state filled in" : "6 digits"}>
          <Input
            id="rg-pin"
            inputMode="numeric"
            maxLength={6}
            value={f.pincode}
            onChange={(e) => {
              const pin = e.target.value.replace(/\D/g, "");
              const hit = PINCODES[pin];
              set(hit ? { pincode: pin, city: hit[0], state: hit[1] } : { pincode: pin });
            }}
            className="font-mono"
          />
        </Field>
        <Field label="City" htmlFor="rg-city" required>
          <Input id="rg-city" value={f.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="State" htmlFor="rg-state" required>
          <Select id="rg-state" value={f.state} onChange={(e) => set({ state: e.target.value })}>
            <option value="">Choose a state</option>
            {states.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred pickup slot" htmlFor="rg-slot">
          <Select id="rg-slot" value={f.slot} onChange={(e) => set({ slot: e.target.value })}>
            <option>11:00 AM to 1:00 PM</option>
            <option>2:00 to 4:00 PM</option>
            <option>4:00 to 6:00 PM</option>
          </Select>
        </Field>
        <Field label="Pickup contact name" htmlFor="rg-contact" required hint="Who hands over packages">
          <Input id="rg-contact" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="Ravi Patil" />
        </Field>
        <Field label="Pickup contact mobile" htmlFor="rg-contact-phone" required error={f.contactPhone.length === 10 && !MOBILE_RE.test(f.contactPhone) ? "Enter a valid 10 digit mobile number" : save.fields["pickup.contactPhone"]}>
          <Input id="rg-contact-phone" inputMode="numeric" maxLength={10} value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value.replace(/\D/g, "") })} placeholder="98220 11834" className="font-mono" />
        </Field>
      </div>
      {gstState && f.state && f.state !== gstState && (
        <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-[13px] text-warning-700">
          This address is in {f.state} but your GSTIN is registered in {gstState}. Add it as an additional place of business on your GST registration, or register in {f.state}.
        </p>
      )}
      <p className="mt-4 text-xs text-ink-500">If you use BluBuy Fulfilled, each fulfilment centre you store stock in is added to your GST registration as an additional place of business.</p>
      <StepFooter
        back={back}
        hint="Complete the address, pincode and pickup contact"
        disabled={!canNext}
        busy={save.busy}
        error={save.error}
        onClick={async () => {
          const r = await save.run(() =>
            saveApplication({
              pickup: {
                line1: f.line1.trim(),
                line2: f.line2.trim() || undefined,
                landmark: f.landmark.trim() || undefined,
                city: f.city.trim(),
                state: f.state,
                pincode: f.pincode,
                contactName: f.contactName.trim(),
                contactPhone: f.contactPhone,
                slot: f.slot,
              },
            }),
          );
          if (r) {
            setApp(r);
            next();
          }
        }}
      />
    </>
  );
}

/* -------------------------------- 6 Bank -------------------------------- */

export function BankStep({ app, setApp, next, back, sandbox }: StepProps) {
  const saved = app!.bank;
  const bc = app!.checks.bank;
  const [editing, setEditing] = useState(!saved);
  const [holder, setHolder] = useState(saved?.holder ?? app!.business.legalName ?? "");
  const [account, setAccount] = useState("");
  const [account2, setAccount2] = useState("");
  const [ifsc, setIfsc] = useState(saved?.ifsc ?? "");
  const a = useAction();
  const ifscOk = IFSC_RE.test(ifsc);
  const bankName = ifscOk ? (BANKS[ifsc.slice(0, 4)] ?? null) : null;
  const mismatch = account2.length > 0 && account !== account2;
  const ready = holder.trim().length >= 3 && account.length >= 9 && account === account2 && ifscOk;
  const canNext = !!bc && bc.result !== "FAILED" && !editing;

  return (
    <>
      <StepTitle title="Bank account" description="Payouts go to this account. It must be a current or savings account in your business's legal name." />
      {!editing && saved && bc ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-900">
              {bc.bankName}, account ending {saved.accountLast4}
            </p>
            <p className="text-xs text-ink-500">
              {saved.ifsc}, {bc.branch}. Holder entered: {saved.holder}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name" htmlFor="rg-holder" required className="sm:col-span-2">
            <Input id="rg-holder" value={holder} onChange={(e) => setHolder(e.target.value)} />
          </Field>
          <Field label="Account number" htmlFor="rg-acc" required error={a.fields.account}>
            <Input id="rg-acc" type="password" inputMode="numeric" autoComplete="off" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 18))} />
          </Field>
          <Field label="Confirm account number" htmlFor="rg-acc2" required error={mismatch ? "Account numbers do not match" : undefined}>
            <Input id="rg-acc2" inputMode="numeric" autoComplete="off" value={account2} onChange={(e) => setAccount2(e.target.value.replace(/\D/g, "").slice(0, 18))} aria-invalid={mismatch} />
          </Field>
          <Field label="IFSC" htmlFor="rg-ifsc" required hint={bankName ? undefined : "11 characters, for example HDFC0001234"} error={a.fields.ifsc ?? (ifsc.length === 11 && !ifscOk ? "Check the IFSC; the fifth character is always 0" : undefined)}>
            <Input id="rg-ifsc" maxLength={11} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} className="font-mono tracking-wider uppercase" />
            {bankName && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-600">
                <Building2 size={13} aria-hidden="true" /> {bankName}
              </p>
            )}
          </Field>
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ink-600">We send ₹1 to this account and check the name the bank returns. It takes a few seconds.</p>
            <div className="flex shrink-0 gap-2">
              {saved && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={!ready || a.busy}
                onClick={async () => {
                  const r = await a.run(() => verifyBank({ holder: holder.trim(), account, ifsc }));
                  if (r) {
                    setApp(r);
                    setAccount("");
                    setAccount2("");
                    setEditing(r.checks.bank?.result === "FAILED");
                  }
                }}
              >
                {a.busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {a.busy ? "Sending ₹1" : "Verify with ₹1"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {a.error && !a.fields.account && !a.fields.ifsc && <p className="mt-2 text-xs text-danger-700">{a.error}</p>}
      {bc && (
        <div className="mt-4">
          {bc.result === "VERIFIED" ? (
            <Notice tone="success" icon={CircleCheck} title="₹1 credited, name matched">
              The bank returned <span className="font-medium text-ink-900">{bc.beneficiaryName}</span> for account ending {bc.accountLast4} ({bc.nameMatchScore}% match). Reference {bc.reference}.
            </Notice>
          ) : bc.result === "PARTIAL" ? (
            <Notice tone="warning" icon={CircleAlert} title="Name partly matches">
              The bank returned <span className="font-medium text-ink-900">{bc.beneficiaryName}</span>, a {bc.nameMatchScore}% match with {app!.business.legalName}. Upload a cancelled cheque or bank statement in the next step so our team can confirm the account.
            </Notice>
          ) : (
            <Notice tone="danger" icon={TriangleAlert} title="This account cannot be used">
              {bc.failureReason ?? `The bank holds this account in the name ${bc.beneficiaryName}, which does not match your business.`} Add an account in your business&apos;s name.
            </Notice>
          )}
        </div>
      )}
      <SandboxHint show={sandbox}>accounts ending 0000 fail, 1111 return another person&apos;s name and 2222 return a partial match. Any other account matches.</SandboxHint>
      <StepFooter back={back} hint="Verify an account in your business's name" disabled={!canNext} onClick={next} label="Continue" />
    </>
  );
}

/* ------------------------------ 7 Documents ----------------------------- */

const DOC_STATUS: Record<ApplicationDocument["status"], { label: string; tone: "info" | "success" | "danger" }> = {
  PENDING: { label: "Uploaded", tone: "info" },
  VERIFIED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Needs a new file", tone: "danger" },
};

function DocumentRow({ kind, label, hint, required, doc, setApp, accept = "application/pdf,image/png,image/jpeg", maxMb = 4 }: { kind: DocumentKind; label: string; hint: string; required: boolean; doc?: ApplicationDocument; setApp: (a: SellerApplication) => void; accept?: string; maxMb?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const a = useAction();
  const rm = useAction();
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
          {label}
          {!required && (
            <Badge size="sm" tone="neutral">
              Optional
            </Badge>
          )}
          {doc && (
            <Badge size="sm" tone={DOC_STATUS[doc.status].tone}>
              {DOC_STATUS[doc.status].label}
            </Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">{hint}</p>
        {doc && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-700">
            <FileText size={13} className="text-ink-400" aria-hidden="true" />
            <a href={`/seller/register/documents/${doc.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
              {doc.fileName}
            </a>
            <span className="text-ink-400">{fileSize(doc.sizeBytes)}</span>
          </p>
        )}
        {doc?.status === "REJECTED" && doc.note && <p className="mt-1.5 rounded-lg bg-danger-50 px-2.5 py-1.5 text-xs text-danger-700">Reviewer: {doc.note}</p>}
        {(a.error ?? rm.error) && <p className="mt-1.5 text-xs text-danger-700">{a.error ?? rm.error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <input
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          aria-label={`Upload ${label}`}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > maxMb * 1024 * 1024) return a.setError(`Files can be up to ${maxMb} MB`);
            const form = new FormData();
            form.set("kind", kind);
            form.set("file", file);
            const r = await a.run(() => uploadDocument(form));
            if (r) setApp(r);
          }}
        />
        {doc && doc.status !== "VERIFIED" && (
          <Button
            variant="ghost"
            size="sm"
            icon={rm.busy ? undefined : Trash2}
            aria-label={`Remove ${label}`}
            disabled={a.busy || rm.busy}
            onClick={async () => {
              // removal succeeds with a null payload, so chain the reload inside run and act on the application it returns
              const refreshed = await rm.run(async () => {
                const r = await removeDocument(doc.id);
                return r.ok ? loadApplication() : r;
              });
              if (refreshed) setApp(refreshed);
            }}
          >
            {rm.busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          </Button>
        )}
        <Button variant={doc && doc.status !== "REJECTED" ? "ghost" : "secondary"} size="sm" icon={a.busy ? undefined : Upload} disabled={a.busy || rm.busy} onClick={() => input.current?.click()}>
          {a.busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {a.busy ? "Uploading" : doc ? "Replace" : "Upload"}
        </Button>
      </div>
    </li>
  );
}

export function DocumentsStep({ app, setApp, next, back }: StepProps) {
  const reqs = app!.requiredDocuments.filter((r) => r.kind !== "SIGNATURE" && r.kind !== "TRADEMARK");
  const doc = (k: DocumentKind) => app!.documents.find((d) => d.kind === k);
  const canNext = reqs.filter((r) => r.required).every((r) => doc(r.kind) && doc(r.kind)!.status !== "REJECTED");
  return (
    <>
      <StepTitle
        title="Documents"
        description={`What we need for a ${app!.business.constitution ? constitutionNoun(app!.business.constitution) : "business"}. PDF, PNG or JPG, up to 4 MB each. ${app!.business.gstExempt ? "Your PAN was" : "Your GSTIN and PAN were"} verified directly, so no copies are needed.`}
      />
      <ul className="divide-y divide-line rounded-xl border border-line">
        {reqs.map((r) => (
          <DocumentRow key={r.kind} kind={r.kind} label={r.label} hint={r.hint} required={r.required} doc={doc(r.kind)} setApp={setApp} />
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-500">Documents are encrypted and seen only by BluBuy&apos;s verification team.</p>
      <StepFooter back={back} hint="Upload every required document" disabled={!canNext} onClick={next} label="Continue" />
    </>
  );
}

/* ------------------------------ 8 Signature ----------------------------- */

export function SignatureStep({ app, setApp, next, back }: StepProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [drawn, setDrawn] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const a = useAction();
  const sig = app!.documents.find((d) => d.kind === "SIGNATURE");

  async function send(file: File) {
    const form = new FormData();
    form.set("kind", "SIGNATURE");
    form.set("file", file);
    const r = await a.run(() => uploadDocument(form));
    if (r) {
      setApp(r);
      setDrawn(false);
      const c = canvas.current;
      c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    }
    return !!r;
  }

  async function saveDrawing() {
    const c = canvas.current;
    const blob = c && (await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png")));
    if (!blob) {
      setDrawn(false);
      a.setError("Could not read the signature pad. Please sign again.");
      return false;
    }
    return send(new File([blob], "signature.png", { type: "image/png" }));
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  }

  const usable = !!sig && sig.status !== "REJECTED";
  return (
    <>
      <StepTitle title="Digital signature" description="Printed on the tax invoices BluBuy generates for your orders. Sign as the authorised signatory." />
      {sig && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- private document streamed through a route handler */}
          <img src={`/seller/register/documents/${sig.id}?v=${encodeURIComponent(sig.uploadedAt)}`} alt="Your saved signature" className="h-14 w-40 rounded-md border border-line bg-white object-contain" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-ink-900">Saved signature</p>
            <p className={cn("text-xs", sig.status === "REJECTED" ? "text-danger-700" : "text-ink-500")}>{sig.status === "REJECTED" ? `Reviewer: ${sig.note ?? "please sign again"}` : "Draw or upload again to replace it"}</p>
          </div>
        </div>
      )}
      <div role="tablist" aria-label="Signature method" className="mb-4 inline-flex gap-1 rounded-xl bg-ink-100 p-1">
        {(["draw", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              // the pad unmounts on the Upload tab, so an unsaved drawing cannot survive the switch
              if (m !== mode) setDrawn(false);
              setMode(m);
            }}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium", mode === m ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}
          >
            {m === "draw" ? <PenLine size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
            {m === "draw" ? "Draw" : "Upload"}
          </button>
        ))}
      </div>
      {mode === "draw" ? (
        <div>
          <div className="relative overflow-hidden rounded-xl border border-line-strong bg-white">
            <canvas
              ref={canvas}
              width={1200}
              height={360}
              aria-label="Signature pad. Draw your signature with a mouse, finger or stylus."
              className="block h-44 w-full touch-none cursor-crosshair"
              onPointerDown={(e) => {
                const ctx = e.currentTarget.getContext("2d");
                if (!ctx) return;
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const [x, y] = pos(e);
                ctx.lineWidth = 4;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.strokeStyle = "#101828";
                ctx.beginPath();
                ctx.moveTo(x, y);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const ctx = e.currentTarget.getContext("2d");
                const [x, y] = pos(e);
                ctx?.lineTo(x, y);
                ctx?.stroke();
              }}
              onPointerUp={() => {
                if (drawing.current) setDrawn(true);
                drawing.current = false;
              }}
            />
            <span className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-dashed border-ink-300" aria-hidden="true" />
            {!drawn && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-400">Sign here</span>}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-ink-500">Authorised signatory for {app!.business.legalName ?? "your business"}</p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={Eraser}
                onClick={() => {
                  const c = canvas.current;
                  c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
                  setDrawn(false);
                }}
              >
                Clear
              </Button>
              <Button size="sm" variant="secondary" disabled={!drawn || a.busy} onClick={saveDrawing}>
                Save signature
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Upload a signature image"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 1024 * 1024) return a.setError("Signature images can be up to 1 MB");
              await send(file);
            }}
          />
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-6 py-10 text-center hover:border-brand-300 hover:bg-ink-50"
          >
            <Upload size={22} className="text-ink-400" aria-hidden="true" />
            <span className="text-sm font-medium text-ink-900">Upload a scan of your signature</span>
            <span className="text-xs text-ink-500">PNG or JPG on a white background, up to 1 MB</span>
          </button>
        </>
      )}
      <StepFooter
        back={back}
        hint="Draw and save, or upload, your signature"
        disabled={!usable && !drawn}
        busy={a.busy}
        error={a.error}
        onClick={async () => {
          if (drawn && !(await saveDrawing())) return;
          next();
        }}
      />
    </>
  );
}

/* ------------------------------ 9 Categories ---------------------------- */

export function CategoriesStep({ app, setApp, next, back, categories }: StepProps & { categories: { id: string; name: string; commission: number; gated?: string }[] }) {
  const [chosen, setChosen] = useState<string[]>(app!.categories);
  const save = useAction();
  return (
    <>
      <StepTitle title="What will you sell?" description="Choose every category you plan to sell in. Restricted categories need documents before you can list; you can start with the others straight away." />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {categories.map((c) => {
          const on = chosen.includes(c.id);
          return (
            <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors", on ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
              <input type="checkbox" className="mt-1 size-4 accent-brand-600" checked={on} onChange={() => setChosen(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">{c.name}</span>
                  {c.gated && (
                    <Badge size="sm" tone="warning">
                      Approval needed
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">{c.gated ?? `Commission ${c.commission}% above ₹999`}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-4 rounded-xl bg-brand-50/60 px-4 py-3 text-[13px] text-brand-800">0% commission on every item priced up to ₹999, in every category.</p>
      <StepFooter
        back={back}
        hint="Choose at least one category"
        disabled={!chosen.length}
        busy={save.busy}
        error={save.error}
        onClick={async () => {
          const r = await save.run(() => saveApplication({ categories: chosen }));
          if (r) {
            setApp(r);
            next();
          }
        }}
      />
    </>
  );
}

/* -------------------------------- 10 Brand ------------------------------ */

export function BrandStep({ app, setApp, next, back }: StepProps) {
  const br = app!.brand;
  const [own, setOwn] = useState(br?.ownBrand ?? false);
  const [brandName, setBrandName] = useState(br?.brandName ?? "");
  const [trademark, setTrademark] = useState(br?.trademark ?? "");
  const [tmClass, setTmClass] = useState(br?.trademarkClass ?? "21");
  const [reseller, setReseller] = useState(br?.reseller ?? false);
  const save = useAction();
  const tmDoc = app!.documents.find((d) => d.kind === "TRADEMARK");
  const canNext = !own || (brandName.trim().length >= 2 && /^\d{6,8}$/.test(trademark));
  return (
    <>
      <StepTitle title="Brand registry" description="Optional. Brand owners get control of their product pages and tools to protect them. You can do this later." />
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line p-4">
          <Switch checked={own} onChange={setOwn} label="I own a brand" description="Enrol in BluBuy Brand Registry with a registered trademark or a pending application with IP India" />
          {own && (
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Brand name" htmlFor="rg-brand" required>
                <Input id="rg-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Sahyadri Home" />
              </Field>
              <Field label="Trademark or application number" htmlFor="rg-tm" required error={save.fields["brand.trademark"]}>
                <Input id="rg-tm" value={trademark} onChange={(e) => setTrademark(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="5281934" className="font-mono" />
              </Field>
              <Field label="Trademark class" htmlFor="rg-class" className="sm:col-span-2">
                <Select id="rg-class" value={tmClass} onChange={(e) => setTmClass(e.target.value)}>
                  <option value="21">Class 21, household utensils</option>
                  <option value="8">Class 8, hand tools and cutlery</option>
                  <option value="9">Class 9, electronics</option>
                  <option value="11">Class 11, appliances</option>
                  <option value="24">Class 24, textiles</option>
                  <option value="25">Class 25, clothing and footwear</option>
                  <option value="30">Class 30, food and spices</option>
                </Select>
              </Field>
              <ul className="divide-y divide-line rounded-xl border border-line sm:col-span-2">
                <DocumentRow kind="TRADEMARK" label="Trademark certificate or application receipt" hint="From IP India. Optional now, needed before Brand Registry goes live." required={false} doc={tmDoc} setApp={setApp} />
              </ul>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line p-4">
          <Switch checked={reseller} onChange={setReseller} label="I resell other brands" description="Keep a brand authorisation letter or distributor invoices ready. Some brands are gated and need them before you list." />
        </div>
      </div>
      <StepFooter
        back={back}
        hint="Add your brand name and trademark number, or turn off brand registry"
        disabled={!canNext}
        busy={save.busy}
        error={save.error}
        label={!own && !reseller ? "Skip for now" : "Save and continue"}
        onClick={async () => {
          const r = await save.run(() =>
            saveApplication({ brand: own ? { ownBrand: true, brandName: brandName.trim(), trademark, trademarkClass: tmClass, reseller } : { ownBrand: false, reseller } }),
          );
          if (r) {
            setApp(r);
            next();
          }
        }}
      />
    </>
  );
}

/* -------------------------------- 11 Review ----------------------------- */

export function ReviewStep({ app, me, back, goTo, categories }: StepProps & { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const a = useAction();
  const x = app!;
  const docs = x.documents.filter((d) => d.kind !== "SIGNATURE");
  const rows: { key: string; label: string; value: string }[] = [
    { key: "account", label: "Account", value: me ? `${formatPhone(me.phone)}, ${me.name ?? ""}, ${me.email ?? ""}` : "" },
    { key: "business", label: "Business", value: x.business.gstExempt ? `${x.business.legalName ?? ""}, GST exempt` : `${x.business.legalName ?? ""}, GSTIN ${x.business.gstin ?? ""}` },
    { key: "pan", label: "PAN", value: x.business.pan ? `${x.business.pan}, ${x.checks.pan?.nameMatchScore ?? 0}% name match` : "" },
    { key: "store", label: "Store", value: x.store.name ?? "" },
    { key: "pickup", label: "Pickup", value: x.pickup ? `${x.pickup.line1}, ${x.pickup.city} ${x.pickup.pincode}` : "" },
    { key: "bank", label: "Bank", value: x.bank && x.checks.bank ? `${x.checks.bank.bankName}, account ending ${x.bank.accountLast4}, ${x.checks.bank.result === "VERIFIED" ? "verified" : `${x.checks.bank.nameMatchScore}% name match`}` : "" },
    { key: "documents", label: "Documents", value: docs.length ? docs.map((d) => d.label).join(", ") : "" },
    { key: "signature", label: "Signature", value: x.documents.some((d) => d.kind === "SIGNATURE") ? "Saved" : "" },
    { key: "categories", label: "Categories", value: categories.filter((c) => x.categories.includes(c.id)).map((c) => c.name).join(", ") },
    { key: "brand", label: "Brand registry", value: x.brand?.ownBrand ? `${x.brand.brandName}, trademark ${x.brand.trademark}` : x.brand?.reseller ? "Reseller of other brands" : "Skipped" },
  ];
  const stepOf = (key: string) => STEPS.findIndex((s) => s.key === key);
  const missing = a.errors.length ? a.errors.map((e) => ({ key: e.path, message: e.message })) : x.missing;
  return (
    <>
      <StepTitle title="Review and submit" description="Check everything once. After you submit, our team verifies your application, usually within 72 hours." />
      {missing.length > 0 && (
        <div className="mb-5">
          <Notice tone="warning" icon={CircleAlert} title="Before you can submit">
            <ul className="flex flex-col gap-1">
              {missing.map((m) => (
                <li key={m.key + m.message} className="flex items-center justify-between gap-3">
                  <span>{m.message}</span>
                  <button type="button" onClick={() => goTo(stepOf(m.key) < 0 ? 0 : stepOf(m.key))} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
                    Go there
                  </button>
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
      <div className="divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{r.label}</p>
              <p className="mt-0.5 text-[13px] break-words text-ink-900">{r.value || "Not provided"}</p>
            </div>
            <button type="button" onClick={() => goTo(stepOf(r.key))} className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
              Edit
            </button>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-ink-50 px-4 py-3">
        <Checkbox
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={
            <>
              I agree to the BluBuy seller agreement ({x.agreementVersion}), the fee rate card and the returns policy, and confirm the information above is accurate.{" "}
              <a href="/policies/terms" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline">
                Read it <ExternalLink size={11} aria-hidden="true" />
              </a>
            </>
          }
          description="Your signature is applied to the agreement electronically when you submit."
        />
      </div>
      <StepFooter
        back={back}
        hint={missing.length ? "Finish the steps listed above" : "Accept the agreement to submit"}
        disabled={!agree || missing.length > 0}
        busy={a.busy}
        error={a.errors.length ? null : a.error}
        icon={Send}
        label={x.status === "ACTION_REQUIRED" ? "Resubmit for verification" : "Submit for verification"}
        onClick={async () => {
          const r = await a.run(() => submitApplication());
          if (r) router.push("/seller/register/status");
        }}
      />
    </>
  );
}

/** Banner shown while a reviewer's change request is open. */
export function ChangesBanner({ app, goTo }: { app: SellerApplication; goTo: (i: number) => void }) {
  if (app.status !== "ACTION_REQUIRED") return null;
  return (
    <div className="mb-6 rounded-[var(--radius-card)] border border-warning-100 bg-warning-50/70 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning-700">
        <CircleAlert size={17} aria-hidden="true" /> Our team asked for changes
      </p>
      {app.reviewerMessage && <p className="mt-1.5 text-[13px] text-ink-800">{app.reviewerMessage}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {app.flaggedItems.map((f) => (
          <button key={f.key} type="button" onClick={() => goTo(stepForFlag(f.key))} className="rounded-full border border-warning-100 bg-white px-3 py-1 text-xs font-medium text-ink-800 hover:border-warning-500">
            Fix: {f.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-600">When you are done, resubmit from the last step.</p>
    </div>
  );
}
