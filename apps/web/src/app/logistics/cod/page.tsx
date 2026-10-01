import { Banknote, CircleAlert, IndianRupee, Landmark, Wallet } from "lucide-react";
import { CASH_STATUS, REMITTANCE_STATUS } from "@/components/logistics/meta";
import { ToastButton } from "@/components/logistics/ops-client";
import { formatDay, formatDayTime, MetricTile, Mono, Note } from "@/components/logistics/ops-ui";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Progress } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { associates } from "@/lib/mock";
import { bankDeposits, cashDepositsYesterday, cashShortages, remittances, runsheets } from "@/lib/mock/ops-extra";
import { cn, formatCompact, formatINR, sum } from "@/lib/utils";

export const metadata = { title: "COD remittance" };

const name = (id: string) => associates.find((a) => a.id === id)?.name ?? id;

export default function CodPage() {
  const collectedToday = sum(runsheets, (r) => r.codCollected);
  const onRoad = sum(runsheets, (r) => r.codToCollect - r.codCollected);
  const expectedY = sum(cashDepositsYesterday, (d) => d.expected);
  const acceptedY = sum(cashDepositsYesterday, (d) => d.accepted ?? 0);
  const notDeclared = cashDepositsYesterday.filter((d) => d.status === "not_declared");
  const declared = cashDepositsYesterday.filter((d) => d.status === "declared");
  const openShort = cashShortages.filter((s) => s.status !== "recovered");
  const live = runsheets.filter((r) => r.associateId && r.codToCollect > 0).sort((a, b) => b.codCollected - a.codCollected);

  return (
    <>
      <PageHeader
        title="COD remittance"
        description="Cash on delivery from collection at the door to the hub cashier, the bank and BluBuy finance."
        actions={
          <>
            <ToastButton label="Close day" icon="check" message="Day close blocked: 3 associates have not declared yesterday's cash" size="md" />
            <ToastButton label="Create bank deposit" icon="banknote" variant="primary" message={`Deposit slip DS-WFD-261001-01 created for ${formatINR(acceptedY)}`} size="md" />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Collected today" value={formatCompact(collectedToday, true)} hint={`${formatCompact(onRoad, true)} still to collect on road`} icon={IndianRupee} />
        <MetricTile label="Yesterday's cash accepted" value={formatCompact(acceptedY, true)} hint={`of ${formatCompact(expectedY, true)} expected from ${cashDepositsYesterday.length} associates`} icon={Wallet} />
        <MetricTile label="Pending deposits" value={notDeclared.length + declared.length} tone="warning" hint={`${notDeclared.length} not declared, ${declared.length} awaiting count`} icon={CircleAlert} />
        <MetricTile label="Open shortages" value={formatINR(sum(openShort, (s) => s.amount))} tone={openShort.length ? "danger" : "neutral"} hint={`${openShort.length} recovery cases`} icon={Banknote} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title={`Associate cash for ${formatDay(cashDepositsYesterday[0]!.businessDate)}`} description="Expected is cash for delivered COD shipments. UPI QR payments settle directly and are excluded." />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Associate</TH>
                  <TH align="right">Expected cash</TH>
                  <TH align="right">Declared</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Action</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {[...cashDepositsYesterday]
                  .sort((a, b) => ["not_declared", "short", "declared", "accepted", "banked", "reconciled"].indexOf(a.status) - ["not_declared", "short", "declared", "accepted", "banked", "reconciled"].indexOf(b.status))
                  .map((d) => {
                    const diff = d.declared !== undefined ? d.declared - d.expected : undefined;
                    return (
                      <TR key={d.id}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name(d.associateId)} size="xs" />
                            <div>
                              <p className="text-[13px] font-medium text-ink-900">{name(d.associateId)}</p>
                              <p className="text-xs text-ink-500">
                                {d.codShipments} COD drops, UPI {formatINR(d.upi)}
                              </p>
                            </div>
                          </div>
                        </TD>
                        <TD align="right" className="font-medium text-ink-900">
                          {formatINR(d.expected)}
                        </TD>
                        <TD align="right">
                          {d.declared !== undefined ? formatINR(d.declared) : <span className="text-ink-400">Not yet</span>}
                          <p className={cn("text-xs", diff && diff < 0 ? "font-medium text-danger-700" : "text-ink-500")}>{diff === undefined ? "" : diff === 0 ? "Matched" : `${formatINR(diff)} short`}</p>
                        </TD>
                        <TD>
                          <StatusBadge meta={CASH_STATUS[d.status]} size="sm" />
                          {d.cashier && <p className="mt-1 text-xs text-ink-500">{d.cashier}</p>}
                        </TD>
                        <TD align="right">
                          {d.status === "declared" && <ToastButton label="Accept" size="xs" variant="soft" message={`${formatINR(d.declared ?? 0)} from ${name(d.associateId)} counted and accepted`} />}
                          {d.status === "not_declared" && <ToastButton label="Remind" size="xs" variant="ghost" message={`Reminder sent to ${name(d.associateId)} on BluBuy Rider`} />}
                          {d.status === "short" && <ToastButton label="Recovery" size="xs" variant="ghost" message={`Recovery case opened for ${name(d.associateId)}`} />}
                        </TD>
                      </TR>
                    );
                  })}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Live collection today" description="Cash and UPI collected on current runsheets" />
            <ul className="flex flex-col gap-3.5 px-5 pt-4 pb-5">
              {live.slice(0, 9).map((r) => (
                <li key={r.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate text-ink-700">{name(r.associateId!)}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium text-ink-900">{formatINR(r.codCollected)}</span>
                      <span className="text-ink-400"> / {formatCompact(r.codToCollect, true)}</span>
                    </span>
                  </div>
                  <Progress value={r.codCollected} max={r.codToCollect} size="sm" tone="success" label={`${name(r.associateId!)} COD collected`} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Shortages and recovery" />
            <ul className="divide-y divide-line px-5 pt-1 pb-2">
              {cashShortages.map((s) => (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-ink-900">{name(s.associateId)}</span>
                    <span className={cn("text-[13px] font-semibold tabular-nums", s.status === "recovered" ? "text-ink-500" : "text-danger-700")}>{formatINR(s.amount)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">{s.reason}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-500">
                    <Badge size="sm" tone={s.status === "recovered" ? "success" : s.status === "open" ? "danger" : "warning"}>
                      {s.status === "recovered" ? "Recovered" : s.status === "open" ? "Open" : "Recovery scheduled"}
                    </Badge>
                    {formatDay(s.businessDate)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader title="Bank deposit slips" description="Cashier deposits to the hub collection account" action={<Landmark size={17} className="text-ink-400" aria-hidden="true" />} />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Slip</TH>
                  <TH>Business day</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {bankDeposits.map((b) => (
                  <TR key={b.slip}>
                    <TD>
                      <Mono className="font-medium text-ink-900">{b.slip}</Mono>
                      <p className="font-mono text-[11px] text-ink-500">{b.reference}</p>
                    </TD>
                    <TD className="text-[13px]">{formatDay(b.businessDate)}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(b.amount)}
                    </TD>
                    <TD>
                      <Badge tone={b.status === "reconciled" ? "success" : "brand"} dot size="sm">
                        {b.status === "reconciled" ? "Reconciled" : "Banked"}
                      </Badge>
                      <p className="mt-1 text-xs text-ink-500">{formatDayTime(b.depositedAt)}</p>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">{bankDeposits[0]!.bank}. Deposits made by the hub cashier with a two-person count.</p>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Remittance to BluBuy finance" description="D+1 cycle from the hub collection account to the COD collection account" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Remittance</TH>
                  <TH>Business day</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {remittances.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Mono className="font-medium text-ink-900">{r.id}</Mono>
                      <p className="font-mono text-[11px] text-ink-500">{r.utr ?? `${r.cycle} cycle`}</p>
                    </TD>
                    <TD className="text-[13px]">{formatDay(r.businessDate)}</TD>
                    <TD align="right" className="font-medium text-ink-900">
                      {formatINR(r.amount)}
                      <p className="text-xs font-normal text-ink-500">{r.shipments} shipments</p>
                    </TD>
                    <TD>
                      <StatusBadge meta={REMITTANCE_STATUS[r.status]} size="sm" />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
          <div className="border-t border-line p-4">
            <Note tone="neutral">Remittance includes cash deposits and UPI QR settlements. Finance reconciles each remittance to delivered COD orders before sellers become eligible for payout.</Note>
          </div>
        </Card>
      </div>
    </>
  );
}
