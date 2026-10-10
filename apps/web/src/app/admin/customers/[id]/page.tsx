import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, MapPin, Smartphone } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { CUSTOMER_STATUS, riskTone } from "@/components/admin/admin-status";
import { ScoreMeter, SummaryRow } from "@/components/admin/bits";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { MaskedValue } from "@/components/admin/masked-value";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { tickets } from "@/lib/api/support";
import { customers, orders, returns } from "@/lib/mock";
import { customerProfile, maskEmail, maskPhone } from "@/lib/mock/admin-extra";
import { ORDER_STATUS, PAYMENT_METHOD, TICKET_STATUS } from "@/lib/status";
import { cn, formatDate, formatDateTime, formatINR, formatNumber, timeAgo } from "@/lib/utils";
import { Inbox } from "lucide-react";


export async function generateMetadata(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  return { title: customers.find((c) => c.id === id)?.name ?? "Customer" };
}

export default async function CustomerDetail(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const c = customers.find((x) => x.id === id);
  if (!c) notFound();

  const p = customerProfile(c.id);
  const myOrders = orders.filter((o) => o.customerId === c.id);
  const myReturns = returns.filter((r) => myOrders.some((o) => o.id === r.orderId));
  const myTickets = (await tickets({ customerRef: c.id })).tickets;
  const addresses = [...new Map(myOrders.map((o) => [`${o.address.line1}-${o.address.pincode}`, o.address])).values()].slice(0, 3);
  const orderCount = Math.max(c.orders, myOrders.length);
  const ltv = Math.max(c.lifetimeValue, myOrders.reduce((a, o) => a + o.total, 0));
  const aov = orderCount ? ltv / orderCount : 0;

  const signals = [
    { label: "COD refusals, 90 days", value: p.codRefusals90d, bad: p.codRefusals90d >= 2, rule: "2 or more disables COD (RR-02)" },
    { label: "Return rate, 90 days", value: `${p.returnRate}%`, bad: p.returnRate > 40 && p.returns90d >= 5, rule: "Over 40% with 5 returns triggers review (RR-04)" },
    { label: "Returns, 90 days", value: p.returns90d, bad: p.returns90d >= 5, rule: "Customer-fault reasons only" },
    { label: "Linked accounts", value: p.linkedAccounts, bad: p.linkedAccounts >= 2, rule: "Shared device, address or payment instrument" },
    { label: "Devices, 30 days", value: p.devices, bad: p.devices >= 4, rule: "Logins from distinct devices" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: c.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} size="md" />
            {c.name}
          </span>
        }
        meta={
          <>
            <StatusBadge meta={CUSTOMER_STATUS[c.status]} />
            <span className="font-mono text-[13px] text-ink-500">{c.id}</span>
            <span className="text-[13px] text-ink-500">
              {c.city}, {c.state}. Customer since {formatDate(c.joinedAt)}
            </span>
          </>
        }
        actions={
          <>
            <ActionButton
              label="Goodwill credit"
              icon="wallet"
              title="Issue goodwill AltasGoods Credits"
              description="Goodwill credits expire after 1 year. Amounts above ₹2,000 need supervisor approval."
              fields={[{ name: "amount", label: "Amount (₹)", type: "number", defaultValue: "200" }]}
              reasons={["Late delivery", "Service recovery after a complaint", "Damaged packaging", "Price drop within 7 days"]}
              note="optional"
              toast="Goodwill credit issued to AltasGoods Credits"
              confirmLabel="Issue credit"
            />
            {c.status !== "flagged" && (
              <ActionButton label="Flag" icon="flag" title={`Flag ${c.name}`} description="Flagged accounts lose refund at pickup and get manual review on returns." reasons={["Return abuse pattern", "COD refusals", "Coupon abuse across accounts", "Payment fraud signal", "Chargeback history"]} note="required" toast="Account flagged for Risk review" doneLabel="Flagged" />
            )}
            {c.status !== "blocked" && (
              <ActionButton
                label="Block"
                icon="lock"
                variant="danger"
                danger
                title={`Block ${c.name}`}
                description="Blocked customers cannot sign in or place orders. Open orders are not cancelled automatically."
                reasons={["Confirmed fraud", "Abusive behaviour towards associates", "Account takeover suspected", "Legal or law enforcement request"]}
                fields={[{ name: "expiry", label: "Block until", type: "select", options: ["Permanent", "30 days", "90 days", "180 days"] }]}
                warning="This is logged with your name, role and IP address. The customer is notified with the grievance officer contact."
                note="required"
                toast="Customer blocked"
                doneLabel="Blocked"
              />
            )}
          </>
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Lifetime value", value: formatINR(ltv) },
          { label: "Orders", value: formatNumber(orderCount) },
          { label: "Average order value", value: formatINR(aov) },
          { label: "Return rate", value: `${p.returnRate}%`, hint: "90 days" },
          { label: "AltasGoods Credits", value: formatINR(p.creditsBalance), hint: "refund-origin, never expire" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Orders" description={`${myOrders.length} orders in the last 6 weeks`} />
            {myOrders.length === 0 ? (
              <EmptyState icon={Inbox} title="No recent orders" description="Older orders are in the order archive." className="py-10" />
            ) : (
              <TableContainer className="mt-3">
                <Table>
                  <THead>
                    <TR>
                      <TH>Order</TH>
                      <TH className="hidden md:table-cell">Items</TH>
                      <TH className="hidden sm:table-cell">Payment</TH>
                      <TH align="right">Total</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {myOrders.slice(0, 8).map((o) => (
                      <TR key={o.id}>
                        <TD>
                          <span className="font-mono text-[13px] font-medium text-brand-700">
                            {o.id}
                          </span>
                          <p className="text-xs text-ink-500">{formatDateTime(o.placedAt)}</p>
                        </TD>
                        <TD className="hidden max-w-[240px] md:table-cell">
                          <p className="truncate text-[13px] text-ink-800">{o.items[0]!.title}</p>
                          {o.items.length > 1 && <p className="text-xs text-ink-500">+{o.items.length - 1} more</p>}
                        </TD>
                        <TD className="hidden text-[13px] sm:table-cell">{PAYMENT_METHOD[o.payment.method]}</TD>
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
            <CardHeader title="Support tickets" description="From AltasGoods Care Desk" />
            {myTickets.length === 0 && myReturns.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No tickets or returns in the last 90 days.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {myTickets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900">{t.subject}</p>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{t.id}</span>, {t.category}, {timeAgo(t.createdAt)}
                      </p>
                    </div>
                    <StatusBadge meta={TICKET_STATUS[t.status]} size="sm" />
                  </li>
                ))}
                {myReturns.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900">Return: {r.reason}</p>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{r.id}</span>, {formatINR(r.amount)}, {timeAgo(r.requestedAt)}
                      </p>
                    </div>
                    <Link href="/admin/returns?view=all" className="text-[13px] font-medium text-brand-700 hover:underline">
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Addresses" description="Saved and recently used delivery addresses" />
            <div className="grid gap-3 px-5 pt-3 pb-5 sm:grid-cols-2">
              {(addresses.length ? addresses : [{ id: "none", line1: "No saved addresses", city: c.city, state: c.state, pincode: "", name: c.name, phone: c.phone, type: "home" as const }]).map((a, i) => (
                <div key={`${a.line1}-${i}`} className="rounded-xl border border-line p-4 text-[13px]">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                    {i === 0 ? <Home size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
                    {i === 0 ? "Default" : "Used recently"}
                  </p>
                  <p className="font-medium text-ink-900">{a.name}</p>
                  <p className="text-ink-700">{a.line1}</p>
                  <p className="text-ink-700">
                    {a.city}, {a.state} {a.pincode}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Profile" />
            <dl className="flex flex-col gap-2.5 px-5 pt-3 pb-5">
              <SummaryRow label="Email" value={<MaskedValue masked={maskEmail(c.email)} full={c.email} />} />
              <SummaryRow label="Phone" value={<MaskedValue masked={maskPhone(c.phone)} full={c.phone} />} />
              <SummaryRow label="Last sign in" value={timeAgo(p.lastLogin)} />
              <SummaryRow
                label="Devices, 30 days"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Smartphone size={13} className="text-ink-400" aria-hidden="true" />
                    {p.devices}
                  </span>
                }
              />
              <SummaryRow label="Cash on delivery" value={p.codEnabled ? "Allowed" : "Disabled by risk rule"} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Risk" description="Signals from the risk engine, spec 10.14" />
            <div className="px-5 pt-3 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink-600">Risk score</span>
                <ScoreMeter value={c.riskScore} tone={riskTone(c.riskScore)} label="Customer risk score" />
              </div>
              <ul className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                {signals.map((s) => (
                  <li key={s.label} className="text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-700">{s.label}</span>
                      <span className={cn("font-semibold tabular-nums", s.bad ? "text-danger-700" : "text-ink-900")}>
                        {s.value}
                        {s.bad && <span className="ml-1.5 text-xs font-medium">Above threshold</span>}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500">{s.rule}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
