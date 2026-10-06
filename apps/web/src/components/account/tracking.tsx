import { Bike, Phone, ShieldCheck, Star } from "lucide-react";
import { Avatar, Stepper, Timeline } from "@/components/ui/misc";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dateTimeLabel, timeLabel, trackIndex, trackSteps } from "./lib";

/** Horizontal Ordered > Packed > Shipped > Out for delivery > Delivered stepper. */
export function TrackingStepper({ order, className }: { order: Order; className?: string }) {
  const current = trackIndex(order.status);
  if (current < 0) return null;
  return <Stepper steps={trackSteps(order)} current={current} className={className} />;
}

/** Full event history, newest first, collapsed behind a disclosure. */
export function TrackingHistory({ order, awb }: { order: Order; awb: string }) {
  const events = [...order.timeline].reverse();
  return (
    <details className="group rounded-xl border border-line bg-ink-50/50 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
        <span>
          See all updates <span className="font-normal text-ink-500">({events.length})</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-normal text-ink-500">
          <span className="hidden sm:inline">Tracking ID</span>
          <span className="font-mono text-[12px] text-ink-700">{awb}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-ink-400 transition-transform group-open:rotate-180">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-line px-4 pt-4 pb-4">
        <Timeline
          items={events.map((e, i) => ({
            title: e.label,
            time: dateTimeLabel(e.at),
            description: e.location,
            tone: i === 0 ? (e.status === "delivered" ? "success" : e.status === "cancelled" || e.status === "undelivered" ? "warning" : "brand") : "neutral",
          }))}
        />
      </div>
    </details>
  );
}

/** AltasGoods Secure Delivery banner shown while a high-value order is out for delivery. */
export function SecureDeliveryBanner({ otp, promisedBy, className }: { otp: string; promisedBy: string; className?: string }) {
  return (
    <section aria-label="Secure Delivery OTP" className={cn("relative overflow-hidden rounded-[var(--radius-card)] bg-brand-950 text-white", className)}>
      <div className="pointer-events-none absolute -top-24 -right-10 size-72 rounded-full bg-brand-600/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 size-64 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <ShieldCheck size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-medium text-brand-200">AltasGoods Secure Delivery</p>
            <p className="mt-0.5 font-display text-[18px] font-semibold">Share this code at your door</p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-brand-100">
              Your package arrives today by {timeLabel(promisedBy)}. Check that the tamper-evident seal is intact, then give this code to the delivery associate.
              AltasGoods will never ask for it on a call.
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <p className="text-[11px] font-semibold tracking-wider text-brand-200 uppercase">Delivery OTP</p>
          <div className="mt-2 flex gap-2" aria-label={`Delivery OTP ${otp.split("").join(" ")}`} role="img">
            {otp.split("").map((d, i) => (
              <span key={i} className="flex h-14 w-12 items-center justify-center rounded-xl bg-white/10 font-mono text-[26px] font-semibold ring-1 ring-white/20" aria-hidden="true">
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Delivery associate row during the out for delivery stage (masked call). */
export function AssociateRow({ name, phone, rating, vehicle, stopsAway }: { name: string; phone: string; rating: number; vehicle: string; stopsAway: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink-900">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-500">
          <span>Your delivery associate</span>
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="text-accent-500" fill="currentColor" strokeWidth={0} aria-hidden="true" />
            {rating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bike size={13} aria-hidden="true" />
            {vehicle}
          </span>
          <span>{stopsAway} stops away</span>
        </p>
      </div>
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-white px-3 text-[13px] font-medium text-ink-800 shadow-xs hover:bg-ink-50"
      >
        <Phone size={14} aria-hidden="true" />
        Call
      </a>
      <p className="w-full text-[11px] text-ink-500">Calls are connected through a masked number, so neither of you sees the other&apos;s phone number.</p>
    </div>
  );
}
