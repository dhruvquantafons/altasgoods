import Link from "next/link";
import Form from "next/form";
import { PackageSearch, Search } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { NewTicketButton } from "@/components/support/new-ticket";
import { formatDay, formatRelativeDay, KeyRow, maskPhone, minsUntil, Mono, one, qs } from "@/components/logistics/ops-ui";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { customers, orders, sellerName, shipments } from "@/lib/mock";
import { shipmentForOrder } from "@/lib/mock/ops-extra";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, SHIPMENT_STATUS, type OrderStatus } from "@/lib/status";
import type { Order } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Order lookup" };

const PRE_SHIP: OrderStatus[] = ["pending_payment", "placed", "confirmed", "packed", "ready_to_ship"];
const MOVING: OrderStatus[] = ["shipped", "in_transit", "out_for_delivery"];

function late(o: Order) {
  return [...PRE_SHIP, ...MOVING, "undelivered"].includes(o.status) && minsUntil(o.promisedBy) < 0;
}

type Category = "Delivery" | "Return and refund" | "Payment" | "Product quality" | "Account" | "Seller dispute" | "Other";

/** Order actions an agent can raise; each opens a ticket for the team that carries it out. */
function actionsFor(o: Order): { label: string; subject: string; category: Category; body: string; primary?: boolean }[] {
  const list: { label: string; subject: string; category: Category; body: string; primary?: boolean }[] = [];
  if (PRE_SHIP.includes(o.status))
    list.push({ label: "Cancel on behalf", subject: `Cancel order ${o.id}`, category: "Other", body: `Customer asked to cancel ${o.id} before dispatch. Full refund to ${PAYMENT_METHOD[o.payment.method]}.`, primary: true });
  if (MOVING.includes(o.status)) list.push({ label: "Reschedule delivery", subject: `Reschedule delivery of ${o.id}`, category: "Delivery", body: `Customer asked to reschedule the delivery of ${o.id}.`, primary: true });
  if (o.status === "undelivered") list.push({ label: "Schedule re-attempt", subject: `Re-attempt delivery of ${o.id}`, category: "Delivery", body: `Delivery attempt failed for ${o.id}. Customer wants a re-attempt.`, primary: true });
  if (late(o)) list.push({ label: "Raise logistics investigation", subject: `Delay investigation for ${o.id}`, category: "Delivery", body: `${o.id} is past its promised date. Investigate with the delivery hub.` });
  if (o.status === "delivered") {
    list.push({ label: "Initiate return", subject: `Return for ${o.id}`, category: "Return and refund", body: `Customer wants to return items from ${o.id}.`, primary: true });
    list.push({ label: "Not received claim", subject: `Not received: ${o.id}`, category: "Delivery", body: `Marked delivered but the customer says ${o.id} was not received.` });
  }
  list.push({ label: "Create ticket", subject: `Order ${o.id}`, category: "Other", body: "" });
  return list;
}

const ATTENTION = [
  { key: "all", label: "Needs attention", match: (o: Order) => late(o) || o.status === "undelivered" || o.status === "return_requested" || o.status === "pending_payment" },
  { key: "late", label: "Past promise", match: late },
  { key: "failed", label: "Delivery failed", match: (o: Order) => o.status === "undelivered" || o.status === "rto_in_transit" },
  { key: "returns", label: "Return requested", match: (o: Order) => o.status === "return_requested" },
];

export default async function OrderLookupPage(props: PageProps<"/support/orders">) {
  const sp = await props.searchParams;
  const raw = (one(sp.q) ?? "").trim();
  const q = raw.toLowerCase();
  const view = ATTENTION.find((v) => v.key === one(sp.view)) ?? ATTENTION[0]!;

  let results: Order[] = [];
  let matchedBy = "";
  if (q) {
    const byId = orders.filter((o) => o.id.toLowerCase().includes(q));
    const awb = shipments.find((s) => s.id.toLowerCase() === q);
    const digits = q.replace(/\D/g, "");
    const byPhone = digits.length >= 6 && !q.startsWith("bb") && !q.startsWith("bbl") ? customers.filter((c) => c.phone.replace(/\D/g, "").endsWith(digits.slice(-10))).flatMap((c) => orders.filter((o) => o.customerId === c.id)) : [];
    if (awb) {
      results = orders.filter((o) => o.id === awb.orderId);
      matchedBy = `AWB ${awb.id}`;
    } else if (byId.length) {
      results = byId;
      matchedBy = "order ID";
    } else if (byPhone.length) {
      results = byPhone;
      matchedBy = "registered phone";
    }
  }
  const attention = orders.filter(view.match).slice(0, 14);

  return (
    <>
      <PageHeader title="Order lookup" description="Find any order by order ID, the customer's phone number or a shipment AWB, then act on it." />

      <Card className="mb-6">
        <Form action="/support/orders" className="flex flex-col gap-3 p-5 sm:flex-row">
          <Input name="q" defaultValue={raw} icon={Search} inputSize="lg" placeholder="BB-261001-10148, 98XXXXXX21 or BBL5562398579" aria-label="Order ID, phone or AWB" className="flex-1" />
          <Button type="submit" size="lg">
            Find order
          </Button>
        </Form>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Phone search matches the last 10 digits of the registered mobile number. Results show masked contact details.</p>
      </Card>

      {q ? (
        results.length === 0 ? (
          <Card>
            <EmptyState icon={PackageSearch} title="No order found" description={`Nothing matches "${raw}". Check the order ID format (BB-YYMMDD-NNNNN) or try the AWB from the SMS.`} />
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-[13px] text-ink-500">
              {results.length} order{results.length === 1 ? "" : "s"} matched by {matchedBy}
              {results.length > 5 && ", showing the 5 most recent"}.
            </p>
            {results.slice(0, 5).map((o) => {
              const c = customers.find((x) => x.id === o.customerId);
              const s = shipmentForOrder(o.id);
              return (
                <Card key={o.id}>
                  <CardHeader
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        <Mono className="text-[15px] font-semibold text-ink-900">{o.id}</Mono>
                        <StatusBadge meta={ORDER_STATUS[o.status]} />
                        {late(o) && <Badge tone="danger">Past promise</Badge>}
                      </span>
                    }
                    description={`Placed ${formatDate(o.placedAt)} on ${o.channel === "web" ? "web" : o.channel === "ios" ? "iOS" : "Android"}, promised by ${formatDay(o.promisedBy)}`}
                  />
                  <div className="grid gap-6 px-5 pt-4 pb-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <ul className="flex flex-col gap-3">
                      {o.items.map((it) => (
                        <li key={it.id} className="flex gap-3">
                          <ProductImage src={it.image} alt="" size={48} rounded="md" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-medium text-ink-900">{it.title}</p>
                            <p className="mt-0.5 text-xs text-ink-500">
                              {it.quantity} x {formatINR(it.price)}, sold by {sellerName(it.sellerId)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <dl className="divide-y divide-line rounded-xl border border-line px-4 py-1">
                      <KeyRow label="Customer">
                        {c ? (
                          <Link href={`/support/customers/${c.id}`} className="text-brand-700 hover:underline">
                            {o.customerName}
                          </Link>
                        ) : (
                          o.customerName
                        )}
                      </KeyRow>
                      <KeyRow label="Phone">
                        <Mono>{maskPhone(o.address.phone)}</Mono>
                      </KeyRow>
                      <KeyRow label="Deliver to">
                        {o.address.city} <Mono className="text-xs text-ink-500">{o.address.pincode}</Mono>
                      </KeyRow>
                      <KeyRow label="Payment">
                        <span className="flex flex-col items-end gap-1">
                          {PAYMENT_METHOD[o.payment.method]}, {formatINR(o.total)}
                          <StatusBadge meta={PAYMENT_STATUS[o.payment.status]} size="sm" />
                        </span>
                      </KeyRow>
                      {s && (
                        <KeyRow label="Shipment">
                          <span className="flex flex-col items-end gap-1">
                            <Link href={`/logistics/shipments/${s.id}`} className="font-mono text-[13px] text-brand-700 hover:underline">
                              {s.id}
                            </Link>
                            <StatusBadge meta={SHIPMENT_STATUS[s.status]} size="sm" />
                          </span>
                        </KeyRow>
                      )}
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
                    <span className="mr-1 text-xs font-medium text-ink-500">Quick actions</span>
                    {actionsFor(o).map((a, i) => (
                      <NewTicketButton
                        key={a.label}
                        label={a.label}
                        size="sm"
                        variant={a.primary && i === 0 ? "primary" : "secondary"}
                        customerName={o.customerName}
                        customerRef={o.customerId}
                        orderId={o.id}
                        orderSnapshot={{
                          total: o.total,
                          paymentLabel: PAYMENT_METHOD[o.payment.method],
                          cod: o.payment.method === "cod",
                          seller: sellerName(o.items[0]!.sellerId),
                          items: o.items.map((it) => ({ id: it.id, title: it.title, price: it.price, quantity: it.quantity })),
                        }}
                        defaultSubject={a.subject}
                        defaultCategory={a.category}
                        defaultBody={a.body}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title="Orders that may need a call" description="Delayed, failed or waiting on the customer. Open one to act." />
          <div className="mt-3 px-5">
            <TabLinks
              variant="pill"
              active={view.key}
              items={ATTENTION.map((v) => ({ key: v.key, label: v.label, href: `/support/orders${qs({ view: v.key === "all" ? undefined : v.key })}`, count: orders.filter(v.match).length }))}
            />
          </div>
          <TableContainer className="mt-4">
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH>Promised</TH>
                  <TH align="right">Total</TH>
                  <TH>
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {attention.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/support/orders?q=${o.id}`} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {o.id}
                      </Link>
                      <p className="max-w-64 truncate text-xs text-ink-500">{o.items[0]!.title}</p>
                    </TD>
                    <TD>
                      <p className="text-[13px] text-ink-900">{o.customerName}</p>
                      <p className="text-xs text-ink-500">{o.address.city}</p>
                    </TD>
                    <TD>
                      <StatusBadge meta={ORDER_STATUS[o.status]} size="sm" />
                    </TD>
                    <TD className={cn("text-[13px]", late(o) ? "font-medium text-danger-700" : "text-ink-600")}>
                      {formatRelativeDay(o.promisedBy)}
                      {late(o) && " (late)"}
                    </TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(o.total)}
                    </TD>
                    <TD align="right">
                      <Link href={`/support/orders?q=${o.id}`} className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
                        Open
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}
