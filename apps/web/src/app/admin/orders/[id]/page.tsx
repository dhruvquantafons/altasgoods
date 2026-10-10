import Link from "next/link";
import { CourierSimulator, LineActions } from "@/components/admin/fulfilment/line-actions";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminOrder } from "@/lib/api/admin-fulfilment";
import { paise, uiItemStatus, uiOrderStatus, uiPaymentMethod, uiPaymentStatus } from "@/lib/api/format";
import type { AdminOrderItem } from "@/lib/api/types";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/status";
import { formatDateShort, formatDateTime } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  return { title: `Order ${id}` };
}

const ACTOR: Record<string, string> = { CUSTOMER: "Customer", STAFF: "Store", SELLER: "Store", SYSTEM: "System", PAYMENT: "Payment", LOGISTICS: "Courier" };
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = await loadAdminOrder(id);

  // lines in the same status can be moved together from the header
  const groups = new Map<string, AdminOrderItem[]>();
  for (const i of order.items) groups.set(i.status, [...(groups.get(i.status) ?? []), i]);
  const bulk = [...groups.values()].filter((g) => g.length > 1 && g[0]!.allowedActions.length);
  const titleOf = new Map(order.items.map((i) => [i.id, i.title]));
  const a = order.address;

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{order.id}</span>}
        breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: order.id }]}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        meta={
          <>
            <StatusBadge meta={ORDER_STATUS[uiOrderStatus(order.status)]} />
            <StatusBadge meta={PAYMENT_STATUS[uiPaymentStatus(order.paymentStatus)]} />
          </>
        }
        actions={bulk.map((g) => (
          <LineActions key={g[0]!.status} orderId={order.id} itemIds={g.map((i) => i.id)} status={g[0]!.status} allowed={g[0]!.allowedActions} />
        ))}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Items" description={`${order.items.length} ${order.items.length === 1 ? "line" : "lines"}, ${paise(order.totalPaise)} in total`} />
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                  <ProductImage src={i.image} alt="" size={56} rounded="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${i.productId.replace(/^p-/, "")}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
                      {i.title}
                    </Link>
                    <p className="text-xs text-ink-500">
                      Qty {i.qty}
                      {i.variant ? `, ${i.variant}` : ""}, {paise(i.unitPricePaise * i.qty)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <StatusBadge meta={ORDER_STATUS[uiItemStatus(i.status)]} size="sm" />
                      {i.awb && <span className="font-mono">AWB {i.awb}</span>}
                      {i.dispatchBy && i.allowedActions.length > 0 && <span>Dispatch by {formatDateShort(i.dispatchBy)}</span>}
                      <span>Promised {formatDateShort(i.promisedBy)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <LineActions orderId={order.id} itemIds={[i.id]} status={i.status} allowed={i.allowedActions} />
                    <CourierSimulator orderId={order.id} itemId={i.id} status={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <Timeline
                items={[...order.events].reverse().map((e) => ({
                  title: label(e.toStatus),
                  time: formatDateTime(e.at),
                  description: [ACTOR[e.actor] ?? label(e.actor), e.orderItemId && order.items.length > 1 ? titleOf.get(e.orderItemId) : null, e.note].filter(Boolean).join(" · "),
                }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Deliver to" />
            <CardBody>
              {a ? (
                <address className="text-sm leading-relaxed text-ink-700 not-italic">
                  <span className="font-medium text-ink-900">{a.name}</span>
                  <br />
                  {a.line1}
                  {a.line2 && (
                    <>
                      <br />
                      {a.line2}
                    </>
                  )}
                  {a.landmark && (
                    <>
                      <br />
                      Near {a.landmark}
                    </>
                  )}
                  <br />
                  {a.city}, {a.state} {a.pincode}
                  <br />
                  <span className="text-ink-500">Phone {a.phone}</span>
                </address>
              ) : (
                <p className="text-sm text-ink-700">
                  {order.shipTo.name}, {order.shipTo.city} {order.shipTo.pincode}
                </p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payment" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Method", value: PAYMENT_METHOD[uiPaymentMethod(order.paymentMethod)] },
                  { label: "Status", value: PAYMENT_STATUS[uiPaymentStatus(order.paymentStatus)].label },
                  { label: "Order total", value: paise(order.totalPaise) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
