import { BadgePercent, ChevronDown, Coins, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";
import type { BankOffer } from "./types";
import { CouponClip } from "./pdp-client";
import { formatINR } from "@/lib/utils";

const kindIcon: Record<BankOffer["kind"], typeof CreditCard> = {
  "Bank offer": CreditCard,
  "Partner offer": Landmark,
  "No cost EMI": CreditCard,
  Cashback: Wallet,
  "UPI offer": Smartphone,
};

function OfferRow({ o }: { o: BankOffer }) {
  const Icon = kindIcon[o.kind];
  return (
    <li className="flex gap-3 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700">
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 text-[13px] leading-relaxed">
        <span className="font-semibold text-ink-900">{o.kind}: </span>
        <span className="text-ink-800">{o.title}</span>
        <span className="block text-ink-500">{o.detail}</span>
      </span>
    </li>
  );
}

/**
 * Offers block: bank, UPI, EMI and partner offers with their conditions, an
 * opt-in coupon, and AltasCoins you will earn. Never folded into the headline price.
 */
export function OffersList({
  offers,
  coupon,
  coins,
  emiFrom,
}: {
  offers: BankOffer[];
  coupon?: { code: string; description: string };
  coins: number;
  emiFrom?: number;
}) {
  const first = offers.slice(0, 3);
  const rest = offers.slice(3);
  return (
    <div className="rounded-2xl border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <BadgePercent size={17} className="text-success-700" aria-hidden="true" /> Offers
        </p>
        <p className="text-xs text-ink-500">Best offer applies automatically at payment</p>
      </div>
      <div className="px-4">
        <ul className="divide-y divide-line">
          {first.map((o) => (
            <OfferRow key={o.id} o={o} />
          ))}
        </ul>
        {rest.length > 0 && (
          <details className="group border-t border-line">
            <summary className="flex cursor-pointer list-none items-center gap-1 py-3 text-[13px] font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{rest.length} more offers</span>
              <span className="hidden group-open:inline">Fewer offers</span>
              <ChevronDown size={15} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {rest.map((o) => (
                <OfferRow key={o.id} o={o} />
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        {coupon && <CouponClip code={coupon.code} description={coupon.description} />}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-700">
          <span className="flex items-center gap-2">
            <Coins size={15} className="text-accent-700" aria-hidden="true" />
            <span>
              Earn <span className="font-semibold text-ink-900">{coins} AltasCoins</span> on this order
            </span>
          </span>
          {emiFrom && (
            <span className="flex items-center gap-2">
              <CreditCard size={15} className="text-ink-500" aria-hidden="true" />
              <span>
                No cost EMI from <span className="font-semibold text-ink-900">{formatINR(emiFrom)} a month</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
