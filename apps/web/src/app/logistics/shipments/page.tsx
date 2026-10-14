import { PackageSearch } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { ALL_SHIPMENT_STATUSES, countOf, SHIPMENT_VIEWS } from "@/components/logistics/shipment-views";
import { ShipmentsTable } from "@/components/logistics/shipments-table";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { loadAdminItems, loadLogisticsStatus } from "@/lib/api/admin-fulfilment";

export const metadata = { title: "Shipments" };

const PAGE_SIZE = 25;
const VIEWS = [{ key: "all", label: "All", statuses: ALL_SHIPMENT_STATUSES }, ...SHIPMENT_VIEWS];

export default async function ShipmentsPage(props: PageProps<"/logistics/shipments">) {
  const params = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp(params, "view")) ?? VIEWS[0]!;
  const q = sp(params, "q")?.trim() ?? "";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);

  const [data, status] = await Promise.all([loadAdminItems({ status: view.statuses, q, page, pageSize: PAGE_SIZE }), loadLogisticsStatus()]);
  const current = { view: view.key === "all" ? undefined : view.key, q: q || undefined };
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total ? (data.page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader title="Shipments" description="Order lines handed to the courier. Open one to see its full timeline in AltasGoods Control." />

      <TabLinks
        className="mb-5"
        active={view.key}
        items={VIEWS.map((v) => ({ key: v.key, label: v.label, count: countOf(data.counts, v.statuses), href: hrefWith("/logistics/shipments", { ...current, page: undefined, view: v.key === "all" ? undefined : v.key }) }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar path="/logistics/shipments" q={q} placeholder="AWB, order ID or product" keep={{ view: current.view }} />
        </div>
        {data.items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={q ? "No shipments match this search" : "No shipments here"}
            description={q ? "Try the full AWB or order ID." : "Order lines become shipments once they are marked ready to ship in AltasGoods Control."}
          />
        ) : (
          // eslint-disable-next-line react-hooks/purity -- request time, read once per render on the server
          <ShipmentsTable items={data.items} now={Date.now()} simulated={status?.provider !== "SHIPROCKET"} />
        )}
        <Pager path="/logistics/shipments" params={current} label="shipments" page={data.page} pages={pages} from={from} to={Math.min(data.page * PAGE_SIZE, data.total)} total={data.total} />
      </Card>
    </>
  );
}
