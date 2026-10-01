import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface ThreadItemData {
  kind: "customer" | "agent" | "system" | "note";
  author: string;
  body: string;
  time: string;
}

/** One entry in the agent conversation: customer left, agent right, internal notes highlighted, system events centred. */
export function ThreadItem({ item }: { item: ThreadItemData }) {
  if (item.kind === "system")
    return (
      <li className="flex items-center gap-3 py-1 text-xs text-ink-500">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className="max-w-[80%] text-center">
          {item.body} <span className="text-ink-400">{item.time}</span>
        </span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </li>
    );
  if (item.kind === "note")
    return (
      <li className="rounded-xl border border-warning-100 bg-warning-50/70 px-4 py-3">
        <p className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-warning-700">
            <Lock size={12} aria-hidden="true" />
            Internal note, {item.author}
          </span>
          <span className="text-ink-500">{item.time}</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-800">{item.body}</p>
      </li>
    );
  const agent = item.kind === "agent";
  return (
    <li className={cn("flex gap-3", agent && "flex-row-reverse")}>
      <Avatar name={item.author} size="sm" className="mt-0.5" />
      <div className={cn("max-w-[85%] min-w-0", agent && "text-right")}>
        <p className={cn("flex items-baseline gap-2 text-xs text-ink-500", agent && "flex-row-reverse")}>
          <span className="font-semibold text-ink-800">{item.author}</span>
          {item.time}
        </p>
        <div
          className={cn(
            "mt-1 rounded-2xl px-4 py-2.5 text-left text-[13.5px] leading-relaxed whitespace-pre-line",
            agent ? "rounded-tr-md border border-brand-100 bg-brand-50 text-ink-900" : "rounded-tl-md border border-line bg-white text-ink-800",
          )}
        >
          {item.body}
        </div>
      </div>
    </li>
  );
}
