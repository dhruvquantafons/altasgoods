import Link from "next/link";
import Form from "next/form";
import { ChevronRight, PackageSearch, Search } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { one } from "@/components/logistics/ops-ui";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { paise, uiOrderStatus, uiPaymentMethod } from "@/lib/api/format";
import { loadSupportOrders } from "@/lib/api/support";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Order lookup" };

export default async function OrderLookupPage(props: PageProps<"/support/orders">) {
  const sp = await props.searchParams;
  const q = (one(sp.q) ?? "").trim();
  const results = await loadSupportOrders(q);

  return (
    <>
      <PageHeader title="Order lookup" description="Find an order by its ID, the courier AWB, or the customer's name or email." />

      <Card className="mb-6">
        <Form action="/support/orders" className="flex flex-col gap-3 p-5 sm:flex-row">
          <Input name="q" defaultValue={q} icon={Search} inputSize="lg" placeholder="Order ID, AWB, customer name or email" aria-label="Order ID, AWB, customer name or email" className="flex-1" />
          <Button type="submit" size="lg">
            Find order
          </Button>
        </Form>
      </Card>

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-ink-900">{q ? `Orders matching "${q}"` : "Latest orders"}</h2>
          <p className="text-xs text-ink-500">{q ? `${results.length} found${results.length === 25 ? ", showing the 25 most recent" : ""}` : "The 25 most recent, failed payments included"}</p>
        </div>
        {results.length === 0 ? (
          <EmptyState icon={PackageSearch} title={q ? "No order found" : "No orders yet"} description={q ? "Check the order ID or AWB, or search by the customer's email." : "Orders appear here as customers place them."} />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Order</TH>
                  <TH className="hidden md:table-cell">Customer</TH>
                  <TH className="hidden lg:table-cell">Items</TH>
                  <TH align="right">Total</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {results.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/support/orders/${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {o.id}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(o.placedAt)}, {PAYMENT_METHOD[uiPaymentMethod(o.paymentMethod)]}
                      </p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <Link href={`/support/customers/${o.customer.id}`} className="text-[13px] text-ink-800 hover:text-brand-700">
                        {o.customer.name ?? o.customer.email}
                      </Link>
                      <p className="truncate text-xs text-ink-500">{o.customer.email}</p>
                    </TD>
                    <TD className="hidden lg:table-cell">
                      {o.firstItem && (
                        <div className="flex max-w-72 items-center gap-2.5">
                          <ProductImage src={o.firstItem.image} alt="" size={34} rounded="md" />
                          <span className="min-w-0 truncate text-[13px] text-ink-800">
                            {o.firstItem.title}
                            {o.itemCount > 1 && <span className="text-ink-500"> and {o.itemCount - 1} more</span>}
                          </span>
                        </div>
                      )}
                    </TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {paise(o.totalPaise)}
                    </TD>
                    <TD>
                      <StatusBadge meta={ORDER_STATUS[uiOrderStatus(o.status)]} size="sm" />
                    </TD>
                    <TD align="right">
                      <Link href={`/support/orders/${o.id}`} aria-label={`Open ${o.id}`}>
                        <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
