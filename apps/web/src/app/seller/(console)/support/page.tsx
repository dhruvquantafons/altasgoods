import Link from "next/link";
import { ArrowUpRight, BookOpen, CirclePlay, FileText, GraduationCap, Truck } from "lucide-react";
import { NewCase } from "@/components/seller/support/new-case";
import { MiniStat, Mono, SlaText, StatStrip } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { academyCourses, CASE_CATEGORIES, CASE_STATUS, supportCases } from "@/lib/mock/seller-extra";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Support cases" };

const HELP = [
  { icon: FileText, title: "Fee rate card", body: "Commission, fixed fee and shipping by category and tier", href: "/seller/payments?tab=tax" },
  { icon: Truck, title: "Packaging and shipping guide", body: "Box sizes, labels, pickups and weight slabs", href: "/seller/orders" },
  { icon: BookOpen, title: "Seller policies", body: "Listing, pricing, messaging and review rules", href: "/seller/performance" },
];

export default function SupportPage() {
  const open = supportCases.filter((c) => !["resolved", "closed"].includes(c.status));
  const waiting = supportCases.filter((c) => c.status === "pending_seller");
  const learning = academyCourses.filter((c) => c.progress > 0 && c.progress < 100);

  return (
    <>
      <PageHeader
        title="Support cases"
        description="Cases with AltasGoods Seller Support. First response within 24 hours; most cases are resolved within 5 business days."
        actions={<NewCase categories={CASE_CATEGORIES} />}
      />

      <StatStrip className="mb-6">
        <MiniStat label="Open cases" value={open.length} hint="With you or with AltasGoods" />
        <MiniStat label="Waiting for your reply" value={waiting.length} hint="Cases close after 72 hours without a reply" tone={waiting.length ? "warning" : undefined} />
        <MiniStat label="Median first response" value="3 h 40 min" hint="Your cases, last 90 days" />
        <MiniStat label="Seller Academy" value={`${academyCourses.filter((c) => c.progress === 100).length} of ${academyCourses.length}`} hint="Courses completed" />
      </StatStrip>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Your cases" />
        <TableContainer className="mt-3">
          <Table className="min-w-[900px]">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Case</TH>
                <TH>Topic</TH>
                <TH>Latest update</TH>
                <TH>Status</TH>
                <TH align="right">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {supportCases.map((c) => (
                <TR key={c.id}>
                  <TD className="max-w-[22rem]">
                    <p className="truncate text-[13px] font-medium text-ink-900">{c.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <Mono className="text-xs">{c.id}</Mono>
                      {c.reference && (
                        <>
                          , re <Mono className="text-xs">{c.reference}</Mono>
                        </>
                      )}
                    </p>
                  </TD>
                  <TD className="text-[13px]">{c.category}</TD>
                  <TD className="max-w-[20rem] text-[13px] whitespace-normal text-ink-600">{c.lastMessage}</TD>
                  <TD>
                    <StatusBadge meta={CASE_STATUS[c.status]} size="sm" />
                    {c.respondBy && (
                      <div className="mt-1">
                        <SlaText dueAt={c.respondBy} className="text-xs" />
                      </div>
                    )}
                  </TD>
                  <TD align="right" className="text-[13px] text-ink-500">
                    {timeAgo(c.updatedAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader
            title="AltasGoods Seller Academy"
            description="Short lessons from the Seller Success team"
            action={
              learning.length > 0 && (
                <Badge tone="brand" icon={GraduationCap}>
                  {learning.length} in progress
                </Badge>
              )
            }
          />
          <ul className="mt-3 grid gap-px border-t border-line bg-line sm:grid-cols-2">
            {academyCourses.map((c) => (
              <li key={c.id} className="bg-surface px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <CirclePlay size={17} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{c.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {c.topic}, {c.level.toLowerCase()}, {c.minutes} min
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Progress value={c.progress} size="sm" tone={c.progress === 100 ? "success" : "brand"} label={`${c.progress}% complete`} />
                      <span className="w-20 shrink-0 text-right text-[11px] text-ink-500">{c.progress === 100 ? "Completed" : c.progress ? `${c.progress}% done` : "Not started"}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Quick help" />
          <ul className="mt-2 divide-y divide-line">
            {HELP.map((h) => (
              <li key={h.title}>
                <Link href={h.href} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-ink-50/60">
                  <h.icon size={17} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink-900">{h.title}</span>
                    <span className="block text-xs text-ink-500">{h.body}</span>
                  </span>
                  <ArrowUpRight size={15} className="text-ink-300 group-hover:text-ink-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-4 text-[13px] text-ink-600">
            Urgent payout or account issue? Call Seller Support on <span className="font-medium whitespace-nowrap text-ink-900">1800 419 2600</span>, 8 AM to 10 PM, all days.
          </div>
        </Card>
      </div>
    </>
  );
}
