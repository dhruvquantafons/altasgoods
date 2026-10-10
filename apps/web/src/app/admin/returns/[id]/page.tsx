import Link from "next/link";
import { ReturnActions, ReturnScanSimulator } from "@/components/admin/fulfilment/return-actions";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, Timeline } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminReturn, nextStep } from "@/lib/api/admin-fulfilment";
import { paise } from "@/lib/api/format";
import { UI_STATUS } from "@/lib/api/returns";
import { RETURN_STATUS } from "@/lib/status";
import { formatDateShort, formatDateTime } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/admin/returns/[id]">) {
  const { id } = await props.params;
  return { title: `Return ${id}` };
}

const ACTOR: Record<string, string> = { CUSTOMER: "Customer", STAFF: "Store", SELLER: "Store", SYSTEM: "System", LOGISTICS: "Courier" };
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const RESOLUTION = { REFUND: "Refund", REPLACEMENT: "Replacement", EXCHANGE: "Exchange" } as const;
const REFUND_TO = { SOURCE: "Original payment method", CREDITS: "AltasGoods Credits", BANK: "Bank account (UPI)" } as const;

export default async function AdminReturnPage(props: PageProps<"/admin/returns/[id]">) {
  const { id } = await props.params;
  const r = await loadAdminReturn(id);
  const next = nextStep(r);

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{r.id}</span>}
        breadcrumbs={[{ label: "Returns", href: "/admin/returns" }, { label: r.id }]}
        description={`Requested by ${r.customerName} on ${formatDateTime(r.createdAt)}${next ? `. ${next}.` : ""}`}
        meta={<StatusBadge meta={RETURN_STATUS[UI_STATUS[r.status]]} />}
        actions={
          <>
            <ReturnScanSimulator id={r.id} status={r.status} />
            <ReturnActions id={r.id} status={r.status} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Item and reason" />
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <ProductImage src={r.item.image} alt="" size={56} rounded="md" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{r.item.title}</p>
                  <p className="text-xs text-ink-500">
                    Qty {r.qty}
                    {r.item.variant ? `, ${r.item.variant}` : ""} from order{" "}
                    <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-brand-700 hover:underline">
                      {r.orderId}
                    </Link>
                  </p>
                </div>
              </div>
              <DescriptionList
                columns={2}
                items={[
                  { label: "Reason", value: r.reasonLabel },
                  { label: "Customer's comments", value: r.comments || "None" },
                  { label: "Wants", value: RESOLUTION[r.resolution] + (r.exchangeSize ? ` (size ${r.exchangeSize})` : "") },
                  { label: "Value", value: paise(r.resolution === "REFUND" ? r.refundAmountPaise : r.item.unitPricePaise * r.qty) },
                  ...(r.decisionNote ? [{ label: "Store's decision note", value: r.decisionNote }] : []),
                  ...(r.qcNote ? [{ label: "Quality check note", value: r.qcNote }] : []),
                ]}
              />
              {r.photos.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-700">Customer&apos;s photos</p>
                  <div className="flex flex-wrap gap-2">
                    {r.photos.map((p) => (
                      <a key={p.id} href={`/admin/returns/${r.id}/photos/${p.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg ring-1 ring-line hover:ring-brand-300">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private photo streamed through the session */}
                        <img src={`/admin/returns/${r.id}/photos/${p.id}`} alt={p.name} className="size-20 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <Timeline
                items={[...r.events].reverse().map((e) => ({
                  title: label(e.toStatus === "PENDING_REVIEW" ? "AWAITING_REVIEW" : e.toStatus),
                  time: formatDateTime(e.at),
                  description: [ACTOR[e.actor] ?? label(e.actor), e.note].filter(Boolean).join(" · "),
                }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Pickup" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "From", value: `${r.address.name}, ${r.address.line1}, ${r.address.city} ${r.address.pincode}` },
                  { label: "Slot", value: r.pickupDate ? `${formatDateShort(`${r.pickupDate}T12:00:00+05:30`)}${r.pickupSlot ? `, ${r.pickupSlot}` : ""}` : "Not booked yet" },
                  { label: "AWB", value: r.awb ? <span className="font-mono">{r.awb}</span> : "Not assigned" },
                ]}
              />
            </CardBody>
          </Card>
          {r.resolution === "REFUND" && (
            <Card>
              <CardHeader title="Refund" />
              <CardBody>
                <DescriptionList
                  items={[
                    { label: "Amount", value: paise(r.refundAmountPaise) },
                    { label: "To", value: r.refundTo ? REFUND_TO[r.refundTo] : "Original payment method" },
                    { label: "Status", value: r.refundStatus ? label(r.refundStatus) : r.instantRefund ? "Refunded at pickup" : "Released after the check" },
                  ]}
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
