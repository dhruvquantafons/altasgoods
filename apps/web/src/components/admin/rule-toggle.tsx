"use client";

import { useState } from "react";
import { RULE_STATUS } from "@/components/admin/admin-status";
import { StatusBadge } from "@/components/ui/badge";
import { Switch, useToast } from "@/components/ui/interactive";

/** Status pill plus an on/off switch for a risk rule; changes are audited. */
export function RuleToggle({ name, status: initial }: { name: string; status: "enabled" | "simulating" | "disabled" }) {
  const [status, setStatus] = useState(initial);
  const { show, node } = useToast();
  return (
    <span className="flex items-center justify-end gap-3">
      <StatusBadge meta={RULE_STATUS[status]} size="sm" />
      <span className="flex" aria-label={`${name} ${status === "enabled" ? "enabled" : "off"}`}>
        <Switch
          checked={status === "enabled"}
          onChange={(on) => {
            setStatus(on ? "enabled" : "disabled");
            show(on ? `${name} enabled` : `${name} disabled. Logged to the audit trail.`);
          }}
        />
      </span>
      {node}
    </span>
  );
}
