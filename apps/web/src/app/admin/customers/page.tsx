import Link from "next/link";
import { ChevronRight, UserSearch } from "lucide-react";
import { FilterBar } from "@/components/admin/filter-bar";
import { sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomers } from "@/lib/api/admin-system";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  const params = await props.searchParams;
  const q = sp(params, "q")?.trim() ?? "";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);
  const data = await loadAdminCustomers(q, page);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const from = data.total ? (page - 1) * data.pageSize + 1 : 0;
  const current = { q: q || undefined };

  return (
    <>
      <PageHeader title="Customers" description="Everyone with a shopper account, newest first. Staff accounts are not listed." />
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar path="/admin/customers" q={q} placeholder="Name, email or mobile number" />
        </div>
        {data.items.length === 0 ? (
          <EmptyState icon={UserSearch} title={q ? "No customers match" : "No customers yet"} description={q ? "Try their email or mobile number." : "Customers appear here once they sign up."} />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Customer</TH>
                  <TH align="right">Orders</TH>
                  <TH align="right" className="hidden md:table-cell">
                    Open tickets
                  </TH>
                  <TH className="hidden md:table-cell">Joined</TH>
                  <TH>
                    <span className="sr-only">Open</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/admin/customers/${c.id}`} className="group flex items-center gap-3">
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
                    <TD align="right">{c.orders}</TD>
                    <TD align="right" className="hidden md:table-cell">
                      {c.openTickets || "-"}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-500 md:table-cell">{formatDate(c.createdAt)}</TD>
                    <TD align="right">
                      <ChevronRight size={16} className="text-ink-300" aria-hidden="true" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/customers" params={current} label="customers" page={page} pages={pages} from={from} to={Math.min(page * data.pageSize, data.total)} total={data.total} />
      </Card>
    </>
  );
}
