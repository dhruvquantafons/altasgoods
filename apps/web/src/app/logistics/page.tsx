import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, PackageCheck, Truck } from "lucide-react";
import { ALL_SHIPMENT_STATUSES, countOf, SHIPMENT_VIEWS } from "@/components/logistics/shipment-views";
import { isLate } from "@/components/logistics/shipments-table";
import { ProductImage } from "@/components/commerce/product-image";
import { Card } from "@/components/ui/card";
import { EmptyState, IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { loadAdminItems, loadLogisticsStatus } from "@/lib/api/admin-fulfilment";
import { formatDateShort } from "@/lib/utils";

export const metadata = { title: "Overview" };

function Check({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? <CircleCheck size={17} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <CircleDashed size={17} className="mt-px shrink-0 text-ink-400" aria-hidden="true" />}
      <span>
        <span className="block text-[13px] font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{hint}</span>
      </span>
    </li>
  );
}

export default async function ShippingOverviewPage() {
  const [status, moving, problems] = await Promise.all([
    loadLogisticsStatus(),
    // the API's largest page; enough to spot late parcels for a store of this size
    loadAdminItems({ status: ["READY_TO_SHIP", "SHIPPED", "OUT_FOR_DELIVERY"], pageSize: 60 }),
    loadAdminItems({ status: ["RTO_IN_TRANSIT", "RTO_RECEIVED", "LOST"], pageSize: 10 }),
  ]);
  const counts = moving.counts;
  // eslint-disable-next-line react-hooks/purity -- request time, read once per render on the server
  const now = Date.now();
  const late = moving.items.filter((i) => isLate(i, now));
  const attention = [...late, ...problems.items].slice(0, 8);
  const simulated = status?.provider !== "SHIPROCKET";
  const sr = status?.shiprocket;

  return (
    <>
      <PageHeader title="Shipping" description="Every parcel handed to the courier, from pickup to the customer's door." />

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <IconTile icon={Truck} tone={simulated ? "warning" : "success"} />
            <div>
              <p className="text-[13px] font-medium text-ink-500">Courier</p>
              <p className="text-lg font-semibold text-ink-900">{status ? (simulated ? "Simulated courier" : "Shiprocket") : "Unknown, the API is unreachable"}</p>
              <p className="mt-1 max-w-xl text-[13px] text-ink-600">
                {simulated
                  ? "No real parcels are booked. Each order line gets a test AWB when it is marked ready to ship, and you move it along with the Simulate buttons on the Shipments page."
                  : "Parcels are booked with Shiprocket when an order line is marked ready to ship. Tracking updates every 10 minutes, or straight away with the tracking webhook."}
              </p>
            </div>
          </div>
          {sr && simulated && (
            <div className="rounded-xl border border-line bg-ink-50/60 p-4 lg:w-[380px]">
              <p className="mb-3 text-[13px] font-semibold text-ink-900">To switch on Shiprocket</p>
              <ul className="flex flex-col gap-3">
                <Check done={sr.credentials} label="API user email and password" hint="SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD: an API user from Shiprocket Settings, API" />
                <Check done={sr.pickupLocation} label="Pickup location" hint="SHIPROCKET_PICKUP_LOCATION: the pickup address nickname in Shiprocket" />
                <Check done={sr.webhookToken} label="Tracking webhook (optional)" hint={`SHIPROCKET_WEBHOOK_TOKEN, and the webhook URL https://<your API address>${status!.webhookPath}`} />
                <Check done={false} label="Turn it on" hint="Set LOGISTICS_PROVIDER=shiprocket in the API settings and restart it" />
              </ul>
            </div>
          )}
        </div>
      </Card>

      <section aria-label="Shipments by stage" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {SHIPMENT_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/logistics/shipments?view=${v.key}`}
            className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-px hover:shadow-raised"
          >
            <div className="flex items-center justify-between">
              <IconTile icon={v.icon} tone={v.tone} size="sm" />
              <ArrowRight size={15} className="text-ink-300 transition-colors group-hover:text-ink-600" aria-hidden="true" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-ink-500">{v.label}</p>
            <p className="mt-0.5 text-xl font-semibold tracking-tight text-ink-900 tabular-nums">{countOf(counts, v.statuses)}</p>
            <p className="mt-0.5 truncate text-xs text-ink-500">{v.hint}</p>
          </Link>
        ))}
      </section>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Needs attention</h2>
            <p className="text-xs text-ink-500">Parcels past their promised date, returned to origin, or lost</p>
          </div>
          <Link href="/logistics/shipments" className="text-[13px] font-medium text-brand-700 hover:underline">
            All shipments
          </Link>
        </div>
        {attention.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Nothing needs attention"
            description={countOf(counts, ALL_SHIPMENT_STATUSES) ? "Every parcel on the move is on time." : "Parcels show up here once order lines are marked ready to ship in AltasGoods Control."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {attention.map((i) => (
              <li key={i.id}>
                <Link href={`/admin/orders/${i.orderId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60">
                  <ProductImage src={i.image} alt="" size={36} rounded="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink-900">{i.title}</span>
                    <span className="block text-xs text-ink-500">
                      <span className="font-mono">{i.awb ?? i.orderId}</span> · {i.shipTo.city} {i.shipTo.pincode}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-medium text-danger-700">
                    {i.status === "LOST" ? "Lost" : i.status.startsWith("RTO") ? "Returned to origin" : `Late, promised ${formatDateShort(i.promisedBy)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
