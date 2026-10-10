import { Download, Laptop, Mail, Monitor, Smartphone, Tablet, UserRound, Phone, ShieldCheck, FileLock2 } from "lucide-react";
import { ActionButton } from "@/components/account/action-button";
import { dateLabel, isActive, timeLabel } from "@/components/account/lib";
import { DeleteAccountButton, EditProfileButton, VerifyContact } from "@/components/account/profile-forms";
import { Panel } from "@/components/account/ui";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/interactive";
import { Avatar, DescriptionList } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ACCOUNT_PROFILE, accountOrders, accountRefunds, consents, CREDITS, dataRequests, sessions } from "@/lib/mock/account-extra";
import { formatINR, timeAgo } from "@/lib/utils";

export const metadata = { title: "Profile and security" };

const DEVICE = { laptop: Laptop, phone: Smartphone, tablet: Tablet, desktop: Monitor };

export default function ProfilePage() {
  const p = ACCOUNT_PROFILE;
  const openOrders = accountOrders.filter((o) => isActive(o.status)).length;
  const openRefunds = accountRefunds.filter((r) => r.status !== "completed").length;
  const blockers = [
    openOrders ? { label: `${openOrders} orders on the way`, detail: "Wait for delivery or cancel them" } : null,
    openRefunds ? { label: `${openRefunds} refund in progress`, detail: "We will finish it before closing the account" } : null,
    CREDITS.balance ? { label: `${formatINR(CREDITS.balance)} in AltasGoods Credits`, detail: `Move ${formatINR(CREDITS.refund.amount)} of refund credits to your bank. Gift card and goodwill credits cannot be paid out` } : null,
  ].filter((b): b is { label: string; detail: string } => Boolean(b));

  return (
    <>
      <PageHeader title="Profile and security" description="Your details, how you sign in, and control over your data under the Digital Personal Data Protection Act, 2023." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Profile" action={<EditProfileButton initial={{ name: p.name, gender: p.gender, dateOfBirth: p.dateOfBirth, language: p.language }} />}>
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={p.name} size="lg" />
            <div>
              <p className="text-[15px] font-semibold text-ink-900">{p.name}</p>
              <p className="text-[13px] text-ink-500">Customer since {dateLabel(p.memberSince)}</p>
            </div>
          </div>
          <DescriptionList
            columns={2}
            items={[
              { label: "Gender", value: p.gender },
              { label: "Date of birth", value: dateLabel(p.dateOfBirth) },
              { label: "Language", value: p.language },
              { label: "Profile ID", value: <span className="font-mono text-[13px]">CUS-001-2021</span> },
            ]}
          />
        </Panel>

        <Panel title="Mobile and email" description="Used to sign in with OTP and for order updates.">
          <ul className="flex flex-col divide-y divide-line">
            <li className="flex items-center gap-3 pb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Phone size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink-900">{p.mobile}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                  Mobile number
                  <Badge size="sm" tone="success" dot>
                    Verified
                  </Badge>
                </p>
              </div>
              <VerifyContact kind="mobile" current={p.mobile} verified />
            </li>
            <li className="flex items-center gap-3 pt-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Mail size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{p.email}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                  Email
                  <Badge size="sm" tone={p.emailVerified ? "success" : "warning"} dot>
                    {p.emailVerified ? "Verified" : "Not verified"}
                  </Badge>
                </p>
              </div>
              <VerifyContact kind="email" current={p.email} verified={p.emailVerified} />
            </li>
          </ul>
        </Panel>

        <Panel title="Login and security" className="xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-5">
              <Switch defaultChecked={p.twoStepEnabled} label="2-step verification" description="When you sign in on a new device, confirm it with a second code sent to your email as well as the mobile OTP." />
              <Switch defaultChecked label="Sign-in alerts" description="Tell me by SMS and email when someone signs in from a new device." />
              <div className="flex items-start gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3 text-xs text-ink-600">
                <ShieldCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
                AltasGoods will never ask for your OTP, PIN or card details on a call, chat or email.
              </div>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink-900">Where you are signed in</p>
                <ActionButton
                  label="Sign out of other devices"
                  icon="logout"
                  variant="ghost"
                  toast="Signed out of all other devices"
                  doneLabel="Signed out"
                  confirm={{ title: "Sign out everywhere else?", body: "You stay signed in on this device. Other devices will need an OTP to sign in again.", confirmLabel: "Sign out" }}
                />
              </div>
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
                {sessions.map((s) => {
                  const Icon = DEVICE[s.platform];
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <Icon size={20} strokeWidth={1.6} className="shrink-0 text-ink-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink-900">
                          {s.device}
                          {s.current && (
                            <Badge size="sm" tone="success" dot>
                              This device
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {s.location} · {s.current ? "Active now" : `Active ${timeAgo(s.lastActive)}`}
                        </p>
                      </div>
                      {!s.current && <ActionButton label="Sign out" variant="ghost" toast={`Signed out of ${s.device}`} doneLabel="Signed out" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Privacy and your data" description="Choose how we use your data. You can change these any time." className="xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <ul className="flex flex-col gap-5">
              {consents.map((c) => (
                <li key={c.key}>
                  <Switch defaultChecked={c.granted} label={c.label} description={`${c.description}${c.since ? ` Given on ${dateLabel(c.since)}.` : ""}`} />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                  <Download size={16} className="text-ink-500" aria-hidden="true" />
                  Download a copy of your data
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">Orders, addresses, reviews, payments (masked) and consent history, as a ZIP of CSV files. Ready within 72 hours.</p>
                <ActionButton label="Request download" variant="secondary" className="mt-3" toast="Request received. We will email you a secure link" doneLabel="Requested" />
                {dataRequests.map((d) => (
                  <p key={d.id} className="mt-3 border-t border-line pt-3 text-xs text-ink-500">
                    <span className="font-mono text-ink-700">{d.id}</span> · {d.type} · {d.status} on {dateLabel(d.completedAt)}, {timeLabel(d.completedAt)}
                  </p>
                ))}
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                  <UserRound size={16} className="text-ink-500" aria-hidden="true" />
                  Delete your account
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">Closes your account and erases your personal data within 30 days, except records the law requires us to keep.</p>
                <div className="mt-3">
                  <DeleteAccountButton blockers={blockers} />
                </div>
              </div>
              <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-500">
                <FileLock2 size={14} className="mt-px shrink-0" aria-hidden="true" />
                Questions about your data? Write to our Grievance Officer, Meera Krishnan, at privacy@altasgoods.in. We reply within 7 days.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
