import { PackageSearch } from "lucide-react";
import { QueueTable } from "@/components/admin/fulfilment/queue-table";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { loadAdminItems } from "@/lib/api/admin-fulfilment";
import type { ApiOrderItemStatus } from "@/lib/api/types";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 25;

/** Fulfilment stages, each a set of order line statuses. */
const VIEWS: { key: string; label: string; statuses: ApiOrderItemStatus[] }[] = [
  { key: "accept", label: "To accept", statuses: ["NEW"] },
  { key: "pack", label: "To pack", statuses: ["ACCEPTED"] },
  { key: "ship", label: "To hand over", statuses: ["PACKED", "READY_TO_SHIP"] },
  { key: "transit", label: "In transit", statuses: ["SHIPPED", "OUT_FOR_DELIVERY"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED", "REPLACED", "CLOSED"] },
  { key: "returns", label: "Returns and RTO", statuses: ["RETURN_REQUESTED", "RETURN_IN_PROGRESS", "RETURNED", "RTO_IN_TRANSIT", "RTO_RECEIVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "LOST"] },
  { key: "all", label: "All", statuses: [] },
];

export default async function OrdersPage(props: PageProps<"/admin/orders">) {
  const params = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp(params, "view")) ?? VIEWS[0]!;
  const q = sp(params, "q")?.trim() ?? "";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);

  const data = await loadAdminItems({ status: view.statuses, q, page, pageSize: PAGE_SIZE });
  const count = (statuses: ApiOrderItemStatus[]) =>
    statuses.length ? statuses.reduce((n, s) => n + (data.counts[s] ?? 0), 0) : Object.values(data.counts).reduce((n, c) => n + c, 0);
  const current = { view: view.key === VIEWS[0]!.key ? undefined : view.key, q: q || undefined };
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total ? (data.page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader title="Orders" description="Accept, pack and hand over every order line. Lines waiting for payment appear once the customer has paid." />

      <TabLinks
        className="mb-5"
        active={view.key}
        items={VIEWS.map((v) => ({ key: v.key, label: v.label, count: count(v.statuses), href: hrefWith("/admin/orders", { ...current, page: undefined, view: v.key === VIEWS[0]!.key ? undefined : v.key }) }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar path="/admin/orders" q={q} placeholder="Order ID or product" keep={{ view: current.view }} />
        </div>

        {data.items.length === 0 ? (
          <EmptyState icon={PackageSearch} title={q ? "No orders match this search" : "Nothing here right now"} description={q ? "Try a different order ID or product name." : "New lines show up here as customers order."} />
        ) : (
          // eslint-disable-next-line react-hooks/purity -- request time, read once per render on the server
          <QueueTable items={data.items} now={Date.now()} />
        )}
        <Pager path="/admin/orders" params={current} label="lines" page={data.page} pages={pages} from={from} to={Math.min(data.page * PAGE_SIZE, data.total)} total={data.total} />
      </Card>
    </>
  );
}
