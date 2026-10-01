"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, UserPlus, X } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";
import { Avatar } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { StatusMeta, Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface InboxRow {
  id: string;
  subject: string;
  preview: string;
  customer: string;
  orderId?: string;
  category: string;
  channel: string;
  priority: StatusMeta;
  status: StatusMeta;
  pcode: string;
  sla: string;
  slaTone: Tone;
  assignee?: string;
  updated: string;
  closed: boolean;
}

/** Ticket list with row selection and a batch bar for bulk assignment. */
export function TicketInbox({ rows, agents }: { rows: InboxRow[]; agents: { name: string; label: string }[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [agent, setAgent] = useState(agents[0]?.name ?? "");
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const { show, node } = useToast();
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));

  function toggle(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  }

  return (
    <div>
      <div className={cn("flex min-h-[52px] flex-wrap items-center gap-2 border-y border-line px-5 py-2", sel.size ? "bg-brand-50/60" : "bg-ink-50/40")}>
        {sel.size ? (
          <>
            <span className="mr-1 text-[13px] font-semibold text-ink-900">{sel.size} selected</span>
            <Select selectSize="sm" value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Assign to agent" className="w-56">
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              icon={UserPlus}
              onClick={() => {
                const next = { ...assigned };
                sel.forEach((id) => (next[id] = agent));
                setAssigned(next);
                show(`${sel.size} ticket${sel.size === 1 ? "" : "s"} assigned to ${agent}`);
                setSel(new Set());
              }}
            >
              Assign
            </Button>
            <Button size="sm" variant="ghost" icon={X} className="ml-auto" onClick={() => setSel(new Set())}>
              Clear
            </Button>
          </>
        ) : (
          <p className="text-[13px] text-ink-500">Select tickets to assign them in bulk. Sorted by next reply due, overdue first.</p>
        )}
      </div>

      <TableContainer className="hidden lg:block">
        <Table>
          <THead className="border-t-0">
            <TR>
              <TH className="w-10">
                <input type="checkbox" aria-label="Select all tickets" className="size-4 accent-brand-600" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} />
              </TH>
              <TH>Ticket</TH>
              <TH>Customer</TH>
              <TH>Priority and status</TH>
              <TH>SLA</TH>
              <TH>Assignee</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const who = assigned[r.id] ?? r.assignee;
              return (
                <TR key={r.id} className={cn(sel.has(r.id) && "bg-brand-50/50")}>
                  <TD>
                    <input type="checkbox" aria-label={`Select ${r.id}`} className="size-4 accent-brand-600" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </TD>
                  <TD className="max-w-[21rem]">
                    <Link href={`/support/tickets/${r.id}`} className="group block">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-500">{r.id}</span>
                        <span className="text-xs text-ink-400">
                          {r.channel}, {r.category}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-medium text-ink-900 group-hover:text-brand-700">{r.subject}</span>
                      <span className="block truncate text-xs text-ink-500">{r.preview}</span>
                    </Link>
                  </TD>
                  <TD>
                    <p className="text-[13px] text-ink-900">{r.customer}</p>
                    {r.orderId && <p className="font-mono text-[11px] text-ink-500">{r.orderId}</p>}
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusBadge meta={r.priority} size="sm" />
                        <span className="font-mono text-[11px] text-ink-400">{r.pcode}</span>
                      </span>
                      <StatusBadge meta={r.status} size="sm" />
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={r.slaTone} size="sm">
                      {r.sla}
                    </Badge>
                  </TD>
                  <TD>
                    {who ? (
                      <span className={cn("inline-flex items-center gap-2 text-[13px]", assigned[r.id] && "font-medium text-brand-700")}>
                        <Avatar name={who} size="xs" />
                        {who}
                      </span>
                    ) : (
                      <span className="text-[13px] text-warning-700">Unassigned</span>
                    )}
                    <p className="mt-0.5 text-xs text-ink-500">Updated {r.updated}</p>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>

      <ul className="divide-y divide-line lg:hidden">
        {rows.map((r) => {
          const who = assigned[r.id] ?? r.assignee;
          return (
            <li key={r.id} className={cn("flex items-start gap-3 px-4 py-3.5", sel.has(r.id) && "bg-brand-50/50")}>
              <input type="checkbox" aria-label={`Select ${r.id}`} className="mt-1 size-4 accent-brand-600" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
              <Link href={`/support/tickets/${r.id}`} className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-ink-500">{r.id}</span>
                  <span className="text-xs text-ink-500">{r.updated}</span>
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium text-ink-900">{r.subject}</span>
                <span className="block truncate text-xs text-ink-500">
                  {r.customer}, {who ?? "Unassigned"}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge meta={r.priority} size="sm" />
                  <StatusBadge meta={r.status} size="sm" />
                  <Badge tone={r.slaTone} size="sm">
                    {r.sla}
                  </Badge>
                </span>
              </Link>
              <ChevronRight size={16} className="mt-1 shrink-0 text-ink-300" aria-hidden="true" />
            </li>
          );
        })}
      </ul>
      {node}
    </div>
  );
}
