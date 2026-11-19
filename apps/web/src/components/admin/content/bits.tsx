"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";

type Outcome = { ok: boolean; error?: string };

/** Runs a content action, shows the outcome, and refreshes the page data. */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<Outcome>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) {
      toast.show(r.error ?? "Something went wrong");
      return false;
    }
    toast.show(done);
    router.refresh();
    return true;
  };
  return { run, busy, toast, router };
}

export function MoveButtons({ index, count, busy, label, onMove }: { index: number; count: number; busy?: boolean; label: string; onMove: (by: -1 | 1) => void }) {
  return (
    <>
      <Button size="xs" variant="ghost" icon={ArrowUp} disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label={`Move ${label} up`} />
      <Button size="xs" variant="ghost" icon={ArrowDown} disabled={busy || index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${label} down`} />
    </>
  );
}

/** A card with a title, a description and an optional Add button, wrapping a list. */
export function Lane({ title, description, onAdd, addLabel, children }: { title: string; description: ReactNode; onAdd?: () => void; addLabel?: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
        {onAdd && (
          <Button size="sm" icon={Plus} onClick={onAdd}>
            {addLabel ?? "Add"}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function ConfirmRemove({ title, description, onCancel, onConfirm, busy, confirmLabel = "Remove" }: { title: string; description: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; confirmLabel?: string }) {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Keep it
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <span />
    </Modal>
  );
}

/** One item per line, as an array, and back. */
export const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
export const fromLines = (a: string[]) => a.join("\n");

export const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
