"use client";

import { useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Building2, Check, CircleCheck, Eraser, ImagePlus, Loader2, Lock, MapPin, PenLine, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/* Shared form state for the onboarding wizard. */
export interface RegisterState {
  mobile: string;
  mobileOtpSent: boolean;
  mobileOtp: string;
  mobileVerified: boolean;
  email: string;
  emailOtpSent: boolean;
  emailOtp: string;
  emailVerified: boolean;
  password: string;
  constitution: string;
  exempt: boolean;
  gstin: string;
  gstVerified: boolean;
  legalName: string;
  registeredAddress: string;
  gstState: string;
  pan: string;
  storeName: string;
  storeDescription: string;
  care: string;
  grievance: string;
  logo: boolean;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
  contact: string;
  slot: string;
  holder: string;
  account: string;
  account2: string;
  ifsc: string;
  bankVerified: boolean;
  signature: "none" | "drawn" | "uploaded";
  categories: string[];
  ownBrand: boolean;
  brandName: string;
  trademark: string;
  tmClass: string;
  reseller: boolean;
  agree: boolean;
}

export type Patch = (p: Partial<RegisterState>) => void;

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const STATE_CODES: Record<string, string> = { "27": "Maharashtra", "29": "Karnataka", "07": "Delhi", "24": "Gujarat", "33": "Tamil Nadu", "36": "Telangana", "09": "Uttar Pradesh", "19": "West Bengal", "32": "Kerala", "08": "Rajasthan" };
const PINCODES: Record<string, [string, string]> = {
  "411026": ["Pune", "Maharashtra"],
  "411001": ["Pune", "Maharashtra"],
  "400072": ["Mumbai", "Maharashtra"],
  "560103": ["Bengaluru", "Karnataka"],
  "110020": ["New Delhi", "Delhi"],
  "600017": ["Chennai", "Tamil Nadu"],
  "500081": ["Hyderabad", "Telangana"],
  "380015": ["Ahmedabad", "Gujarat"],
};
const BANKS: Record<string, string> = { HDFC: "HDFC Bank", ICIC: "ICICI Bank", SBIN: "State Bank of India", UTIB: "Axis Bank", KKBK: "Kotak Mahindra Bank", PUNB: "Punjab National Bank" };
const TAKEN = ["apex retail", "urbankart", "novatek official store", "terra living"];

export function StepTitle({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{description}</p>
    </div>
  );
}

function Verified({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-success-700">
      <CircleCheck size={14} aria-hidden="true" />
      {children}
    </p>
  );
}

/** A tiny async simulation: show a spinner, then run the callback. */
function useFakeAsync() {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: (fn: () => void, ms = 900) => {
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        fn();
      }, ms);
    },
  };
}

/* ---------------------------------- 1 ---------------------------------- */

function OtpBlock({
  id,
  label,
  value,
  onChange,
  type,
  sent,
  otp,
  verified,
  placeholder,
  prefix,
  valid,
  onSend,
  onOtp,
  onVerify,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  sent: boolean;
  otp: string;
  verified: boolean;
  placeholder: string;
  prefix?: string;
  valid: boolean;
  onSend: () => void;
  onOtp: (v: string) => void;
  onVerify: () => void;
}) {
  return (
    <div>
      <Field label={label} htmlFor={id} required>
        <div className="flex gap-2">
          <div className="relative flex-1">
            {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-500">{prefix}</span>}
            <Input id={id} type={type} value={value} disabled={verified} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={prefix ? { paddingLeft: "3rem" } : undefined} />
          </div>
          {!verified && (
            <Button variant="secondary" disabled={!valid} onClick={onSend}>
              {sent ? "Resend" : "Send OTP"}
            </Button>
          )}
        </div>
      </Field>
      {verified ? (
        <Verified>Verified</Verified>
      ) : (
        sent && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-ink-50 p-3 sm:flex-row sm:items-end">
            <Field label="Enter the 6 digit OTP" htmlFor={`${id}-otp`} hint="Sent just now. You can resend in 30 seconds." className="flex-1">
              <Input id={`${id}-otp`} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => onOtp(e.target.value.replace(/\D/g, ""))} placeholder="000000" className="font-mono tracking-[0.4em]" autoComplete="one-time-code" />
            </Field>
            <Button disabled={otp.length !== 6} onClick={onVerify} className="sm:mb-6">
              Verify
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export function AccountStep({ s, set }: { s: RegisterState; set: Patch }) {
  const strength = [s.password.length >= 8, /[A-Z]/.test(s.password), /\d/.test(s.password), /[^A-Za-z0-9]/.test(s.password)].filter(Boolean).length;
  return (
    <>
      <StepTitle title="Create your seller account" description="We verify your mobile number and email with a one-time password. You will use them to sign in to Seller Hub." />
      <div className="flex flex-col gap-5">
        <OtpBlock
          id="rg-mobile"
          label="Mobile number"
          type="tel"
          prefix="+91"
          placeholder="98765 43210"
          value={s.mobile}
          onChange={(v) => set({ mobile: v.replace(/[^\d ]/g, "").slice(0, 11) })}
          valid={/^[6-9]\d{9}$/.test(s.mobile.replace(/\s/g, ""))}
          sent={s.mobileOtpSent}
          otp={s.mobileOtp}
          verified={s.mobileVerified}
          onSend={() => set({ mobileOtpSent: true })}
          onOtp={(v) => set({ mobileOtp: v })}
          onVerify={() => set({ mobileVerified: true })}
        />
        <OtpBlock
          id="rg-email"
          label="Business email"
          type="email"
          placeholder="you@yourbusiness.in"
          value={s.email}
          onChange={(v) => set({ email: v.trim() })}
          valid={/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(s.email)}
          sent={s.emailOtpSent}
          otp={s.emailOtp}
          verified={s.emailVerified}
          onSend={() => set({ emailOtpSent: true })}
          onOtp={(v) => set({ emailOtp: v })}
          onVerify={() => set({ emailVerified: true })}
        />
        <Field label="Password" htmlFor="rg-pass" required hint="At least 8 characters with a capital letter, a number and a symbol">
          <Input id="rg-pass" type="password" value={s.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
          <div className="mt-1 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full", i < strength ? (strength >= 3 ? "bg-success-500" : "bg-warning-500") : "bg-ink-200")} />
            ))}
          </div>
          <span className="sr-only">Password strength {strength} of 4</span>
        </Field>
      </div>
    </>
  );
}

/* ---------------------------------- 2 ---------------------------------- */

export function BusinessStep({ s, set, constitutions }: { s: RegisterState; set: Patch; constitutions: string[] }) {
  const v = useFakeAsync();
  const formatOk = GSTIN_RE.test(s.gstin);
  return (
    <>
      <StepTitle title="Business details" description="Your GSTIN tells us your legal name and registered address. Sellers of GST-exempt goods only, such as books, can register with PAN." />
      <fieldset className="mb-6">
        <legend className="mb-2 text-[13px] font-medium text-ink-700">Business type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {constitutions.map((c) => (
            <label key={c} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm", s.constitution === c ? "border-brand-300 bg-brand-50/50 font-medium text-ink-900" : "border-line text-ink-700 hover:bg-ink-50")}>
              <input type="radio" name="rg-const" checked={s.constitution === c} onChange={() => set({ constitution: c })} className="accent-brand-600" />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <Checkbox checked={s.exempt} onChange={(e) => set({ exempt: e.target.checked, gstVerified: false })} label="I only sell GST-exempt products" description="For example printed books. You can add a GSTIN later to sell other categories." />
      {!s.exempt && (
        <div className="mt-5">
          <Field label="GSTIN" htmlFor="rg-gstin" required error={s.gstin.length === 15 && !formatOk ? "This does not look like a valid GSTIN. Check the 15 characters." : undefined} hint="15 characters, for example 27AAKFS4410M1Z2">
            <div className="flex gap-2">
              <Input
                id="rg-gstin"
                value={s.gstin}
                maxLength={15}
                disabled={s.gstVerified}
                onChange={(e) => set({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""), gstVerified: false })}
                className="flex-1 font-mono tracking-wider uppercase"
                aria-invalid={s.gstin.length === 15 && !formatOk}
              />
              {!s.gstVerified && (
                <Button
                  variant="secondary"
                  disabled={!formatOk || v.busy}
                  onClick={() =>
                    v.run(() =>
                      set({
                        gstVerified: true,
                        legalName: "Sahyadri Home Essentials LLP",
                        registeredAddress: "Plot 12, Sector 7, Bhosari MIDC, Pune 411026",
                        gstState: STATE_CODES[s.gstin.slice(0, 2)] ?? "Maharashtra",
                        pan: s.gstin.slice(2, 12),
                        constitution: s.constitution || "Limited liability partnership (LLP)",
                        holder: "Sahyadri Home Essentials LLP",
                      }),
                    )
                  }
                >
                  {v.busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                  {v.busy ? "Checking" : "Verify GSTIN"}
                </Button>
              )}
            </div>
          </Field>
          {s.gstVerified && (
            <div className="mt-4 rounded-xl border border-success-100 bg-success-50/50 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-success-700">
                <BadgeCheck size={16} aria-hidden="true" /> Active on the GST portal
              </p>
              <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-500">Legal name</dt>
                  <dd className="font-medium text-ink-900">{s.legalName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">State</dt>
                  <dd className="text-ink-900">{s.gstState}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-500">Principal place of business</dt>
                  <dd className="text-ink-900">{s.registeredAddress}</dd>
                </div>
              </dl>
              <button type="button" onClick={() => set({ gstVerified: false })} className="mt-3 text-xs font-medium text-brand-700 hover:underline">
                Use a different GSTIN
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- 3 ---------------------------------- */

export function PanStep({ s, set }: { s: RegisterState; set: Patch }) {
  const ok = PAN_RE.test(s.pan);
  return (
    <>
      <StepTitle title="PAN" description={s.gstVerified ? "Taken from your GSTIN (characters 3 to 12). TDS under section 194-O is deposited against this PAN." : "Your business PAN. TDS under section 194-O is deposited against it."} />
      <Field label="PAN" htmlFor="rg-pan" required error={s.pan.length === 10 && !ok ? "PAN is 5 letters, 4 digits and a letter, for example AAKFS4410M" : undefined}>
        <Input id="rg-pan" maxLength={10} value={s.pan} disabled={s.gstVerified} onChange={(e) => set({ pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className="font-mono tracking-wider uppercase sm:max-w-xs" />
      </Field>
      {ok && (
        <div className="mt-4 rounded-xl border border-line p-4">
          <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-500">Name on PAN</dt>
              <dd className="font-medium text-ink-900">{(s.legalName || "Your business name").toUpperCase()}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">PAN type</dt>
              <dd className="text-ink-900">{s.pan[3] === "F" ? "Firm or LLP" : s.pan[3] === "C" ? "Company" : s.pan[3] === "P" ? "Individual" : "Other"}</dd>
            </div>
          </dl>
          <Verified>Name matches your GST registration</Verified>
        </div>
      )}
    </>
  );
}

/* ---------------------------------- 4 ---------------------------------- */

export function StoreStep({ s, set }: { s: RegisterState; set: Patch }) {
  const name = s.storeName.trim();
  const taken = TAKEN.includes(name.toLowerCase());
  return (
    <>
      <StepTitle title="Your store" description="Customers see your store name on every product you sell and on your store page." />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Store display name" htmlFor="rg-store" required className="sm:col-span-2" error={taken ? "That name is taken. Try adding your city or speciality." : undefined}>
          <Input id="rg-store" value={s.storeName} maxLength={40} onChange={(e) => set({ storeName: e.target.value })} placeholder="Sahyadri Home" aria-invalid={taken} />
          {name.length >= 3 && !taken && <Verified>{name} is available</Verified>}
        </Field>
        <Field label="Store description" htmlFor="rg-desc" className="sm:col-span-2" hint={`${s.storeDescription.length} of 300 characters`}>
          <Textarea id="rg-desc" maxLength={300} value={s.storeDescription} onChange={(e) => set({ storeDescription: e.target.value })} placeholder="Handpicked cookware and home essentials from Pune, packed with care." />
        </Field>
        <Field label="Customer care number" htmlFor="rg-care" required>
          <Input id="rg-care" inputMode="tel" value={s.care} onChange={(e) => set({ care: e.target.value })} placeholder="+91 20 4012 8821" />
        </Field>
        <Field label="Grievance officer" htmlFor="rg-griev" required hint="Name and email, shown on your store page">
          <Input id="rg-griev" value={s.grievance} onChange={(e) => set({ grievance: e.target.value })} placeholder="Meera Kulkarni, grievance@sahyadrihome.in" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-[13px] font-medium text-ink-700">Store logo</p>
          <button type="button" onClick={() => set({ logo: !s.logo })} className={cn("flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left", s.logo ? "border-success-100 bg-success-50/50" : "border-line-strong hover:bg-ink-50")}>
            <span className={cn("flex size-10 items-center justify-center rounded-lg", s.logo ? "bg-ink-900 text-sm font-semibold text-white" : "bg-ink-100 text-ink-500")}>
              {s.logo ? (name || "S").slice(0, 1).toUpperCase() : <ImagePlus size={18} aria-hidden="true" />}
            </span>
            <span className="text-[13px]">
              <span className="block font-medium text-ink-900">{s.logo ? "logo-square.png added" : "Upload a square logo"}</span>
              <span className="block text-xs text-ink-500">PNG or JPG, at least 400 x 400 px. Optional.</span>
            </span>
          </button>
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-line bg-ink-50/60 p-4">
        <p className="text-xs font-medium text-ink-500">Preview on a product page</p>
        <div className="mt-2 rounded-lg border border-line bg-white px-4 py-3 text-[13px]">
          <p className="text-ink-600">
            Sold by <span className="font-semibold text-brand-700">{name || "Your store"}</span> and fulfilled by BluBuy
          </p>
          <p className="mt-0.5 text-xs text-ink-500">New seller on BluBuy, ratings appear after your first orders</p>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------- 5 ---------------------------------- */

export function PickupStep({ s, set, states }: { s: RegisterState; set: Patch; states: string[] }) {
  return (
    <>
      <StepTitle title="Pickup address" description="BluBuy Logistics collects your packages from here. Add more locations later from Settings." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" htmlFor="rg-l1" required className="sm:col-span-2">
          <Input id="rg-l1" value={s.line1} onChange={(e) => set({ line1: e.target.value })} placeholder="Building, unit, street" />
        </Field>
        <Field label="Address line 2" htmlFor="rg-l2">
          <Input id="rg-l2" value={s.line2} onChange={(e) => set({ line2: e.target.value })} placeholder="Area or industrial estate" />
        </Field>
        <Field label="Landmark" htmlFor="rg-lm">
          <Input id="rg-lm" value={s.landmark} onChange={(e) => set({ landmark: e.target.value })} placeholder="Near Telco Road signal" />
        </Field>
        <Field label="Pincode" htmlFor="rg-pin" required hint={PINCODES[s.pincode] ? "City and state filled in" : "6 digits"}>
          <Input
            id="rg-pin"
            inputMode="numeric"
            maxLength={6}
            value={s.pincode}
            onChange={(e) => {
              const pin = e.target.value.replace(/\D/g, "");
              const hit = PINCODES[pin];
              set(hit ? { pincode: pin, city: hit[0], state: hit[1] } : { pincode: pin });
            }}
            className="font-mono"
          />
        </Field>
        <Field label="City" htmlFor="rg-city" required>
          <Input id="rg-city" value={s.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="State" htmlFor="rg-state" required>
          <Select id="rg-state" value={s.state} onChange={(e) => set({ state: e.target.value })}>
            <option value="">Choose a state</option>
            {states.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </Select>
        </Field>
        <Field label="Pickup contact" htmlFor="rg-contact" required hint="Name and mobile of the person who hands over packages">
          <Input id="rg-contact" value={s.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Ravi Patil, +91 98220 11834" />
        </Field>
        <Field label="Preferred pickup slot" htmlFor="rg-slot" className="sm:col-span-2">
          <Select id="rg-slot" value={s.slot} onChange={(e) => set({ slot: e.target.value })}>
            <option>11:00 AM to 1:00 PM</option>
            <option>2:00 to 4:00 PM</option>
            <option>4:00 to 6:00 PM</option>
          </Select>
        </Field>
      </div>
      <div className="relative mt-5 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-line bg-[linear-gradient(90deg,var(--color-ink-100)_1px,transparent_1px),linear-gradient(var(--color-ink-100)_1px,transparent_1px)] bg-[size:28px_28px]">
        <span className="flex flex-col items-center gap-1 rounded-xl bg-white/90 px-4 py-2 text-center shadow-xs">
          <MapPin size={20} className="text-brand-600" aria-hidden="true" />
          <span className="text-xs font-medium text-ink-800">{s.city ? `Pin dropped in ${s.city}` : "Drop a pin at your entrance"}</span>
          <span className="text-[11px] text-ink-500">Helps the pickup associate find you</span>
        </span>
      </div>
      {s.gstState && s.state && s.state !== s.gstState && (
        <p className="mt-4 rounded-xl bg-warning-50 px-4 py-3 text-[13px] text-warning-700">
          This address is in {s.state} but your GSTIN is registered in {s.gstState}. Add it as an additional place of business on your GST registration, or register in {s.state}.
        </p>
      )}
      <p className="mt-4 text-xs text-ink-500">If you use BluBuy Fulfilled, each fulfilment centre you store stock in is added to your GST registration as an additional place of business.</p>
    </>
  );
}

/* ---------------------------------- 6 ---------------------------------- */

export function BankStep({ s, set }: { s: RegisterState; set: Patch }) {
  const v = useFakeAsync();
  const ifscOk = IFSC_RE.test(s.ifsc);
  const bank = ifscOk ? (BANKS[s.ifsc.slice(0, 4)] ?? "Bank found") : null;
  const mismatch = s.account2.length > 0 && s.account !== s.account2;
  const ready = s.account.length >= 9 && !mismatch && s.account === s.account2 && ifscOk && s.holder.trim().length > 2;
  return (
    <>
      <StepTitle title="Bank account" description="Payouts go to this account. It must be a current or savings account in your business's legal name." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account holder name" htmlFor="rg-holder" required className="sm:col-span-2">
          <Input id="rg-holder" value={s.holder} disabled={s.bankVerified} onChange={(e) => set({ holder: e.target.value })} />
        </Field>
        <Field label="Account number" htmlFor="rg-acc" required>
          <Input id="rg-acc" type="password" inputMode="numeric" autoComplete="off" value={s.account} disabled={s.bankVerified} onChange={(e) => set({ account: e.target.value.replace(/\D/g, "").slice(0, 18) })} />
        </Field>
        <Field label="Confirm account number" htmlFor="rg-acc2" required error={mismatch ? "Account numbers do not match" : undefined}>
          <Input id="rg-acc2" inputMode="numeric" autoComplete="off" value={s.account2} disabled={s.bankVerified} onChange={(e) => set({ account2: e.target.value.replace(/\D/g, "").slice(0, 18) })} aria-invalid={mismatch} />
        </Field>
        <Field label="IFSC" htmlFor="rg-ifsc" required hint={bank ? undefined : "11 characters, for example HDFC0001234"} error={s.ifsc.length === 11 && !ifscOk ? "Check the IFSC; the fifth character is always 0" : undefined}>
          <Input id="rg-ifsc" maxLength={11} value={s.ifsc} disabled={s.bankVerified} onChange={(e) => set({ ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className="font-mono tracking-wider uppercase" />
          {bank && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-600">
              <Building2 size={13} aria-hidden="true" /> {bank}, Pimpri branch, Pune
            </p>
          )}
        </Field>
      </div>
      <div className="mt-6 rounded-xl border border-line p-4">
        {s.bankVerified ? (
          <div className="flex items-start gap-3">
            <CircleCheck size={19} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
            <div className="text-[13px]">
              <p className="font-semibold text-success-700">₹1 credited, name matched</p>
              <p className="mt-0.5 text-ink-600">
                The bank returned <span className="font-medium text-ink-900">{s.holder.toUpperCase()}</span> for account ending {s.account.slice(-4)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-ink-600">We send ₹1 to this account and check the name the bank returns. It takes a few seconds.</p>
            <Button variant="secondary" disabled={!ready || v.busy} onClick={() => v.run(() => set({ bankVerified: true }), 1300)}>
              {v.busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {v.busy ? "Sending ₹1" : "Verify with ₹1"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------------- 7 ---------------------------------- */

export function SignatureStep({ s, set }: { s: RegisterState; set: Patch }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  }

  return (
    <>
      <StepTitle title="Digital signature" description="Printed on the tax invoices BluBuy generates for your orders. Sign as the authorised signatory." />
      <div role="tablist" aria-label="Signature method" className="mb-4 inline-flex gap-1 rounded-xl bg-ink-100 p-1">
        {(["draw", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium", mode === m ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}
          >
            {m === "draw" ? <PenLine size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
            {m === "draw" ? "Draw" : "Upload"}
          </button>
        ))}
      </div>
      {mode === "draw" ? (
        <div>
          <div className="relative overflow-hidden rounded-xl border border-line-strong bg-white">
            <canvas
              ref={canvas}
              width={1200}
              height={360}
              aria-label="Signature pad. Draw your signature with a mouse, finger or stylus."
              className="block h-44 w-full touch-none cursor-crosshair"
              onPointerDown={(e) => {
                const ctx = e.currentTarget.getContext("2d");
                if (!ctx) return;
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const [x, y] = pos(e);
                ctx.lineWidth = 4;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.strokeStyle = "#101828";
                ctx.beginPath();
                ctx.moveTo(x, y);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const ctx = e.currentTarget.getContext("2d");
                const [x, y] = pos(e);
                ctx?.lineTo(x, y);
                ctx?.stroke();
              }}
              onPointerUp={() => {
                if (drawing.current) set({ signature: "drawn" });
                drawing.current = false;
              }}
            />
            <span className="pointer-events-none absolute right-6 bottom-8 left-6 border-b border-dashed border-ink-300" aria-hidden="true" />
            {s.signature !== "drawn" && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-400">Sign here</span>}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-ink-500">Authorised signatory for {s.legalName || "your business"}</p>
            <Button
              size="sm"
              variant="ghost"
              icon={Eraser}
              onClick={() => {
                const c = canvas.current;
                c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
                set({ signature: "none" });
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => set({ signature: "uploaded" })}
          className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center", s.signature === "uploaded" ? "border-success-100 bg-success-50/50" : "border-line-strong hover:border-brand-300 hover:bg-ink-50")}
        >
          {s.signature === "uploaded" ? <Check size={22} className="text-success-600" aria-hidden="true" /> : <Upload size={22} className="text-ink-400" aria-hidden="true" />}
          <span className="text-sm font-medium text-ink-900">{s.signature === "uploaded" ? "signature-scan.png added" : "Upload a scan of your signature"}</span>
          <span className="text-xs text-ink-500">PNG or JPG on a white background, up to 2 MB</span>
        </button>
      )}
    </>
  );
}

/* ---------------------------------- 8 ---------------------------------- */

export function CategoriesStep({ s, set, categories }: { s: RegisterState; set: Patch; categories: { id: string; name: string; commission: number; gated?: string }[] }) {
  return (
    <>
      <StepTitle title="What will you sell?" description="Choose every category you plan to sell in. Restricted categories need documents before you can list; you can start with the others straight away." />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {categories.map((c) => {
          const on = s.categories.includes(c.id);
          return (
            <label key={c.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors", on ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
              <input
                type="checkbox"
                className="mt-1 size-4 accent-brand-600"
                checked={on}
                onChange={() => set({ categories: on ? s.categories.filter((x) => x !== c.id) : [...s.categories, c.id] })}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">{c.name}</span>
                  {c.gated && (
                    <Badge size="sm" tone="warning" icon={Lock}>
                      Approval needed
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">{c.gated ?? `Commission ${c.commission}% above ₹999`}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-4 rounded-xl bg-brand-50/60 px-4 py-3 text-[13px] text-brand-800">0% commission on every item priced up to ₹999, in every category.</p>
    </>
  );
}

/* ---------------------------------- 9 ---------------------------------- */

export function BrandStep({ s, set }: { s: RegisterState; set: Patch }) {
  return (
    <>
      <StepTitle title="Brand registry" description="Optional. Brand owners get control of their product pages and tools to protect them. You can do this later." />
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line p-4">
          <Switch checked={s.ownBrand} onChange={(v) => set({ ownBrand: v })} label="I own a brand" description="Enrol in BluBuy Brand Registry with a registered trademark or a pending application with IP India" />
          {s.ownBrand && (
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Brand name" htmlFor="rg-brand" required>
                <Input id="rg-brand" value={s.brandName} onChange={(e) => set({ brandName: e.target.value })} placeholder="Sahyadri Home" />
              </Field>
              <Field label="Trademark or application number" htmlFor="rg-tm" required>
                <Input id="rg-tm" value={s.trademark} onChange={(e) => set({ trademark: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="5281934" className="font-mono" />
              </Field>
              <Field label="Trademark class" htmlFor="rg-class">
                <Select id="rg-class" value={s.tmClass} onChange={(e) => set({ tmClass: e.target.value })}>
                  <option value="21">Class 21, household utensils</option>
                  <option value="8">Class 8, hand tools and cutlery</option>
                  <option value="11">Class 11, appliances</option>
                  <option value="24">Class 24, textiles</option>
                </Select>
              </Field>
              <Field label="Certificate or application receipt" htmlFor="rg-cert">
                <Button variant="secondary" icon={Upload} className="w-full">
                  Upload PDF
                </Button>
              </Field>
              <ul className="grid gap-2 rounded-xl bg-ink-50 p-4 text-[13px] text-ink-700 sm:col-span-2 sm:grid-cols-2">
                {["A+ content on product pages", "Your own brand store", "Sponsored Brands ads", "Report and remove counterfeits"].map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <CircleCheck size={14} className="text-success-600" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line p-4">
          <Switch checked={s.reseller} onChange={(v) => set({ reseller: v })} label="I resell other brands" description="Keep a brand authorisation letter or distributor invoices ready. Some brands are gated and need them before you list." />
        </div>
      </div>
    </>
  );
}

/* ---------------------------------- 10 --------------------------------- */

export function ReviewStep({ s, set, goTo, categories }: { s: RegisterState; set: Patch; goTo: (n: number) => void; categories: { id: string; name: string }[] }) {
  const rows: { step: number; label: string; value: string }[] = [
    { step: 0, label: "Account", value: `+91 ${s.mobile}, ${s.email}` },
    { step: 1, label: "Business", value: s.exempt ? `${s.constitution}, GST exempt` : `${s.legalName}, GSTIN ${s.gstin}` },
    { step: 2, label: "PAN", value: s.pan },
    { step: 3, label: "Store", value: s.storeName },
    { step: 4, label: "Pickup", value: `${s.line1}, ${s.city} ${s.pincode}` },
    { step: 5, label: "Bank", value: `Account ending ${s.account.slice(-4)}, ${s.ifsc}, verified` },
    { step: 6, label: "Signature", value: s.signature === "drawn" ? "Drawn" : "Uploaded" },
    { step: 7, label: "Categories", value: categories.filter((c) => s.categories.includes(c.id)).map((c) => c.name).join(", ") },
    { step: 8, label: "Brand registry", value: s.ownBrand ? `${s.brandName}, trademark ${s.trademark}` : s.reseller ? "Reseller of other brands" : "Skipped" },
  ];
  return (
    <>
      <StepTitle title="Review and submit" description="Check everything once. After you submit, our team verifies your documents, usually within 24 to 72 hours." />
      <div className="divide-y divide-line rounded-xl border border-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{r.label}</p>
              <p className="mt-0.5 text-[13px] break-words text-ink-900">{r.value || "Not provided"}</p>
            </div>
            <button type="button" onClick={() => goTo(r.step)} className="shrink-0 text-[13px] font-medium text-brand-700 hover:underline">
              Edit
            </button>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-ink-50 px-4 py-3">
        <Checkbox
          checked={s.agree}
          onChange={(e) => set({ agree: e.target.checked })}
          label="I agree to the BluBuy seller agreement, the fee rate card and the returns policy, and confirm the information above is accurate."
          description="Your signature is applied to the agreement electronically when you submit."
        />
      </div>
    </>
  );
}
