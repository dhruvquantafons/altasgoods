import Link from "next/link";
import { ChevronRight, Crown, Search, UserSearch } from "lucide-react";
import { AutoSubmitForm } from "@/components/logistics/ops-client";
import { maskPhone, Mono, one, Pager, qs } from "@/components/logistics/ops-ui";
import { RiskPill } from "@/components/support/meta";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { customers, tickets } from "@/lib/mock";
import { isActiveTicket } from "@/lib/mock/ops-extra";
import type { Customer } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Customer lookup" };

const PAGE = 20;

function matches(c: Customer, q: string) {
  const digits = q.replace(/\D/g, "");
  return (
    c.name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    c.id.toLowerCase() === q ||
    (digits.length >= 4 && c.phone.replace(/\D/g, "").includes(digits))
  );
}

export default async function CustomersPage(props: PageProps<"/support/customers">) {
  const sp = await props.searchParams;
  const q = (one(sp.q) ?? "").trim().toLowerCase();
  const plus = one(sp.plus) ?? "";
  const risk = one(sp.risk) ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const rows = customers
    .filter((c) => (!q || matches(c, q)) && (!plus || (plus === "yes" ? c.plusMember : !c.plusMember)) && (!risk || (risk === "high" ? c.riskScore >= 70 : c.status !== "active")))
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  const paged = rows.slice((page - 1) * PAGE, page * PAGE);
  const openTickets = (name: string) => tickets.filter((t) => t.customerName === name && isActiveTicket(t)).length;
  const params = { q: q || undefined, plus: plus || undefined, risk: risk || undefined };

  return (
    <>
      <PageHeader title="Customer lookup" description="Find a customer by name, email, phone or customer ID. Contact details stay masked unless revealed." />
      <Card className="overflow-hidden">
        <AutoSubmitForm action="/support/customers" className="flex flex-wrap items-center gap-2 px-5 py-4">
          <Input name="q" defaultValue={q} icon={Search} inputSize="sm" placeholder="Name, email, last 4 digits of phone or c-001" aria-label="Search customers" className="w-full sm:w-80" />
          <Select name="plus" defaultValue={plus} selectSize="sm" aria-label="Membership" className="w-[calc(50%-4px)] sm:w-40">
            <option value="">All members</option>
            <option value="yes">BluBuy Plus</option>
            <option value="no">Not Plus</option>
          </Select>
          <Select name="risk" defaultValue={risk} selectSize="sm" aria-label="Risk" className="w-[calc(50%-4px)] sm:w-44">
            <option value="">Any risk</option>
            <option value="high">High risk score</option>
            <option value="flagged">Flagged or blocked</option>
          </Select>
          <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Search
          </button>
          {(q || plus || risk) && (
            <Link href="/support/customers" className="px-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Clear
            </Link>
          )}
        </AutoSubmitForm>
        {paged.length === 0 ? (
          <EmptyState icon={UserSearch} title="No customers found" description="Check the spelling, or search by the last 4 digits of the registered mobile number." className="border-t border-line" />
        ) : (
          <>
            <TableContainer className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Customer</TH>
                    <TH>Phone</TH>
                    <TH>City</TH>
                    <TH align="right">Orders</TH>
                    <TH align="right">Lifetime value</TH>
                    <TH>Risk</TH>
                    <TH align="right">Open tickets</TH>
                    <TH>Joined</TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {paged.map((c) => {
                    const open = openTickets(c.name);
                    return (
                      <TR key={c.id}>
                        <TD>
                          <Link href={`/support/customers/${c.id}`} className="group flex items-center gap-3">
                            <Avatar name={c.name} size="sm" />
                            <span>
                              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900 group-hover:text-brand-700">
                                {c.name}
                                {c.plusMember && <Crown size={13} className="text-brand-600" aria-label="BluBuy Plus" />}
                              </span>
                              <span className="font-mono text-[11px] text-ink-500">{c.id}</span>
                            </span>
                          </Link>
                        </TD>
                        <TD>
                          <Mono className="text-ink-700">{maskPhone(c.phone)}</Mono>
                        </TD>
                        <TD className="text-[13px]">{c.city}</TD>
                        <TD align="right">{c.orders}</TD>
                        <TD align="right" className="font-medium text-ink-900">
                          {formatINR(c.lifetimeValue)}
                        </TD>
                        <TD>
                          <RiskPill score={c.riskScore} />
                        </TD>
                        <TD align="right" className={cn(open > 0 && "font-medium text-ink-900")}>
                          {open || "-"}
                        </TD>
                        <TD className="text-[13px] text-ink-500">{formatDate(c.joinedAt)}</TD>
                        <TD align="right">
                          <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableContainer>
            <ul className="divide-y divide-line border-t border-line md:hidden">
              {paged.map((c) => (
                <li key={c.id}>
                  <Link href={`/support/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={c.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-900">{c.name}</span>
                      <span className="block text-xs text-ink-500">
                        {c.orders} orders, {formatINR(c.lifetimeValue)}, {c.city}
                      </span>
                    </span>
                    <RiskPill score={c.riskScore} />
                  </Link>
                </li>
              ))}
            </ul>
            <Pager page={page} pageSize={PAGE} total={rows.length} label="customers" hrefFor={(p) => `/support/customers${qs({ ...params, page: p > 1 ? p : undefined })}`} />
          </>
        )}
      </Card>
    </>
  );
}
