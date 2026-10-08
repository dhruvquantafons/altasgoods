"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, Clock, FileText, Paperclip, PenLine, Send, ShieldCheck } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { slaFor } from "../shared";

export interface InboxMessage {
  id: string;
  from: "buyer" | "seller" | "system";
  body: string;
  at: string;
  attachment?: string;
}

export interface InboxThread {
  id: string;
  buyer: string;
  orderId: string;
  productTitle: string;
  image: string;
  subject: string;
  status: "needs_reply" | "replied" | "no_response_needed";
  lastAt: string;
  dueAt?: string;
  messages: InboxMessage[];
}

const RULES: { test: RegExp; reason: string }[] = [
  { test: /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/, reason: "Phone numbers are not allowed. AltasGoods relays every message." },
  { test: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: "Email addresses are not allowed." },
  { test: /(https?:\/\/|www\.)\S+/i, reason: "External links are not allowed." },
  { test: /\b(discount|offer|sale|coupon|buy now|cashback)\b/i, reason: "Promotional language is not allowed in buyer messages." },
  { test: /\b(5 star|five star|good review|positive review)\b/i, reason: "You cannot ask for positive reviews." },
];

const STATUS_LABEL: Record<InboxThread["status"], { label: string; tone: "warning" | "success" | "neutral" }> = {
  needs_reply: { label: "Needs reply", tone: "warning" },
  replied: { label: "Replied", tone: "success" },
  no_response_needed: { label: "No reply needed", tone: "neutral" },
};

function MessageBubble({ m, buyer }: { m: InboxMessage; buyer: string }) {
  if (m.from === "system") return <p className="mx-auto max-w-md text-center text-xs text-ink-500">{m.body}</p>;
  return (
    <div className={cn("flex", m.from === "seller" ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%]", m.from === "seller" ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md border border-line bg-white text-ink-800")}>
        <p className="text-[13px] leading-relaxed whitespace-pre-line">{m.body}</p>
        {m.attachment && (
          <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs", m.from === "seller" ? "bg-white/15" : "bg-ink-100 text-ink-700")}>
            <FileText size={13} aria-hidden="true" />
            {m.attachment}
          </span>
        )}
        <p className={cn("mt-1 text-[11px]", m.from === "seller" ? "text-brand-100" : "text-ink-500")}>
          {m.from === "seller" ? "You" : buyer}, {formatDateTime(m.at)}
        </p>
      </div>
    </div>
  );
}

/** Buyer-seller messaging inbox: thread list on the left, conversation on the right; list then detail on mobile. */
export function Inbox({ threads, templates, initialId }: { threads: InboxThread[]; templates: { id: string; title: string; body: string }[]; initialId?: string }) {
  const orderParam = useSearchParams().get("order");
  // an order with no conversation yet (every real order, as threads are sample data) opens a new message, never an unrelated thread
  const composeFor = orderParam && !threads.some((t) => t.orderId === orderParam) ? orderParam : null;
  const [composing, setComposing] = useState(Boolean(composeFor));
  const [sentNew, setSentNew] = useState<InboxMessage[]>([]);
  const [data, setData] = useState(threads);
  const [activeId, setActiveId] = useState<string | undefined>(initialId);
  const [mobileOpen, setMobileOpen] = useState(Boolean(initialId || composeFor));
  const [draft, setDraft] = useState("");
  const [attach, setAttach] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_reply">("all");
  const toast = useToast();

  const sorted = useMemo(
    () =>
      data
        .filter((t) => filter === "all" || t.status === "needs_reply")
        .slice()
        .sort((a, b) => Number(b.status === "needs_reply") - Number(a.status === "needs_reply") || +new Date(b.lastAt) - +new Date(a.lastAt)),
    [data, filter],
  );
  const active = composing ? undefined : data.find((t) => t.id === (activeId ?? sorted[0]?.id));
  const replyOrder = active?.orderId ?? (composing ? composeFor : null);
  const violation = RULES.find((r) => r.test.test(draft));
  const needs = data.filter((t) => t.status === "needs_reply").length;

  function update(id: string, patch: Partial<InboxThread>) {
    setData((d) => d.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function send() {
    if (violation || !draft.trim()) return;
    const body = draft.trim();
    const at = new Date().toISOString();
    if (composing && composeFor) {
      setSentNew((prev) => [...prev, { id: `new-${composeFor}-${prev.length}`, from: "seller", body, at, attachment: attach ?? undefined }]);
      toast.show(`Message sent through AltasGoods about order ${composeFor}. The buyer is notified by app and email; their reply appears here.`);
    } else if (active) {
      const msg: InboxMessage = { id: `${active.id}-new-${active.messages.length}`, from: "seller", body, at, attachment: attach ?? undefined };
      update(active.id, { messages: [...active.messages, msg], status: "replied", dueAt: undefined, lastAt: msg.at });
      toast.show("Reply sent through AltasGoods. The buyer is notified by app and email.");
    } else return;
    setDraft("");
    setAttach(null);
  }

  const composer = replyOrder && (
    <div className="border-t border-line p-3 sm:p-4">
      {active?.dueAt && (
        <p className={cn("mb-2 flex items-center gap-1.5 text-xs", { danger: "text-danger-700", warning: "text-warning-700" }[slaFor(active.dueAt, 6).tone as "danger" | "warning"] ?? "text-ink-600")}>
          <Clock size={13} aria-hidden="true" /> Reply within 24 hours: {slaFor(active.dueAt, 6).label}
        </p>
      )}
      <Textarea
        aria-label={composing ? "Message" : "Reply"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={composing ? "Write a message. Keep it about this order." : "Write a reply. Keep it about this order."}
        className="min-h-20"
        aria-invalid={Boolean(violation)}
      />
      {violation && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger-700">
          <CircleAlert size={13} aria-hidden="true" /> {violation.reason}
        </p>
      )}
      {attach && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink-100 px-2 py-1 text-xs text-ink-700">
          <FileText size={13} aria-hidden="true" /> {attach}
          <button type="button" onClick={() => setAttach(null)} className="ml-1 text-ink-500 hover:text-ink-800" aria-label="Remove attachment">
            Remove
          </button>
        </span>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Select
          selectSize="sm"
          aria-label="Insert a template"
          value=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) setDraft(t.body.replace("{order}", replyOrder).replace("{date}", "Sat, 3 Oct"));
          }}
          className="w-44"
        >
          <option value="">Use a template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" icon={Paperclip} onClick={() => setAttach(`Invoice-${replyOrder}.pdf`)}>
          Attach invoice
        </Button>
        <span className="hidden items-center gap-1 text-[11px] text-ink-500 md:inline-flex">
          <ShieldCheck size={12} aria-hidden="true" /> Contact details are masked both ways
        </span>
        <Button size="sm" icon={Send} className="ml-auto" disabled={!draft.trim() || Boolean(violation)} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid h-[calc(100vh-15rem)] min-h-[34rem] grid-cols-1 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card lg:grid-cols-[22rem_1fr]">
      {/* Thread list */}
      <div className={cn("flex min-h-0 flex-col border-line lg:border-r", mobileOpen && "hidden lg:flex")}>
        <div className="flex items-center gap-1 border-b border-line p-2.5">
          {(["all", "needs_reply"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn("h-8 rounded-lg px-3 text-[13px] font-medium", filter === f ? "bg-ink-100 text-ink-900" : "text-ink-500 hover:text-ink-800")}
            >
              {f === "all" ? "All" : `Needs reply (${needs})`}
            </button>
          ))}
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto scrollbar-thin">
          {composeFor && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setComposing(true);
                  setMobileOpen(true);
                }}
                className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors", composing ? "bg-brand-50/60" : "hover:bg-ink-50")}
                aria-current={composing ? "true" : undefined}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <PenLine size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink-900">{sentNew.length ? "Message sent" : "New message"}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-500">{composeFor}</span>
                </span>
              </button>
            </li>
          )}
          {sorted.map((t) => {
            const sla = t.dueAt ? slaFor(t.dueAt, 6) : null;
            const isActive = active?.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setActiveId(t.id);
                    setMobileOpen(true);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3.5 text-left transition-colors", isActive ? "bg-brand-50/60" : "hover:bg-ink-50")}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="relative mt-0.5 shrink-0">
                    <ProductImage src={t.image} alt="" size={36} rounded="md" />
                    {t.status === "needs_reply" && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[13px]", t.status === "needs_reply" ? "font-semibold text-ink-900" : "font-medium text-ink-800")}>{t.buyer}</span>
                      <span className="shrink-0 text-[11px] text-ink-500">{timeAgo(t.lastAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-700">{t.subject}</span>
                    <span className="mt-1 flex items-center gap-2">
                      {sla ? (
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", sla.tone === "danger" ? "text-danger-700" : sla.tone === "warning" ? "text-warning-700" : "text-ink-600")}>
                          <Clock size={11} aria-hidden="true" />
                          {sla.label}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-500">{STATUS_LABEL[t.status].label}</span>
                      )}
                      <span className="truncate font-mono text-[11px] text-ink-500">{t.orderId}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {sorted.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-ink-500">No messages need a reply. Nice work.</li>}
        </ul>
      </div>

      {/* Conversation */}
      {active ? (
        <div className={cn("flex min-h-0 flex-col", !mobileOpen && "hidden lg:flex")}>
          <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <button type="button" onClick={() => setMobileOpen(false)} className="-ml-1 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden" aria-label="Back to messages">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-ink-900">{active.subject}</p>
                <Badge size="sm" tone={STATUS_LABEL[active.status].tone}>
                  {STATUS_LABEL[active.status].label}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                {/* sample threads: order ids are not real orders, so they are shown, not linked */}
                {active.buyer}, order <span className="font-mono text-ink-700">{active.orderId}</span>, {active.productTitle}
              </p>
            </div>
            {active.status === "needs_reply" && (
              <Button
                size="sm"
                variant="ghost"
                className="hidden sm:inline-flex"
                onClick={() => {
                  update(active.id, { status: "no_response_needed", dueAt: undefined });
                  toast.show("Marked as no response needed. It no longer counts toward your 24 hour response rate.");
                }}
              >
                No reply needed
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas/60 px-4 py-5 scrollbar-thin sm:px-6">
            {active.messages.map((m) => (
              <MessageBubble key={m.id} m={m} buyer={active.buyer} />
            ))}
          </div>
          {composer}
        </div>
      ) : composing && composeFor ? (
        <div className={cn("flex min-h-0 flex-col", !mobileOpen && "hidden lg:flex")}>
          <div className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <button type="button" onClick={() => setMobileOpen(false)} className="-ml-1 rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden" aria-label="Back to messages">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink-900">New message</p>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                To the buyer of order <span className="font-mono text-ink-700">{composeFor}</span>
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas/60 px-4 py-5 scrollbar-thin sm:px-6">
            <p className="mx-auto max-w-md text-center text-xs text-ink-500">No conversation with this buyer yet. Your message starts one, and their reply appears here.</p>
            {sentNew.map((m) => (
              <MessageBubble key={m.id} m={m} buyer="Buyer" />
            ))}
          </div>
          {composer}
        </div>
      ) : (
        <div className="hidden items-center justify-center text-sm text-ink-500 lg:flex">Select a conversation</div>
      )}
      {toast.node}
    </div>
  );
}
