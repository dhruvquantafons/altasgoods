"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CircleCheck } from "lucide-react";
import { setCustomerStatus } from "@/app/actions/admin-system";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";

/** Block or unblock a customer. Blocking signs them out everywhere and stops them signing in; their orders carry on. */
export function CustomerStatusButton({ id, name, status }: { id: string; name: string; status: "ACTIVE" | "BLOCKED" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const blocking = status === "ACTIVE";

  const confirm = async () => {
    setBusy(true);
    const r = await setCustomerStatus(id, blocking ? "BLOCKED" : "ACTIVE", reason.trim() || undefined);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    setOpen(false);
    toast.show(blocking ? `${name} is blocked` : `${name} can sign in again`);
    router.refresh();
  };

  return (
    <>
      <Button variant={blocking ? "secondary" : "primary"} icon={blocking ? Ban : CircleCheck} className={blocking ? "border-danger-100 text-danger-700 hover:bg-danger-50" : undefined} onClick={() => setOpen(true)}>
        {blocking ? "Block account" : "Unblock account"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={blocking ? `Block ${name}?` : `Unblock ${name}?`}
        description={blocking ? "They are signed out everywhere and cannot sign in until you unblock them. Orders already placed carry on." : "They can sign in and shop again."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={blocking ? "danger" : "primary"} onClick={confirm} disabled={busy}>
              {busy ? "Saving" : blocking ? "Block account" : "Unblock account"}
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="cs-reason" hint="Optional. Saved in the audit log.">
          <Textarea id="cs-reason" className="min-h-16" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </>
  );
}
