import { notFound } from "next/navigation";
import { ArrowRight, CircleCheck, CircleX, ClipboardCheck } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { HEALTH_BAND, healthBand, KYC_DOC_STATUS, KYC_STATUS, TIER_TONE, VIOLATION_STATUS } from "@/components/admin/admin-status";
import { Mono, SummaryRow } from "@/components/admin/bits";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { MaskedValue } from "@/components/admin/masked-value";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionList, Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { categories, getSeller, productsBySeller, sellers } from "@/lib/mock";
import { adminSettlements, auditEntries, bsinFor, kycApplications, maskEmail, maskPhone, payoutHolds, sellerKycDocs, sellerViolations } from "@/lib/mock/admin-extra";
import { LISTING_STATUS, SELLER_STATUS, SETTLEMENT_STATUS } from "@/lib/status";
import { cn, formatCompact, formatDate, formatDateShort, formatINR, formatNumber, timeAgo } from "@/lib/utils";

export function generateStaticParams() {
  return sellers.map((s) => ({ id: s.id }));
}

export async function generateMetadata(props: PageProps<"/admin/sellers/[id]">) {
  const { id } = await props.params;
  return { title: getSeller(id)?.displayName ?? "Seller" };
}

const ONBOARDING = ["registration_started", "documents_submitted", "under_review", "action_required"];
const FULFILMENT: Record<string, string> = { blubuy_fulfilled: "AltasGoods Fulfilled", easy_ship: "AltasGoods Ship", self_ship: "Self Ship" };

export default async function SellerDetail(props: PageProps<"/admin/sellers/[id]">) {
  const { id } = await props.params;
  const s = getSeller(id);
  if (!s) notFound();

  const onboarding = ONBOARDING.includes(s.status);
  const application = kycApplications.find((k) => k.sellerId === s.id);
  const listings = productsBySeller(s.id);
  const settlements = adminSettlements.filter((x) => x.sellerId === s.id);
  const violations = sellerViolations.filter((v) => v.sellerId === s.id);
  const holds = payoutHolds.filter((h) => h.sellerId === s.id);
  const audit = auditEntries.filter((a) => a.target === s.id).slice(0, 4);
  const h = s.health;
  const band = healthBand(h.score);
  const cats = s.categories.map((c) => categories.find((x) => x.id === c)?.name ?? c);

  const metrics = [
    { label: "Order defect rate", value: h.odr, target: 1, lower: true, window: "60 days" },
    { label: "Pre-fulfilment cancel rate", value: h.cancellationRate, target: 2.5, lower: true, window: "30 days" },
    { label: "Late dispatch rate", value: h.lateDispatchRate, target: 4, lower: true, window: "30 days" },
    { label: "Valid tracking rate", value: h.validTrackingRate, target: 95, lower: false, window: "30 days" },
    { label: "Return rate, category benchmark", value: h.returnRate, target: 10, lower: true, window: "90 days" },
  ];

  const tierOptions = ["Platinum", "Gold", "Silver", "Bronze"].filter((t) => t !== s.tier);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Sellers", href: "/admin/sellers" }, { label: s.displayName }]}
        title={s.displayName}
        meta={
          <>
            <StatusBadge meta={SELLER_STATUS[s.status]} />
            <Badge tone={TIER_TONE[s.tier]}>{`${s.tier} tier`}</Badge>
            <span className="text-[13px] text-ink-500">
              {s.legalName}. Joined {formatDate(s.joinedAt)}
            </span>
          </>
        }
        actions={
          onboarding ? (
            <ButtonLink href="/admin/sellers/approvals" size="sm" icon={ClipboardCheck}>
              Open KYC review
            </ButtonLink>
          ) : (
            <>
              <ActionButton
                label="Change tier"
                icon="user"
                title="Override seller tier"
                description="Tier overrides last until the next quarterly evaluation. Benefits and fees change from the next order."
                fields={[{ name: "tier", label: "New tier", type: "select", options: tierOptions }]}
                reasons={["Strategic seller programme", "Correction after metric dispute", "Health band demotion", "Account manager request"]}
                note="required"
                toast="Tier override saved"
              />
              <ActionButton
                label={holds.length ? "Release hold" : "Hold payouts"}
                icon={holds.length ? "unlock" : "pause"}
                title={holds.length ? "Release payout hold" : "Place a payout hold"}
                description={holds.length ? "Held settlement lines become eligible for the next payout run." : "Eligible lines move to On hold until released (spec 11.10)."}
                reasons={holds.length ? ["Condition met", "Appeal accepted", "Hold placed in error"] : ["Account health below threshold", "Risk investigation", "KYC lapse", "Reserve for open claims"]}
                note="required"
                toast={holds.length ? "Payout hold released" : "Payouts placed on hold"}
                doneLabel={holds.length ? "Released" : "On hold"}
              />
              {s.status !== "suspended" && (
                <ActionButton
                  label="Suspend"
                  icon="ban"
                  variant="danger"
                  danger
                  title={`Suspend ${s.displayName}`}
                  description="Listings move to Paused and payouts may be held. The seller is notified with the reason and appeal path."
                  reasons={["Seller Health critical", "Counterfeit or IP violation", "Review manipulation", "Fake orders", "KYC lapse (GSTIN cancelled)"]}
                  warning="Consequence ladder: warning, listing action, feature restriction, payout hold, suspension. Confirm earlier steps were tried or are not appropriate."
                  note="required"
                  toast="Seller suspended and notified"
                  doneLabel="Suspended"
                />
              )}
            </>
          )
        }
      />

      {onboarding ? (
        <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">This seller is still onboarding</p>
            <p className="mt-0.5 text-[13px] text-ink-600">
              {application ? `Application ${application.id} is ${KYC_STATUS[application.status].label.toLowerCase()}.` : "Application not submitted yet."} Listings go live after KYC approval, the first listing passes QC and the pickup address is verified.
            </p>
          </div>
          {application && <StatusBadge meta={KYC_STATUS[application.status]} />}
        </div>
      ) : (
        <KpiStrip
          className="mb-6"
          items={[
            { label: "GMV, 30 days", value: formatCompact(s.gmv30d, true) },
            { label: "Orders, 30 days", value: formatNumber(s.orders30d) },
            { label: "Live listings", value: formatNumber(s.liveListings) },
            { label: "Seller rating", value: s.rating.toFixed(1), hint: `${formatCompact(s.ratingCount)} ratings` },
            { label: "Seller Health", value: h.score, hint: HEALTH_BAND[band].label },
          ]}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {!onboarding && (
            <Card>
              <CardHeader title="Seller Health" description="Score 0 to 1000 with metric targets from spec 10.6" action={<StatusBadge meta={HEALTH_BAND[band]} />} />
              <div className="grid gap-6 px-5 pt-4 pb-5 md:grid-cols-[200px_1fr]">
                <div>
                  <p className="text-[40px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{h.score}</p>
                  <p className="mt-1 text-[13px] text-ink-500">of 1000</p>
                  <Progress value={h.score} max={1000} tone={HEALTH_BAND[band].tone} className="mt-3" label="Seller Health score" />
                  <p className="mt-3 text-xs text-ink-500">
                    {h.policyViolations} open policy {h.policyViolations === 1 ? "violation" : "violations"}. Recovers 10 points a week when every metric is within target.
                  </p>
                </div>
                <ul className="flex flex-col divide-y divide-line">
                  {metrics.map((m) => {
                    const ok = m.lower ? m.value < m.target : m.value > m.target;
                    return (
                      <li key={m.label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] first:pt-0">
                        <span>
                          <span className="block text-ink-800">{m.label}</span>
                          <span className="text-xs text-ink-500">
                            Target {m.lower ? "under" : "over"} {m.target}%, {m.window}
                          </span>
                        </span>
                        <span className={cn("flex items-center gap-1.5 font-semibold tabular-nums", ok ? "text-ink-900" : "text-danger-700")}>
                          {m.value.toFixed(2)}%
                          {ok ? <CircleCheck size={15} className="text-success-600" aria-label="On target" /> : <CircleX size={15} className="text-danger-600" aria-label="Off target" />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Listings" description={onboarding ? "No listings are live until onboarding completes" : `${formatNumber(s.liveListings)} live listings; top offers shown`} />
            {listings.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No offers yet.</p>
            ) : (
              <TableContainer className="mt-3">
                <Table>
                  <THead>
                    <TR>
                      <TH>Listing</TH>
                      <TH className="hidden md:table-cell">BSIN</TH>
                      <TH align="right">Price</TH>
                      <TH align="right" className="hidden sm:table-cell">
                        Stock
                      </TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {listings.slice(0, 8).map((p) => {
                      const offer = p.offers.find((o) => o.sellerId === s.id)!;
                      const status = offer.stock === 0 ? "out_of_stock" : p.listingStatus === "out_of_stock" ? "live" : p.listingStatus;
                      return (
                        <TR key={p.id}>
                          <TD>
                            <div className="flex max-w-[320px] items-center gap-3">
                              <ProductImage src={p.image} alt="" size={36} rounded="md" />
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] text-ink-800">{p.title}</span>
                                <span className="text-xs text-ink-500">
                                  {offer.fulfilledBy === "blubuy" ? "AltasGoods Fulfilled" : "Seller fulfilled"}
                                  {p.featuredSellerId === s.id ? ", featured offer" : ""}
                                </span>
                              </span>
                            </div>
                          </TD>
                          <TD className="hidden md:table-cell">
                            <Mono>{bsinFor(p.id)}</Mono>
                          </TD>
                          <TD align="right" className="font-medium text-ink-900">
                            {formatINR(offer.price)}
                          </TD>
                          <TD align="right" className="hidden sm:table-cell">
                            {formatNumber(offer.stock)}
                          </TD>
                          <TD>
                            <StatusBadge meta={LISTING_STATUS[status]} size="sm" />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          {settlements.length > 0 && (
            <Card>
              <CardHeader title="Settlements" description="Weekly cycles. Net payout is after fees, GST on fees, TCS, TDS and refunds." action={<ButtonLink href="/admin/payouts" variant="ghost" size="xs" iconRight={ArrowRight}>Payouts</ButtonLink>} />
              <TableContainer className="mt-3">
                <Table>
                  <THead>
                    <TR>
                      <TH>Cycle</TH>
                      <TH align="right" className="hidden sm:table-cell">
                        Gross sales
                      </TH>
                      <TH align="right" className="hidden xl:table-cell">
                        Fees and taxes
                      </TH>
                      <TH align="right">Net payout</TH>
                      <TH>Status</TH>
                      <TH className="hidden lg:table-cell">UTR</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {settlements.map((x) => (
                      <TR key={x.id}>
                        <TD>
                          <Mono>{x.id}</Mono>
                          <p className="text-xs text-ink-500">
                            {formatDateShort(x.periodStart)} to {formatDateShort(x.periodEnd)}
                          </p>
                        </TD>
                        <TD align="right" className="hidden sm:table-cell">
                          {formatINR(x.grossSales)}
                        </TD>
                        <TD align="right" className="hidden xl:table-cell">
                          -{formatINR(x.feesTotal + x.tcs + x.tds)}
                        </TD>
                        <TD align="right" className="font-medium text-ink-900">
                          {formatINR(x.netPayout)}
                        </TD>
                        <TD>
                          <StatusBadge meta={SETTLEMENT_STATUS[x.status]} size="sm" />
                        </TD>
                        <TD className="hidden lg:table-cell">{x.utr ? <Mono className="text-xs">{x.utr}</Mono> : <span className="text-xs text-ink-500">{x.failure ?? "Not paid yet"}</span>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          <Card>
            <CardHeader title="Policy violations" description="Deductions by severity: low 20, medium 50, high 100, critical 200 points" />
            {violations.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-[13px] text-ink-500">No violations in the last 180 days.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {violations.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink-900">{v.policy}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{v.detail}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        <span className="font-mono">{v.id}</span>, {v.severity} severity, minus {v.points} points, {formatDate(v.at)}
                      </p>
                    </div>
                    <StatusBadge meta={VIOLATION_STATUS[v.status]} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Business details" />
            <div className="px-5 pt-3 pb-5">
              <DescriptionList
                items={[
                  { label: "Legal name", value: s.legalName },
                  { label: "GSTIN", value: <Mono>{s.gstin}</Mono> },
                  { label: "PAN", value: <Mono>{s.pan}</Mono> },
                  { label: "Owner", value: s.ownerName },
                  { label: "Email", value: <MaskedValue masked={maskEmail(s.email)} full={s.email} /> },
                  { label: "Phone", value: <MaskedValue masked={maskPhone(s.phone)} full={s.phone} /> },
                  { label: "Principal place of business", value: `${s.city}, ${s.state} ${s.pincode}` },
                  { label: "Fulfilment", value: s.fulfillment.map((f) => FULFILMENT[f]).join(", ") },
                  { label: "Categories", value: cats.join(", ") },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="KYC documents" description="Verified against the GST portal, PAN database and penny drop" />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {sellerKycDocs(s).map((d) => (
                <li key={d.label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] text-ink-800">{d.label}</span>
                    <span className="block truncate text-xs text-ink-500">{d.value}</span>
                  </span>
                  <StatusBadge meta={KYC_DOC_STATUS[d.status]} size="sm" />
                </li>
              ))}
            </ul>
          </Card>

          {holds.length > 0 && (
            <Card className="border-warning-100">
              <CardHeader title="Payout hold" action={<StatusBadge meta={{ label: "On hold", tone: "warning" }} size="sm" />} />
              {holds.map((hd) => (
                <dl key={hd.id} className="flex flex-col gap-2.5 px-5 pt-3 pb-5">
                  <p className="text-[13px] text-ink-800">{hd.reason}</p>
                  <SummaryRow label="Amount held" value={formatINR(hd.amountHeld)} />
                  <SummaryRow label="Since" value={formatDate(hd.since)} />
                  <SummaryRow label="Placed by" value={hd.placedBy} />
                  <p className="text-xs text-ink-500">Releases when: {hd.releaseWhen}</p>
                </dl>
              ))}
            </Card>
          )}

          <Card>
            <CardHeader title="Notes and audit" />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3 text-[13px]">
                  <p className="text-ink-800">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {a.actor}, {timeAgo(a.at)}
                  </p>
                </li>
              ))}
              <li className="px-5 py-3 text-[13px]">
                <p className="text-ink-800">Account created and seller agreement accepted</p>
                <p className="mt-0.5 text-xs text-ink-500">Seller Hub, {formatDate(s.joinedAt)}</p>
              </li>
            </ul>
            <div className="border-t border-line px-5 py-3">
              <ActionButton label="Add note" icon="note" size="xs" variant="ghost" title="Add an internal note" note="required" toast="Note added" />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
