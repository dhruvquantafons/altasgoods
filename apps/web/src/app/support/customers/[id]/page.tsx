import Link from "next/link";
import { notFound } from "next/navigation";
import { Coins, Crown, IndianRupee, Inbox, ShieldAlert, ShoppingBag } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { NewTicketButton, RevealContact } from "@/components/support/new-ticket";
import { KeyRow, maskPhone, MetricTile, Mono } from "@/components/logistics/ops-ui";
import { RiskPill, SlaBadge } from "@/components/support/meta";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { customers, refunds, returns } from "@/lib/mock";
import { currentTime, isActiveTicket, slaOf, tickets } from "@/lib/api/support";
import { ordersForCustomer } from "@/lib/mock/ops-extra";
import { ORDER_STATUS, PAYMENT_METHOD, REFUND_STATUS, RETURN_STATUS, TICKET_STATUS } from "@/lib/status";
import { cn, formatDate, formatINR, formatNumber, NOW, timeAgo } from "@/lib/utils";


export async function generateMetadata(props: PageProps<"/support/customers/[id]">) {
  const { id } = await props.params;
  return { title: customers.find((c) => c.id === id)?.name ?? "Customer" };
}

export default async function CustomerSupportView(props: PageProps<"/support/customers/[id]">) {
  const { id } = await props.params;
  const c = customers.find((x) => x.id === id);
  if (!c) notFound();

  const orders = ordersForCustomer(c.id);
  const tix = (await tickets({ customerRef: c.id })).tickets;
  const now = currentTime();
  const open = tix.filter(isActiveTicket);
  const rets = returns.filter((r) => r.customerName === c.name);
  const refs = refunds.filter((r) => r.customerName === c.name);
  const codOrders = orders.filter((o) => o.payment.method === "cod");
  const codRefusals = orders.filter((o) => o.payment.method === "cod" && (o.status === "rto_in_transit" || o.status === "returned_to_seller")).length;
  const returnRate = orders.length ? Math.round((rets.length / orders.length) * 1000) / 10 : 0;
  const riskTone = c.riskScore >= 70 ? "danger" : c.riskScore >= 40 ? "warning" : "success";
  // a few shared mock refund dates fall after NOW; show those as scheduled
  const when = (d: string) => (new Date(d) > NOW ? "Scheduled" : timeAgo(d));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customer lookup", href: "/support/customers" }, { label: c.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} size="md" />
            {c.name}
          </span>
        }
        meta={
          <>
            <Mono className="text-xs text-ink-500">{c.id}</Mono>
            {c.plusMember && (
              <Badge tone="brand" icon={Crown}>
                AltasGoods Plus
              </Badge>
            )}
            {c.status !== "active" && (
              <Badge tone="danger" icon={ShieldAlert}>
                {c.status === "flagged" ? "Risk flagged" : "Blocked"}
              </Badge>
            )}
            <span className="text-[13px] text-ink-500">
              {c.city}, {c.state}. Customer since {formatDate(c.joinedAt)}
            </span>
          </>
        }
        actions={
          <>
            <RevealContact phone={c.phone} email={c.email} />
            <NewTicketButton customerName={c.name} customerRef={c.id} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Orders" value={formatNumber(c.orders)} hint={`${orders.length} in the last 6 weeks`} icon={ShoppingBag} />
        <MetricTile label="Lifetime value" value={formatINR(c.lifetimeValue)} hint={`Average ${formatINR(Math.round(c.lifetimeValue / Math.max(1, c.orders)))} per order`} icon={IndianRupee} />
        <MetricTile label="Open tickets" value={open.length} tone={open.length ? "warning" : "neutral"} hint={`${tix.length} ticket${tix.length === 1 ? "" : "s"} in total`} icon={Inbox} />
        <MetricTile label="AltasCoins" value={formatNumber(c.bluCoins)} hint={c.plusMember ? "Plus earns 2x coins" : "Standard earn rate"} icon={Coins} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Recent orders" description="Newest first" />
            {orders.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No orders in the last 6 weeks.</p>
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
                    {orders.slice(0, 8).map((o) => (
                      <TR key={o.id}>
                        <TD>
                          <Link href={`/support/orders?q=${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                            {o.id}
                          </Link>
                          <p className="text-xs text-ink-500">{formatDate(o.placedAt)}</p>
                        </TD>
                        <TD>
                          <div className="flex max-w-80 items-center gap-3">
                            <ProductImage src={o.items[0]!.image} alt="" size={36} rounded="md" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-ink-900">{o.items[0]!.title}</p>
                              <p className="text-xs text-ink-500">
                                {o.items.length > 1 ? `and ${o.items.length - 1} more, ` : ""}
                                {PAYMENT_METHOD[o.payment.method]}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD align="right" className="font-medium text-ink-900">
                          {formatINR(o.total)}
                        </TD>
                        <TD>
                          <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" />
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
            <CardHeader title="Profile" description="Masked by default" />
            <dl className="px-5 pt-2 pb-4">
              <KeyRow label="Phone">
                <Mono>{maskPhone(c.phone)}</Mono>
              </KeyRow>
              <KeyRow label="Email">
                <span className="font-mono text-[12px]">
                  {c.email.slice(0, 2)}
                  {"*".repeat(5)}@{c.email.split("@")[1]}
                </span>
              </KeyRow>
              <KeyRow label="Location">
                {c.city}, {c.state}
              </KeyRow>
              <KeyRow label="Membership">{c.plusMember ? "AltasGoods Plus" : "Standard"}</KeyRow>
              <KeyRow label="Account">{c.status === "active" ? "Active" : c.status === "flagged" ? "Flagged by risk" : "Blocked"}</KeyRow>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Risk signals" action={<RiskPill score={c.riskScore} />} />
            <div className="px-5 pt-3 pb-5">
              <Progress value={c.riskScore} tone={riskTone} label="Customer risk score" />
              <dl className="mt-3">
                <KeyRow label="COD orders">{codOrders.length}</KeyRow>
                <KeyRow label="COD refusals, 90 days">
                  <span className={cn(codRefusals >= 2 && "text-danger-700")}>{codRefusals}</span>
                </KeyRow>
                <KeyRow label="Return rate">{returnRate}%</KeyRow>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                {c.riskScore >= 70
                  ? "High risk: refunds wait for QC at the FC, and COD may be disabled after 2 refusals in 90 days."
                  : "Low or medium risk: eligible for refund at pickup on items up to ₹5,000."}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Returns and refunds" />
            {rets.length + refs.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No returns or refunds.</p>
            ) : (
              <ul className="divide-y divide-line px-5 pt-1 pb-2">
                {rets.slice(0, 4).map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Mono className="text-xs text-ink-500">{r.id}</Mono>
                      <StatusBadge meta={RETURN_STATUS[r.status]} size="sm" />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-800">{r.productTitle}</p>
                    <p className="text-xs text-ink-500">
                      {r.reason}, {formatINR(r.amount)}
                    </p>
                  </li>
                ))}
                {refs.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <Mono className="text-xs text-ink-500">{r.id}</Mono>
                      <p className="text-[13px] text-ink-800">
                        {formatINR(r.amount)} to {r.method === "bluwallet" ? "AltasGoods Credits" : PAYMENT_METHOD[r.method]}
                      </p>
                      <p className="text-xs text-ink-500">{when(r.initiatedAt)}</p>
                    </div>
                    <StatusBadge meta={REFUND_STATUS[r.status]} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
