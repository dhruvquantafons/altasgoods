import { notFound } from "next/navigation";
import { PackageX } from "lucide-react";
import { dayLabel, deliveredAt, paymentLabel, refundTiming, returnInfo } from "@/components/account/lib";
import { ReturnWizard, type WizardItem } from "@/components/account/return-wizard";
import { ProductImage } from "@/components/commerce/product-image";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { customerAddresses, getProduct } from "@/lib/mock";
import { getAccountOrder, pickupSlots, RETURN_REASONS } from "@/lib/mock/account-extra";
import { NOW } from "@/lib/utils";

export const metadata = { title: "Return or replace" };

const HIGH_RISK = ["cat-mobiles"];

export default async function ReturnPage(props: PageProps<"/account/orders/[id]/return">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const order = getAccountOrder(id);
  if (!order) notFound();

  const delivered = deliveredAt(order);
  const items: WizardItem[] = order.items.map((it) => {
    const product = getProduct(it.productId);
    const ri = returnInfo(order, it);
    const policy = ri.policy;
    const changeOfMindOpen = Boolean(delivered) && policy.resolutions.includes("refund") && new Date(delivered!).getTime() + policy.days * 86400_000 >= NOW.getTime();
    const amount = it.price * it.quantity;
    return {
      id: it.id,
      title: it.title,
      image: it.image,
      variant: it.variant,
      quantity: it.quantity,
      amount,
      eligible: ri.eligible,
      blockedReason: ri.reason,
      windowLabel: ri.windowEndsAt ? dayLabel(ri.windowEndsAt) : undefined,
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
          addresses={customerAddresses.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type === "home" ? "Home" : a.type === "work" ? "Work" : "Other",
            lines: [a.line1, a.line2, `${a.city} ${a.pincode}`].filter(Boolean).join(", "),
            phone: a.phone,
            isDefault: Boolean(a.isDefault),
          }))}
          slots={pickupSlots().map((s) => {
            const label = dayLabel(s.date);
            const [weekday, date] = label.split(", ");
            return { key: s.date, weekday: weekday!, date: date!, full: label, windows: s.windows };
          })}
          payment={{ label: paymentLabel(method), timing: refundTiming(method), isCod: method === "cod", creditsOnly: method === "wallet" || method === "giftcard" }}
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
