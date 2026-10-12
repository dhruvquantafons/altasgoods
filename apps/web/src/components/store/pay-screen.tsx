"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Clock, FlaskConical, Loader2, Lock, ShieldCheck } from "lucide-react";
import { completeSandboxPayment, confirmPayment, retryPayment } from "@/app/actions/store";
import { LogoMark } from "@/components/brand/logo";
import { paise } from "@/lib/api/format";
import type { PaymentDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface Props {
  payment: { id: string; status: string; amountPaise: number; failureReason: string | null; method: string; methodCode: string };
  order: { id: string; status: string; paymentDueBy: string | null; itemCount: number; firstItem: string };
  /** Set when the gateway's own checkout takes the payment; null for the sandbox. */
  checkout: PaymentDetail["checkout"];
  customer: { name: string; phone: string };
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (r: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

/** API payment methods to the method Razorpay Checkout opens on. */
const RAZORPAY_METHODS: Record<string, string> = { UPI: "upi", CARD: "card", NETBANKING: "netbanking", EMI: "emi", PAY_LATER: "paylater" };

let razorpayScript: Promise<boolean> | null = null;

/** Loads Razorpay Checkout once, on first use. */
function loadRazorpay() {
  razorpayScript ??= new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScript = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScript;
}

function useCountdown(until: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [until]);
  return left;
}

/**
 * The pay step after an order is placed. With Razorpay the customer pays in
 * Razorpay Checkout and the API verifies the result; with the sandbox the
 * buttons simulate the gateway. Either way the order is confirmed server side.
 */
export function PayScreen({ payment, order, checkout, customer }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pay" | "fail" | "retry">(null);
  const [failed, setFailed] = useState(payment.status === "FAILED" ? (payment.failureReason ?? "The payment did not go through") : null);
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(order.paymentDueBy);
  const expired = left === 0 || order.status === "ABANDONED" || payment.status === "EXPIRED" || payment.status === "CANCELLED";
  const paid = payment.status === "CAPTURED" || (order.status !== "PAYMENT_PENDING" && order.status !== "PAYMENT_FAILED" && order.status !== "ABANDONED" && order.status !== "CANCELLED");

  const settle = (r: Awaited<ReturnType<typeof confirmPayment>>) => {
    if (!r.ok) {
      setBusy(null);
      return setError(r.error);
    }
    if (r.data.status === "CAPTURED") return router.replace(`/order/confirmed?id=${order.id}`);
    setBusy(null);
    if (r.data.status === "REFUNDED") return setError("This order had already expired, so the amount was refunded straight away.");
    setFailed(r.data.failureReason ?? "The payment did not go through");
  };

  const act = async (outcome: "SUCCESS" | "FAILURE") => {
    setBusy(outcome === "SUCCESS" ? "pay" : "fail");
    setError(null);
    settle(await completeSandboxPayment(payment.id, outcome));
  };

  const payWithRazorpay = async () => {
    if (!checkout) return;
    setBusy("pay");
    setError(null);
    if (!(await loadRazorpay()) || !window.Razorpay) {
      setBusy(null);
      return setError("We could not load the payment page. Check your connection and try again.");
    }
    const rzp = new window.Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderRef,
      amount: payment.amountPaise,
      currency: checkout.currency,
      name: "AltasGoods",
      description: `Order ${order.id}`,
      prefill: { name: customer.name, contact: customer.phone, method: RAZORPAY_METHODS[payment.methodCode] },
      notes: { orderId: order.id },
      theme: { color: "#2358e0" },
      handler: async (res: RazorpaySuccess) => {
        settle(await confirmPayment(payment.id, { razorpayPaymentId: res.razorpay_payment_id, razorpayOrderId: res.razorpay_order_id, razorpaySignature: res.razorpay_signature }));
      },
      // closed without paying: the order stays reserved until the window ends
      modal: { ondismiss: () => setBusy(null) },
    });
    // Razorpay keeps its checkout open and offers another try, so only note the reason
    rzp.on("payment.failed", (r) => setError(r.error.description ? `${r.error.description}. You can try again.` : null));
    rzp.open();
  };

  const retry = async () => {
    setBusy("retry");
    const r = await retryPayment(order.id);
    if (!r.ok) {
      setBusy(null);
      return setError(r.error);
    }
    router.replace(`/checkout/pay/${r.data.paymentId}`);
  };

  const mm = left === null ? null : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-16">
      {!checkout && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-800 ring-1 ring-accent-100">
          <FlaskConical size={14} aria-hidden="true" />
          AltasGoods Pay sandbox: no real money moves
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-raised">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <div>
              <p className="text-sm font-semibold text-ink-900">AltasGoods Pay</p>
              <p className="text-xs text-ink-500">AltasGoods Commerce Private Limited</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs text-ink-500">
            <Lock size={13} aria-hidden="true" /> Secure
          </span>
        </div>

        <div className="px-6 py-6">
          <p className="text-xs text-ink-500">Amount to pay</p>
          <p className="mt-1 font-display text-[36px] leading-none font-semibold tracking-tight text-ink-900">{paise(payment.amountPaise)}</p>
          <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-ink-500">Order</dt>
            <dd className="text-right font-mono text-[13px] text-ink-900">{order.id}</dd>
            <dt className="text-ink-500">Items</dt>
            <dd className="truncate text-right text-ink-900">
              {order.firstItem}
              {order.itemCount > 1 && ` and ${order.itemCount - 1} more`}
            </dd>
            <dt className="text-ink-500">Method</dt>
            <dd className="text-right text-ink-900">{payment.method}</dd>
          </dl>

          {!paid && !expired && mm && (
            <p className={cn("mt-5 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px]", left !== null && left < 300 ? "bg-warning-50 text-warning-700" : "bg-ink-50 text-ink-600")}>
              <Clock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Complete payment within <span className="font-semibold tabular-nums">{mm}</span> to keep your items reserved
              </span>
            </p>
          )}

          {failed && !expired && !paid && (
            <div role="alert" className="mt-5 rounded-xl bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
              <p className="flex items-center gap-2 font-semibold">
                <CircleAlert size={15} aria-hidden="true" /> Payment failed
              </p>
              <p className="mt-0.5">{failed}. Your items are still reserved; you can try again.</p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2">
            {paid ? (
              <Link href={`/order/confirmed?id=${order.id}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-success-700 text-[15px] font-semibold text-white">
                <CircleCheck size={18} aria-hidden="true" /> Paid. View your order
              </Link>
            ) : expired ? (
              <>
                <p className="text-sm text-ink-600">The time to pay for this order has ended, so the items were released. Nothing was charged.</p>
                <Link href="/cart" className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700">
                  Back to cart
                </Link>
              </>
            ) : failed ? (
              <button type="button" onClick={retry} disabled={!!busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300">
                {busy === "retry" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                Try again
              </button>
            ) : checkout ? (
              <button type="button" onClick={payWithRazorpay} disabled={!!busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300">
                {busy === "pay" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                Pay {paise(payment.amountPaise)}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => act("SUCCESS")} disabled={!!busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300">
                  {busy === "pay" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                  Pay {paise(payment.amountPaise)}
                </button>
                <button type="button" onClick={() => act("FAILURE")} disabled={!!busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50">
                  {busy === "fail" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  Simulate a failed payment
                </button>
              </>
            )}
          </div>
        </div>

        <p className="flex items-start gap-2 border-t border-line bg-ink-50 px-6 py-3.5 text-xs leading-relaxed text-ink-500">
          <ShieldCheck size={15} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
          {checkout
            ? "Payments are processed securely by Razorpay. AltasGoods never sees your card number or UPI PIN."
            : "In production this step happens in your UPI app or on your bank's page. AltasGoods never sees your card number or UPI PIN."}
        </p>
      </div>
      <Link href={`/account/orders/${order.id}`} className="mt-5 text-center text-sm font-medium text-ink-600 hover:text-ink-900">
        View order details
      </Link>
    </div>
  );
}
