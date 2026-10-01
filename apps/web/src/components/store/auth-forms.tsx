"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Code2, Loader2, ShieldCheck } from "lucide-react";
import { requestOtp, verifyOtp } from "@/app/actions/auth";
import type { OtpChallenge } from "@/lib/api/types";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

const minutesUntil = (iso: string) => Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));

/** Full navigation after sign in, so the header and cart render with the new session. */
const go = (to: string) => window.location.assign(to);

function validMobile(v: string) {
  return /^[6-9]\d{9}$/.test(v);
}

function formatMobile(v: string) {
  return v.length > 5 ? `${v.slice(0, 5)} ${v.slice(5)}` : v;
}

/* --------------------------------- Mobile ------------------------------- */

function MobileInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <Field label="Mobile number" htmlFor="mobile" error={error ?? undefined}>
      <div className="flex">
        <span className="flex h-12 items-center rounded-l-lg border border-r-0 border-line-strong bg-ink-50 px-3.5 text-[15px] font-medium text-ink-700">+91</span>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus
          value={formatMobile(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          aria-invalid={!!error}
          placeholder="98765 43210"
          className="h-12 min-w-0 flex-1 rounded-r-lg border border-line-strong bg-white px-3.5 text-[15px] tracking-wide text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none aria-invalid:border-danger-500"
        />
      </div>
    </Field>
  );
}

/* ----------------------------------- OTP -------------------------------- */

function OtpStep({
  mobile,
  challenge: initial,
  name,
  onBack,
  onVerified,
  cta,
}: {
  mobile: string;
  challenge: OtpChallenge;
  name?: string;
  onBack: () => void;
  onVerified: () => void;
  cta: string;
}) {
  const [challenge, setChallenge] = useState(initial);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [left, setLeft] = useState(initial.resendAfterSeconds);
  const [expiresMin, setExpiresMin] = useState(() => minutesUntil(initial.expiresAt));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const fill = (start: number, text: string) => {
    const chars = text.replace(/\D/g, "").slice(0, OTP_LENGTH - start).split("");
    if (!chars.length) return;
    setDigits((d) => {
      const n = [...d];
      chars.forEach((c, i) => (n[start + i] = c));
      return n;
    });
    refs.current[Math.min(OTP_LENGTH - 1, start + chars.length)]?.focus();
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < OTP_LENGTH) return setError(`Enter all ${OTP_LENGTH} digits of the code`);
    setBusy(true);
    const r = await verifyOtp({ challengeId: challenge.challengeId, code, name });
    if (r.ok) return onVerified();
    setBusy(false);
    setError(r.error);
    if (r.code === "OTP_LOCKED" || r.code === "OTP_EXPIRED") setDigits(Array(OTP_LENGTH).fill(""));
  };

  const resend = async () => {
    setError(null);
    const r = await requestOtp(mobile);
    if (!r.ok) return setError(r.error);
    setChallenge(r.data);
    setExpiresMin(minutesUntil(r.data.expiresAt));
    setLeft(r.data.resendAfterSeconds);
    setResent(true);
    setDigits(Array(OTP_LENGTH).fill(""));
    refs.current[0]?.focus();
  };

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft size={16} aria-hidden="true" /> Change number
      </button>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">Enter the code</h1>
      <p className="mt-2 text-[15px] text-ink-600">
        We sent a 6 digit code to <span className="font-semibold text-ink-900">+91 {formatMobile(mobile)}</span>. It expires in {expiresMin} minutes.
      </p>
      <fieldset className="mt-7">
        <legend className="sr-only">One-time code</legend>
        <div className="flex justify-between gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
              aria-invalid={!!error}
              autoFocus={i === 0}
              maxLength={OTP_LENGTH}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                if (v.length > 1) return fill(i, v);
                setDigits((x) => {
                  const n = [...x];
                  n[i] = v;
                  return n;
                });
                setError(null);
                if (v && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
              }}
              onPaste={(e) => {
                e.preventDefault();
                fill(i, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
              }}
              className={cn(
                "size-12 rounded-xl border bg-white text-center font-display text-xl font-semibold text-ink-900 tabular-nums transition-colors focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none sm:size-14",
                error ? "border-danger-500" : d ? "border-ink-400" : "border-line-strong",
              )}
            />
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-600">
          {error}
        </p>
      )}
      {challenge.devCode && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong bg-ink-50 px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-xs text-ink-600">
            <Code2 size={15} className="text-ink-400" aria-hidden="true" />
            Development code: <span className="font-mono text-sm font-semibold tracking-widest text-ink-900">{challenge.devCode}</span>
          </p>
          <button type="button" onClick={() => fill(0, challenge.devCode!)} className="text-xs font-semibold text-brand-700 hover:underline">
            Fill it in
          </button>
        </div>
      )}
      <button type="submit" disabled={busy} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400">
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {busy ? "Verifying" : cta}
      </button>
      <p className="mt-5 text-center text-sm text-ink-600">
        {left > 0 ? (
          <>
            Resend code in <span className="font-semibold text-ink-900 tabular-nums">0:{String(left).padStart(2, "0")}</span>
          </>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-brand-700 hover:underline">
            Resend code by SMS
          </button>
        )}
      </p>
      {resent && left > 0 && <p className="mt-1 text-center text-xs text-success-700">A new code is on its way</p>}
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
        <ShieldCheck size={15} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
        BluBuy will never call you to ask for this code. Do not share it with anyone.
      </p>
    </form>
  );
}

/* --------------------------------- Login -------------------------------- */

const COPY = {
  shopper: { title: "Sign in or create an account", body: "Use your mobile number. We will send you a one-time code, no password needed." },
  seller: { title: "Sign in to Seller Hub", body: "Use the mobile number registered to your seller account." },
  staff: { title: "Sign in to BluBuy Control", body: "For BluBuy staff. Use the mobile number on your staff account." },
};

export function LoginForm({ next, audience = "shopper", denied = false }: { next: string; audience?: keyof typeof COPY; denied?: boolean }) {
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [sending, setSending] = useState(false);

  if (challenge) return <OtpStep mobile={mobile} challenge={challenge} onBack={() => setChallenge(null)} onVerified={() => go(next)} cta="Verify and sign in" />;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validMobile(mobile)) return setError("Enter a valid 10 digit Indian mobile number");
        setError(null);
        setSending(true);
        const r = await requestOtp(mobile);
        setSending(false);
        if (r.ok) setChallenge(r.data);
        else setError(r.error);
      }}
    >
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">{COPY[audience].title}</h1>
      <p className="mt-2 text-[15px] text-ink-600">{COPY[audience].body}</p>
      {denied && (
        <p role="alert" className="mt-4 rounded-xl border border-warning-100 bg-warning-50 px-3.5 py-3 text-[13px] text-warning-700">
          The account you are signed in with does not have access here. Sign in with a {audience === "staff" ? "BluBuy staff" : "seller"} account.
        </p>
      )}
      <div className="mt-8">
        <MobileInput value={mobile} onChange={setMobile} error={error} />
      </div>
      <button type="submit" disabled={sending} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400">
        {sending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {sending ? "Sending code" : "Send code"}
      </button>
      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        By continuing you agree to BluBuy&apos;s{" "}
        <Link href="/policies/terms" className="font-medium text-brand-700 hover:underline">
          Terms of use
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/policies/privacy" className="font-medium text-brand-700 hover:underline">
          Privacy notice
        </Link>
        . We use your number to sign you in and send order updates. Promotional messages are off unless you turn them on.
      </p>
      {audience !== "staff" && (
        <div className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-600">
          {audience === "seller" ? "Not selling on BluBuy yet?" : "New to BluBuy?"}{" "}
          <Link href={audience === "seller" ? "/seller/register" : "/signup"} className="font-semibold text-brand-700 hover:underline">
            {audience === "seller" ? "Start selling" : "Create an account"}
          </Link>
        </div>
      )}
    </form>
  );
}

/* --------------------------------- Signup ------------------------------- */

export function SignupForm() {
  const [f, setF] = useState({ name: "", mobile: "", email: "", promos: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  if (challenge)
    return <OtpStep mobile={f.mobile} challenge={challenge} name={f.name.trim()} onBack={() => setChallenge(null)} onVerified={() => go("/")} cta="Verify and create account" />;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (f.name.trim().length < 2) errs.name = "Enter your full name";
        if (!validMobile(f.mobile)) errs.mobile = "Enter a valid 10 digit Indian mobile number";
        if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = "Enter a valid email address, or leave it empty";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        const r = await requestOtp(f.mobile);
        if (r.ok) setChallenge(r.data);
        else setErrors({ mobile: r.error });
      }}
    >
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">Create your BluBuy account</h1>
      <p className="mt-2 text-[15px] text-ink-600">Three details and a code. That is all.</p>
      <div className="mt-8 flex flex-col gap-4">
        <Field label="Full name" htmlFor="su-name" required error={errors.name}>
          <Input id="su-name" autoComplete="name" inputSize="lg" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} aria-invalid={!!errors.name} />
        </Field>
        <MobileInput value={f.mobile} onChange={(v) => setF((x) => ({ ...x, mobile: v }))} error={errors.mobile} />
        <Field label="Email (optional)" htmlFor="su-email" error={errors.email} hint="For invoices and order receipts">
          <Input id="su-email" type="email" autoComplete="email" inputSize="lg" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} aria-invalid={!!errors.email} />
        </Field>
        <Checkbox
          checked={f.promos}
          onChange={(e) => setF((x) => ({ ...x, promos: e.target.checked }))}
          label="Send me offers and sale reminders"
          description="Optional. You can change this any time in Account, then Notifications."
        />
      </div>
      <button type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700">
        Continue
      </button>
      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        By creating an account you agree to BluBuy&apos;s{" "}
        <Link href="/policies/terms" className="font-medium text-brand-700 hover:underline">
          Terms of use
        </Link>{" "}
        and acknowledge the{" "}
        <Link href="/policies/privacy" className="font-medium text-brand-700 hover:underline">
          Privacy notice
        </Link>{" "}
        under the Digital Personal Data Protection Act, 2023.
      </p>
      <div className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}
