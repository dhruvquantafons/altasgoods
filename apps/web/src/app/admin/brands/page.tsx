import Link from "next/link";
import { BadgeCheck, CircleCheck, CircleX } from "lucide-react";
import { BrandReview } from "@/components/admin/brand-review";
import { BRAND_REQUEST_STATUS } from "@/components/admin/admin-status";
import { Mono } from "@/components/admin/bits";
import { ageLabel, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { brands, sellers } from "@/lib/mock";
import { brandRequests, verifiedBrands, type BrandRequest } from "@/lib/mock/admin-extra";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Brands" };

const TYPE: Record<BrandRequest["type"], string> = { registry: "Brand Registry", authorisation: "Seller authorisation", new_brand: "New brand" };
const sellerName = (id?: string) => sellers.find((s) => s.id === id)?.displayName ?? "Unclaimed";

export default async function BrandsPage(props: PageProps<"/admin/brands">) {
  const params = await props.searchParams;
  const tab = sp(params, "tab") === "verified" ? "verified" : "requests";
  const open = brandRequests.filter((r) => r.status === "pending" || r.status === "info_requested");
  const requests = [...brandRequests].sort((a, b) => Number(b.status === "pending" || b.status === "info_requested") - Number(a.status === "pending" || a.status === "info_requested") || +new Date(a.submittedAt) - +new Date(b.submittedAt));

  return (
    <>
      <PageHeader title="Brands" description="BluBuy Brand Registry and seller brand authorisations. Trademarks are checked against IP India; registry owners get content priority and IP complaint tools." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Requests open", value: open.length, hint: `${open.filter((r) => r.status === "info_requested").length} waiting on seller` },
          { label: "Verified brands", value: verifiedBrands.length, hint: `of ${brands.length} brands in the catalog` },
          { label: "Unverified brands", value: brands.length - verifiedBrands.length, hint: "listed without registry owner" },
          { label: "Open IP complaints", value: verifiedBrands.reduce((a, b) => a + b.ipComplaints, 0), hint: "notice and takedown" },
        ]}
      />

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "requests", label: "Requests", count: open.length, href: "/admin/brands" },
          { key: "verified", label: "Verified brands", count: verifiedBrands.length, href: "/admin/brands?tab=verified" },
        ]}
      />

      <Card>
        {tab === "requests" ? (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Brand</TH>
                  <TH className="hidden md:table-cell">Applicant</TH>
                  <TH className="hidden lg:table-cell">Trademark</TH>
                  <TH className="hidden sm:table-cell">IP India</TH>
                  <TH>Status</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {requests.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <p className="font-medium text-ink-900">{r.brandName}</p>
                      <p className="text-xs text-ink-500">
                        {TYPE[r.type]}, <span className="font-mono">{r.id}</span>, {ageLabel(r.submittedAt)} ago
                      </p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <Link href={`/admin/sellers/${r.sellerId}`} className="text-[13px] text-ink-800 hover:text-brand-700">
                        {sellerName(r.sellerId)}
                      </Link>
                      <p className="max-w-[200px] truncate text-xs text-ink-500">{r.documents.join(", ")}</p>
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <Mono>{r.trademarkNo}</Mono>
                      <p className="text-xs text-ink-500">
                        {r.trademarkClass}, {r.trademarkStatus.toLowerCase()}
                      </p>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      {r.ipIndiaMatch ? (
                        <span className="inline-flex items-center gap-1 text-[13px] text-success-700">
                          <CircleCheck size={14} aria-hidden="true" />
                          Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] text-danger-700">
                          <CircleX size={14} aria-hidden="true" />
                          No match
                        </span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge meta={BRAND_REQUEST_STATUS[r.status]} size="sm" />
                    </TD>
                    <TD align="right">
                      <BrandReview request={r} sellerName={sellerName(r.sellerId)} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Brand</TH>
                  <TH className="hidden sm:table-cell">Registry owner</TH>
                  <TH className="hidden md:table-cell">Trademark</TH>
                  <TH align="right">Products</TH>
                  <TH align="right" className="hidden md:table-cell">
                    Offers
                  </TH>
                  <TH align="right">IP complaints</TH>
                  <TH className="hidden lg:table-cell">Verified</TH>
                </TR>
              </THead>
              <TBody>
                {verifiedBrands.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink-900">
                        {b.name}
                        <BadgeCheck size={15} className="text-brand-600" aria-label="Verified" />
                      </span>
                    </TD>
                    <TD className="hidden text-[13px] sm:table-cell">
                      {b.ownerSellerId ? (
                        <Link href={`/admin/sellers/${b.ownerSellerId}`} className="hover:text-brand-700">
                          {sellerName(b.ownerSellerId)}
                        </Link>
                      ) : (
                        "Unclaimed"
                      )}
                    </TD>
                    <TD className="hidden md:table-cell">
                      <Mono>{b.trademarkNo}</Mono>
                    </TD>
                    <TD align="right">{b.products}</TD>
                    <TD align="right" className="hidden md:table-cell">
                      {formatNumber(b.offers)}
                    </TD>
                    <TD align="right" className={b.ipComplaints ? "font-medium text-danger-700" : ""}>
                      {b.ipComplaints || "None"}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{formatDate(b.verifiedOn)}</TD>
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
