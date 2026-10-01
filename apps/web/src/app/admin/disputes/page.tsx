import Link from "next/link";
import { Video } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { CHARGEBACK_STATUS, GUARANTEE_STATUS, SAFECLAIM_STATUS } from "@/components/admin/admin-status";
import { Mono, SlaText } from "@/components/admin/bits";
import { ageLabel, minutesUntil, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { sellers } from "@/lib/mock";
import { chargebacks, guaranteeClaims, safeClaims } from "@/lib/mock/admin-extra";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Disputes and claims" };

const sellerName = (id: string) => sellers.find((s) => s.id === id)?.displayName ?? id;
const OPEN_G = ["submitted", "awaiting_seller", "under_review", "appealed"];
const OPEN_S = ["submitted", "under_review", "info_requested", "appealed"];

export default async function DisputesPage(props: PageProps<"/admin/disputes">) {
  const params = await props.searchParams;
  const tab = (["guarantee", "safeclaim", "chargebacks"] as const).find((t) => t === sp(params, "tab")) ?? "guarantee";
  const openG = guaranteeClaims.filter((c) => OPEN_G.includes(c.status));
  const openS = safeClaims.filter((c) => OPEN_S.includes(c.status));
  const due24 = openG.filter((c) => minutesUntil(c.status === "awaiting_seller" ? c.sellerRespondBy : c.decideBy) < 24 * 60).length;
  const granted = guaranteeClaims.filter((c) => c.status === "granted");
  const grantedAmt = granted.reduce((a, c) => a + c.amount, 0);
  const blubuyShare = granted.length ? (granted.filter((c) => c.fundedBy === "blubuy").reduce((a, c) => a + c.amount, 0) / grantedAmt) * 100 : 0;

  return (
    <>
      <PageHeader title="Disputes and claims" description="BluBuy Guarantee claims from customers, SafeClaim reimbursements for sellers, and card chargebacks. Sellers get 72 hours to respond; BluBuy decides within 7 days." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Guarantee claims open", value: openG.length, hint: `${openG.filter((c) => c.status === "awaiting_seller").length} awaiting seller` },
          { label: "Due within 24 h", value: due24, hint: "response or decision" },
          { label: "SafeClaims open", value: openS.length, hint: "7 business day decision" },
          { label: "Granted, 30 days", value: formatINR(grantedAmt), hint: `${granted.length} claims` },
          { label: "BluBuy funded", value: `${blubuyShare.toFixed(0)}%`, hint: "logistics or FC caused" },
        ]}
      />

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "guarantee", label: "BluBuy Guarantee", count: openG.length, href: "/admin/disputes" },
          { key: "safeclaim", label: "BluBuy SafeClaim", count: openS.length, href: "/admin/disputes?tab=safeclaim" },
          { key: "chargebacks", label: "Chargebacks", count: chargebacks.filter((c) => c.status === "open").length, href: "/admin/disputes?tab=chargebacks" },
        ]}
      />

      {tab === "guarantee" && (
        <Card>
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Claim</TH>
                  <TH className="hidden md:table-cell">Reason</TH>
                  <TH className="hidden lg:table-cell">Seller</TH>
                  <TH align="right">Amount</TH>
                  <TH className="hidden sm:table-cell">Deadline</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {guaranteeClaims.map((c) => {
                  const open = OPEN_G.includes(c.status);
                  return (
                    <TR key={c.id}>
                      <TD>
                        <div className="flex max-w-[260px] items-center gap-3">
                          <ProductImage src={c.image} alt="" size={36} rounded="md" />
                          <div className="min-w-0">
                            <Mono className="font-medium">{c.id}</Mono>
                            <p className="truncate text-xs text-ink-500">
                              {c.customerName},{" "}
                              <Link href={`/admin/orders/${c.orderId}`} className="font-mono hover:text-brand-700">
                                {c.orderId}
                              </Link>
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD className="hidden max-w-[220px] whitespace-normal md:table-cell">
                        <p className="text-[13px] text-ink-800">{c.reason}</p>
                        <p className="text-xs text-ink-500">Filed {ageLabel(c.filedAt)} ago</p>
                      </TD>
                      <TD className="hidden max-w-[220px] whitespace-normal lg:table-cell">
                        <Link href={`/admin/sellers/${c.sellerId}`} className="text-[13px] text-ink-800 hover:text-brand-700">
                          {sellerName(c.sellerId)}
                        </Link>
                        <p className="text-xs text-ink-500">{c.sellerResponse ?? "No response yet"}</p>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatINR(c.amount)}
                      </TD>
                      <TD className="hidden sm:table-cell">
                        {open ? (
                          <>
                            <SlaText dueAt={c.status === "awaiting_seller" ? c.sellerRespondBy : c.decideBy} warnWithinMins={24 * 60} />
                            <p className="text-xs text-ink-500">{c.status === "awaiting_seller" ? "Seller response" : "BluBuy decision"}</p>
                          </>
                        ) : (
                          <span className="text-[13px] text-ink-500">{c.fundedBy ? (c.fundedBy === "blubuy" ? "BluBuy funded" : "Seller funded") : "Closed"}</span>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge meta={GUARANTEE_STATUS[c.status]} size="sm" />
                      </TD>
                      <TD align="right">
                        {open && (
                          <ActionButton
                            label="Decide"
                            size="xs"
                            title={`Decide ${c.id}`}
                            description="Seller-funded grants count toward the seller's order defect rate; logistics-caused claims are BluBuy funded and do not."
                            summary={[
                              { label: "Customer", value: c.customerName },
                              { label: "Amount", value: formatINR(c.amount) },
                              { label: "Reason", value: c.reason },
                              { label: "Seller response", value: c.sellerResponse ?? "None yet" },
                              { label: "Evidence", value: c.evidence.join(", ") },
                              { label: "Order", value: c.orderId },
                            ]}
                            fields={[{ name: "decision", label: "Decision", type: "select", options: ["Grant, seller funded", "Grant, BluBuy funded", "Deny", "Request more information"] }]}
                            note="required"
                            confirmLabel="Record decision"
                            toast="Decision recorded; customer and seller notified"
                            doneLabel="Decided"
                          />
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === "safeclaim" && (
        <Card>
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Claim</TH>
                  <TH className="hidden md:table-cell">Grade</TH>
                  <TH className="hidden lg:table-cell">Evidence</TH>
                  <TH align="right">Claimed</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Approved
                  </TH>
                  <TH className="hidden sm:table-cell">Decision due</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {safeClaims.map((c) => {
                  const open = OPEN_S.includes(c.status);
                  const weightGap = c.evidence.receivedWeight !== undefined && c.evidence.dispatchWeight ? Math.round((1 - c.evidence.receivedWeight / c.evidence.dispatchWeight) * 100) : 0;
                  return (
                    <TR key={c.id}>
                      <TD>
                        <div className="flex max-w-[280px] items-center gap-3">
                          <ProductImage src={c.image} alt="" size={36} rounded="md" />
                          <div className="min-w-0">
                            <Mono className="font-medium">{c.id}</Mono>
                            <p className="truncate text-xs text-ink-500">
                              {sellerName(c.sellerId)}, {c.referenceType} <span className="font-mono">{c.reference}</span>
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD className="hidden text-[13px] md:table-cell">{c.grade}</TD>
                      <TD className="hidden lg:table-cell">
                        <p className="flex items-center gap-1.5 text-[13px] text-ink-700">
                          {c.evidence.photos} photos
                          {c.evidence.unboxingVideo && (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                              <Video size={13} aria-hidden="true" />
                              video
                            </span>
                          )}
                        </p>
                        <p className={weightGap > 30 ? "text-xs font-medium text-danger-700" : "text-xs text-ink-500"}>
                          {c.evidence.dispatchWeight} kg sent, {c.evidence.receivedWeight} kg back
                        </p>
                      </TD>
                      <TD align="right" className="font-medium text-ink-900">
                        {formatINR(c.claimed)}
                      </TD>
                      <TD align="right" className="hidden sm:table-cell">
                        {c.approved !== undefined ? formatINR(c.approved) : <span className="text-ink-400">Pending</span>}
                      </TD>
                      <TD className="hidden sm:table-cell">{open ? <SlaText dueAt={c.decideBy} warnWithinMins={48 * 60} /> : <span className="text-[13px] text-ink-500">{c.status === "reimbursed" ? "Paid in payout" : "Closed"}</span>}</TD>
                      <TD>
                        <StatusBadge meta={SAFECLAIM_STATUS[c.status]} size="sm" />
                      </TD>
                      <TD align="right">
                        {open && (
                          <ActionButton
                            label="Decide"
                            size="xs"
                            title={`Decide ${c.id}`}
                            description="Approved amounts are added to the seller's next payout as a SafeClaim reimbursement line. Unboxing video is mandatory above ₹5,000."
                            summary={[
                              { label: "Seller", value: sellerName(c.sellerId) },
                              { label: "Grade", value: c.grade },
                              { label: "Claimed", value: formatINR(c.claimed) },
                              { label: "Evidence", value: `${c.evidence.photos} photos${c.evidence.unboxingVideo ? ", unboxing video" : ", no video"}` },
                              { label: "Weights", value: `${c.evidence.dispatchWeight} kg sent, ${c.evidence.receivedWeight} kg back` },
                              { label: "Reference", value: c.reference },
                            ]}
                            fields={[
                              { name: "decision", label: "Decision", type: "select", options: ["Approve in full", "Approve partially", "Reject", "Request more information"] },
                              { name: "amount", label: "Approved amount (₹)", type: "number", defaultValue: String(c.claimed) },
                            ]}
                            warning={c.claimed > 5000 && !c.evidence.unboxingVideo ? "No unboxing video for an item above ₹5,000." : undefined}
                            note="required"
                            confirmLabel="Record decision"
                            toast="SafeClaim decision recorded"
                            doneLabel="Decided"
                          />
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === "chargebacks" && (
        <Card>
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Dispute</TH>
                  <TH className="hidden md:table-cell">Reason</TH>
                  <TH align="right">Amount</TH>
                  <TH className="hidden sm:table-cell">Respond by</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {chargebacks.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Mono className="font-medium">{c.id}</Mono>
                      <p className="text-xs text-ink-500">
                        {c.network},{" "}
                        <Link href={`/admin/orders/${c.orderId}`} className="font-mono hover:text-brand-700">
                          {c.orderId}
                        </Link>
                      </p>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">{c.reasonCode}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(c.amount)}
                    </TD>
                    <TD className="hidden sm:table-cell">{c.status === "open" ? <SlaText dueAt={c.respondBy} warnWithinMins={72 * 60} /> : <span className="text-[13px] text-ink-500">Closed</span>}</TD>
                    <TD>
                      <StatusBadge meta={CHARGEBACK_STATUS[c.status]} size="sm" />
                    </TD>
                    <TD align="right">
                      {c.status === "open" && (
                        <div className="flex justify-end gap-1.5">
                          <ActionButton label="Represent" icon="send" size="xs" title="Represent with evidence" description="Sends proof of delivery, OTP log, invoice and customer communication to the payment aggregator." fields={[{ name: "pack", label: "Evidence pack", type: "select", options: ["Proof of delivery with OTP", "Invoice and tracking history", "Customer chat transcript"] }]} note="optional" toast="Representment submitted" doneLabel="Submitted" />
                          <ActionButton label="Accept" size="xs" variant="ghost" title="Accept chargeback" description="The amount is debited from escrow and recovered from the seller if the seller is at fault." reasons={["Evidence insufficient", "Amount below representment threshold", "Seller at fault"]} note="optional" toast="Chargeback accepted" doneLabel="Accepted" />
                        </div>
                      )}
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
