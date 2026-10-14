import Link from "next/link";
import { ChevronRight, Search, UserSearch } from "lucide-react";
import { AutoSubmitForm } from "@/components/logistics/ops-client";
import { maskPhone, Mono, one, Pager, qs } from "@/components/logistics/ops-ui";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadCustomers } from "@/lib/api/support";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Customer lookup" };

export default async function CustomersPage(props: PageProps<"/support/customers">) {
  const sp = await props.searchParams;
  const q = (one(sp.q) ?? "").trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const data = await loadCustomers(q, page);

  return (
    <>
      <PageHeader title="Customer lookup" description="Find a customer by name, email or mobile number. Newest accounts first." />
      <Card className="overflow-hidden">
        <AutoSubmitForm action="/support/customers" className="flex flex-wrap items-center gap-2 px-5 py-4">
          <Input name="q" defaultValue={q} icon={Search} inputSize="sm" placeholder="Name, email or mobile number" aria-label="Search customers" className="w-full sm:w-80" />
          <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Search
          </button>
          {q && (
            <Link href="/support/customers" className="px-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              Clear
            </Link>
          )}
        </AutoSubmitForm>
        {data.items.length === 0 ? (
          <EmptyState
            icon={UserSearch}
            title={q ? "No customers found" : "No customers yet"}
            description={q ? "Check the spelling, or search by email or mobile number." : "Customers appear here once they sign up."}
            className="border-t border-line"
          />
        ) : (
          <>
            <TableContainer className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Customer</TH>
                    <TH>Mobile</TH>
                    <TH align="right">Orders</TH>
                    <TH align="right">Open tickets</TH>
                    <TH>Joined</TH>
                    <TH>
                      <span className="sr-only">Open</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((c) => (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/support/customers/${c.id}`} className="group flex items-center gap-3">
                          <Avatar name={c.name ?? c.email} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900 group-hover:text-brand-700">
                              {c.name ?? "No name"}
                              {c.status === "BLOCKED" && (
                                <Badge size="sm" tone="danger">
                                  Blocked
                                </Badge>
                              )}
                            </span>
                            <span className="block truncate text-xs text-ink-500">{c.email}</span>
                          </span>
                        </Link>
                      </TD>
                      <TD>{c.phone ? <Mono className="text-ink-700">{maskPhone(c.phone)}</Mono> : <span className="text-xs text-ink-400">Not given</span>}</TD>
                      <TD align="right">{c.orders}</TD>
                      <TD align="right" className={cn(c.openTickets > 0 && "font-medium text-ink-900")}>
                        {c.openTickets || "-"}
                      </TD>
                      <TD className="text-[13px] text-ink-500">{formatDate(c.createdAt)}</TD>
                      <TD align="right">
                        <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
            <ul className="divide-y divide-line border-t border-line md:hidden">
              {data.items.map((c) => (
                <li key={c.id}>
                  <Link href={`/support/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={c.name ?? c.email} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-900">{c.name ?? c.email}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {c.orders} orders, {c.email}
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Pager page={page} pageSize={data.pageSize} total={data.total} label="customers" hrefFor={(p) => `/support/customers${qs({ q: q || undefined, page: p > 1 ? p : undefined })}`} />
          </>
        )}
      </Card>
    </>
  );
}
