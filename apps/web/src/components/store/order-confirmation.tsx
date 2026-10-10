"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, CircleCheck, Copy, MapPin, Package, ShieldCheck, Truck, Undo2 } from "lucide-react";
import { Timeline } from "@/components/ui/misc";
import { cn, formatINR } from "@/lib/utils";
import { LAST_ORDER_KEY } from "./pricing";
import type { PlacedOrder } from "./types";

const noop = () => () => {};

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LAST_ORDER_KEY);
  } catch {
    return null;
  }
}

export function OrderConfirmation({ fallback, requestedId, firstName, phone }: { fallback: PlacedOrder; requestedId: string; firstName: string; phone: string }) {
  const raw = useSyncExternalStore(noop, readStored, () => null);
  let order = fallback;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PlacedOrder;
      if (!requestedId || parsed.id === requestedId) order = parsed;
    } catch {
      /* keep fallback */
    }
  }
  const [copied, setCopied] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-50 ring-8 ring-success-50/50">
          <CircleCheck size={34} className="text-success-600" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900 lg:text-[32px]">Order placed, thank you {firstName}</h1>
        <p className="mt-2 max-w-lg text-[15px] text-ink-600">
          We have sent the confirmation to {phone} by SMS and to your email. {order.cod ? `Please keep ${formatINR(order.payable)} ready at delivery, or pay by UPI at the door.` : ""}
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-white py-1.5 pr-1.5 pl-4">
          <span className="text-[13px] text-ink-500">Order ID</span>
          <span className="font-mono text-[15px] font-semibold text-ink-900">{order.id}</span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(order.id).catch(() => {});
              setCopied(true);
            }}
            aria-label="Copy order ID"
            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-ink-600 hover:bg-ink-100"
          >
            {copied ? <Check size={14} className="text-success-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Your shipment" className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-medium text-ink-500">
                  <Truck size={14} aria-hidden="true" /> {order.delivery.option} delivery
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-ink-900">Arriving {order.delivery.date}</p>
              </div>
              <p className="text-[13px] text-ink-600">
                Shipped by <span className="font-semibold text-ink-900">AltasGoods</span>
              </p>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.slug + (it.variant ?? "")} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                    <Image src={it.image} alt="" fill sizes="56px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${it.slug}`} className="line-clamp-1 text-sm text-ink-900 hover:underline">
                      {it.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {it.variant ? `${it.variant}, ` : ""}Qty {it.qty}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink-900 tabular-nums">{formatINR(it.price * it.qty)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="next-heading" className="rounded-2xl border border-line bg-white p-5">
            <h2 id="next-heading" className="text-base font-semibold text-ink-900">
              What happens next
            </h2>
            <Timeline
              className="mt-4"
              items={[
                { title: "Order confirmed", time: "Just now", description: "We have your order and your payment is secured.", tone: "success" },
                { title: "Packed by AltasGoods", description: "Usually within a day. You can still cancel for free until it ships.", done: false },
                { title: "Shipped", description: "You get a tracking link by SMS and in Your orders.", done: false },
                { title: "Out for delivery", description: "For high value items, share the one-time code with the delivery associate.", done: false },
                { title: "Delivered", description: "On or before the promised date above. Easy returns from the order page if anything is not right.", done: false },
              ]}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section aria-label="Payment" className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-semibold tracking-wider text-ink-500 uppercase">{order.cod ? "To pay on delivery" : "Amount paid"}</p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(order.payable)}</p>
            <p className="mt-1 text-[13px] text-ink-600">{order.paymentLabel}</p>
            {order.savings > 0 && <p className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-[13px] font-semibold text-success-700">You saved {formatINR(order.savings)} on this order</p>}
          </section>

          <section aria-label="Delivery address" className="rounded-2xl border border-line bg-white p-5 text-[13px]">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <MapPin size={16} className="text-ink-500" aria-hidden="true" /> Delivering to {order.address.name}
            </p>
            <p className="mt-1.5 leading-relaxed text-ink-600">
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}, {order.address.state} {order.address.pincode}
            </p>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-5 text-[13px]">
            <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-600" />
            <span>
              <span className="block font-semibold text-ink-900">Get delivery updates on WhatsApp</span>
              <span className="block text-ink-500">Optional. Order updates only, never promotions. Turn off any time.</span>
            </span>
          </label>

          <div className="flex flex-col gap-2.5">
            <Link href="/account/orders" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700">
              <Package size={16} aria-hidden="true" /> View or track order
            </Link>
            <Link href="/" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-800 hover:bg-ink-50">
              Continue shopping <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ul className="flex flex-col gap-2 px-1 text-xs text-ink-500">
            <li className="flex items-center gap-2">
              <Undo2 size={13} aria-hidden="true" /> Free cancellation until your order ships
            </li>
            <li className={cn("flex items-center gap-2")}>
              <ShieldCheck size={13} aria-hidden="true" /> Protected by the AltasGoods Guarantee
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
