"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/** Edit name, gender, date of birth and language. */
export function EditProfileButton({ initial }: { initial: { name: string; gender: string; dateOfBirth: string; language: string } }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [err, setErr] = useState("");
  const t = useToast();
  return (
    <>
      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (form.name.trim().length < 2) return setErr("Enter your full name.");
                setErr("");
                setOpen(false);
                t.show("Profile updated");
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="pf-name" error={err || undefined} className="sm:col-span-2">
            <Input id="pf-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Gender" htmlFor="pf-gender" hint="Optional">
            <Select id="pf-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              {["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date of birth" htmlFor="pf-dob" hint="Optional, for birthday offers">
            <Input id="pf-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Language" htmlFor="pf-lang">
            <Select id="pf-lang" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option>English</option>
              <option>Hindi</option>
            </Select>
          </Field>
        </div>
      </Modal>
      {t.node}
    </>
  );
}

/** OTP verification for a new email or mobile number (accepts paste). */
export function VerifyContact({ kind, current, verified }: { kind: "email" | "mobile"; current: string; verified: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "otp" | "done">(verified ? "enter" : "otp");
  const [value, setValue] = useState(verified ? "" : current);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const isEmail = kind === "email";
  const label = verified ? `Change ${isEmail ? "email" : "mobile number"}` : "Verify";

  const reset = () => {
    setOpen(false);
    setTimeout(() => {
      setStep(verified ? "enter" : "otp");
      setOtp("");
      setErr("");
    }, 200);
  };

  return (
    <>
      <Button size="sm" variant={verified ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {verified ? "Change" : "Verify"}
      </Button>
      <Modal
        open={open}
        onClose={reset}
        size="sm"
        title={step === "done" ? (isEmail ? "Email verified" : "Mobile number updated") : label}
        description={
          step === "otp"
            ? `Enter the 6 digit code we sent to ${value || current}. It expires in 10 minutes.`
            : step === "enter"
              ? isEmail
                ? "We will send a code to the new address."
                : "We will send codes to your current and new numbers."
              : undefined
        }
        footer={
          step === "done" ? (
            <Button onClick={reset}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={reset}>
                Cancel
              </Button>
              {step === "enter" ? (
                <Button
                  onClick={() => {
                    const ok = isEmail ? /^\S+@\S+\.\S+$/.test(value) : /^[6-9]\d{9}$/.test(value);
                    if (!ok) return setErr(isEmail ? "Enter a valid email address." : "Enter a 10 digit mobile number.");
                    setErr("");
                    setStep("otp");
                  }}
                >
                  Send code
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (!/^\d{6}$/.test(otp)) return setErr("Enter all 6 digits.");
                    setErr("");
                    setStep("done");
                  }}
                >
                  Verify
                </Button>
              )}
            </>
          )
        }
      >
        {step === "enter" && (
          <Field label={isEmail ? "New email address" : "New mobile number"} htmlFor="vc-value" error={err || undefined}>
            {isEmail ? (
              <Input id="vc-value" type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <div className="flex">
                <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-ink-50 px-3 text-sm text-ink-600">+91</span>
                <Input id="vc-value" inputMode="numeric" autoComplete="tel-national" className="min-w-0 flex-1 rounded-l-none" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </div>
            )}
          </Field>
        )}
        {step === "otp" && (
          <div>
            <label htmlFor="vc-otp" className="text-[13px] font-medium text-ink-700">
              Verification code
            </label>
            <Input
              id="vc-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1.5 h-12 text-center font-mono text-xl tracking-[0.5em]"
              placeholder="000000"
              aria-invalid={Boolean(err)}
            />
            {err && <p className="mt-1.5 text-xs text-danger-600">{err}</p>}
            <p className="mt-3 text-xs text-ink-500">Did not get it? You can resend the code in 30 seconds.</p>
          </div>
        )}
        {step === "done" && (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <CircleCheck size={18} aria-hidden="true" />
            {isEmail ? `${value || current} is verified. Order updates will be sent here.` : "Your new number is now used for login and delivery updates."}
          </p>
        )}
      </Modal>
    </>
  );
}

/** Account deletion request (DPDP): shows blockers honestly, then a confirmed request. */
export function DeleteAccountButton({ blockers }: { blockers: { label: string; detail: string }[] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" icon={Trash2} className="border-danger-100 text-danger-700 hover:bg-danger-50" onClick={() => setOpen(true)}>
        Request account deletion
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={done ? "Deletion requested" : "Delete your BluBuy account"}
        description={done ? undefined : "We will delete your personal data within 30 days, except what the law requires us to keep, like tax invoices."}
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={!ack} onClick={() => setDone(true)}>
                Request deletion
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className="text-sm text-ink-600">
            Request DR-2318 is recorded. We will confirm by email once everything below is settled, and your account will be closed within 30 days. You can cancel by signing
            in before then.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {blockers.length > 0 && (
              <div className="rounded-xl border border-warning-100 bg-warning-50 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-warning-700">
                  <CircleAlert size={16} aria-hidden="true" />
                  To settle first
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-700">
                  {blockers.map((b) => (
                    <li key={b.label}>
                      <span className="font-medium">{b.label}:</span> {b.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Field label="Why are you leaving?" htmlFor="del-reason" hint="Optional, helps us improve">
              <Textarea id="del-reason" className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <label className={cn("flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-700")}>
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              I understand that my order history, reviews, BluCoins and saved lists will be permanently deleted.
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
