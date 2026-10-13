"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Code2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { forgotPassword, resetPassword, signIn, signUp } from "@/app/actions/auth";
import type { PasswordResetChallenge } from "@/lib/api/types";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;
const MIN_PASSWORD = 8;

const minutesUntil = (iso: string) => Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));

/** Full navigation after sign in, so the header and cart render with the new session. */
const go = (to: string) => window.location.assign(to);

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function passwordProblem(v: string) {
  if (v.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
  if (v.length > 128) return "Use 128 characters or fewer";
  return null;
}

const primaryButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400";

function Submit({ busy, idle, working }: { busy: boolean; idle: string; working: string }) {
  return (
    <button type="submit" disabled={busy} className={cn(primaryButton, "mt-6")}>
      {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
      {busy ? working : idle}
    </button>
  );
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
      {error}
    </p>
  );
}

/* -------------------------------- Inputs -------------------------------- */

function EmailField({ id, value, onChange, error, autoFocus }: { id: string; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean }) {
  return (
    <Field label="Email" htmlFor={id} error={error}>
      <Input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        inputSize="lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        placeholder="you@example.com"
      />
    </Field>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          name={autoComplete === "new-password" ? "new-password" : "password"}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputSize="lg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-500 hover:text-ink-800"
        >
          {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

function CodeInput({ digits, setDigits, error, onTyped }: { digits: string[]; setDigits: (fn: (d: string[]) => string[]) => void; error: boolean; onTyped: () => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fill = (start: number, text: string) => {
    const chars = text.replace(/\D/g, "").slice(0, OTP_LENGTH - start).split("");
    if (!chars.length) return;
    setDigits((d) => {
      const n = [...d];
      chars.forEach((c, i) => (n[start + i] = c));
      return n;
    });
    refs.current[Math.min(OTP_LENGTH - 1, start + chars.length)]?.focus();
    onTyped();
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-800">Code from the email</legend>
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
            aria-invalid={error}
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
              onTyped();
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
  );
}

/* --------------------------------- Login -------------------------------- */

const COPY = {
  shopper: { title: "Sign in to AltasGoods", body: "Welcome back. Use the email and password for your account." },
  staff: { title: "Sign in to AltasGoods Control", body: "For AltasGoods staff. Use the email and password of your staff account." },
};

export function LoginForm({ next, audience = "shopper", denied = false, signedInAs }: { next: string; audience?: keyof typeof COPY; denied?: boolean; signedInAs?: string }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forgotHref = `/forgot-password?${new URLSearchParams({ next, ...(validEmail(f.email) ? { email: f.email.trim() } : {}), ...(audience === "staff" ? { as: "staff" } : {}) })}`;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: typeof errors = {};
        if (!validEmail(f.email)) errs.email = "Enter a valid email address";
        if (!f.password) errs.password = "Enter your password";
        setErrors(errs);
        setError(null);
        if (Object.keys(errs).length) return;
        setBusy(true);
        const r = await signIn({ email: f.email.trim(), password: f.password });
        if (r.ok) return go(next);
        setBusy(false);
        setError(r.error);
      }}
    >
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">{COPY[audience].title}</h1>
      <p className="mt-2 text-[15px] text-ink-600">{COPY[audience].body}</p>
      {(denied || signedInAs) && (
        <p role="alert" className="mt-4 rounded-xl border border-warning-100 bg-warning-50 px-3.5 py-3 text-[13px] text-warning-700">
          {signedInAs ? `You are signed in as ${signedInAs}, which has no AltasGoods staff access.` : "The account you are signed in with does not have access here."} Sign in with an
          AltasGoods staff account to continue.
        </p>
      )}
      <FormError error={error} />
      <div className="mt-8 flex flex-col gap-4">
        <EmailField id="login-email" value={f.email} onChange={(email) => setF((x) => ({ ...x, email }))} error={errors.email} autoFocus />
        <div>
          <PasswordField id="login-password" label="Password" autoComplete="current-password" value={f.password} onChange={(password) => setF((x) => ({ ...x, password }))} error={errors.password} />
          <div className="mt-2 text-right">
            <Link href={forgotHref} className="text-sm font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
      <Submit busy={busy} idle="Sign in" working="Signing in" />
      {audience !== "staff" && (
        <div className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-600">
          New to AltasGoods?{" "}
          <Link href={next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </div>
      )}
    </form>
  );
}

/* --------------------------------- Signup ------------------------------- */

export function SignupForm({ next = "/" }: { next?: string }) {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [error, setError] = useState<{ message: string; taken: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: typeof errors = {};
        if (f.name.trim().length < 2) errs.name = "Enter your full name";
        if (!validEmail(f.email)) errs.email = "Enter a valid email address";
        const pw = passwordProblem(f.password);
        if (pw) errs.password = pw;
        setErrors(errs);
        setError(null);
        if (Object.keys(errs).length) return;
        setBusy(true);
        const r = await signUp({ name: f.name.trim(), email: f.email.trim(), password: f.password });
        if (r.ok) return go(next);
        setBusy(false);
        setError({ message: r.error, taken: r.code === "EMAIL_TAKEN" });
      }}
    >
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">Create your AltasGoods account</h1>
      <p className="mt-2 text-[15px] text-ink-600">Your name, your email and a password. That is all.</p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
          {error.message}{" "}
          {error.taken && (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold underline">
              Sign in instead
            </Link>
          )}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-4">
        <Field label="Full name" htmlFor="su-name" required error={errors.name}>
          <Input id="su-name" autoComplete="name" autoFocus inputSize="lg" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} aria-invalid={!!errors.name} />
        </Field>
        <EmailField id="su-email" value={f.email} onChange={(email) => setF((x) => ({ ...x, email }))} error={errors.email} />
        <PasswordField
          id="su-password"
          label="Password"
          autoComplete="new-password"
          value={f.password}
          onChange={(password) => setF((x) => ({ ...x, password }))}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters. A short phrase is easier to remember and harder to guess.`}
        />
      </div>
      <Submit busy={busy} idle="Create account" working="Creating your account" />
      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        By creating an account you agree to AltasGoods&apos;s{" "}
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
        <Link href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </div>
    </form>
  );
}

/* ---------------------------- Forgot password --------------------------- */

function ResetStep({ email, challenge: initial, next, onBack }: { email: string; challenge: PasswordResetChallenge; next: string; onBack: () => void }) {
  const [challenge, setChallenge] = useState(initial);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(initial.resendAfterSeconds);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const code = digits.join("");
    const pw = passwordProblem(password);
    setPasswordError(pw ?? undefined);
    if (code.length < OTP_LENGTH) return setError(`Enter all ${OTP_LENGTH} digits of the code`);
    if (pw) return setError(null);
    setError(null);
    setBusy(true);
    const r = await resetPassword({ email, code, password });
    if (r.ok) return go(next);
    setBusy(false);
    setError(r.error);
    if (r.code === "OTP_LOCKED" || r.code === "OTP_EXPIRED") setDigits(Array(OTP_LENGTH).fill(""));
  };

  const resend = async () => {
    setError(null);
    const r = await forgotPassword(email);
    if (!r.ok) return setError(r.error);
    setChallenge(r.data);
    setLeft(r.data.resendAfterSeconds);
    setResent(true);
    setDigits(Array(OTP_LENGTH).fill(""));
  };

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft size={16} aria-hidden="true" /> Use a different email
      </button>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">Check your email</h1>
      <p className="mt-2 text-[15px] text-ink-600">
        If <span className="font-semibold text-ink-900">{email}</span> has an AltasGoods account, we have sent it a 6 digit code. It expires in {minutesUntil(challenge.expiresAt)} minutes.
        Check your spam folder if it is not there in a minute.
      </p>
      <FormError error={error} />
      <div className="mt-7 flex flex-col gap-5">
        <CodeInput digits={digits} setDigits={setDigits} error={!!error && digits.join("").length < OTP_LENGTH} onTyped={() => setError(null)} />
        {challenge.devCode && (
          <div className="-mt-1 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong bg-ink-50 px-3.5 py-2.5">
            <p className="flex items-center gap-2 text-xs text-ink-600">
              <Code2 size={15} className="text-ink-400" aria-hidden="true" />
              Development code: <span className="font-mono text-sm font-semibold tracking-widest text-ink-900">{challenge.devCode}</span>
            </p>
            <button type="button" onClick={() => setDigits(() => challenge.devCode!.split(""))} className="text-xs font-semibold text-brand-700 hover:underline">
              Fill it in
            </button>
          </div>
        )}
        <PasswordField
          id="reset-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
      </div>
      <Submit busy={busy} idle="Set new password and sign in" working="Saving" />
      <p className="mt-5 text-center text-sm text-ink-600">
        {left > 0 ? (
          <>
            Resend code in <span className="font-semibold text-ink-900 tabular-nums">0:{String(left).padStart(2, "0")}</span>
          </>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-brand-700 hover:underline">
            Resend code
          </button>
        )}
      </p>
      {resent && left > 0 && <p className="mt-1 text-center text-xs text-success-700">A new code is on its way</p>}
      <p className="mt-6 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
        <ShieldCheck size={15} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
        Setting a new password signs you out on every other device. AltasGoods will never ask you for this code.
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ next, initialEmail = "", audience = "shopper" }: { next: string; initialEmail?: string; audience?: "shopper" | "staff" }) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<PasswordResetChallenge | null>(null);
  const [busy, setBusy] = useState(false);

  if (challenge) return <ResetStep email={email.trim()} challenge={challenge} next={next} onBack={() => setChallenge(null)} />;

  const loginHref = `/login?${new URLSearchParams({ next, ...(audience === "staff" ? { as: "staff" } : {}) })}`;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!validEmail(email)) return setEmailError("Enter a valid email address");
        setEmailError(undefined);
        setError(null);
        setBusy(true);
        const r = await forgotPassword(email.trim());
        setBusy(false);
        if (r.ok) setChallenge(r.data);
        else setError(r.error);
      }}
    >
      <Link href={loginHref} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
      </Link>
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink-900">Reset your password</h1>
      <p className="mt-2 text-[15px] text-ink-600">Enter the email on your account. We will email you a code to choose a new password.</p>
      <FormError error={error} />
      <div className="mt-8">
        <EmailField id="forgot-email" value={email} onChange={setEmail} error={emailError} autoFocus />
      </div>
      <Submit busy={busy} idle="Email me a code" working="Sending code" />
    </form>
  );
}
