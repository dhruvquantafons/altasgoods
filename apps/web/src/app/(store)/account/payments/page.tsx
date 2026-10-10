import { BadgeCheck, CalendarClock, CreditCard, Landmark, Lock, Smartphone } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { dateLabel, dayLabel, relativeDay } from "@/components/account/lib";
import { AddUpiButton } from "@/components/account/money-forms";
import { KeyValue, Panel } from "@/components/account/ui";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/interactive";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { emiOptions, PAY_LATER, savedCards, savedUpis } from "@/lib/mock/account-extra";
import { cn, formatINR } from "@/lib/utils";

export const metadata = { title: "Payment methods" };

export default function PaymentsPage() {
  const available = PAY_LATER.limit - PAY_LATER.used;
  return (
    <>
      <PageHeader title="Payment methods" description="Saved UPI IDs and cards for faster checkout, plus your AltasGoods Pay Later and EMI options." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="UPI" description="Pay with any UPI app. Your preferred ID is selected at checkout." action={<AddUpiButton />} bodyClassName="px-0 pb-1 sm:px-0">
            <ul className="divide-y divide-line">
              {savedUpis.map((u) => (
                <li key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-700">
                      <Smartphone size={18} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-ink-900">
                        <span className="truncate">{u.vpa}</span>
                        {u.preferred && (
                          <Badge size="sm" tone="brand">
                            Preferred
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {u.bank} · Verified · Last used {relativeDay(u.lastUsed)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!u.preferred && <ActionButton label="Make preferred" variant="ghost" toast={`${u.vpa} is now your preferred UPI ID`} doneLabel="Preferred" />}
                    <ActionButton
                      label="Remove"
                      icon="trash"
                      variant="ghost"
                      toast="UPI ID removed"
                      doneLabel="Removed"
                      confirm={{ title: `Remove ${u.vpa}?`, body: "You can add it again any time. Pending refunds to this ID will still be paid.", confirmLabel: "Remove", danger: true }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Saved cards"
            description="Stored as secure tokens with your bank as RBI rules require. AltasGoods never keeps your full card number or CVV."
            bodyClassName="pt-5"
          >
            <ul className="grid gap-4 md:grid-cols-2">
              {savedCards.map((c) => (
                <li key={c.id} className={cn("flex flex-col rounded-xl border p-4", c.expired ? "border-line bg-ink-50/60" : "border-line")}>
                  <div
                    className={cn(
                      "relative flex aspect-[1.75] w-full max-w-[280px] flex-col justify-between overflow-hidden rounded-xl p-4 text-white",
                      c.expired ? "bg-ink-400" : c.kind === "Credit card" ? "bg-gradient-to-br from-brand-700 to-brand-950" : "bg-gradient-to-br from-ink-700 to-ink-950",
                    )}
                  >
                    <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/10" aria-hidden="true" />
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold">{c.bank}</p>
                      <CreditCard size={18} strokeWidth={1.6} aria-hidden="true" className="opacity-80" />
                    </div>
                    <div>
                      <p className="font-mono text-[15px] tracking-[0.18em]">•••• •••• •••• {c.last4}</p>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-85">
                        <span>{c.holder}</span>
                        <span className="font-mono">{c.expiry}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-ink-900">
                      {c.kind} ending {c.last4}
                    </p>
                    {c.preferred && (
                      <Badge size="sm" tone="brand">
                        Preferred
                      </Badge>
                    )}
                    {c.expired && (
                      <Badge size="sm" tone="warning" dot>
                        Expired
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {c.expired ? "Update the card with your bank's new expiry date, or remove it." : c.noCostEmi ? "Eligible for no cost EMI" : "Saved for one-tap checkout"}
                  </p>
                  <div className="mt-3 flex gap-1 border-t border-line pt-3">
                    <ActionButton
                      label="Remove"
                      icon="trash"
                      variant="ghost"
                      toast="Card removed"
                      doneLabel="Removed"
                      confirm={{ title: `Remove ${c.bank} card ending ${c.last4}?`, body: "The saved token is deleted with your bank. You can add the card again at checkout.", confirmLabel: "Remove card", danger: true }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
              <Lock size={13} aria-hidden="true" />
              New cards are added at checkout, with OTP verification from your bank.
            </p>
          </Panel>

          <Panel title="EMI options" description="Pre-approved limits for spreading the cost of bigger purchases.">
            <ul className="flex flex-col divide-y divide-line">
              {emiOptions.map((e) => (
                <li key={e.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                    {e.id === "emi-3" ? <Landmark size={18} strokeWidth={1.8} aria-hidden="true" /> : <CreditCard size={18} strokeWidth={1.8} aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-ink-900">
                      {e.title}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
                        <BadgeCheck size={13} aria-hidden="true" />
                        Eligible
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{e.source}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{e.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-ink-500">Up to</p>
                    <p className="text-[14px] font-semibold text-ink-900 tabular-nums">{formatINR(e.limit)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="AltasGoods Pay Later" action={<Badge tone="success" dot>Active</Badge>}>
            <p className="text-xs text-ink-500">Available to spend</p>
            <p className="mt-1 text-[30px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(available)}</p>
            <Progress value={PAY_LATER.used} max={PAY_LATER.limit} className="mt-4" label="Pay Later limit used" />
            <p className="mt-2 flex justify-between text-xs text-ink-500">
              <span>{formatINR(PAY_LATER.used)} used</span>
              <span>Limit {formatINR(PAY_LATER.limit)}</span>
            </p>
            <div className="mt-5 rounded-xl bg-ink-50 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
                <CalendarClock size={15} className="text-ink-500" aria-hidden="true" />
                Bill due on {dayLabel(PAY_LATER.dueOn)}
              </p>
              <dl className="mt-3 flex flex-col gap-2">
                <KeyValue label="Statement amount" value={formatINR(PAY_LATER.statementAmount)} />
                <KeyValue label="Interest if paid on time" value="₹0" tone="success" />
              </dl>
              <ActionButton label="Pay bill now" variant="primary" size="md" className="mt-4 w-full" toast="Opening the payment page" />
            </div>
            <div className="mt-5">
              <Switch defaultChecked={PAY_LATER.autopay} label="Autopay on due date" description="From your preferred UPI ID, so you never pay a late fee" />
            </div>
            <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-500">
              Credit is provided by {PAY_LATER.partner}, a registered NBFC. {PAY_LATER.interestFreeDays} days interest free on every purchase. Statement generated on the 1st, last updated {dateLabel("2026-10-01T09:00:00+05:30")}.
            </p>
          </Panel>

          <Panel title="Other ways to pay">
            <ul className="flex flex-col gap-3 text-[13px] text-ink-600">
              <li className="flex items-start gap-2.5">
                <Landmark size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                Net banking from 50+ banks, chosen at checkout
              </li>
              <li className="flex items-start gap-2.5">
                <BadgeCheck size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                Pay on delivery by cash or UPI, with no extra charge
              </li>
              <li className="flex items-start gap-2.5">
                <CreditCard size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                AltasGoods Credits and gift cards can be combined with any method
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
