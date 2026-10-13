"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CircleCheck, Code2, KeyRound, LogOut, Pencil } from "lucide-react";
import { changePassword, requestEmailCode, signOutOtherDevices, updateProfile, verifyEmailCode } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** A small modal form: one save button, a busy state and an error line. */
function FormModal({
  open,
  onClose,
  title,
  description,
  saveLabel,
  busy,
  onSave,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  saveLabel: string;
  busy: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Saving" : saveLabel}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {children}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Edit the account holder's name. */
export function EditNameButton({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useToast();

  const save = async () => {
    if (value.trim().length < 2) return setErr("Enter your full name.");
    setBusy(true);
    const r = await updateProfile({ name: value.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setOpen(false);
    t.show("Name updated");
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={Pencil}
        onClick={() => {
          setValue(name);
          setErr("");
          setOpen(true);
        }}
      >
        Edit
      </Button>
      <FormModal open={open} onClose={() => setOpen(false)} title="Edit your name" saveLabel="Save" busy={busy} onSave={save}>
        <Field label="Full name" htmlFor="pf-name" error={err || undefined}>
          <Input id="pf-name" autoComplete="name" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(err)} />
        </Field>
      </FormModal>
      {t.node}
    </>
  );
}

/** Add, change or remove the optional contact number. */
export function EditPhoneButton({ phone }: { phone: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useToast();

  const save = async (next: string | null) => {
    if (next !== null && !/^[6-9]\d{9}$/.test(next)) return setErr("Enter a 10 digit mobile number.");
    setBusy(true);
    const r = await updateProfile({ phone: next });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setOpen(false);
    t.show(next ? "Mobile number saved" : "Mobile number removed");
    router.refresh();
  };

  return (
    <>
      <Button
        size="sm"
        variant={phone ? "ghost" : "secondary"}
        onClick={() => {
          setValue(phone?.replace(/^\+91/, "") ?? "");
          setErr("");
          setOpen(true);
        }}
      >
        {phone ? "Change" : "Add"}
      </Button>
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={phone ? "Change mobile number" : "Add a mobile number"}
        description="Optional. Used to prefill call back requests. Deliveries use the number on each address."
        saveLabel="Save"
        busy={busy}
        onSave={() => save(value)}
      >
        <Field label="Mobile number" htmlFor="pf-phone" error={err || undefined}>
          <div className="flex">
            <span className="inline-flex h-10 items-center rounded-l-lg border border-r-0 border-line-strong bg-ink-50 px-3 text-sm text-ink-600">+91</span>
            <Input
              id="pf-phone"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              className="min-w-0 flex-1 rounded-l-none"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))}
              aria-invalid={Boolean(err)}
            />
          </div>
        </Field>
        {phone && (
          <button type="button" onClick={() => save(null)} disabled={busy} className="mt-3 text-xs font-medium text-danger-700 hover:underline">
            Remove this number
          </button>
        )}
      </FormModal>
      {t.node}
    </>
  );
}

/**
 * Confirms the sign in email, or changes it: a code goes to the address, and
 * it only becomes the sign in email once the code is entered.
 */
export function EmailButton({ email, verified }: { email: string; verified: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"enter" | "code" | "done">("enter");
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [resent, setResent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const changing = verified;

  const send = async (to: string, again = false) => {
    if (!validEmail(to)) return setErr("Enter a valid email address.");
    setBusy(true);
    const r = await requestEmailCode(to.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setErr("");
    setSentTo(to.trim().toLowerCase());
    setDevCode(r.data.devCode);
    setCode("");
    setResent(again);
    setStep("code");
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setErr("Enter all 6 digits.");
    setBusy(true);
    const r = await verifyEmailCode(code);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setErr("");
    setStep("done");
    router.refresh();
  };

  const start = () => {
    setErr("");
    setValue("");
    setCode("");
    setOpen(true);
    if (changing) setStep("enter");
    else {
      setStep("code");
      void send(email);
    }
  };

  const close = () => setOpen(false);

  return (
    <>
      <Button size="sm" variant={verified ? "ghost" : "secondary"} onClick={start}>
        {verified ? "Change" : "Verify"}
      </Button>
      <Modal
        open={open}
        onClose={close}
        size="sm"
        title={step === "done" ? (changing ? "Email changed" : "Email verified") : changing ? "Change your email" : "Verify your email"}
        description={
          step === "enter"
            ? "We will send a code to the new address. You will sign in with it from then on."
            : step === "code"
              ? sentTo
                ? `Enter the 6 digit code we sent to ${sentTo}. It expires in 10 minutes.`
                : "Sending a code..."
              : undefined
        }
        footer={
          step === "done" ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              {step === "enter" ? (
                <Button onClick={() => send(value)} disabled={busy}>
                  {busy ? "Sending" : "Send code"}
                </Button>
              ) : (
                <Button onClick={verify} disabled={busy || !sentTo}>
                  {busy ? "Checking" : "Verify"}
                </Button>
              )}
            </>
          )
        }
      >
        {step === "enter" && (
          <Field label="New email address" htmlFor="pf-email" error={err || undefined}>
            <Input id="pf-email" type="email" autoComplete="email" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(err)} />
          </Field>
        )}
        {step === "code" && (
          <div>
            <label htmlFor="pf-code" className="text-[13px] font-medium text-ink-700">
              Verification code
            </label>
            <Input
              id="pf-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              className="mt-1.5 h-12 text-center font-mono text-xl tracking-[0.5em]"
              placeholder="000000"
              aria-invalid={Boolean(err)}
            />
            {err && <p className="mt-1.5 text-xs text-danger-600">{err}</p>}
            {devCode && (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-line-strong bg-ink-50 px-3 py-2 text-xs text-ink-600">
                <Code2 size={14} className="text-ink-400" aria-hidden="true" />
                Development code: <span className="font-mono font-semibold tracking-widest text-ink-900">{devCode}</span>
                <button type="button" onClick={() => setCode(devCode)} className="ml-auto font-semibold text-brand-700 hover:underline">
                  Fill it in
                </button>
              </p>
            )}
            {sentTo && (
              <p className="mt-3 flex items-center gap-3 text-xs">
                <button type="button" onClick={() => send(sentTo, true)} disabled={busy} className="font-medium text-brand-700 hover:underline">
                  Send a new code
                </button>
                {resent && <span className="text-success-700">A new code is on its way</span>}
              </p>
            )}
          </div>
        )}
        {step === "done" && (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <CircleCheck size={18} aria-hidden="true" />
            {changing ? `You now sign in with ${sentTo}.` : `${sentTo} is verified.`}
          </p>
        )}
      </Modal>
    </>
  );
}

/** Change the password with the current one. Other devices are signed out. */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: "", next: "" });
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const t = useToast();

  const save = async () => {
    const e: typeof errors = {};
    if (!f.current) e.current = "Enter your current password.";
    if (f.next.length < 8) e.next = "Use at least 8 characters.";
    else if (f.next.length > 128) e.next = "Use 128 characters or fewer.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const r = await changePassword({ currentPassword: f.current, newPassword: f.next });
    setBusy(false);
    if (!r.ok) return setErrors(r.code === "PASSWORD_INCORRECT" ? { current: r.error } : { form: r.error });
    setOpen(false);
    t.show("Password changed. Other devices were signed out");
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={KeyRound}
        onClick={() => {
          setF({ current: "", next: "" });
          setErrors({});
          setOpen(true);
        }}
      >
        Change password
      </Button>
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Change your password"
        description="You stay signed in here. Every other device is signed out."
        saveLabel="Change password"
        busy={busy}
        onSave={save}
      >
        <div className="flex flex-col gap-4">
          <Field label="Current password" htmlFor="pw-current" error={errors.current}>
            <Input id="pw-current" type="password" autoComplete="current-password" autoFocus value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} aria-invalid={Boolean(errors.current)} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={errors.next} hint="At least 8 characters">
            <Input id="pw-new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} aria-invalid={Boolean(errors.next)} />
          </Field>
          {errors.form && <p className="text-xs text-danger-600">{errors.form}</p>}
        </div>
      </FormModal>
      {t.node}
    </>
  );
}

/** Ends every session except this one. */
export function SignOutOthersButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const t = useToast();

  const confirm = async () => {
    setBusy(true);
    const r = await signOutOtherDevices();
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setOpen(false);
    t.show("Signed out of all other devices");
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={LogOut}
        onClick={() => {
          setErr("");
          setOpen(true);
        }}
      >
        Sign out of other devices
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Sign out everywhere else?"
        description="You stay signed in on this device. Other devices will need your password to sign in again."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Signing out" : "Sign out"}
            </Button>
          </>
        }
      >
        {err && <p className="text-sm text-danger-600">{err}</p>}
      </Modal>
      {t.node}
    </>
  );
}
