"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgePercent, Bell, CheckCheck, Lock, Package, ShieldAlert, Sparkles, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch, useToast } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface InboxItem {
  id: string;
  kind: "order" | "payment" | "account" | "promo" | "system" | "alert";
  title: string;
  body: string;
  when: string;
  read: boolean;
  href?: string;
}

const KIND = {
  order: { icon: Package, cls: "bg-brand-50 text-brand-600" },
  payment: { icon: Wallet, cls: "bg-success-50 text-success-600" },
  account: { icon: UserRound, cls: "bg-ink-100 text-ink-600" },
  promo: { icon: BadgePercent, cls: "bg-accent-50 text-accent-700" },
  system: { icon: Sparkles, cls: "bg-info-50 text-info-600" },
  alert: { icon: ShieldAlert, cls: "bg-warning-50 text-warning-700" },
} as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "promo", label: "Offers" },
  { key: "account", label: "Account" },
] as const;

/** Notification inbox with filters and read state. */
export function NotificationInbox({ initial }: { initial: InboxItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const unread = items.filter((i) => !i.read).length;
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "unread" ? !i.read : filter === "order" ? i.kind === "order" || i.kind === "payment" : filter === "promo" ? i.kind === "promo" || i.kind === "alert" : i.kind === "account" || i.kind === "system",
  );
  const markRead = (id: string) => setItems((list) => list.map((i) => (i.id === id ? { ...i, read: true } : i)));

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                filter === f.key ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
              )}
            >
              {f.label}
              {f.key === "unread" && unread > 0 && <span className={cn("text-xs tabular-nums", filter === f.key ? "text-ink-300" : "text-ink-500")}>{unread}</span>}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" icon={CheckCheck} disabled={unread === 0} onClick={() => setItems((l) => l.map((i) => ({ ...i, read: true })))}>
          Mark all as read
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing here" description="You have read everything in this view." />
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((n) => {
            const k = KIND[n.kind];
            const inner = (
              <>
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", k.cls)}>
                  <k.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className={cn("text-[13.5px]", n.read ? "font-medium text-ink-800" : "font-semibold text-ink-900")}>{n.title}</span>
                    <span className="shrink-0 text-xs text-ink-500">{n.when}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-600">{n.body}</span>
                </span>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} aria-label={n.read ? undefined : "Unread"} />
              </>
            );
            const cls = cn("flex gap-3.5 px-5 py-4 transition-colors sm:px-6", n.read ? "hover:bg-ink-50/60" : "bg-brand-50/40 hover:bg-brand-50/70");
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className={cls} onClick={() => markRead(n.id)}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className={cn(cls, "w-full text-left")} onClick={() => markRead(n.id)}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Channel = "push" | "sms" | "email" | "whatsapp";
const CHANNELS: { key: Channel; label: string }[] = [
  { key: "push", label: "Push" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

/** Channel preferences by message type. Transactional SMS stays on (spec 9.1.1). */
export function NotificationPrefs({
  initial,
}: {
  initial: { key: string; label: string; description: string; transactional: boolean; channels: Record<Channel, boolean> }[];
}) {
  const [prefs, setPrefs] = useState(initial);
  const t = useToast();
  const toggle = (key: string, ch: Channel, v: boolean) => {
    setPrefs((p) => p.map((r) => (r.key === key ? { ...r, channels: { ...r.channels, [ch]: v } } : r)));
    t.show("Preference saved");
  };
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="px-5 pt-5 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink-900">How we reach you</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">Changes apply right away. Order, refund and security messages always reach you by SMS.</p>
      </div>
      <div className="mt-4 overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[340px] text-left">
          <thead>
            <tr className="border-y border-line bg-ink-50/70">
              <th className="px-5 py-2.5 text-xs font-medium text-ink-500 sm:px-6">Message type</th>
              {CHANNELS.map((c) => (
                <th key={c.key} className="w-14 px-1 py-2.5 text-center text-xs font-medium text-ink-500 last:pr-4 sm:w-20 sm:last:pr-6">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {prefs.map((r) => (
              <tr key={r.key}>
                <td className="px-5 py-3.5 align-top sm:px-6">
                  <p className="text-[13.5px] font-medium text-ink-900">{r.label}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{r.description}</p>
                  {r.transactional && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-500">
                      <Lock size={11} aria-hidden="true" />
                      Essential
                    </p>
                  )}
                </td>
                {CHANNELS.map((c) => {
                  const locked = r.transactional && c.key === "sms";
                  return (
                    <td key={c.key} className="px-1 py-3.5 text-center align-top last:pr-4 sm:last:pr-6">
                      <span className="inline-flex" title={locked ? "Always on for essential messages" : undefined}>
                        <SwitchCell checked={locked || r.channels[c.key]} disabled={locked} label={`${r.label} by ${c.label}`} onChange={(v) => toggle(r.key, c.key, v)} />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-4 border-t border-line px-5 py-5 sm:px-6">
        <Switch defaultChecked label="Quiet hours" description="No offers or reminders between 10 pm and 8 am. Delivery updates still come through." />
        <Switch label="Weekly deals digest" description="One email on Sunday with price drops on your wishlist and the week's best deals." />
      </div>
      {t.node}
    </section>
  );
}

function SwitchCell({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed", checked ? (disabled ? "bg-brand-300" : "bg-brand-600") : "bg-ink-200")}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow-xs transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
