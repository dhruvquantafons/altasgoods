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
  Coins,
  CreditCard,
  Gift,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Stepper } from "@/components/ui/misc";
import { cn, formatINR, formatNumber } from "@/lib/utils";
import { useCart } from "./cart-context";
import { COD_LIMIT, daysFromNow, formatPromise, isValidPincode, lookupPincode, promiseDays } from "./delivery";
import { PriceDetails } from "./price-details";
import { bestBankOffer, computeTotals } from "./pricing";
import { QrArt } from "./qr-art";
import type { AddressLite, BankOffer, CartCatalog, CartLine, CouponLite, WalletLite } from "./types";

type PayMethod = "upi" | "card" | "netbanking" | "emi" | "paylater" | "cod";
type Choice = "standard" | "oneday" | "slot1" | "slot2";

const STEPS = [
  { label: "Sign in" },
  { label: "Address" },
  { label: "Delivery" },
  { label: "Summary" },
  { label: "Payment" },
];


const EMI_BANKS = ["Kaveri Bank credit card", "Coral Bank credit card", "Sahyadri Bank debit card"];

function emiMonthly(amount: number, months: number, noCost: boolean) {
  if (noCost) return Math.ceil(amount / months);
  const r = 0.14 / 12;
  return Math.ceil((amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

export function CheckoutFlow({
  catalog,
  coupons,
  bankOffers,
  banks,
  wallet,
  customer,
  addresses: initialAddresses,
  buyNow,
}: {
  catalog: CartCatalog;
  coupons: CouponLite[];
  bankOffers: BankOffer[];
  banks: string[];
  wallet: WalletLite;
  customer: { name: string; phone: string };
  addresses: AddressLite[];
  buyNow?: CartLine;
}) {
  const router = useRouter();
  const cart = useCart();
  const lines = useMemo(() => (buyNow ? [buyNow] : cart.active), [buyNow, cart.active]);

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [install, setInstall] = useState(false);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [upiMode, setUpiMode] = useState<"id" | "qr">("id");
  const [upiId, setUpiId] = useState("");
  const [upiVerified, setUpiVerified] = useState<string | null>(null);
  const [cardMode, setCardMode] = useState<"saved" | "new">("saved");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "", save: false });
  const [savedCvv, setSavedCvv] = useState("");
  const [bank, setBank] = useState("");
  const [emiBank, setEmiBank] = useState(EMI_BANKS[0]!);
  const [emiMonths, setEmiMonths] = useState(6);
  const [useCredits, setUseCredits] = useState(false);
  const [useGift, setUseGift] = useState(false);
  const [useCoins, setUseCoins] = useState(false);
  const [giftBalance, setGiftBalance] = useState(wallet.giftCard);
  const [giftCode, setGiftCode] = useState("");
  const [giftMsg, setGiftMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // one key per checkout attempt: retries and double clicks return the same order
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [quote, setQuote] = useState<Quote | null>(null);

  const address = addresses.find((a) => a.id === addressId) ?? addresses[0];
  const info = lookupPincode(address?.pincode ?? "");
  const localTotals = computeTotals(lines, catalog, { couponCode: cart.coupon, coupons, plus: wallet.plusMember, method });

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
  const bankKey = method === "card" && cardMode === "saved" ? "Kaveri Bank" : method === "emi" ? emiBank.split(" ")[0] + " Bank" : undefined;
  // bank offers apply once a payment method is chosen at the payment step
  const bankDeal =
    step < 4
      ? null
      : method === "emi"
      ? emiMonths >= 6
        ? bestBankOffer(bankOffers, totals.total, "emi", bankKey)
        : null
      : bestBankOffer(bankOffers, totals.total, method === "netbanking" || method === "cod" || method === "paylater" ? "none" : method, bankKey);
  const bankValue = bankDeal?.value ?? 0;
  let remaining = Math.max(0, totals.total - bankValue);
  const coinsCap = Math.min(wallet.bluCoins, Math.floor(totals.priceTotal * 0.1));
  const coinsUsed = useCoins ? Math.min(coinsCap, remaining) : 0;
  remaining -= coinsUsed;
  const creditsUsed = useCredits ? Math.min(wallet.credits, remaining) : 0;
  remaining -= creditsUsed;
  const giftUsed = useGift ? Math.min(giftBalance, remaining) : 0;
  remaining -= giftUsed;
  const payable = remaining;
  const extra = [
    ...(bankDeal ? [{ label: bankDeal.offer.kind === "UPI offer" ? "UPI offer" : "Bank offer", value: bankValue, note: bankDeal.offer.title }] : []),
    ...(coinsUsed ? [{ label: "AltasCoins", value: coinsUsed, note: `${formatNumber(coinsUsed)} coins redeemed` }] : []),
    ...(creditsUsed ? [{ label: "AltasGoods Credits", value: creditsUsed }] : []),
    ...(giftUsed ? [{ label: "Gift card balance", value: giftUsed }] : []),
  ];
  const coinsEarned = Math.min(100, Math.floor((totals.priceTotal - totals.couponDiscount) / 100) * (wallet.plusMember ? 2 : 1));
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
  const payLaterBlock = payable > wallet.payLaterLimit ? `Your available limit is ${formatINR(wallet.payLaterLimit)}` : null;

  /* ----- delivery: everything ships together from the store ----- */
  const deliveryInfo = () => {
    const days = promiseDays(totals.deliveryDays, info);
    const large = totals.lines.some((l) => l.product.large);
    const oneDay = wallet.plusMember && info?.zone === "metro" && days > 1 && !large;
    const picked: Choice = choice ?? (large ? "slot1" : "standard");
    const slots = [
      { key: "slot1" as const, label: `${formatPromise(daysFromNow(days))}, 9 am to 1 pm` },
      { key: "slot2" as const, label: `${formatPromise(daysFromNow(days + 1))}, 2 pm to 6 pm` },
    ];
    const date = picked === "oneday" ? daysFromNow(1) : picked === "slot2" ? daysFromNow(days + 1) : daysFromNow(days);
    const optionLabel = picked === "oneday" ? "Plus one-day" : large ? `Scheduled, ${slots.find((s) => s.key === picked)?.label}` : "Standard";
    return { days, large, oneDay, choice: picked, slots, date, optionLabel };
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

  const validatePayment = () => {
    if (payable === 0) return null;
    if (method === "upi" && upiMode === "id" && !upiVerified) return "Verify your UPI ID, or switch to the QR code option";
    if (method === "card" && cardMode === "saved" && !/^\d{3}$/.test(savedCvv)) return "Enter the 3 digit CVV for your saved card";
    if (method === "card" && cardMode === "new") {
      if (card.number.replace(/\s/g, "").length < 15) return "Enter a valid card number";
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) return "Enter the expiry as MM/YY";
      if (!/^\d{3,4}$/.test(card.cvv)) return "Enter the CVV";
      if (!card.name.trim()) return "Enter the name on the card";
    }
    if (method === "netbanking" && !bank) return "Choose your bank";
    if (method === "cod" && codBlock) return codBlock;
    if (method === "paylater" && payLaterBlock) return payLaterBlock;
    return null;
  };

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

  const ctaLabel = step < 4 ? (step === 1 ? "Deliver to this address" : step === 2 ? "Continue" : "Continue to payment") : payable === 0 ? "Place order" : method === "cod" ? "Place order" : `Pay ${formatINR(payable)}`;

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
          <StepCard n={1} title="Signed in" done icon={UserRound} summary={`${customer.name}, ${customer.phone}`} action={<Link href="/login?next=/checkout" className="text-[13px] font-semibold text-brand-700 hover:underline">Change</Link>} />

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
                    <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors", on ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500" : "border-line hover:border-line-strong")}>
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
                        <span className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-medium", ai?.serviceable ? "text-success-700" : "text-danger-700")}>
                          {ai?.serviceable ? <Check size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
                          {ai?.serviceable ? `All items deliverable${ai.codAvailable ? ", pay on delivery available" : ""}` : "Not deliverable to this pincode yet"}
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
                  if (!saved.ok) {
                    setError(saved.error);
                    return;
                  }
                  a = toAddressLite(saved.data);
                  setAddresses((list) => [...list, a]);
                  setAddressId(a.id);
                  setAdding(false);
                }}
                name={customer.name}
                phone={customer.phone}
              />
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:underline">
                <Plus size={16} aria-hidden="true" /> Add a new address
              </button>
            )}
            <StepActions>
              <button type="button" disabled={!info?.serviceable} onClick={next} className="h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300">
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
                  : [
                      { key: "standard", title: `Delivery by ${formatPromise(daysFromNow(d.days))}`, sub: "Standard delivery", price: fee },
                      ...(d.oneDay ? [{ key: "oneday" as const, title: `Tomorrow, ${formatPromise(daysFromNow(1))}`, sub: "Plus one-day delivery", price: "Free with Plus" }] : []),
                    ];
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
                        <label key={o.key} className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5", d.choice === o.key ? "bg-brand-50/60" : "hover:bg-ink-50")}>
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
                      {l.offer.assured && <span className="ml-2 inline-flex items-center gap-0.5 font-medium text-brand-700"><BadgeCheck size={12} aria-hidden="true" /> Assured</span>}
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
            {/* Balances (hidden until stored value is priced by the API) */}
            {(wallet.bluCoins > 0 || wallet.credits > 0 || wallet.giftCard > 0) && (
            <div className="rounded-xl border border-line">
              <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">Use your AltasGoods balance</p>
              <div className="flex flex-col divide-y divide-line">
                <BalanceRow icon={Coins} label={`AltasCoins: ${formatNumber(wallet.bluCoins)} available`} hint={`Use up to ${formatNumber(coinsCap)} coins (10% of order value). 1 coin = ₹1.`} checked={useCoins} disabled={!coinsCap} onChange={setUseCoins} value={coinsUsed} />
                <BalanceRow icon={Wallet} label={`AltasGoods Credits: ${formatINR(wallet.credits)}`} hint="Refund credits, never expire" checked={useCredits} disabled={!wallet.credits} onChange={setUseCredits} value={creditsUsed} />
                <BalanceRow icon={Gift} label={`Gift card balance: ${formatINR(giftBalance)}`} hint="Valid for 1 year from activation" checked={useGift} disabled={!giftBalance} onChange={setUseGift} value={giftUsed} />
              </div>
              <form
                className="flex flex-wrap items-start gap-2 border-t border-line px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (/^BBGC-?[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(giftCode.trim().toUpperCase())) {
                    setGiftBalance((b) => b + 1000);
                    setUseGift(true);
                    setGiftMsg("₹1,000 added to your gift card balance");
                    setGiftCode("");
                  } else setGiftMsg("That code is not valid. Gift card codes look like BBGC-XXXX-XXXX-XXXX.");
                }}
              >
                <label htmlFor="gift-code" className="sr-only">
                  Gift card code
                </label>
                <Input id="gift-code" inputSize="sm" value={giftCode} onChange={(e) => setGiftCode(e.target.value)} placeholder="Redeem a gift card code" className="min-w-0 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case" />
                <button type="submit" className="h-8 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-800 hover:bg-ink-50">
                  Redeem
                </button>
                {giftMsg && <p className="w-full text-xs text-ink-600">{giftMsg}</p>}
              </form>
            </div>
            )}

            {payable === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm font-medium text-success-700">
                <Check size={16} aria-hidden="true" /> Your AltasGoods balance covers this order. No further payment needed.
              </p>
            ) : (
              <fieldset className="mt-4 overflow-hidden rounded-xl border border-line">
                <legend className="sr-only">Payment method</legend>
                <PayOption id="upi" icon={Smartphone} title="UPI" sub="Pay with any UPI app" method={method} setMethod={setMethod} badge={bestBankOffer(bankOffers, totals.total, "upi") ? `Save ${formatINR(bestBankOffer(bankOffers, totals.total, "upi")!.value)}` : undefined}>
                  <div className="flex gap-2">
                    {(["id", "qr"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setUpiMode(m)} aria-pressed={upiMode === m} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium", upiMode === m ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-700")}>
                        {m === "id" ? <Smartphone size={14} aria-hidden="true" /> : <QrCode size={14} aria-hidden="true" />}
                        {m === "id" ? "UPI ID" : "Scan QR code"}
                      </button>
                    ))}
                  </div>
                  {upiMode === "id" ? (
                    <div className="mt-3">
                      <Field label="UPI ID" htmlFor="upi-id" hint={upiVerified ? undefined : "For example ananya.sharma@kaveri. You will approve the request in your UPI app within 15 minutes."}>
                        <div className="flex gap-2">
                          <Input
                            id="upi-id"
                            value={upiId}
                            onChange={(e) => {
                              setUpiId(e.target.value.trim());
                              setUpiVerified(null);
                            }}
                            placeholder="yourname@bank"
                            className="min-w-0 flex-1"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setUpiVerified(/^[\w.-]{2,}@[a-z]{2,}$/i.test(upiId) ? customer.name : null)}
                            className="h-10 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink-800 hover:bg-ink-50"
                          >
                            Verify
                          </button>
                        </div>
                      </Field>
                      {upiVerified && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success-700">
                          <BadgeCheck size={14} aria-hidden="true" /> Verified: {upiVerified}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                      <div className="rounded-xl border border-line p-2">
                        <QrArt seed={`${payable}-${addressId}`} label={`UPI QR code to pay ${formatINR(payable)}`} />
                      </div>
                      <div className="text-sm text-ink-600">
                        <p className="font-semibold text-ink-900">Scan with any UPI app to pay {formatINR(payable)}</p>
                        <p className="mt-1">The code is valid for 15 minutes after you place the order. Keep this page open until payment is confirmed.</p>
                      </div>
                    </div>
                  )}
                </PayOption>

                <PayOption id="card" icon={CreditCard} title="Credit or debit card" sub="Saved cards are tokenised, we never store card numbers" method={method} setMethod={setMethod} badge={bankOffers.length && totals.total >= 5000 ? "10% off with Kaveri Bank" : undefined}>
                  <div className="flex flex-col gap-2">
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", cardMode === "saved" ? "border-brand-500 bg-brand-50/40" : "border-line")}>
                      <input type="radio" name="card-mode" checked={cardMode === "saved"} onChange={() => setCardMode("saved")} className="size-4 accent-brand-600" />
                      <span className="flex-1 text-sm">
                        <span className="block font-medium text-ink-900">Kaveri Bank credit card ending 4821</span>
                        <span className="block text-xs text-ink-500">Expires 08/29, saved as a secure token</span>
                      </span>
                      {cardMode === "saved" && (
                        <Input aria-label="CVV" inputMode="numeric" maxLength={3} value={savedCvv} onChange={(e) => setSavedCvv(e.target.value.replace(/\D/g, ""))} placeholder="CVV" inputSize="sm" className="w-20" type="password" autoComplete="cc-csc" />
                      )}
                    </label>
                    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5", cardMode === "new" ? "border-brand-500 bg-brand-50/40" : "border-line")}>
                      <input type="radio" name="card-mode" checked={cardMode === "new"} onChange={() => setCardMode("new")} className="size-4 accent-brand-600" />
                      <span className="text-sm font-medium text-ink-900">Use a new card</span>
                    </label>
                  </div>
                  {cardMode === "new" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Card number" htmlFor="cc-num" className="sm:col-span-2">
                        <Input
                          id="cc-num"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          value={card.number}
                          onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim() }))}
                          placeholder="1234 5678 9012 3456"
                        />
                      </Field>
                      <Field label="Expiry (MM/YY)" htmlFor="cc-exp">
                        <Input
                          id="cc-exp"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          value={card.expiry}
                          onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setCard((c) => ({ ...c, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                          }}
                          placeholder="MM/YY"
                        />
                      </Field>
                      <Field label="CVV" htmlFor="cc-cvv">
                        <Input id="cc-cvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "") }))} placeholder="3 digits" />
                      </Field>
                      <Field label="Name on card" htmlFor="cc-name" className="sm:col-span-2">
                        <Input id="cc-name" autoComplete="cc-name" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} />
                      </Field>
                      <Checkbox
                        className="sm:col-span-2"
                        checked={card.save}
                        onChange={(e) => setCard((c) => ({ ...c, save: e.target.checked }))}
                        label="Save this card securely for future payments"
                        description="Stored as a token by our payment partner as per RBI rules. Optional."
                      />
                    </div>
                  )}
                </PayOption>

                <PayOption id="netbanking" icon={Landmark} title="Net banking" sub="All major banks" method={method} setMethod={setMethod}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {banks.slice(0, 6).map((b) => (
                      <button key={b} type="button" onClick={() => setBank(b)} aria-pressed={bank === b} className={cn("flex h-11 items-center gap-2 rounded-lg border px-3 text-left text-[13px] font-medium", bank === b ? "border-brand-500 bg-brand-50/40 text-ink-900" : "border-line text-ink-700 hover:border-line-strong")}>
                        <Landmark size={15} className="shrink-0 text-ink-400" aria-hidden="true" />
                        <span className="truncate">{b}</span>
                      </button>
                    ))}
                  </div>
                  <Select aria-label="Other banks" value={banks.includes(bank) && banks.indexOf(bank) < 6 ? "" : bank} onChange={(e) => setBank(e.target.value)} className="mt-2 sm:max-w-xs">
                    <option value="">Other banks</option>
                    {["Malabar Rural Bank", "Godavari Bank", "Tapti Urban Bank"].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </Select>
                </PayOption>

                <PayOption id="emi" icon={CalendarClock} title="EMI" sub={totals.total >= 3000 ? "No cost EMI on 3 and 6 months" : "Available on orders of ₹3,000 and above"} method={method} setMethod={setMethod} disabled={totals.total < 3000}>
                  <Select aria-label="EMI card" value={emiBank} onChange={(e) => setEmiBank(e.target.value)} className="sm:max-w-xs">
                    {EMI_BANKS.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </Select>
                  <div className="mt-3 overflow-hidden rounded-lg border border-line">
                    <table className="w-full text-[13px]">
                      <thead className="bg-ink-50 text-xs text-ink-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Plan</th>
                          <th className="px-3 py-2 text-right font-medium">Monthly</th>
                          <th className="px-3 py-2 text-right font-medium">Interest</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {[3, 6, 9, 12].map((m) => {
                          const noCost = m <= 6 && !emiBank.startsWith("Sahyadri");
                          const amt = Math.max(0, totals.total);
                          const monthly = emiMonthly(amt, m, noCost);
                          return (
                            <tr key={m} className={cn("cursor-pointer", emiMonths === m && "bg-brand-50/50")} onClick={() => setEmiMonths(m)}>
                              <td className="px-3 py-2">
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input type="radio" name="emi" checked={emiMonths === m} onChange={() => setEmiMonths(m)} className="size-3.5 accent-brand-600" />
                                  {m} months {noCost && <span className="rounded bg-success-50 px-1.5 py-px text-[11px] font-semibold text-success-700">No cost</span>}
                                </label>
                              </td>
                              <td className="px-3 py-2 text-right text-ink-900 tabular-nums">{formatINR(monthly)}</td>
                              <td className="px-3 py-2 text-right text-ink-600 tabular-nums">{noCost ? formatINR(0) : formatINR(monthly * m - amt)}</td>
                              <td className="px-3 py-2 text-right text-ink-900 tabular-nums">{formatINR(monthly * m)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-ink-500">No cost EMI: the interest is given to you as an upfront discount by the brand or AltasGoods. Bank GST on interest may apply on interest bearing plans.</p>
                </PayOption>

                <PayOption id="paylater" icon={Wallet} title="AltasGoods Pay Later" sub={payLaterBlock ?? `Available limit ${formatINR(wallet.payLaterLimit)}. Pay by 15 Nov, no extra cost.`} method={method} setMethod={setMethod} disabled={!!payLaterBlock}>
                  <p className="text-sm text-ink-600">
                    You will pay {formatINR(payable)} in one bill on 15 Nov, with no interest if paid on time. Offered with our NBFC partner. Late payment charges are shown in your Pay
                    Later agreement.
                  </p>
                </PayOption>

                <PayOption id="cod" icon={Banknote} title="Pay on delivery" sub={codBlock ?? "Cash or UPI at your door. No extra charge."} method={method} setMethod={setMethod} disabled={!!codBlock} last>
                  <p className="text-sm text-ink-600">
                    Keep {formatINR(payable)} ready or pay by scanning the associate&apos;s UPI QR. AltasGoods never charges a fee for paying on delivery.
                  </p>
                </PayOption>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                <CircleAlert size={16} aria-hidden="true" /> {error}
              </p>
            )}
            <div className="mt-5 hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-500">By placing this order you agree to AltasGoods&apos;s terms of use and return policy.</p>
              <button type="button" onClick={place} disabled={placing} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400">
                {placing ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                {placing ? "Processing payment" : ctaLabel}
              </button>
            </div>
          </StepCard>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <PriceDetails totals={totals} extra={extra} plus={wallet.plusMember} totalLabel={step === 4 ? "Amount payable" : "Order total"} />
          <div className="rounded-2xl border border-line bg-white p-4 text-[13px] text-ink-600">
            <p className="flex items-center gap-2 font-semibold text-ink-900">
              <Coins size={15} className="text-accent-700" aria-hidden="true" /> You will earn {coinsEarned} AltasCoins
            </p>
            <p className="mt-1">Credited after the return window closes{wallet.plusMember ? ", at 2x with Plus" : ""}.</p>
            <p className="mt-3 flex items-center gap-2 font-semibold text-ink-900">
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

function BalanceRow({
  icon: Icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
  value,
}: {
  icon: typeof Coins;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  value: number;
}) {
  return (
    <label className={cn("flex items-center gap-3 px-4 py-3", disabled ? "opacity-50" : "cursor-pointer hover:bg-ink-25")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-brand-600" />
      <Icon size={17} className="shrink-0 text-ink-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{hint}</span>
      </span>
      {checked && value > 0 && <span className="text-sm font-semibold text-success-700 tabular-nums">-{formatINR(value)}</span>}
    </label>
  );
}

function PayOption({
  id,
  icon: Icon,
  title,
  sub,
  method,
  setMethod,
  badge,
  disabled,
  last,
  children,
}: {
  id: PayMethod;
  icon: typeof Coins;
  title: string;
  sub: string;
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  badge?: string;
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
        {badge && <span className="hidden shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 sm:inline">{badge}</span>}
      </label>
      {on && <div className="px-4 pb-4 sm:pl-[4.25rem]">{children}</div>}
    </div>
  );
}

function AddressForm({ onSave, onCancel, name, phone }: { onSave: (a: AddressLite) => void; onCancel: () => void; name: string; phone: string }) {
  const [f, setF] = useState({ pincode: "", name, phone, line1: "", line2: "", landmark: "", type: "home" as AddressLite["type"] });
  const [err, setErr] = useState<string | null>(null);
  const info = isValidPincode(f.pincode) ? lookupPincode(f.pincode) : null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: k === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value }));
  return (
    <div className="mt-4 rounded-xl border border-line bg-ink-25 p-4">
      <p className="text-sm font-semibold text-ink-900">Add a new address</p>
      <p className="mt-0.5 text-xs text-ink-500">Fields marked * are required. We use your phone number only to coordinate delivery.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Pincode" required htmlFor="na-pin" hint={info ? `${info.city}${info.state ? `, ${info.state}` : ""}${info.serviceable ? "" : ", not serviceable yet"}` : "City and state fill in automatically"}>
          <Input id="na-pin" inputMode="numeric" autoComplete="postal-code" value={f.pincode} onChange={set("pincode")} />
        </Field>
        <Field label="Address type" htmlFor="na-type">
          <div className="flex gap-2" id="na-type">
            {(["home", "work", "other"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setF((x) => ({ ...x, type: t }))} aria-pressed={f.type === t} className={cn("h-10 flex-1 rounded-lg border text-sm font-medium capitalize", f.type === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line-strong text-ink-700")}>
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
      </div>
      {err && <p className="mt-3 text-xs text-danger-600">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (!info) return setErr("Enter a valid 6 digit pincode");
            if (!f.name.trim() || !f.line1.trim() || f.phone.replace(/\D/g, "").length < 10) return setErr("Fill in your name, a 10 digit mobile number and the house or building");
            onSave({ id: `addr-new-${f.pincode}-${f.line1.length}`, name: f.name, phone: f.phone, line1: f.line1, line2: f.line2 || undefined, landmark: f.landmark || undefined, city: info.city, state: info.state, pincode: f.pincode, type: f.type });
          }}
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Save and use this address
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg px-4 text-sm font-medium text-ink-700 hover:bg-ink-100">
          Cancel
        </button>
      </div>
    </div>
  );
}
