"use client";

import { useState } from "react";
import { CircleCheck, Gift, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { Tone } from "@/lib/status";
import { cn, formatINR } from "@/lib/utils";

/** Add and verify a UPI ID (mock verification). */
export function AddUpiButton() {
  const [open, setOpen] = useState(false);
  const [vpa, setVpa] = useState("");
  const [state, setState] = useState<"idle" | "verified" | "error">("idle");
  const t = useToast();
  const valid = /^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa);
  return (
    <>
      <Button size="sm" variant="secondary" icon={Plus} onClick={() => setOpen(true)}>
        Add UPI ID
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a UPI ID"
        description="We check the name on the account before saving it. Nothing is charged."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {state === "verified" ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  setState("idle");
                  setVpa("");
                  t.show("UPI ID saved");
                }}
              >
                Save UPI ID
              </Button>
            ) : (
              <Button onClick={() => setState(valid ? "verified" : "error")}>Verify</Button>
            )}
          </>
        }
      >
        <Field label="UPI ID" htmlFor="upi-id" error={state === "error" ? "Enter a UPI ID like name@bank." : undefined} hint="Find it in your UPI app under your profile">
          <Input
            id="upi-id"
            inputMode="email"
            autoComplete="off"
            value={vpa}
            onChange={(e) => {
              setVpa(e.target.value.trim());
              setState("idle");
            }}
            placeholder="name@bank"
            aria-invalid={state === "error"}
          />
        </Field>
        {state === "verified" && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2.5 text-[13px] text-success-700">
            <CircleCheck size={16} aria-hidden="true" />
            Verified: ANANYA SHARMA
          </p>
        )}
      </Modal>
      {t.node}
    </>
  );
}

/** Redeem a BluBuy Gift Card into BluBuy Credits. */
export function AddGiftCardButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const pretty = code
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 16)
    .replace(/(.{4})(?=.)/g, "$1 ");
  return (
    <>
      <Button icon={Gift} className={className} onClick={() => setOpen(true)}>
        Add a gift card
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(false);
        }}
        title={done ? "Gift card added" : "Add a BluBuy Gift Card"}
        description={done ? undefined : "The balance moves to your BluBuy Credits and keeps the gift card's expiry date."}
        footer={
          done ? (
            <Button
              onClick={() => {
                setOpen(false);
                setDone(false);
                setCode("");
                setPin("");
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (pretty.replace(/\s/g, "").length !== 16) return setErr("The code has 16 letters and numbers.");
                  if (!/^\d{6}$/.test(pin)) return setErr("The PIN has 6 digits.");
                  setErr("");
                  setDone(true);
                }}
              >
                Add to balance
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col items-center py-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-3 text-2xl font-semibold text-ink-900 tabular-nums">{formatINR(1000)}</p>
            <p className="mt-1 text-sm text-ink-600">added to your BluBuy Credits. Use it on any order before 1 Oct 2027.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Gift card code" htmlFor="gc-code" hint="16 characters, on the back of the card or in the email">
              <Input id="gc-code" value={pretty} onChange={(e) => setCode(e.target.value)} placeholder="XXXX XXXX XXXX XXXX" className="font-mono tracking-wider" autoComplete="off" />
            </Field>
            <Field label="PIN" htmlFor="gc-pin">
              <Input id="gc-pin" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digits" className="max-w-40 font-mono tracking-widest" autoComplete="off" />
            </Field>
            {err && <p className="text-xs text-danger-600">{err}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}

const designBg: Record<Tone, string> = {
  neutral: "from-ink-700 to-ink-900",
  info: "from-info-500 to-info-700",
  brand: "from-brand-500 to-brand-800",
  success: "from-success-500 to-success-700",
  warning: "from-warning-500 to-warning-700",
  danger: "from-danger-500 to-danger-700",
  accent: "from-accent-300 to-accent-600",
};

/** Buy a BluBuy Gift Card for someone (design, amount, recipient). */
export function BuyGiftCardButton({ designs, className }: { designs: { id: string; name: string; tone: Tone }[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState(designs[0]?.id ?? "");
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const t = useToast();
  const d = designs.find((x) => x.id === design) ?? designs[0]!;
  const value = custom ? Number(custom) : amount;
  return (
    <>
      <Button variant="secondary" icon={Send} className={className} onClick={() => setOpen(true)}>
        Send a gift card
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Send a BluBuy Gift Card"
        description="Delivered by email within minutes. Valid for one year, usable on anything sold on BluBuy."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!(value >= 100 && value <= 10000)) return setErr("Choose an amount between ₹100 and ₹10,000.");
                if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter the recipient's email address.");
                setErr("");
                setOpen(false);
                t.show(`Continue to payment for ${formatINR(value)}`);
              }}
            >
              Continue to pay {value >= 100 ? formatINR(value) : ""}
            </Button>
          </>
        }
      >
        <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className={cn("flex aspect-[1.6] flex-col justify-between rounded-2xl bg-gradient-to-br p-4 text-white shadow-raised", designBg[d.tone])}>
            <p className="font-display text-[15px] font-semibold">BluBuy</p>
            <div>
              <p className="text-xs opacity-80">{d.name}</p>
              <p className="text-2xl font-semibold tabular-nums">{value >= 100 ? formatINR(value) : "₹0"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-700">Design</legend>
              <div className="flex flex-wrap gap-2">
                {designs.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={design === x.id}
                    onClick={() => setDesign(x.id)}
                    className={cn("h-9 rounded-full border px-3.5 text-[13px] font-medium", design === x.id ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line-strong text-ink-700 hover:border-ink-400")}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-700">Amount</legend>
              <div className="flex flex-wrap gap-2">
                {[500, 1000, 2000, 5000].map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={!custom && amount === a}
                    onClick={() => {
                      setAmount(a);
                      setCustom("");
                    }}
                    className={cn("h-9 rounded-lg border px-3.5 text-[13px] font-medium tabular-nums", !custom && amount === a ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line-strong text-ink-700 hover:border-ink-400")}
                  >
                    {formatINR(a)}
                  </button>
                ))}
                <Input inputSize="sm" className="w-32" inputMode="numeric" placeholder="Other amount" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 5))} aria-label="Other amount in rupees" />
              </div>
            </fieldset>
            <Field label="Recipient's email" htmlFor="gc-email">
              <Input id="gc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </Field>
            <Field label="Message" htmlFor="gc-note" hint="Optional, up to 150 characters">
              <Textarea id="gc-note" className="min-h-20" maxLength={150} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Happy Diwali! Pick something you love." />
            </Field>
            {err && <p className="text-xs text-danger-600">{err}</p>}
          </div>
        </div>
      </Modal>
      {t.node}
    </>
  );
}
