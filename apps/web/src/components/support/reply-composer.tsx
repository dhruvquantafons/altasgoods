"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BookText, Loader2, Lock, Paperclip, Search, Send, X } from "lucide-react";
import { sendTicketMessage, uploadTicketAttachment } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Popover, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

export interface ComposerMacro {
  id: string;
  title: string;
  category: string;
  body: string;
}

type Pending = { id: string; name: string };

/** Reply composer with macro insertion (placeholders filled from ticket context), attachments and internal notes. */
export function ReplyComposer({
  ticketId,
  channel,
  context,
  macros,
  disabled,
}: {
  ticketId: string;
  channel: string;
  context: Record<string, string>;
  macros: ComposerMacro[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [after, setAfter] = useState<"PENDING_CUSTOMER" | "OPEN" | "RESOLVED">("PENDING_CUSTOMER");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<"send" | "attach" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { show, node } = useToast();

  const fill = (body: string) => body.replace(/\{(\w+)\}/g, (m, k: string) => context[k] ?? m);
  const list = macros.filter((m) => !query || `${m.title} ${m.category} ${m.body}`.toLowerCase().includes(query.toLowerCase()));

  async function send() {
    if (!text.trim() || busy) return;
    setBusy("send");
    setError(null);
    const r = await sendTicketMessage(ticketId, { kind: mode === "note" ? "NOTE" : "REPLY", body: text.trim(), statusAfter: mode === "reply" ? after : undefined, attachmentIds: files.map((f) => f.id) });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setText("");
    setFiles([]);
    show(mode === "note" ? "Internal note added. Only BluBuy staff can see it." : `Reply sent by ${channel.toLowerCase()}${after === "PENDING_CUSTOMER" ? ", waiting for the customer" : after === "RESOLVED" ? ", ticket resolved" : ""}`);
    router.refresh();
  }

  async function attach(file: File) {
    if (file.size > 4 * 1024 * 1024) return setError("Attachments can be up to 4 MB");
    setBusy("attach");
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const r = await uploadTicketAttachment(ticketId, form);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setFiles((f) => [...f, { id: r.data.id, name: r.data.name }]);
  }

  return (
    <div>
      <div className="border-t border-line p-4 sm:p-5">
        <div className={cn("rounded-xl border bg-white shadow-xs transition-colors focus-within:ring-4", mode === "note" ? "border-warning-200 bg-warning-50/40 focus-within:ring-warning-100" : "border-line-strong focus-within:border-brand-400 focus-within:ring-brand-100")}>
          <div className="flex items-center gap-1 border-b border-line px-2 pt-2" role="tablist" aria-label="Message type">
            {(
              [
                { key: "reply", label: `Reply by ${channel.toLowerCase()}` },
                { key: "note", label: "Internal note" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => setMode(t.key)}
                className={cn(
                  "relative inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium",
                  mode === t.key ? (t.key === "note" ? "text-warning-700" : "text-ink-900") : "text-ink-500 hover:text-ink-800",
                )}
              >
                {t.key === "note" && <Lock size={13} aria-hidden="true" />}
                {t.label}
                {mode === t.key && <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full", t.key === "note" ? "bg-warning-500" : "bg-brand-600")} />}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder={mode === "note" ? "Add context for the team. Customers never see internal notes." : "Write a reply, or insert a macro"}
            aria-label={mode === "note" ? "Internal note" : "Reply to customer"}
            className="min-h-28 rounded-none border-0 bg-transparent shadow-none focus:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
            <Popover
              align="start"
              className="w-[22rem] p-0"
              trigger={() => (
                <Button variant="ghost" size="sm" icon={BookText} disabled={disabled}>
                  Macros
                </Button>
              )}
            >
              {(close) => (
                <div>
                  <div className="relative border-b border-line p-2">
                    <Search size={15} className="pointer-events-none absolute top-1/2 left-4.5 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search macros"
                      aria-label="Search macros"
                      className="h-9 w-full rounded-lg bg-ink-50 pr-3 pl-8 text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <ul className="max-h-72 overflow-y-auto p-1.5 scrollbar-thin">
                    {list.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => {
                            setText((t) => (t ? `${t}\n\n` : "") + fill(m.body));
                            setMode("reply");
                            close();
                          }}
                          className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-ink-50"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-ink-900">{m.title}</span>
                            <span className="font-mono text-[11px] text-ink-400">{m.id}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">{fill(m.body)}</span>
                        </button>
                      </li>
                    ))}
                    {list.length === 0 && <li className="px-2.5 py-4 text-center text-[13px] text-ink-500">No macros match</li>}
                  </ul>
                </div>
              )}
            </Popover>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="sr-only"
              // the Attach button opens it; one control per action for screen readers
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void attach(f);
              }}
            />
            <Button variant="ghost" size="sm" icon={busy === "attach" ? undefined : Paperclip} disabled={disabled || busy !== null || files.length >= 5} onClick={() => fileInput.current?.click()}>
              {busy === "attach" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Attach
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {mode === "reply" && (
                <>
                  <span className="text-xs text-ink-500">then</span>
                  <Select selectSize="sm" value={after} onChange={(e) => setAfter(e.target.value as typeof after)} aria-label="Status after sending" className="w-44">
                    <option value="PENDING_CUSTOMER">Awaiting customer</option>
                    <option value="OPEN">Keep open</option>
                    <option value="RESOLVED">Resolve</option>
                  </Select>
                </>
              )}
              <Button size="sm" variant={mode === "note" ? "dark" : "primary"} icon={busy === "send" ? undefined : mode === "note" ? Lock : Send} disabled={disabled || !text.trim() || busy !== null} onClick={send}>
                {busy === "send" && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {mode === "note" ? "Add note" : "Send"}
              </Button>
            </div>
          </div>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attachments to send">
            {files.map((f) => (
              <li key={f.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white py-1 pr-1 pl-2 text-xs text-ink-800">
                <Paperclip size={12} className="text-ink-400" aria-hidden="true" />
                {f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))} className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger-700">
            {error}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-500">Ctrl and Enter to send. Placeholders such as the order ID fill in from this ticket.</p>
      </div>
      {node}
    </div>
  );
}
