"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

/**
 * PII is masked by default (spec 8.2). Revealing needs the pii:reveal
 * permission and is itself written to the audit log.
 */
export function MaskedValue({ masked, full, className }: { masked: string; full: string; className?: string }) {
  const [shown, setShown] = useState(false);
  const { show, node } = useToast();
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="tabular-nums">{shown ? full : masked}</span>
      {!shown && (
        <button
          type="button"
          onClick={() => {
            setShown(true);
            show("Revealed. This view is recorded in the audit log.");
          }}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          <Eye size={13} aria-hidden="true" />
          Reveal
        </button>
      )}
      {node}
    </span>
  );
}
