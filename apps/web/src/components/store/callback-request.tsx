"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CircleCheck, LogIn, PhoneCall } from "lucide-react";
import { startConversation } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

const SLOTS = ["In the next 15 minutes", "Within the next 2 hours", "This evening, 6 pm to 10 pm", "Tomorrow morning, 8 am to 12 pm", "Tomorrow afternoon, 12 pm to 4 pm"];
const TOPICS = ["An order", "A return or refund", "A payment", "Your account", "Something else"];
const CATEGORY: Record<string, "Delivery" | "Return and refund" | "Payment" | "Account" | "Other"> = { "An order": "Delivery", "A return or refund": "Return and refund", "A payment": "Payment", "Your account": "Account", "Something else": "Other" };

const pretty = (digits: string) => `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;

/** Call-back request: a phone number and a time that suits the customer, raised as a phone ticket for the Care Desk. */
export function CallbackRequest({ careNumber, defaultPhone = "", signedIn }: { careNumber: string; defaultPhone?: string; signedIn: boolean }) {
  const id = useId();
  const [phone, setPhone] = useState(defaultPhone);
  const [slot, setSlot] = useState(SLOTS[0]!);
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<{ phone: string; slot: string; topic: string; ticket: string } | null>(null);

  // requests are tickets on the customer's account, so the Care Desk knows who to call
  if (!signedIn)
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-600">Sign in so we know whose orders to look at before we call. Or call {careNumber} now.</p>
        <Link href="/login?next=%2Fcontact%23call-back" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          <LogIn size={16} aria-hidden="true" /> Sign in to request a call back
        </Link>
      </div>
    );

  if (booked)
    return (
      <div className="flex gap-3 rounded-xl bg-success-50 px-4 py-4 text-sm text-success-800" role="status">
        <CircleCheck size={18} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
        <div>
          <p className="font-semibold">Call-back requested</p>
          <p className="mt-1 leading-relaxed">
            We will call {pretty(booked.phone)} about {booked.topic.charAt(0).toLowerCase() + booked.topic.slice(1)}.
          </p>
          <p className="mt-0.5 leading-relaxed">When: {booked.slot}.</p>
          <p className="mt-0.5 leading-relaxed">
            Reference{" "}
            <Link href="/account/support" className="font-semibold underline underline-offset-2">
              {booked.ticket}
            </Link>
            , also in your Help and support page.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-success-700">The call comes from {careNumber}. We never ask for your OTP, PIN or card details.</p>
          <button type="button" onClick={() => setBooked(null)} className="mt-2 text-[13px] font-semibold text-success-800 underline underline-offset-2">
            Change the number or time
          </button>
        </div>
      </div>
    );

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
        if (!/^[6-9]\d{9}$/.test(digits)) return setError("Enter a 10 digit Indian mobile number");
        setError("");
        setBusy(true);
        const r = await startConversation({ subject: `Call back about ${topic.charAt(0).toLowerCase() + topic.slice(1)}`, category: CATEGORY[topic] ?? "Other", body: `Please call me on ${pretty(digits)}. Best time: ${slot.charAt(0).toLowerCase() + slot.slice(1)}.`, channel: "PHONE" });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setBooked({ phone: digits, slot, topic, ticket: r.data.id });
      }}
    >
      <Field label="Mobile number" htmlFor={`${id}-phone`} error={error || undefined} required>
        <Input
          id={`${id}-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98450 12345"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <Field label="When should we call?" htmlFor={`${id}-slot`}>
        <Select id={`${id}-slot`} value={slot} onChange={(e) => setSlot(e.target.value)}>
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label="What is it about?" htmlFor={`${id}-topic`}>
        <Select id={`${id}-topic`} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" icon={PhoneCall} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Requesting" : "Request a call back"}
        </Button>
      </div>
    </form>
  );
}
