import Link from "next/link";
import { notFound } from "next/navigation";
import { IndianRupee, Inbox, ShieldAlert, ShoppingBag } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { NewTicketButton, RevealContact } from "@/components/support/new-ticket";
import { KeyRow, maskPhone, MetricTile, Mono } from "@/components/logistics/ops-ui";
import { SlaBadge } from "@/components/support/meta";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { paise, uiOrderStatus, uiPaymentMethod } from "@/lib/api/format";
import { currentTime, isActiveTicket, loadCustomer, slaOf, tickets } from "@/lib/api/support";
import { ORDER_STATUS, PAYMENT_METHOD, TICKET_STATUS } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/support/customers/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) return { title: "Customer" };
  const c = await loadCustomer(id).catch(() => null);
  return { title: c?.name ?? c?.email ?? "Customer" };
}

const maskEmail = (email: string) => `${email.slice(0, 2)}${"*".repeat(5)}@${email.split("@")[1]}`;

export default async function CustomerSupportView(props: PageProps<"/support/customers/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [c, { tickets: tix }] = await Promise.all([loadCustomer(id), tickets({ view: "all", customerId: id })]);
  const now = currentTime();
  const open = tix.filter(isActiveTicket);
  const name = c.name ?? c.email;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customer lookup", href: "/support/customers" }, { label: name }]}
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
            <RevealContact phone={c.phone ?? "No mobile number"} email={c.email} />
            <NewTicketButton customerName={name} customerId={c.id} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <MetricTile label="Orders" value={formatNumber(c.orderCount)} hint="Orders that went through" icon={ShoppingBag} />
        <MetricTile label="Spent" value={paise(c.spentPaise)} hint={c.orderCount ? `Average ${paise(Math.round(c.spentPaise / c.orderCount))} per order` : "No orders yet"} icon={IndianRupee} />
        <MetricTile label="Open tickets" value={open.length} tone={open.length ? "warning" : "neutral"} hint={`${tix.length} ticket${tix.length === 1 ? "" : "s"} in total`} icon={Inbox} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Recent orders" description="Newest first, failed payments included" />
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
                          <Link href={`/support/orders/${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
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
            <CardHeader title="Tickets" />
            {tix.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No support contacts yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {tix.map((t) => (
                  <li key={t.id}>
                    <Link href={`/support/tickets/${t.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-ink-50/70 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <Mono className="text-xs text-ink-500">{t.id}</Mono>
                          <span className="text-xs text-ink-500">{t.category}</span>
                        </p>
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
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Profile" description="Masked until you reveal it" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Mobile">{c.phone ? <Mono>{maskPhone(c.phone)}</Mono> : "Not given"}</KeyRow>
              <KeyRow label="Email">
                <span className="font-mono text-[12px]">{maskEmail(c.email)}</span>
              </KeyRow>
              <KeyRow label="Email verified">{c.emailVerified ? "Yes" : "No"}</KeyRow>
              <KeyRow label="Account">{c.status === "BLOCKED" ? "Blocked" : "Active"}</KeyRow>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
