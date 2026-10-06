import Link from "next/link";
import { Users } from "lucide-react";
import { CUSTOMER_STATUS, riskTone } from "@/components/admin/admin-status";
import { ScoreMeter } from "@/components/admin/bits";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, paginate, pctChange, sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Pager } from "@/components/admin/pager";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { customers, platformDaily } from "@/lib/mock";
import { maskEmail, platformSettings } from "@/lib/mock/admin-extra";
import type { Customer } from "@/lib/types";
import { formatCompact, formatDate, formatINR, formatNumber, NOW } from "@/lib/utils";

export const metadata = { title: "Customers" };

const SEGMENTS: { key: string; label: string; match: (c: Customer) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "plus", label: "Plus members", match: (c) => c.plusMember },
  { key: "new", label: "New, 90 days", match: (c) => NOW.getTime() - new Date(c.joinedAt).getTime() < 90 * 86_400_000 },
  { key: "risk", label: "High risk", match: (c) => c.riskScore >= 70 },
  { key: "flagged", label: "Flagged", match: (c) => c.status === "flagged" },
  { key: "blocked", label: "Blocked", match: (c) => c.status === "blocked" },
];

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const params = await props.searchParams;
  const segment = SEGMENTS.find((s) => s.key === sp(params, "segment"))?.key ?? "all";
  const q = sp(params, "q")?.trim() ?? "";
  const city = sp(params, "city") ?? "all";
  const sort = sp(params, "sort") ?? "ltv";
  const page = Number(sp(params, "page") ?? 1) || 1;
  const current = { segment: segment === "all" ? undefined : segment, q: q || undefined, city: city === "all" ? undefined : city, sort: sort === "ltv" ? undefined : sort };

  const needle = q.toLowerCase();
  const base = customers.filter((c) => {
    if (needle && !`${c.name} ${c.email} ${c.phone} ${c.id}`.toLowerCase().includes(needle)) return false;
    if (city !== "all" && c.city !== city) return false;
    return true;
  });
  const filtered = base
    .filter(SEGMENTS.find((s) => s.key === segment)!.match)
    .sort((a, b) => (sort === "risk" ? b.riskScore - a.riskScore : sort === "recent" ? +new Date(b.joinedAt) - +new Date(a.joinedAt) : b.lifetimeValue - a.lifetimeValue));
  const { rows, ...pg } = paginate(filtered, page, 20);
  const cities = [...new Set(customers.map((c) => c.city))].sort();

  const completed = platformDaily.slice(0, -1);
  const new7 = completed.slice(-7).reduce((a, d) => a + d.newCustomers, 0);
  const newPrev = completed.slice(-14, -7).reduce((a, d) => a + d.newCustomers, 0);

  return (
    <>
      <PageHeader title="Customers" description="Customer accounts, memberships and risk. Contact details stay masked unless you reveal them, and every reveal is audited." />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "AltasGoods Plus members", value: formatCompact(platformSettings.plus.members), hint: "active and in grace period" },
          { label: "New customers, 7 days", value: formatCompact(new7), delta: pctChange(new7, newPrev), deltaLabel: "vs prior 7 days" },
          { label: "High risk accounts", value: customers.filter((c) => c.riskScore >= 70).length, hint: "risk score 70 or above", href: "/admin/customers?segment=risk" },
          { label: "Blocked accounts", value: customers.filter((c) => c.status === "blocked").length, hint: "cannot place orders", href: "/admin/customers?segment=blocked" },
        ]}
      />

      <TabLinks
        className="mb-5"
        active={segment}
        items={SEGMENTS.map((s) => ({ key: s.key, label: s.label, count: base.filter(s.match).length, href: hrefWith("/admin/customers", current, { segment: s.key === "all" ? undefined : s.key, page: undefined }) }))}
      />

      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/customers"
            q={q}
            placeholder="Name, email, phone or customer ID"
            keep={{ segment: current.segment }}
            selects={[
              { name: "city", label: "City", value: city, options: [{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))] },
              { name: "sort", label: "Sort by", value: sort, defaultValue: "ltv", options: [{ value: "ltv", label: "Highest lifetime value" }, { value: "risk", label: "Highest risk" }, { value: "recent", label: "Newest first" }] },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Check the spelling or search by phone number or customer ID." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">City</TH>
                  <TH className="hidden lg:table-cell">Joined</TH>
                  <TH align="right" className="hidden sm:table-cell">
                    Orders
                  </TH>
                  <TH align="right">Lifetime value</TH>
                  <TH className="hidden sm:table-cell">Membership</TH>
                  <TH align="right" className="hidden xl:table-cell">
                    AltasCoins
                  </TH>
                  <TH className="hidden md:table-cell">Risk score</TH>
                  <TH className="hidden sm:table-cell">Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/admin/customers/${c.id}`} className="group flex items-center gap-3">
                        <Avatar name={c.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink-900 group-hover:text-brand-700">{c.name}</span>
                          <span className="block text-xs text-ink-500">{maskEmail(c.email)}</span>
                          {c.status !== "active" && (
                            <span className="mt-1 block sm:hidden">
                              <StatusBadge meta={CUSTOMER_STATUS[c.status]} size="sm" />
                            </span>
                          )}
                        </span>
                      </Link>
                    </TD>
                    <TD className="hidden text-[13px] md:table-cell">{c.city}</TD>
                    <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{formatDate(c.joinedAt)}</TD>
                    <TD align="right" className="hidden sm:table-cell">
                      {formatNumber(c.orders)}
                    </TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(c.lifetimeValue)}
                    </TD>
                    <TD className="hidden sm:table-cell">{c.plusMember ? <Badge tone="brand" size="sm">Plus</Badge> : <span className="text-[13px] text-ink-400">None</span>}</TD>
                    <TD align="right" className="hidden xl:table-cell">
                      {formatNumber(c.bluCoins)}
                    </TD>
                    <TD className="hidden md:table-cell">
                      <ScoreMeter value={c.riskScore} tone={riskTone(c.riskScore)} label="Customer risk score" />
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <StatusBadge meta={CUSTOMER_STATUS[c.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/customers" params={current} label="customers" {...pg} />
      </Card>
    </>
  );
}
