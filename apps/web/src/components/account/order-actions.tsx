"use client";

import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/actions/store";
import { useState } from "react";
import { CircleCheck, Download, Info, ShoppingCart, XCircle } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";
import { Textarea } from "@/components/ui/input";
import { cn, formatINR } from "@/lib/utils";

export interface CancelItem {
  id: string;
  title: string;
  image: string;
  variant?: string;
  quantity: number;
  amount: number;
}

export interface RefundOption {
  key: "original" | "credits";
  label: string;
  detail: string;
}

/**
 * Cancel flow (spec 10.4): pick items, a reason and where the refund goes.
 * "request" mode is used once the package has shipped (intercept, refuse at door).
 */
export function CancelOrderButton({
  orderId,
  mode,
  items,
  reasons,
  refundOptions,
  isCod,
  size = "sm",
  variant = "secondary",
  className,
  fullWidth,
}: {
  orderId: string;
  mode: "cancel" | "request";
  items: CancelItem[];
  reasons: string[];
  refundOptions: RefundOption[];
  isCod: boolean;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  className?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(items.map((i) => i.id));
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [refundTo, setRefundTo] = useState<RefundOption["key"]>(refundOptions[0]?.key ?? "original");
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const router = useRouter();

  const amount = items.filter((i) => selected.includes(i.id)).reduce((a, i) => a + i.amount, 0);
  const chosen = refundOptions.find((r) => r.key === refundTo);
  const valid = selected.length > 0 && reason !== "";
  const noun = mode === "cancel" ? "Cancel" : "Request cancellation";

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setDone(false);
      setTouched(false);
    }, 200);
  };

  return (
    <>
      <Button size={size} variant={variant} icon={XCircle} className={cn(fullWidth && "w-full", className)} onClick={() => setOpen(true)}>
        {mode === "cancel" ? (items.length > 1 ? "Cancel items" : "Cancel item") : "Request cancellation"}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={done ? (mode === "cancel" ? "Cancellation confirmed" : "Cancellation requested") : `${noun} from order ${orderId}`}
        description={done ? undefined : mode === "cancel" ? "Nothing has shipped yet, so this takes effect right away." : "Your package has already shipped. We will try to stop it before it reaches you."}
        footer={
          done ? (
            <Button onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                Keep order
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setTouched(true);
                  if (!valid) return;
                  setBusy(true);
                  setApiError(null);
                  const r = await cancelOrder(orderId, [reason, note.trim()].filter(Boolean).join(": "), selected);
                  setBusy(false);
                  if (!r.ok) return setApiError(r.error);
                  setDone(true);
                  router.refresh();
                }}
              >
                {mode === "cancel" ? `Cancel ${selected.length > 1 ? `${selected.length} items` : "item"}` : "Request cancellation"}
              </Button>
            </>
          )
        }
      >
        {apiError && !done && (
          <p role="alert" className="mb-4 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-700">
            {apiError}
          </p>
        )}
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-ink-900">
              {mode === "cancel" ? "Your items have been cancelled" : "We are stopping your package"}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-ink-600">
              {isCod
                ? "This was a pay on delivery order, so no money was taken and there is nothing to refund."
                : mode === "cancel"
                  ? `A refund of ${formatINR(amount)} to ${chosen?.label ?? "your original payment method"} starts within 1 hour. ${chosen?.detail ? `${chosen.detail}.` : ""}`
                  : `If the package reaches you, refuse it at the door at no charge. Your refund of ${formatINR(amount)} starts as soon as it is on its way back.`}
            </p>
            <p className="mt-3 text-xs text-ink-500">We have sent the details to your mobile and email.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-ink-900">{items.length > 1 ? "Items to cancel" : "Item"}</legend>
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
                {items.map((it) => {
                  const on = selected.includes(it.id);
                  return (
                    <li key={it.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-3", items.length === 1 && "cursor-default")}>
                        {items.length > 1 && (
                          <input
                            type="checkbox"
                            className="size-4 accent-brand-600"
                            checked={on}
                            onChange={() => setSelected((s) => (on ? s.filter((x) => x !== it.id) : [...s, it.id]))}
                          />
                        )}
                        <ProductImage src={it.image} alt="" size={44} rounded="md" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-[13px] font-medium text-ink-900">{it.title}</span>
                          <span className="text-xs text-ink-500">
                            {it.variant ? `${it.variant} · ` : ""}Qty {it.quantity}
                          </span>
                        </span>
                        <span className="text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(it.amount)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {touched && selected.length === 0 && <p className="mt-1.5 text-xs text-danger-600">Choose at least one item to cancel.</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-ink-900">Reason for cancelling</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {reasons.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
                      reason === r ? "border-brand-500 bg-brand-50 text-ink-900" : "border-line text-ink-700 hover:border-line-strong",
                    )}
                  >
                    <input type="radio" name="cancel-reason" className="size-4 accent-brand-600" checked={reason === r} onChange={() => setReason(r)} />
                    {r}
                  </label>
                ))}
              </div>
              {touched && !reason && <p className="mt-1.5 text-xs text-danger-600">Choose a reason so we can improve.</p>}
              <Textarea className="mt-3 min-h-20" placeholder="Anything else we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Additional comments" />
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-ink-900">Refund</legend>
              {isCod ? (
                <p className="flex items-start gap-2 rounded-lg bg-ink-50 px-3.5 py-3 text-[13px] text-ink-700">
                  <Info size={16} className="mt-px shrink-0 text-ink-500" aria-hidden="true" />
                  You chose pay on delivery, so nothing has been charged and there is nothing to refund.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {refundOptions.map((o) => (
                    <label
                      key={o.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                        refundTo === o.key ? "border-brand-500 bg-brand-50" : "border-line hover:border-line-strong",
                      )}
                    >
                      <input type="radio" name="refund-to" className="mt-0.5 size-4 accent-brand-600" checked={refundTo === o.key} onChange={() => setRefundTo(o.key)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink-900">{o.label}</span>
                        <span className="block text-xs text-ink-500">{o.detail}</span>
                      </span>
                    </label>
                  ))}
                  <div className="mt-1 flex items-center justify-between rounded-lg bg-ink-50 px-3.5 py-2.5 text-[13px]">
                    <span className="text-ink-600">Refund amount</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{formatINR(amount)}</span>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-ink-500">AltasGoods never charges a cancellation fee. Any AltasGoods Credits you used are restored right away.</p>
            </fieldset>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Downloads a GST tax invoice (mock: confirms with a toast). */
export function InvoiceButton({
  orderId,
  label = "Invoice",
  size = "sm",
  variant = "secondary",
  className,
}: {
  orderId: string;
  label?: string;
  size?: "xs" | "sm" | "md";
  variant?: "secondary" | "ghost" | "link";
  className?: string;
}) {
  const toast = useToast();
  return (
    <>
      <Button size={size} variant={variant} icon={variant === "link" ? undefined : Download} className={className} onClick={() => toast.show(`Tax invoice for ${orderId} downloaded`)}>
        {label}
      </Button>
      {toast.node}
    </>
  );
}

/** Adds the item to the cart again (mock: confirms with a toast). */
export function BuyAgainButton({ title, size = "sm", className }: { title: string; size?: "sm" | "md"; className?: string }) {
  const toast = useToast();
  return (
    <>
      <Button size={size} variant="secondary" icon={ShoppingCart} className={className} onClick={() => toast.show(`${title} added to your cart`)}>
        Buy again
      </Button>
      {toast.node}
    </>
  );
}
