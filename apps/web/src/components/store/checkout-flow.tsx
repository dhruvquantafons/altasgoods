"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createAddress, placeOrder, quoteCheckout } from "@/app/actions/store";
import { toAddressLite } from "@/lib/api/store-adapters";
import type { Quote } from "@/lib/api/types";
import {
  BadgeCheck,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Smartphone,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Stepper } from "@/components/ui/misc";
import { cn, formatINR } from "@/lib/utils";
import { useCart } from "./cart-context";
import { daysFromNow, formatPromise, INDIAN_STATES, isValidPincode, lookupPincode, promiseDays } from "./delivery";
import { useDeliveryRules } from "./store-settings";
import { PriceDetails } from "./price-details";
import { computeTotals } from "./pricing";
import type { AddressLite, CartCatalog, CartLine, CouponLite } from "./types";

type PayMethod = "upi" | "card" | "netbanking" | "emi" | "paylater" | "cod";
type Choice = "standard" | "slot1" | "slot2";

const STEPS = [{ label: "Sign in" }, { label: "Address" }, { label: "Delivery" }, { label: "Summary" }, { label: "Payment" }];

export function CheckoutFlow({
  catalog,
  coupons,
  customer,
  addresses: initialAddresses,
  buyNow,
}: {
  catalog: CartCatalog;
  coupons: CouponLite[];
  customer: { name: string; phone: string };
  addresses: AddressLite[];
  buyNow?: CartLine;
}) {
  const router = useRouter();
  const cart = useCart();
  const rules = useDeliveryRules();
  const COD_LIMIT = rules.codLimit;
  const lines = useMemo(() => (buyNow ? [buyNow] : cart.active), [buyNow, cart.active]);

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [install, setInstall] = useState(false);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // one key per checkout attempt: retries and double clicks return the same order
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [quote, setQuote] = useState<Quote | null>(null);

  const address = addresses.find((a) => a.id === addressId) ?? addresses[0];
  const info = lookupPincode(address?.pincode ?? "");
  const localTotals = computeTotals(lines, catalog, { couponCode: cart.coupon, coupons, method, rules });

  // The API prices the order; its quote is the authority for every amount shown.
  const request = useMemo(
    () => ({ addressId, couponCode: cart.coupon, method, lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, variant: l.variant })) }),
    [addressId, cart.coupon, method, lines],
  );
  useEffect(() => {
    if (!request.addressId || !request.lines.length) return;
    let live = true;
    quoteCheckout(request).then((r) => {
      if (!live) return;
      if (r.ok) setQuote(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [request]);
  const issues = quote?.issues ?? [];
  const totals = quote
    ? {
        ...localTotals,
        mrpTotal: quote.mrpTotalPaise / 100,
        priceTotal: quote.subtotalPaise / 100,
        mrpDiscount: (quote.mrpTotalPaise - quote.subtotalPaise) / 100,
        couponDiscount: quote.couponDiscountPaise / 100,
        couponNote: quote.coupon && !quote.coupon.applied ? quote.coupon.message : null,
        delivery: quote.deliveryFeePaise / 100,
        total: quote.totalPaise / 100,
        savings: quote.savingsPaise / 100,
      }
    : localTotals;

  /* ----- money ----- */
  const payable = totals.total;
  const codBlock =
    quote && !quote.cod.available
      ? quote.cod.reason
      : payable > COD_LIMIT
        ? `Pay on delivery is available for orders up to ${formatINR(COD_LIMIT)}`
        : !info?.codAvailable
          ? `Pay on delivery is not available for pincode ${address?.pincode}`
          : totals.lines.some((l) => !l.offer.codAvailable)
            ? "One or more items cannot be paid on delivery"
            : null;

  /* ----- delivery: everything ships together from the store ----- */
  const deliveryInfo = () => {
    const days = promiseDays(totals.deliveryDays, info);
    const large = totals.lines.some((l) => l.product.large);
    const picked: Choice = choice ?? (large ? "slot1" : "standard");
    const slots = [
      { key: "slot1" as const, label: `${formatPromise(daysFromNow(days))}, 9 am to 1 pm` },
      { key: "slot2" as const, label: `${formatPromise(daysFromNow(days + 1))}, 2 pm to 6 pm` },
    ];
    const date = picked === "slot2" ? daysFromNow(days + 1) : daysFromNow(days);
    const optionLabel = large ? `Scheduled, ${slots.find((s) => s.key === picked)?.label}` : "Standard";
    return { days, large, choice: picked, slots, date, optionLabel };
  };

  if (!lines.length || !totals.lines.length)
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-ink-900">Nothing to check out</h1>
        <p className="mt-2 text-sm text-ink-500">Your cart is empty. Add something you love and come back here.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">
          Continue shopping
        </Link>
      </div>
    );

  const validatePayment = () => (method === "cod" && codBlock ? codBlock : null);

  const place = async () => {
    const err = validatePayment();
    if (err) {
      setError(err);
      return;
    }
    if (issues.length) {
      setError(issues.map((i) => i.message).join(". "));
      return;
    }
    setError(null);
    setPlacing(true);
    const r = await placeOrder({ ...request, addressId: request.addressId, method, idempotencyKey });
    if (!r.ok) {
      setPlacing(false);
      setError(r.error);
      return;
    }
    if (!buyNow) cart.removePurchased();
    router.push(r.data.redirect);
  };

  const next = () => {
    setError(null);
    setStep((s) => Math.min(4, s + 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const ctaLabel =
    step < 4
      ? step === 1
        ? "Deliver to this address"
        : step === 2
          ? "Continue"
          : "Continue to payment"
      : method === "cod"
        ? "Place order"
        : `Pay ${formatINR(payable)}`;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-36 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Checkout</h1>
          <p className="mt-1 text-sm text-ink-500">
            {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}
            {buyNow ? " (Buy now, the rest of your cart is untouched)" : ""}
          </p>
        </div>
        {!buyNow && (
          <Link href="/cart" className="text-sm font-semibold text-brand-700 hover:underline">
            Back to cart
          </Link>
        )}
      </div>
      <Stepper steps={STEPS} current={step} className="mt-6 hidden max-w-3xl sm:flex" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1. Sign in */}
          <StepCard
            n={1}
            title="Signed in"
            done
            icon={UserRound}
            summary={`${customer.name}, ${customer.phone}`}
            action={
              <Link href="/login?next=/checkout" className="text-[13px] font-semibold text-brand-700 hover:underline">
                Change
              </Link>
            }
          />

          {/* 2. Address */}
          <StepCard
            n={2}
            title="Delivery address"
            icon={MapPin}
            done={step > 1}
            active={step === 1}
            summary={address ? `${address.name}, ${address.line1}, ${address.city} ${address.pincode}` : undefined}
            action={step > 1 ? <EditButton onClick={() => setStep(1)} /> : null}
          >
            <fieldset>
              <legend className="sr-only">Choose a delivery address</legend>
              <div className="flex flex-col gap-3">
                {addresses.map((a) => {
                  const ai = lookupPincode(a.pincode);
                  const on = a.id === addressId;
                  return (
                    <label
                      key={a.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                        on ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500" : "border-line hover:border-line-strong",
                      )}
                    >
                      <input type="radio" name="address" checked={on} onChange={() => setAddressId(a.id)} className="mt-1 size-4 shrink-0 accent-brand-600" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{a.name}</span>
                          <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-600 uppercase">{a.type}</span>
                          {a.isDefault && <span className="text-xs text-ink-500">Default</span>}
                        </span>
                        <span className="mt-1 block text-ink-700">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}
                          {a.landmark ? `, ${a.landmark}` : ""}, {a.city}, {a.state} {a.pincode}
                        </span>
                        <span className="mt-0.5 block text-ink-500">{a.phone}</span>
                        <span
                          className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-medium", ai?.serviceable ? "text-success-700" : "text-danger-700")}
                        >
                          {ai?.serviceable ? <Check size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
                          {ai?.serviceable
                            ? `All items deliverable${ai.codAvailable ? ", pay on delivery available" : ""}`
                            : "Not deliverable to this pincode yet"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {adding ? (
              <AddressForm
                onCancel={() => setAdding(false)}
                onSave={async (a) => {
                  const saved = await createAddress({
                    name: a.name,
                    phone: a.phone,
                    line1: a.line1,
                    line2: a.line2,
                    landmark: a.landmark,
                    city: a.city,
                    state: a.state,
                    pincode: a.pincode,
                    type: a.type.toUpperCase() as "HOME" | "WORK" | "OTHER",
                  });
                  if (!saved.ok) return saved.error;
                  a = toAddressLite(saved.data);
                  setAddresses((list) => [...list, a]);
                  setAddressId(a.id);
                  setAdding(false);
                  return null;
                }}
                name={customer.name}
                phone={customer.phone}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                <Plus size={16} aria-hidden="true" /> Add a new address
              </button>
            )}
            <StepActions>
              <button
                type="button"
                disabled={!info?.serviceable}
                onClick={next}
                className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300"
              >
                Deliver to this address
              </button>
            </StepActions>
          </StepCard>

          {/* 3. Delivery options */}
          <StepCard
            n={3}
            title="Delivery options"
            icon={Truck}
            done={step > 2}
            active={step === 2}
            summary={step > 2 ? `Arrives ${formatPromise(deliveryInfo().date)}` : undefined}
            action={step > 2 ? <EditButton onClick={() => setStep(2)} /> : null}
          >
            <div className="flex flex-col gap-4">
              {(() => {
                const d = deliveryInfo();
                const fee = totals.delivery ? formatINR(totals.delivery) : "Free";
                const opts: { key: Choice; title: string; sub: string; price: string }[] = d.large
                  ? d.slots.map((s) => ({ key: s.key, title: s.label, sub: "Scheduled delivery, our team calls 1 hour before", price: fee }))
                  : [{ key: "standard", title: `Delivery by ${formatPromise(daysFromNow(d.days))}`, sub: "Standard delivery", price: fee }];
                return (
                  <div className="rounded-xl border border-line">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                      <p className="text-sm font-semibold text-ink-900">
                        One shipment<span className="font-normal text-ink-500"> from AltasGoods</span>
                      </p>
                      <div className="flex -space-x-2">
                        {totals.lines.map((l) => (
                          <span key={l.line.key} className="relative size-9 overflow-hidden rounded-lg bg-ink-50 ring-2 ring-white">
                            <Image src={l.product.image} alt={l.product.title} fill sizes="36px" className="object-cover" />
                          </span>
                        ))}
                      </div>
                    </div>
                    <fieldset className="flex flex-col gap-2 p-3">
                      <legend className="sr-only">Delivery option</legend>
                      {opts.map((o) => (
                        <label
                          key={o.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                            d.choice === o.key ? "bg-brand-50/60" : "hover:bg-ink-50",
                          )}
                        >
                          <input type="radio" name="ship" checked={d.choice === o.key} onChange={() => setChoice(o.key)} className="size-4 accent-brand-600" />
                          <span className="flex-1 text-sm">
                            <span className="block font-semibold text-ink-900">{o.title}</span>
                            <span className="block text-xs text-ink-500">{o.sub}</span>
                          </span>
                          <span className={cn("text-[13px] font-medium", o.price.startsWith("Free") ? "text-success-700" : "text-ink-900")}>{o.price}</span>
                        </label>
                      ))}
                      {d.large && (
                        <Checkbox
                          className="mt-1 px-3"
                          checked={install}
                          onChange={(e) => setInstall(e.target.checked)}
                          label="Request free installation"
                          description="A technician visits within 48 hours of delivery."
                        />
                      )}
                    </fieldset>
                  </div>
                );
              })()}
            </div>
            <StepActions>
              <button type="button" onClick={next} className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700">
                Continue
              </button>
            </StepActions>
          </StepCard>

          {/* 4. Summary */}
          <StepCard
            n={4}
            title="Order summary"
            icon={Building2}
            done={step > 3}
            active={step === 3}
            summary={step > 3 ? `${totals.itemCount} items, ${formatINR(totals.total)}` : undefined}
            action={step > 3 ? <EditButton onClick={() => setStep(3)} /> : null}
          >
            <ul className="divide-y divide-line rounded-xl border border-line">
              {totals.lines.map((l) => (
                <li key={l.line.key} className="flex gap-4 p-4">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                    <Image src={l.product.image} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 text-ink-900">{l.product.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {l.line.variant ? `${l.line.variant}, ` : ""}Qty {l.line.qty}
                    </p>
                    <p className="mt-1 text-xs text-ink-600">
                      {l.offer.returnWindowDays ? `${l.offer.returnWindowDays} day return policy` : "Not returnable, damage covered"}
                      {l.offer.assured && (
                        <span className="ml-2 inline-flex items-center gap-0.5 font-medium text-brand-700">
                          <BadgeCheck size={12} aria-hidden="true" /> Assured
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{formatINR(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Nothing has been added to your order for you: no insurance, extended warranty or donations. AltasGoods issues one GST invoice for your order.
            </p>
            <StepActions>
              <button type="button" onClick={next} className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700">
                Continue to payment
              </button>
            </StepActions>
          </StepCard>

          {/* 5. Payment */}
          <StepCard n={5} title="Payment" icon={Lock} active={step === 4}>
            <fieldset className="overflow-hidden rounded-xl border border-line">
              <legend className="sr-only">Payment method</legend>
              <PayOption id="upi" icon={Smartphone} title="UPI" sub="Pay with any UPI app" method={method} setMethod={setMethod}>
                <p className="text-sm text-ink-600">
                  After you place the order, Razorpay&apos;s secure window opens. Enter your UPI ID or scan the QR code there, then approve in your UPI app.
                </p>
              </PayOption>
              <PayOption id="card" icon={CreditCard} title="Credit or debit card" sub="Visa, Mastercard, RuPay and more" method={method} setMethod={setMethod}>
                <p className="text-sm text-ink-600">
                  You enter your card details in Razorpay&apos;s secure window. AltasGoods never sees or stores your card number.
                </p>
              </PayOption>
              <PayOption id="netbanking" icon={Landmark} title="Net banking" sub="Pay from your bank account" method={method} setMethod={setMethod}>
                <p className="text-sm text-ink-600">You choose your bank in Razorpay&apos;s secure window and sign in on your bank&apos;s page.</p>
              </PayOption>
              <PayOption id="emi" icon={CalendarClock} title="EMI" sub="On eligible credit and debit cards" method={method} setMethod={setMethod}>
                <p className="text-sm text-ink-600">
                  The EMI plans your bank offers, with their interest, are shown in Razorpay&apos;s secure window before you confirm.
                </p>
              </PayOption>
              <PayOption id="paylater" icon={Wallet} title="Pay Later" sub="With supported pay later providers" method={method} setMethod={setMethod}>
                <p className="text-sm text-ink-600">
                  You choose a provider in Razorpay&apos;s secure window. Your limit and repayment terms come from that provider.
                </p>
              </PayOption>
              <PayOption
                id="cod"
                icon={Banknote}
                title="Pay on delivery"
                sub={codBlock ?? "Cash or UPI at your door. No extra charge."}
                method={method}
                setMethod={setMethod}
                disabled={!!codBlock}
                last
              >
                <p className="text-sm text-ink-600">
                  Keep {formatINR(payable)} ready or pay by UPI when your order arrives. AltasGoods never charges a fee for paying on delivery.
                </p>
              </PayOption>
            </fieldset>

            {error && (
              <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                <CircleAlert size={16} aria-hidden="true" /> {error}
              </p>
            )}
            <div className="mt-5 hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-500">By placing this order you agree to AltasGoods&apos;s terms of use and return policy.</p>
              <button
                type="button"
                onClick={place}
                disabled={placing}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400"
              >
                {placing ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                {placing ? "Processing payment" : ctaLabel}
              </button>
            </div>
          </StepCard>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <PriceDetails totals={totals} totalLabel={step === 4 ? "Amount payable" : "Order total"} />
          <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-ink-600">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <ShieldCheck size={15} className="text-success-600" aria-hidden="true" /> AltasGoods Guarantee
            </p>
            <p className="mt-1">Get the item you ordered or your money back.</p>
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(16_24_40/0.18)] backdrop-blur sm:hidden">
        <div>
          <p className="text-xs text-ink-500">{step === 4 ? "Amount payable" : "Order total"}</p>
          <p className="text-lg font-semibold text-ink-900 tabular-nums">{formatINR(step === 4 ? payable : totals.total)}</p>
        </div>
        <button
          type="button"
          disabled={placing || (step === 1 && !info?.serviceable)}
          onClick={step === 4 ? place : next}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:bg-brand-400"
        >
          {placing && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {placing ? "Processing" : ctaLabel}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

function StepCard({
  n,
  title,
  icon: Icon,
  done,
  active,
  summary,
  action,
  children,
}: {
  n: number;
  title: string;
  icon: typeof MapPin;
  done?: boolean;
  active?: boolean;
  summary?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("rounded-2xl border bg-white", active ? "border-line-strong shadow-raised" : "border-line")}>
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            done ? "bg-success-600 text-white" : active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500",
          )}
        >
          {done ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn("flex items-center gap-2 text-[15px] font-semibold", done || active ? "text-ink-900" : "text-ink-500")}>
            <Icon size={16} className="text-ink-400" aria-hidden="true" /> {title}
          </h2>
          {done && summary && <p className="mt-0.5 truncate text-[13px] text-ink-600">{summary}</p>}
        </div>
        {action}
      </div>
      {active && children && <div className="border-t border-line px-5 py-5">{children}</div>}
    </section>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
      <Pencil size={13} aria-hidden="true" /> Change
    </button>
  );
}

function StepActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 hidden justify-end sm:flex">{children}</div>;
}

function PayOption({
  id,
  icon: Icon,
  title,
  sub,
  method,
  setMethod,
  disabled,
  last,
  children,
}: {
  id: PayMethod;
  icon: typeof MapPin;
  title: string;
  sub: string;
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  disabled?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  const on = method === id && !disabled;
  return (
    <div className={cn(!last && "border-b border-line", on && "bg-ink-25")}>
      <label className={cn("flex items-center gap-3 px-4 py-3.5", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
        <input type="radio" name="pay" checked={on} disabled={disabled} onChange={() => setMethod(id)} className="size-4 shrink-0 accent-brand-600" />
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-ink-700 ring-1 ring-line">
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-900">{title}</span>
          <span className="block text-xs text-ink-500">{sub}</span>
        </span>
      </label>
      {on && <div className="px-4 pb-4 sm:pl-[4.25rem]">{children}</div>}
    </div>
  );
}

/** Saves the address; resolves to an error message, or null once saved. */
function AddressForm({
  onSave,
  onCancel,
  name,
  phone,
}: {
  onSave: (a: AddressLite) => Promise<string | null>;
  onCancel: () => void;
  name: string;
  phone: string;
}) {
  const [f, setF] = useState({ pincode: "", name, phone, line1: "", line2: "", landmark: "", city: "", state: "", type: "home" as AddressLite["type"] });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const info = isValidPincode(f.pincode) ? lookupPincode(f.pincode) : null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPincode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.replace(/\D/g, "").slice(0, 6);
    const hit = isValidPincode(pin) ? lookupPincode(pin) : null;
    // only a pincode the lookup knows fills in the city and state; otherwise the customer types them
    setF((x) => ({ ...x, pincode: pin, ...(hit?.state ? { city: hit.city, state: hit.state } : {}) }));
  };
  const save = async () => {
    if (!info) return setErr("Enter a valid 6 digit pincode");
    if (!f.name.trim() || !f.line1.trim() || f.phone.replace(/\D/g, "").length < 10)
      return setErr("Fill in your name, a 10 digit mobile number and the house or building");
    if (f.city.trim().length < 2 || !f.state) return setErr("Fill in the city and choose the state");
    setErr(null);
    setSaving(true);
    const error = await onSave({
      id: `addr-new-${f.pincode}-${f.line1.length}`,
      name: f.name,
      phone: f.phone,
      line1: f.line1,
      line2: f.line2 || undefined,
      landmark: f.landmark || undefined,
      city: f.city.trim(),
      state: f.state,
      pincode: f.pincode,
      type: f.type,
    });
    setSaving(false);
    if (error) setErr(error);
  };
  return (
    <div className="mt-4 rounded-xl border border-line bg-ink-25 p-4">
      <p className="text-sm font-semibold text-ink-900">Add a new address</p>
      <p className="mt-0.5 text-xs text-ink-500">Fields marked * are required. We use your phone number only to coordinate delivery.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Pincode"
          required
          htmlFor="na-pin"
          hint={info ? (info.serviceable ? undefined : "Not serviceable yet") : "City and state fill in automatically where we can"}
        >
          <Input id="na-pin" inputMode="numeric" autoComplete="postal-code" value={f.pincode} onChange={setPincode} />
        </Field>
        <Field label="Address type" htmlFor="na-type">
          <div className="flex gap-2" id="na-type">
            {(["home", "work", "other"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setF((x) => ({ ...x, type: t }))}
                aria-pressed={f.type === t}
                className={cn(
                  "h-10 flex-1 rounded-lg border text-sm font-medium capitalize",
                  f.type === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line-strong text-ink-700",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Full name" required htmlFor="na-name">
          <Input id="na-name" autoComplete="name" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Mobile number" required htmlFor="na-phone">
          <Input id="na-phone" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Flat, house number, building" required htmlFor="na-l1" className="sm:col-span-2">
          <Input id="na-l1" autoComplete="address-line1" value={f.line1} onChange={set("line1")} />
        </Field>
        <Field label="Area, street, sector" htmlFor="na-l2">
          <Input id="na-l2" autoComplete="address-line2" value={f.line2} onChange={set("line2")} />
        </Field>
        <Field label="Landmark (optional)" htmlFor="na-lm">
          <Input id="na-lm" value={f.landmark} onChange={set("landmark")} />
        </Field>
        <Field label="City" required htmlFor="na-city">
          <Input id="na-city" autoComplete="address-level2" value={f.city} onChange={set("city")} />
        </Field>
        <Field label="State" required htmlFor="na-state">
          <Select id="na-state" autoComplete="address-level1" value={f.state} onChange={set("state")}>
            <option value="">Choose a state</option>
            {INDIAN_STATES.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </Select>
        </Field>
      </div>
      {err && <p className="mt-3 text-xs text-danger-600">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300"
        >
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Save and use this address
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg px-4 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
