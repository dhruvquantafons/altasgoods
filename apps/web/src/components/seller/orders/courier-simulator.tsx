"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Loader2, PackageCheck, Truck } from "lucide-react";
import { simulateCourierScan } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";

type Step = "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";
const NEXT: Record<string, { to: Step; label: string } | undefined> = {
  READY_TO_SHIP: { to: "SHIPPED", label: "Scan pickup" },
  SHIPPED: { to: "OUT_FOR_DELIVERY", label: "Scan out for delivery" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Scan delivered" },
};

/**
 * Development only: stands in for AltasGoods Logistics scans so the whole order
 * lifecycle can be demonstrated before the logistics integration exists.
 */
export function CourierSimulator({ items }: { items: { id: string; title: string; status: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const movable = items.filter((i) => NEXT[i.status]);
  if (!movable.length) return null;

  const scan = async (id: string, to: Step) => {
    setBusy(id);
    setError(null);
    const r = await simulateCourierScan(id, to);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };

  return (
    <div className="mb-6 rounded-[var(--radius-card)] border border-dashed border-accent-300 bg-accent-50/60 px-5 py-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-accent-800">
        <FlaskConical size={15} aria-hidden="true" /> Courier simulator (development only)
      </p>
      <p className="mt-0.5 text-xs text-ink-600">Stands in for AltasGoods Logistics scans until the logistics integration is live.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {movable.map((i) => {
          const next = NEXT[i.status]!;
          return (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-line">
              <span className="min-w-0 truncate text-[13px] text-ink-800">{i.title}</span>
              <Button size="sm" variant="secondary" icon={next.to === "DELIVERED" ? PackageCheck : Truck} disabled={!!busy} onClick={() => scan(i.id, next.to)}>
                {busy === i.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                {next.label}
              </Button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-danger-700">{error}</p>}
    </div>
  );
}
