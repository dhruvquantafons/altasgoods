import Link from "next/link";
import { notFound } from "next/navigation";
import { IndianRupee, Inbox, ShieldAlert, ShoppingBag } from "lucide-react";
import { CustomerStatusButton } from "@/components/admin/customer-status";
import { ProductImage } from "@/components/commerce/product-image";
import { KeyRow, maskPhone, MetricTile, Mono } from "@/components/logistics/ops-ui";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomer } from "@/lib/api/admin-system";
import { paise, uiOrderStatus, uiPaymentMethod } from "@/lib/api/format";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Customer" };

export default async function AdminCustomerPage(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const c = await loadAdminCustomer(id);
  const name = c.name ?? c.email;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} size="md" />
            {name}
          </span>
        }
        meta={
          <>
            {c.status === "BLOCKED" && (
              <Badge tone="danger" icon={ShieldAlert}>
                Blocked
              </Badge>
            )}
            <span className="text-[13px] text-ink-500">Customer since {formatDate(c.createdAt)}</span>
          </>
        }
        actions={
          <>
            <ButtonLink href={`/support/customers/${c.id}`} variant="secondary">
              Open in Care Desk
            </ButtonLink>
            <CustomerStatusButton id={c.id} name={name} status={c.status} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <MetricTile label="Orders" value={formatNumber(c.orderCount)} hint="Orders that went through" icon={ShoppingBag} />
        <MetricTile label="Spent" value={paise(c.spentPaise)} hint={c.orderCount ? `Average ${paise(Math.round(c.spentPaise / c.orderCount))} per order` : "No orders yet"} icon={IndianRupee} />
        <MetricTile label="Email" value={c.emailVerified ? "Verified" : "Not verified"} hint={c.email} icon={Inbox} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Orders" description="The 20 most recent, failed payments included" />
          {c.orders.length === 0 ? (
            <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No orders yet.</p>
          ) : (
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Order</TH>
                    <TH>Items</TH>
                    <TH align="right">Total</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {c.orders.map((o) => (
                    <TR key={o.id}>
                      <TD>
                        <Link href={`/admin/orders/${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                          {o.id}
                        </Link>
                        <p className="text-xs text-ink-500">{formatDate(o.placedAt)}</p>
                      </TD>
                      <TD>
                        {o.firstItem && (
                          <div className="flex max-w-80 items-center gap-3">
                            <ProductImage src={o.firstItem.image} alt="" size={36} rounded="md" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-ink-900">{o.firstItem.title}</p>
                              <p className="text-xs text-ink-500">
                                {o.itemCount > 1 ? `and ${o.itemCount - 1} more, ` : ""}
                                {PAYMENT_METHOD[uiPaymentMethod(o.paymentMethod)]}
                              </p>
                            </div>
                          </div>
                        )}
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {paise(o.totalPaise)}
                      </TD>
                      <TD>
                        <StatusBadge meta={ORDER_STATUS[uiOrderStatus(o.status)]} size="sm" />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Contact" />
          <dl className="px-5 pt-2 pb-4">
            <KeyRow label="Email">
              <Mono className="text-[12px]">{c.email}</Mono>
            </KeyRow>
            <KeyRow label="Mobile">{c.phone ? <Mono>{maskPhone(c.phone)}</Mono> : "Not given"}</KeyRow>
            <KeyRow label="Account">{c.status === "BLOCKED" ? "Blocked" : "Active"}</KeyRow>
          </dl>
        </Card>
      </div>
    </>
  );
}
