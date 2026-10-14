import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { KeyRow, maskPhone, Mono } from "@/components/logistics/ops-ui";
import { SlaBadge } from "@/components/support/meta";
import { NewTicketButton } from "@/components/support/new-ticket";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { paise, uiItemStatus, uiOrderStatus, uiPaymentMethod, uiPaymentStatus } from "@/lib/api/format";
import { currentTime, isActiveTicket, loadSupportOrder, slaOf, tickets } from "@/lib/api/support";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, TICKET_STATUS } from "@/lib/status";
import { formatDateShort, formatDateTime } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/support/orders/[id]">) {
  const { id } = await props.params;
  return { title: `Order ${id}` };
}

/** "OUT_FOR_DELIVERY" as "out for delivery", for the history. */
const words = (s: string | null) => (s ? s.toLowerCase().replace(/_/g, " ") : "");

export default async function SupportOrderPage(props: PageProps<"/support/orders/[id]">) {
  const { id } = await props.params;
  const [o, { tickets: tix }] = await Promise.all([loadSupportOrder(id), tickets({ view: "all", orderId: id })]);
  if (!o) notFound();
  const now = currentTime();
  const customerName = o.customer.name ?? o.customer.email;
  const titleOf = new Map(o.items.map((i) => [i.id, i.title]));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Order lookup", href: "/support/orders" }, { label: o.id }]}
        title={<Mono className="text-[22px] font-semibold text-ink-900">{o.id}</Mono>}
        meta={
          <>
            <StatusBadge meta={ORDER_STATUS[uiOrderStatus(o.status)]} />
            <span className="text-[13px] text-ink-500">Placed {formatDateTime(o.placedAt)}</span>
          </>
        }
        actions={<NewTicketButton customerName={customerName} customerId={o.customer.id} orderId={o.id} label="Create ticket" />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Items and shipping" description="Each line ships as its own parcel" />
            <ul className="mt-2 divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <ProductImage src={i.image} alt="" size={52} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-ink-900">{i.title}</p>
                    <p className="text-xs text-ink-500">
                      Qty {i.qty}
                      {i.variant ? `, ${i.variant}` : ""}, {paise(i.unitPricePaise * i.qty)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                      <StatusBadge meta={ORDER_STATUS[uiItemStatus(i.status)]} size="sm" />
                      <span>Promised {formatDateShort(i.promisedBy)}</span>
                      {i.awb && (
                        <span>
                          {i.courier ?? "Courier"} <Mono>{i.awb}</Mono>
                        </span>
                      )}
                      {i.trackingUrl && (
                        <a href={i.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                          Track <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    {i.trackingStatus && (
                      <p className="mt-1.5 text-xs text-ink-500">
                        Latest scan: {i.trackingStatus}
                        {i.trackedAt ? `, ${formatDateTime(i.trackedAt)}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Tickets about this order" />
            {tix.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No tickets yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {tix.map((t) => (
                  <li key={t.id}>
                    <Link href={`/support/tickets/${t.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-ink-50/70 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <Mono className="text-xs text-ink-500">{t.id}</Mono>
                        <p className="truncate text-[13px] font-medium text-ink-900">{t.subject}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge meta={TICKET_STATUS[t.status]} size="sm" />
                        {isActiveTicket(t) && <SlaBadge sla={slaOf(t, now)} />}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="History" description="Every status change, oldest first" />
            {o.events.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">Nothing yet. The order is waiting for payment.</p>
            ) : (
              <ol className="px-5 pt-2 pb-4">
                {o.events.map((e, n) => (
                  <li key={n} className="flex gap-3 border-l border-line pb-3 pl-4 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink-800">
                        {o.items.length > 1 && e.orderItemId ? <span className="text-ink-500">{titleOf.get(e.orderItemId)}: </span> : null}
                        {e.fromStatus ? `${words(e.fromStatus)} to ${words(e.toStatus)}` : words(e.toStatus)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(e.at)}, {e.actor}
                        {e.note ? `. ${e.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Customer" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Name">
                <Link href={`/support/customers/${o.customer.id}`} className="font-medium text-brand-700 hover:underline">
                  {customerName}
                </Link>
              </KeyRow>
              <KeyRow label="Delivery phone">
                <Mono>{maskPhone(o.address.phone)}</Mono>
              </KeyRow>
              <KeyRow label="Deliver to">
                {o.address.city}, {o.address.state} {o.address.pincode}
              </KeyRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Total">{paise(o.totalPaise)}</KeyRow>
              <KeyRow label="Method">{PAYMENT_METHOD[uiPaymentMethod(o.paymentMethod)]}</KeyRow>
              <KeyRow label="Status">
                <StatusBadge meta={PAYMENT_STATUS[uiPaymentStatus(o.paymentStatus)]} size="sm" />
              </KeyRow>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
