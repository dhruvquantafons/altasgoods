import { notFound } from "next/navigation";
import { PackageX } from "lucide-react";
import { dayLabel, refundTiming } from "@/components/account/lib";
import { ReturnWizard, type WizardItem } from "@/components/account/return-wizard";
import { ProductImage } from "@/components/commerce/product-image";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { loadMyOrder, toUiOrder } from "@/lib/api/account-orders";
import { api } from "@/lib/api/server";
import { currentTime } from "@/lib/api/support";
import { getProduct } from "@/lib/mock";
import { pickupSlots, returnPolicyFor, RETURN_REASONS } from "@/lib/mock/account-extra";
import { PAYMENT_METHOD } from "@/lib/status";

const DAY = 86_400_000;
/** Damage, defect and wrong item claims stay open this long after delivery; the store reviews late ones (spec 11.3). */
const CLAIM_DAYS = 90;

export const metadata = { title: "Return or replace" };

const HIGH_RISK = ["cat-mobiles"];

export default async function ReturnPage(props: PageProps<"/account/orders/[id]/return">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const client = await api();
  const [raw, myReturns, addressBook] = await Promise.all([loadMyOrder(id), client.GET("/v1/me/returns").then((r) => r.data ?? []), client.GET("/v1/me/addresses").then((r) => r.data ?? [])]);
  if (!raw) notFound();
  const order = toUiOrder(raw);
  const now = currentTime();
  const delivered = order.deliveredAt;

  const items: WizardItem[] = raw.items.map((it) => {
    const product = getProduct(it.productId);
    const policy = returnPolicyFor(product);
    const open = myReturns.find((r) => r.orderItemId === it.id && !["CANCELLED", "REJECTED", "COMPLETED"].includes(r.status));
    const deliveredOn = it.deliveredAt ? Date.parse(it.deliveredAt) : null;
    const windowEnds = deliveredOn ? deliveredOn + Math.max(policy.days, 7) * DAY : null;
    const changeOfMindOpen = windowEnds !== null && policy.resolutions.includes("refund") && windowEnds >= now;
    const eligible = it.status === "DELIVERED" && !open && deliveredOn !== null && deliveredOn + CLAIM_DAYS * DAY >= now;
    const blockedReason = open
      ? `Return ${open.id} is already open for this item`
      : it.status !== "DELIVERED"
        ? "Returns open once the item is delivered"
        : !eligible
          ? "This item is past its return and claim window"
          : undefined;
    const amount = (it.unitPricePaise * it.qty) / 100;
    return {
      id: it.id,
      title: it.title,
      image: it.image,
      variant: it.variant || undefined,
      quantity: it.qty,
      amount,
      eligible,
      blockedReason,
      windowLabel: windowEnds && windowEnds >= now ? dayLabel(new Date(windowEnds).toISOString()) : undefined,
      policySummary: policy.summary,
      policyNote: policy.note,
      resolutions: policy.resolutions,
      fashion: product?.categoryId === "cat-fashion",
      changeOfMind: changeOfMindOpen,
      sizes: product?.variants.find((v) => v.name === "Size")?.values.map((v) => ({ label: v.label, available: v.available })) ?? [],
      instantRefund: amount <= 5000 && !HIGH_RISK.includes(product?.categoryId ?? "") && product?.subcategory !== "Laptops",
    };
  });

  const anyEligible = items.some((i) => i.eligible);
  const itemParam = Array.isArray(sp.item) ? sp.item[0] : sp.item;
  const method = order.payment.method;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Your account", href: "/account" },
          { label: "Your orders", href: "/account/orders" },
          { label: order.id, href: `/account/orders/${order.id}` },
          { label: "Return or replace" },
        ]}
        title="Return or replace items"
        description={delivered ? `Delivered on ${dayLabel(delivered)}. Free doorstep pickup, and no questions asked for items inside their return window.` : "Returns open once your order is delivered."}
      />

      {anyEligible ? (
        <ReturnWizard
          orderId={order.id}
          items={items}
          initialItemId={itemParam}
          reasons={RETURN_REASONS}
          addresses={addressBook.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type === "HOME" ? "Home" : a.type === "WORK" ? "Work" : "Other",
            lines: [a.line1, a.line2, `${a.city} ${a.pincode}`].filter(Boolean).join(", "),
            phone: a.phone,
            isDefault: a.isDefault,
          }))}
          slots={pickupSlots(4, now).map((s) => {
            const label = dayLabel(s.date);
            const [weekday, date] = label.split(", ");
            return { key: s.date, weekday: weekday!, date: date!, full: label, windows: s.windows };
          })}
          payment={{ label: PAYMENT_METHOD[method], timing: refundTiming(method), isCod: method === "cod", creditsOnly: method === "wallet" || method === "giftcard" }}
        />
      ) : (
        <section className="rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          <EmptyState
            icon={PackageX}
            title="Nothing in this order can be returned right now"
            description="Items can be returned or replaced once they are delivered and while their return window is open. You can still get help with a damaged or wrong item."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={`/account/support?order=${order.id}`}>Get help</ButtonLink>
                <ButtonLink href={`/account/orders/${order.id}`} variant="secondary">
                  Back to order
                </ButtonLink>
              </div>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <ProductImage src={it.image} alt="" size={52} rounded="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink-900">{it.title}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{it.blockedReason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
