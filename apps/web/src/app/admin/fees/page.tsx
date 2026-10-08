import { ActionButton } from "@/components/admin/action-button";
import { Chip, SummaryRow } from "@/components/admin/bits";
import { FeeCalculator, type FeeCalcConfig } from "@/components/admin/fee-calculator";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  categories,
  COMMISSION_FREE_UPTO,
  FIXED_FEE_SLABS,
  GST_ON_FEES_PERCENT,
  PAYOUT_HOLD_DAYS,
  RATE_CARD_VERSION,
  SHIPPING_RATE_CARD,
  TCS_PERCENT,
  TDS_PERCENT,
  TIER_FIXED_FEE_MODIFIER,
  TIER_SHIPPING_DISCOUNT,
} from "@/lib/mock";
import { categoryMeta } from "@/lib/mock/admin-extra";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Fees and commission" };

const TIERS = ["Platinum", "Gold", "Silver", "Bronze"] as const;

function slabLabel(i: number) {
  const s = FIXED_FEE_SLABS[i]!;
  const from = i === 0 ? 0 : FIXED_FEE_SLABS[i - 1]!.upTo + 1;
  return s.upTo === Infinity ? `Above ${formatINR(FIXED_FEE_SLABS[i - 1]!.upTo)}` : `${formatINR(from)} to ${formatINR(s.upTo)}`;
}

export default function FeesPage() {
  const config: FeeCalcConfig = {
    categories: categories.map((c) => ({ id: c.id, name: c.name, commission: c.commission, gstRate: categoryMeta.find((m) => m.categoryId === c.id)?.gstRate ?? 18 })),
    fixedSlabs: FIXED_FEE_SLABS.map((s) => ({ upTo: s.upTo === Infinity ? null : s.upTo, fee: s.fee })),
    tierFixed: { ...TIER_FIXED_FEE_MODIFIER },
    shipping: SHIPPING_RATE_CARD.map((r) => ({ ...r })),
    tierShipDiscount: { ...TIER_SHIPPING_DISCOUNT },
    freeUpto: COMMISSION_FREE_UPTO,
    gstOnFees: GST_ON_FEES_PERCENT,
    tcs: TCS_PERCENT,
    tds: TDS_PERCENT,
  };

  return (
    <>
      <PageHeader
        title="Fees and commission"
        description="The seller rate card: commission, fixed fee and shipping, plus GST on fees, TCS and TDS. No separate collection fee; gateway and COD costs are absorbed by AltasGoods."
        meta={
          <>
            <StatusBadge meta={{ label: "Live", tone: "success" }} />
            <span className="font-mono text-[13px] text-ink-700">{RATE_CARD_VERSION}</span>
            <span className="text-[13px] text-ink-500">Effective 1 Jul 2026. Orders are charged by the version live at confirmation.</span>
          </>
        }
        actions={
          <ActionButton
            label="Draft new version"
            icon="edit"
            variant="primary"
            title="Draft a new rate card version"
            description="Copies the live card into a draft you can edit and simulate. Publishing needs a Finance Manager (checker)."
            fields={[
              { name: "name", label: "Version name", defaultValue: "RC-2026-11" },
              { name: "from", label: "Effective from", type: "date", defaultValue: "2026-11-01" },
            ]}
            warning="Maker-checker: you cannot publish a version you drafted."
            note="optional"
            confirmLabel="Create draft"
            toast="Draft RC-2026-11 created"
          />
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 shadow-card sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">
            Draft <span className="font-mono text-[13px] font-medium">RC-2026-10-FESTIVE</span> is awaiting approval
          </p>
          <p className="mt-0.5 text-[13px] text-ink-600">Zero commission for new sellers in Toys and Books for 90 days, prepared by Arvind Nair (Finance Executive). Simulated impact: minus ₹38 lakh fee revenue a month.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
        <StatusBadge meta={{ label: "Awaiting approval", tone: "warning" }} />
        <ActionButton label="Review draft" size="sm" title="Approve RC-2026-10-FESTIVE" description="Publishing makes it effective for orders confirmed from 15 Oct 2026." warning="You are the checker. The maker cannot approve their own draft." reasons={["Approved as simulated", "Approved with a later effective date"]} note="optional" confirmLabel="Approve and publish" toast="Rate card approved, effective 15 Oct" doneLabel="Approved" />
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader title="Fee calculator" description="Seller net proceeds for one item under the live card. Defaults to the spec 14.2 worked example." />
        <div className="px-5 pt-4 pb-5">
          <FeeCalculator config={config} defaults={{ price: 1499, categoryId: "cat-home", weight: 1, zone: "regional", tier: "Gold" }} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Commission" description={`On the GST-inclusive selling price. 0% on items up to ${formatINR(COMMISSION_FREE_UPTO)} in every category.`} />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Up to {formatINR(COMMISSION_FREE_UPTO)}</TH>
                  <TH align="right">Above</TH>
                  <TH className="hidden sm:table-cell">Allowed range</TH>
                </TR>
              </THead>
              <TBody>
                {categories.map((c) => (
                  <TR key={c.id}>
                    <TD className="text-[13px] font-medium text-ink-900">{c.name}</TD>
                    <TD align="right" className="text-ink-500">
                      0%
                    </TD>
                    <TD align="right" className="font-semibold text-ink-900">
                      {c.commission}%
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 sm:table-cell">{categoryMeta.find((m) => m.categoryId === c.id)?.commissionRange}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Fixed fee" description="Per item, AltasGoods Ship, Flex and Fulfilled. Second and later units of the same BSIN in one package pay 50%." />
            <TableContainer className="mt-3">
              <Table>
                <THead>
                  <TR>
                    <TH>Item price</TH>
                    {TIERS.map((t) => (
                      <TH key={t} align="right">
                        {t}
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {FIXED_FEE_SLABS.map((s, i) => (
                    <TR key={s.upTo}>
                      <TD className="text-[13px] text-ink-800">{slabLabel(i)}</TD>
                      {TIERS.map((t) => (
                        <TD key={t} align="right" className={t === "Platinum" ? "font-semibold text-ink-900" : ""}>
                          ₹{s.fee + TIER_FIXED_FEE_MODIFIER[t]}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Tier modifier per item: Platinum +₹0, Gold +₹2, Silver +₹5, Bronze +₹10.</p>
          </Card>

          <Card>
            <CardHeader title="Taxes on every sale" />
            <dl className="flex flex-col gap-3 px-5 pt-3 pb-5">
              <SummaryRow label={<span>GST on fees <span className="block text-xs text-ink-500">On commission, fixed fee, shipping and penalties; input credit for registered sellers</span></span>} value={`${GST_ON_FEES_PERCENT}%`} />
              <SummaryRow label={<span>TCS, section 52 CGST <span className="block text-xs text-ink-500">On taxable value; GSTR-8 by the 10th</span></span>} value={`${TCS_PERCENT}%`} />
              <SummaryRow label={<span>TDS, section 194-O <span className="block text-xs text-ink-500">On taxable value (assumption D7); exempt under ₹5 lakh with PAN</span></span>} value={`${TDS_PERCENT}%`} />
            </dl>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeader title="Shipping fee" description="Forward, per package, by chargeable weight (actual or L x W x H / 5000) and zone. Self Ship pays no AltasGoods shipping." />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Chargeable weight</TH>
                  <TH align="right">Local</TH>
                  <TH align="right">Regional</TH>
                  <TH align="right">National</TH>
                  <TH align="right">Special</TH>
                </TR>
              </THead>
              <TBody>
                {SHIPPING_RATE_CARD.map((r) => (
                  <TR key={r.weight}>
                    <TD className="text-[13px] text-ink-800">{r.weight}</TD>
                    <TD align="right">₹{r.local}</TD>
                    <TD align="right">₹{r.regional}</TD>
                    <TD align="right">₹{r.national}</TD>
                    <TD align="right">₹{r.special}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink-500">
            Tier discount:
            {TIERS.map((t) => (
              <Chip key={t}>
                {t} {TIER_SHIPPING_DISCOUNT[t]}%
              </Chip>
            ))}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Returns, RTO and cancellations" description="What is charged or refunded to the seller (spec 13.6)" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Scenario</TH>
                  <TH>Commission</TH>
                  <TH className="hidden 2xl:table-cell">Fixed and shipping</TH>
                  <TH>Reverse fee</TH>
                </TR>
              </THead>
              <TBody>
                {[
                  ["Cancelled before ship", "Not charged", "Not charged", "None"],
                  ["Customer-caused RTO", "Not charged", "Shipping charged", "None"],
                  ["Seller-fault return", "Refunded", "Kept", "Forward slab"],
                  ["Customer-remorse return", "Refunded less ₹50 or 20%", "Kept", "₹30 fashion, ₹45 other"],
                  ["Logistics-fault return", "Refunded", "Refunded", "None, SafeClaim raised"],
                ].map(([a, b, c, d]) => (
                  <TR key={a}>
                    <TD className="text-[13px] font-medium text-ink-900">{a}</TD>
                    <TD className="text-[13px]">{b}</TD>
                    <TD className="hidden text-[13px] 2xl:table-cell">{c}</TD>
                    <TD className="text-[13px]">{d}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Penalties" description="Seller-packed channels, with 18% GST; disputable within 15 days" />
          <dl className="mt-3 divide-y divide-line border-t border-line text-[13px]">
            {[
              ["Late dispatch, first scan after the dispatch-by date", "₹30 per item"],
              ["Seller cancellation or SLA auto-cancel", "₹60 per item; 1% above ₹10,000, capped at ₹1,000"],
              ["Late dispatch followed by cancellation", "₹90 per item"],
              ["Pickup failed, seller not ready", "₹15 after the first each month"],
              ["Weight discrepancy", "Slab difference + ₹10 per package"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-5 py-2.5">
                <dt className="text-ink-700">{k}</dt>
                <dd className="text-right font-medium text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Settlement timing by tier" description="Payout runs Monday, Wednesday and Friday. COD lines also wait for remittance." />
          <dl className="mt-3 grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t} className="bg-surface px-5 py-4">
                <dt className="text-xs text-ink-500">{t}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink-900">Delivered + {PAYOUT_HOLD_DAYS[t]} days</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">New sellers stay on the Bronze timeline for their first 90 days and may carry a 10% rolling reserve.</p>
        </Card>
      </div>
    </>
  );
}
