"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setProductActive } from "@/app/actions/admin-catalog";
import { Switch, useToast } from "@/components/ui/interactive";

/** Puts a product on sale or takes it off, straight from the product list. */
export function ActiveToggle({ id, title, active }: { id: string; title: string; active: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Switch
        checked={on}
        disabled={busy}
        ariaLabel={`${title} on sale`}
        onChange={async (v) => {
          setBusy(true);
          setOn(v);
          const r = await setProductActive(id, v);
          setBusy(false);
          if (!r.ok) {
            setOn(!v);
            return toast.show(r.error);
          }
          toast.show(v ? "On sale in the store" : "Taken off the store");
          router.refresh();
        }}
      />
      {toast.node}
    </>
  );
}
