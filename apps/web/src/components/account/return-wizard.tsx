"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createReturn, uploadReturnPhoto } from "@/app/actions/returns";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CircleCheck,
  ImageIcon,
  Info,
  Loader2,
  MapPin,
  PackageCheck,
  Pencil,
  RefreshCcw,
  Repeat,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Stepper } from "@/components/ui/misc";
import { cn, formatINR } from "@/lib/utils";

export type Resolution = "refund" | "replacement" | "exchange";

export interface WizardItem {
  id: string;
  title: string;
  image: string;
  variant?: string;
  quantity: number;
  amount: number;
  eligible: boolean;
  blockedReason?: string;
  windowLabel?: string;
  policySummary: string;
  policyNote?: string;
  resolutions: Resolution[];
  fashion: boolean;
  /** change-of-mind reasons allowed (refund category and inside the category window) */
  changeOfMind: boolean;
  sizes: { label: string; available: boolean }[];
  /** refund at pickup: value up to ₹5,000 and not a high-risk category */
  instantRefund: boolean;
}

export interface WizardReason {
  code: string;
  label: string;
  fault: "seller" | "logistics" | "customer";
  photos: boolean;
  fashionOnly?: boolean;
}

export interface WizardAddress {
  id: string;
  name: string;
  type: string;
  lines: string;
  phone: string;
  isDefault: boolean;
}

export interface WizardSlot {
  key: string;
  weekday: string;
  date: string;
  full: string;
  windows: string[];
}

const STEPS = [{ label: "Item" }, { label: "Reason" }, { label: "Resolution" }, { label: "Pickup" }, { label: "Review" }];

const RESOLUTION_COPY: Record<Resolution, { title: string; detail: string; icon: typeof RefreshCcw }> = {
  refund: { title: "Refund", detail: "Get your money back", icon: Wallet },
  replacement: { title: "Replacement", detail: "Same item, new unit", icon: RefreshCcw },
  exchange: { title: "Exchange size", detail: "Picked up and delivered in one visit", icon: Repeat },
};

function Choice({
  selected,
  disabled,
  onSelect,
  children,
  className,
  name,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition-colors",
        selected ? "border-brand-500 ring-1 ring-brand-500" : "border-line hover:border-line-strong",
        disabled && "cursor-not-allowed bg-ink-50/70 opacity-70 hover:border-line",
        className,
      )}
    >
      <input type="radio" name={name} className="mt-0.5 size-4 shrink-0 accent-brand-600" checked={selected} disabled={disabled} onChange={onSelect} />
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

export function ReturnWizard({
  orderId,
  items,
  initialItemId,
  reasons,
  addresses,
  slots,
  payment,
}: {
  orderId: string;
  items: WizardItem[];
  initialItemId?: string;
  reasons: WizardReason[];
  addresses: WizardAddress[];
  slots: WizardSlot[];
  payment: { label: string; timing: string; isCod: boolean; creditsOnly: boolean };
}) {
  const firstEligible = items.find((i) => i.eligible && i.id === initialItemId) ?? items.find((i) => i.eligible);
  const [step, setStep] = useState(0);
  const [itemId, setItemId] = useState(firstEligible?.id ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState<"photo" | "submit" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; status: string } | null>(null);
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [size, setSize] = useState("");
  const [refundTo, setRefundTo] = useState<"original" | "credits" | "bank">(payment.isCod || payment.creditsOnly ? "credits" : "original");
  const [upi, setUpi] = useState("");
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [slotKey, setSlotKey] = useState(slots[0]?.key ?? "");
  const [pickupWindow, setPickupWindow] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const submitted = created !== null;

  const item = items.find((i) => i.id === itemId);
  const reason = reasons.find((r) => r.code === reasonCode);
  const slot = slots.find((s) => s.key === slotKey);
  const address = addresses.find((a) => a.id === addressId);

  const availableReasons = item
    ? reasons.filter((r) => (r.fashionOnly ? item.fashion : true) && (r.fault !== "customer" || item.changeOfMind))
    : [];

  const allowedResolutions: Resolution[] = !item || !reason
    ? []
    : item.resolutions.filter((r) => {
        if (reason.code === "SIZE_FIT_ISSUE") return r === "exchange" || r === "refund";
        if (reason.fault === "customer") return r === "refund";
        return r !== "exchange";
      });

  const errors: Record<number, string | undefined> = {
    0: !item ? "Choose the item you want to return." : undefined,
    1: !reason ? "Choose a reason." : reason.photos && photos.length === 0 ? "Add at least one photo so we can approve this quickly." : undefined,
    2: !resolution
      ? "Choose how you would like this resolved."
      : resolution === "exchange" && !size
        ? "Choose the size you want instead."
        : resolution === "refund" && refundTo === "bank" && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upi)
          ? "Enter a valid UPI ID, for example name@bank."
          : undefined,
    3: !address ? "Choose a pickup address." : !pickupWindow ? "Choose a pickup time window." : undefined,
  };

  const next = () => {
    if (errors[step]) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => {
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
  };
  const goto = (s: number) => {
    setShowErrors(false);
    setStep(s);
  };

  const refundLabel =
    refundTo === "credits" ? "BluBuy Credits" : refundTo === "bank" ? `UPI ID ${upi}` : payment.label;
  const refundWhen =
    refundTo === "credits"
      ? item?.instantRefund
        ? "Instantly, as soon as the pickup is done"
        : "Under 2 hours after the seller's quality check"
      : refundTo === "bank"
        ? "1 to 2 business days after pickup"
        : `${payment.timing} after ${item?.instantRefund ? "pickup" : "the seller's quality check"}`;

  async function submit() {
    if (!item || !reason || !resolution || !slot) return;
    setBusy("submit");
    setSubmitError(null);
    const r = await createReturn({
      orderId,
      orderItemId: item.id,
      qty: item.quantity,
      reasonCode: reason.code,
      reasonLabel: reason.label,
      fault: reason.fault.toUpperCase() as "SELLER" | "LOGISTICS" | "CUSTOMER",
      comments: comment.trim() || undefined,
      photoIds: photos.map((p) => p.id),
      resolution: resolution.toUpperCase() as "REFUND" | "REPLACEMENT" | "EXCHANGE",
      exchangeSize: resolution === "exchange" ? size : undefined,
      refundTo: resolution === "refund" ? (refundTo === "original" ? "SOURCE" : refundTo === "credits" ? "CREDITS" : "BANK") : undefined,
      refundUpi: resolution === "refund" && refundTo === "bank" ? upi : undefined,
      pickupDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(slot.key)),
      pickupSlot: pickupWindow,
      addressId: address?.id,
    });
    setBusy(null);
    if (!r.ok) return setSubmitError(r.error);
    setCreated({ id: r.data.id, status: r.data.status });
    router.refresh();
  }

  if (submitted && item) {
    return (
      <section className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-10 text-center shadow-card sm:px-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600">
          <CircleCheck size={30} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-ink-900">
          {resolution === "refund" ? "Return requested" : resolution === "exchange" ? "Exchange requested" : "Replacement requested"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
          {created?.status === "PENDING_SELLER_REVIEW" ? (
            <>
              Request <span className="font-mono text-[13px] text-ink-900">{created.id}</span> is outside the return window, so the seller reviews it within 48 hours. We will let you know as soon as they decide.
            </>
          ) : (
            <>
              Request <span className="font-mono text-[13px] text-ink-900">{created?.id}</span> is approved and the pickup is booked. We have sent the details to your mobile and email.
            </>
          )}
        </p>
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          <div className="rounded-xl border border-line p-4">
            <MapPin size={18} className="text-brand-600" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-ink-900">Pickup</p>
            <p className="mt-0.5 text-xs text-ink-600">
              {slot?.full}, {pickupWindow}
            </p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <PackageCheck size={18} className="text-brand-600" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-ink-900">Keep it ready</p>
            <p className="mt-0.5 text-xs text-ink-600">With tags, accessories and the original box. The associate will check it at your door.</p>
          </div>
          <div className="rounded-xl border border-line p-4">
            {resolution === "refund" ? <Wallet size={18} className="text-brand-600" aria-hidden="true" /> : <RefreshCcw size={18} className="text-brand-600" aria-hidden="true" />}
            <p className="mt-2 text-[13px] font-semibold text-ink-900">{resolution === "refund" ? `${formatINR(item.amount)} refund` : resolution === "exchange" ? `Size ${size}` : "New unit"}</p>
            <p className="mt-0.5 text-xs text-ink-600">
              {resolution === "refund" ? `To ${refundLabel}. ${refundWhen}.` : "Ships as soon as the pickup is done. Plus members may get it sooner."}
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/account/returns">View returns and refunds</ButtonLink>
          <ButtonLink href={`/account/orders/${orderId}`} variant="secondary">
            Back to order
          </ButtonLink>
        </div>
      </section>
    );
  }

  const err = showErrors ? errors[step] : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <div className="border-b border-line px-3 py-5 sm:px-8">
          <Stepper steps={STEPS} current={step} />
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-7">
          {step === 0 && (
            <fieldset>
              <legend className="text-base font-semibold text-ink-900">Which item do you want to return or replace?</legend>
              <p className="mt-1 text-[13px] text-ink-500">Choose one item at a time. Each item gets its own pickup and refund.</p>
              <div className="mt-5 flex flex-col gap-3">
                {items.map((it) => (
                  <Choice key={it.id} name="item" selected={itemId === it.id} disabled={!it.eligible} onSelect={() => {
                    setItemId(it.id);
                    setReasonCode("");
                    setResolution("");
                  }}>
                    <div className="flex gap-3.5">
                      <ProductImage src={it.image} alt="" size={64} rounded="md" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13.5px] font-medium text-ink-900">{it.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {it.variant ? `${it.variant} · ` : ""}Qty {it.quantity} · {formatINR(it.amount)}
                        </p>
                        {it.eligible ? (
                          <p className="mt-1.5 text-xs text-ink-600">
                            {it.policySummary}
                            {it.windowLabel ? `. Request by ${it.windowLabel}` : ""}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs font-medium text-ink-600">{it.blockedReason}</p>
                        )}
                      </div>
                    </div>
                  </Choice>
                ))}
              </div>
            </fieldset>
          )}

          {step === 1 && item && (
            <div className="flex flex-col gap-7">
              <fieldset>
                <legend className="text-base font-semibold text-ink-900">What went wrong?</legend>
                <p className="mt-1 text-[13px] text-ink-500">
                  {item.changeOfMind ? "Your answer decides which options you get next." : "This item can be replaced if it arrived damaged, defective, incomplete or wrong."}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {availableReasons.map((r) => (
                    <label
                      key={r.code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] transition-colors",
                        reasonCode === r.code ? "border-brand-500 bg-brand-50 text-ink-900" : "border-line text-ink-700 hover:border-line-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name="reason"
                        className="size-4 accent-brand-600"
                        checked={reasonCode === r.code}
                        onChange={() => {
                          setReasonCode(r.code);
                          setResolution("");
                        }}
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="return-comment" className="text-[13px] font-semibold text-ink-900">
                  Tell us more <span className="font-normal text-ink-500">(optional)</span>
                </label>
                <Textarea id="return-comment" className="mt-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example, the left earcup crackles at high volume." maxLength={500} />
              </div>

              {reason?.photos && (
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">Add photos</p>
                  <p className="mt-0.5 text-xs text-ink-500">Show the issue and the shipping label. Up to 4 photos, JPG or PNG.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {photos.map((p) => (
                      <div key={p.id} className="relative flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-ink-50 text-ink-400">
                        <ImageIcon size={20} aria-hidden="true" />
                        <span className="max-w-[4.5rem] truncate text-[10px] text-ink-500">{p.name}</span>
                        <button
                          type="button"
                          onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))}
                          className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-line bg-white text-ink-500 shadow-xs hover:text-ink-900"
                          aria-label={`Remove ${p.name}`}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      aria-label="Add a photo"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        if (f.size > 4 * 1024 * 1024) return setSubmitError("Photos can be up to 4 MB");
                        setBusy("photo");
                        setSubmitError(null);
                        const form = new FormData();
                        form.set("file", f);
                        const r = await uploadReturnPhoto(form);
                        setBusy(null);
                        if (!r.ok) return setSubmitError(r.error);
                        setPhotos((ps) => [...ps, r.data]);
                      }}
                    />
                    {photos.length < 4 && (
                      <button
                        type="button"
                        disabled={busy === "photo"}
                        onClick={() => photoInput.current?.click()}
                        className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {busy === "photo" ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
                        <span className="text-[11px] font-medium">{busy === "photo" ? "Adding" : "Add photo"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && item && (
            <div className="flex flex-col gap-7">
              <fieldset>
                <legend className="text-base font-semibold text-ink-900">How should we make it right?</legend>
                <div className={cn("mt-4 grid gap-3", allowedResolutions.length > 1 && "sm:grid-cols-2")}>
                  {allowedResolutions.map((r) => {
                    const c = RESOLUTION_COPY[r];
                    return (
                      <Choice key={r} name="resolution" selected={resolution === r} onSelect={() => setResolution(r)}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[14px] font-semibold text-ink-900">{c.title}</p>
                            <p className="mt-0.5 text-xs text-ink-500">{r === "refund" ? `${formatINR(item.amount)} back to you` : c.detail}</p>
                          </div>
                          <c.icon size={18} strokeWidth={1.8} className="text-ink-400" aria-hidden="true" />
                        </div>
                      </Choice>
                    );
                  })}
                </div>
                {allowedResolutions.length === 1 && allowedResolutions[0] === "replacement" && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
                    <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
                    {item.policySummary}. If the replacement also has a problem, you can get a full refund.
                  </p>
                )}
              </fieldset>

              {resolution === "exchange" && (
                <fieldset>
                  <legend className="text-[13px] font-semibold text-ink-900">Size you want instead</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.sizes.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        disabled={!s.available || s.label === item.variant}
                        onClick={() => setSize(s.label)}
                        aria-pressed={size === s.label}
                        className={cn(
                          "h-11 min-w-12 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                          size === s.label ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-line-strong text-ink-800 hover:border-ink-400",
                          "disabled:cursor-not-allowed disabled:border-line disabled:bg-ink-50 disabled:text-ink-400 disabled:line-through",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {resolution === "refund" && (
                <fieldset>
                  <legend className="text-[13px] font-semibold text-ink-900">Where should the refund go?</legend>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {!payment.isCod && !payment.creditsOnly && (
                      <Choice name="refund" selected={refundTo === "original"} onSelect={() => setRefundTo("original")}>
                        <p className="text-[13.5px] font-medium text-ink-900">Original payment method</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {payment.label}. {payment.timing} after {item.instantRefund ? "pickup" : "the seller's quality check"}
                        </p>
                      </Choice>
                    )}
                    <Choice name="refund" selected={refundTo === "credits"} onSelect={() => setRefundTo("credits")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-medium text-ink-900">BluBuy Credits</p>
                        {item.instantRefund && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                            <Zap size={11} aria-hidden="true" />
                            Instant
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {item.instantRefund ? "Credited the moment the item is picked up." : "Credited within 2 hours of the quality check."} Never expires, and you can move it to your bank later.
                      </p>
                    </Choice>
                    {payment.isCod && (
                      <Choice name="refund" selected={refundTo === "bank"} onSelect={() => setRefundTo("bank")}>
                        <p className="text-[13.5px] font-medium text-ink-900">UPI ID or bank account</p>
                        <p className="mt-0.5 text-xs text-ink-500">1 to 2 business days. We verify it with a ₹1 deposit first.</p>
                        {refundTo === "bank" && (
                          <Input className="mt-3 max-w-xs" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" aria-label="UPI ID for refund" inputMode="email" />
                        )}
                      </Choice>
                    )}
                  </div>
                </fieldset>
              )}

              {resolution === "replacement" && (
                <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3.5 py-3 text-[13px] text-brand-800">
                  <Zap size={16} className="mt-px shrink-0" aria-hidden="true" />
                  As a BluBuy Plus member, your replacement can ship before we pick up the original, so you are never without it for long.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-7">
              <fieldset>
                <legend className="text-base font-semibold text-ink-900">Pickup address</legend>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {addresses.map((a) => (
                    <Choice key={a.id} name="address" selected={addressId === a.id} onSelect={() => setAddressId(a.id)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-ink-900">{a.name}</p>
                        <span className="rounded-full bg-ink-100 px-2 py-px text-[11px] font-medium text-ink-600">{a.type}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-600">{a.lines}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{a.phone}</p>
                    </Choice>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-base font-semibold text-ink-900">Pickup date</legend>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {slots.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSlotKey(s.key)}
                      aria-pressed={slotKey === s.key}
                      className={cn(
                        "flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-colors",
                        slotKey === s.key ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className={cn("text-xs", slotKey === s.key ? "text-brand-700" : "text-ink-500")}>{s.weekday}</span>
                      <span className="mt-0.5 text-[14px] font-semibold text-ink-900">{s.date}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {slot?.windows.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPickupWindow(w)}
                      aria-pressed={pickupWindow === w}
                      className={cn(
                        "h-10 rounded-lg border px-3.5 text-[13px] font-medium transition-colors",
                        pickupWindow === w ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600" : "border-line-strong text-ink-700 hover:border-ink-400",
                      )}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl bg-ink-50 px-4 py-4">
                <p className="text-[13px] font-semibold text-ink-900">The associate checks five things at your door</p>
                <ul className="mt-2 grid gap-1.5 text-xs text-ink-600 sm:grid-cols-2">
                  {["It is the same item, with the MRP tag", "All accessories and freebies are included", "It is unused, unwashed and reset", "It has no new damage", "It is in the original packaging"].map((c) => (
                    <li key={c} className="flex items-start gap-2">
                      <CircleCheck size={14} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === 4 && item && (
            <div>
              <h2 className="text-base font-semibold text-ink-900">Check and submit</h2>
              <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
                {[
                  { k: "Item", v: item.title, s: 0 },
                  { k: "Reason", v: `${reason?.label}${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}`, s: 1 },
                  {
                    k: "Resolution",
                    v:
                      resolution === "refund"
                        ? `Refund of ${formatINR(item.amount)} to ${refundLabel}`
                        : resolution === "exchange"
                          ? `Exchange for size ${size}`
                          : "Replacement",
                    s: 2,
                  },
                  { k: "Pickup", v: `${slot?.full}, ${pickupWindow} · ${address?.name}, ${address?.lines}`, s: 3 },
                ].map((r) => (
                  <div key={r.k} className="flex items-start gap-4 px-4 py-3.5">
                    <div className="min-w-0 flex-1 sm:flex sm:gap-4">
                      <dt className="text-[13px] text-ink-500 sm:w-24 sm:shrink-0">{r.k}</dt>
                      <dd className="mt-0.5 min-w-0 flex-1 text-[13.5px] text-ink-900 sm:mt-0">{r.v}</dd>
                    </div>
                    <button type="button" onClick={() => goto(r.s)} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline" aria-label={`Edit ${r.k.toLowerCase()}`}>
                      <Pencil size={13} aria-hidden="true" />
                      Edit
                    </button>
                  </div>
                ))}
              </dl>
              {resolution === "refund" && (
                <p className="mt-4 rounded-lg bg-success-50 px-3.5 py-3 text-[13px] text-success-700">
                  <span className="font-semibold">When you get your money:</span> {refundWhen}.
                </p>
              )}
              <p className="mt-4 text-xs text-ink-500">
                By submitting, you confirm the item meets the doorstep conditions. If the check is not passed, the associate will leave the item with you and nothing is charged.
              </p>
            </div>
          )}

          {(err || submitError) && (
            <p role="alert" className="mt-5 rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-700">
              {err ?? submitError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-8">
          {step > 0 ? (
            <Button variant="secondary" icon={ArrowLeft} onClick={back}>
              Back
            </Button>
          ) : (
            <Link href={`/account/orders/${orderId}`} className="text-[13px] font-medium text-ink-600 hover:text-ink-900">
              Cancel
            </Link>
          )}
          {step < 4 ? (
            <Button iconRight={ArrowRight} onClick={next}>
              Continue
            </Button>
          ) : (
            <Button disabled={busy !== null} onClick={submit}>
              {busy === "submit" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Submit request
            </Button>
          )}
        </div>
      </section>

      <aside className="hidden xl:block">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
          <p className="text-[13px] font-semibold text-ink-900">Your request</p>
          {item ? (
            <>
              <div className="mt-4 flex gap-3">
                <ProductImage src={item.image} alt="" size={52} rounded="md" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[13px] font-medium text-ink-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{formatINR(item.amount)}</p>
                </div>
              </div>
              <dl className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-[13px]">
                <div>
                  <dt className="text-xs text-ink-500">Reason</dt>
                  <dd className="mt-0.5 text-ink-900">{reason?.label ?? "Not chosen yet"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Resolution</dt>
                  <dd className="mt-0.5 text-ink-900">{resolution ? RESOLUTION_COPY[resolution].title : "Not chosen yet"}</dd>
                </div>
                {resolution === "refund" && (
                  <div>
                    <dt className="text-xs text-ink-500">Refund to</dt>
                    <dd className="mt-0.5 text-ink-900">{refundLabel}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-ink-500">Pickup</dt>
                  <dd className="mt-0.5 text-ink-900">{pickupWindow && slot ? `${slot.full}, ${pickupWindow}` : "Not chosen yet"}</dd>
                </div>
              </dl>
              <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600">{item.policyNote ?? item.policySummary}</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink-500">Choose an item to begin.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
