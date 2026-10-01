"use client";

import { useState } from "react";
import { BookText, Lock, Paperclip, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Popover, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";
import { ThreadItem, type ThreadItemData } from "./thread";

export interface ComposerMacro {
  id: string;
  title: string;
  category: string;
  body: string;
}

/** Reply composer with macro insertion (placeholders filled from ticket context) and internal notes. */
export function ReplyComposer({
  channel,
  agentName,
  context,
  macros,
  disabled,
}: {
  channel: string;
  agentName: string;
  context: Record<string, string>;
  macros: ComposerMacro[];
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [after, setAfter] = useState("awaiting_customer");
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<ThreadItemData[]>([]);
  const { show, node } = useToast();

  const fill = (body: string) => body.replace(/\{(\w+)\}/g, (m, k: string) => context[k] ?? m);
  const list = macros.filter((m) => !query || `${m.title} ${m.category} ${m.body}`.toLowerCase().includes(query.toLowerCase()));

  function send() {
    if (!text.trim()) return;
    setSent((s) => [...s, { kind: mode === "note" ? "note" : "agent", author: agentName, body: text.trim(), time: "Just now" }]);
    setText("");
    show(mode === "note" ? "Internal note added. Only BluBuy staff can see it." : `Reply sent by ${channel.toLowerCase()}${after === "awaiting_customer" ? ", status set to Awaiting customer" : after === "resolved" ? ", ticket resolved and CSAT survey queued" : ""}`);
  }

  return (
    <div>
      {sent.length > 0 && (
        <ol className="flex flex-col gap-4 px-5 pb-4">
          {sent.map((s, i) => (
            <ThreadItem key={i} item={s} />
          ))}
        </ol>
      )}
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
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
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
            <Button variant="ghost" size="sm" icon={Paperclip} disabled={disabled} onClick={() => show("Attachments open the file picker on a real device")}>
              Attach
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {mode === "reply" && (
                <>
                  <span className="text-xs text-ink-500">then</span>
                  <Select selectSize="sm" value={after} onChange={(e) => setAfter(e.target.value)} aria-label="Status after sending" className="w-44">
                    <option value="awaiting_customer">Awaiting customer</option>
                    <option value="open">Keep open</option>
                    <option value="resolved">Resolve</option>
                  </Select>
                </>
              )}
              <Button size="sm" variant={mode === "note" ? "dark" : "primary"} icon={mode === "note" ? Lock : Send} disabled={disabled || !text.trim()} onClick={send}>
                {mode === "note" ? "Add note" : "Send"}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">Ctrl and Enter to send. Placeholders such as the order ID fill in from this ticket.</p>
      </div>
      {node}
    </div>
  );
}
