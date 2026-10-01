import Link from "next/link";
import { CircleAlert, Clock, MapPin, RefreshCcw, Undo2, Wallet } from "lucide-react";
import { CUSTOMER_REFUND_STATUS, CUSTOMER_RETURN_STATUS, dateLabel, dateTimeLabel, dayLabel, relativeDay, shortDate } from "@/components/account/lib";
import { ReturnActions } from "@/components/account/return-actions";
import { Notice, Panel, StepList } from "@/components/account/ui";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, IconTile } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { customerAddresses } from "@/lib/mock";
import { accountRefunds, accountReturns, pickupSlots, type AccountReturn } from "@/lib/mock/account-extra";
import { formatINR, NOW } from "@/lib/utils";

export const metadata = { title: "Returns and refunds" };

const OPEN = (r: AccountReturn) => !["completed", "rejected", "cancelled"].includes(r.status);

export default async function ReturnsPage(props: PageProps<"/account/returns">) {
  const sp = await props.searchParams;
  const tab = sp.tab === "refunds" ? "refunds" : "returns";
  const open = accountReturns.filter(OPEN);
  const inProgress = accountRefunds.filter((r) => r.status !== "completed" && r.status !== "failed");
  const refunded90 = accountRefunds.filter((r) => r.status === "completed" && NOW.getTime() - new Date(r.completedAt ?? r.initiatedAt).getTime() < 90 * 86400_000);
  const slots = pickupSlots().map((s) => ({ key: s.date, label: dayLabel(s.date), windows: s.windows }));

  return (
    <>
      <PageHeader title="Returns and refunds" description="Track pickups, replacements and every rupee on its way back to you." />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Open requests", value: String(open.length), hint: "Pickups, replacements and refunds", icon: Undo2, tone: "info" as const },
          { label: "Refunds on the way", value: formatINR(inProgress.reduce((a, r) => a + r.amount, 0)), hint: `${inProgress.length} refund${inProgress.length === 1 ? "" : "s"} processing`, icon: Clock, tone: "brand" as const },
          { label: "Refunded, last 90 days", value: formatINR(refunded90.reduce((a, r) => a + r.amount, 0)), hint: `${refunded90.length} refunds completed`, icon: Wallet, tone: "success" as const },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <IconTile icon={t.icon} tone={t.tone} />
            <div className="min-w-0">
              <p className="text-[13px] text-ink-500">{t.label}</p>
              <p className="text-lg font-semibold tracking-tight text-ink-900 tabular-nums">{t.value}</p>
              <p className="truncate text-xs text-ink-500">{t.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <TabLinks
        className="mb-6"
        active={tab}
        items={[
          { key: "returns", label: "Returns and replacements", href: "/account/returns", count: accountReturns.length },
          { key: "refunds", label: "Refunds", href: "/account/returns?tab=refunds", count: accountRefunds.length },
        ]}
      />

      {tab === "returns" ? (
        accountReturns.length === 0 ? (
          <Panel>
            <EmptyState icon={Undo2} title="No returns yet" description="When you return or replace an item, you can follow it here." />
          </Panel>
        ) : (
          <div className="flex flex-col gap-5">
            {accountReturns.map((r) => (
              <ReturnCard key={r.id} r={r} slots={slots} />
            ))}
          </div>
        )
      ) : (
        <Panel title="All refunds" description="Cancellations and returns. Bank posting can take a day after a refund shows as completed." bodyClassName="px-0 pb-1 sm:px-0">
          <ul className="divide-y divide-line">
            {accountRefunds.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center md:gap-6">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  {f.image && <ProductImage src={f.image} alt="" size={48} rounded="md" />}
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink-900">{f.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {f.source}
                      {f.returnId ? ` ${f.returnId}` : ""} ·{" "}
                      <Link href={`/account/orders/${f.orderId}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                        {f.orderId}
                      </Link>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:flex-nowrap">
                  <div className="md:w-48">
                    <p className="text-[13.5px] font-semibold text-ink-900 tabular-nums">{formatINR(f.amount)}</p>
                    <p className="truncate text-xs text-ink-500">{f.destination}</p>
                  </div>
                  <div className="md:w-44">
                    <StatusBadge meta={CUSTOMER_REFUND_STATUS[f.status]} size="sm" />
                    <p className="mt-1 text-xs text-ink-500">
                      {f.status === "completed" && f.completedAt ? `On ${dateLabel(f.completedAt)}` : f.expectedBy ? `Expected by ${relativeDay(f.expectedBy)}` : `Started ${shortDate(f.initiatedAt)}`}
                    </p>
                  </div>
                  <p className="font-mono text-[12px] text-ink-500 md:w-40 md:text-right">{f.reference ?? ""}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function ReturnCard({ r, slots }: { r: AccountReturn; slots: { key: string; label: string; windows: string[] }[] }) {
  const meta = CUSTOMER_RETURN_STATUS[r.status];
  const beforePickup = ["requested", "approved", "pickup_scheduled"].includes(r.status);
  const addr = customerAddresses.find((a) => a.id === r.pickup?.addressId);
  return (
    <article id={r.id} className="scroll-mt-28 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <header className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-start sm:px-6">
        <div className="flex min-w-0 flex-1 gap-4">
          <ProductImage src={r.image} alt="" size={64} rounded="lg" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-[14px] font-medium text-ink-900">{r.productTitle}</p>
            <p className="mt-1 text-xs text-ink-500">
              <span className="font-mono text-[12px] text-ink-700">{r.id}</span> · Order{" "}
              <Link href={`/account/orders/${r.orderId}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                {r.orderId}
              </Link>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Requested {dateLabel(r.requestedAt)} · {r.reason}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <StatusBadge meta={meta} />
          <Badge size="sm" tone="neutral" icon={r.resolution === "refund" ? Wallet : RefreshCcw}>
            {r.resolution === "refund" ? "Refund" : r.resolution === "replacement" ? "Replacement" : "Exchange"}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Progress</p>
          <StepList items={r.events.map((e) => ({ label: e.label, at: e.at ? dateTimeLabel(e.at) : undefined, note: e.note, done: e.done }))} />
        </div>
        <div className="flex flex-col gap-3">
          {r.refund && (
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Refund</p>
                <StatusBadge meta={CUSTOMER_REFUND_STATUS[r.refund.status]} size="sm" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{formatINR(r.refund.amount)}</p>
              <p className="mt-0.5 text-[13px] text-ink-600">To {r.refund.destination}</p>
              <p className="mt-2 text-xs text-ink-500">
                {r.refund.status === "completed" && r.refund.completedAt
                  ? `Completed ${dateTimeLabel(r.refund.completedAt)}${r.refund.instant ? ", instant refund at pickup" : ""}`
                  : r.refund.expectedBy
                    ? `Expected by ${relativeDay(r.refund.expectedBy)}`
                    : `Started ${dateTimeLabel(r.refund.initiatedAt)}`}
              </p>
              {r.refund.reference && <p className="mt-1 font-mono text-[12px] text-ink-500">{r.refund.reference}</p>}
            </div>
          )}
          {r.status === "replacement_shipped" && r.replacementEta && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Replacement</p>
              <p className="mt-2 text-[15px] font-semibold text-ink-900">Arriving by {dayLabel(r.replacementEta)}</p>
              <p className="mt-0.5 text-[13px] text-ink-600">A new unit is on its way with BluBuy Logistics.</p>
            </div>
          )}
          {r.pickup && beforePickup && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Pickup</p>
              <p className="mt-2 text-[15px] font-semibold text-ink-900">
                {dayLabel(r.pickup.date)}, {r.pickup.window}
              </p>
              {addr && (
                <p className="mt-1 flex items-start gap-1.5 text-[13px] text-ink-600">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                  {addr.line1}, {addr.city}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-500">Keep the item packed with its tags, accessories and box.</p>
              {r.replacementEta && <p className="mt-1 text-xs text-ink-500">Replacement expected by {dayLabel(r.replacementEta)}.</p>}
            </div>
          )}
          {r.status === "rejected" && r.rejectionReason && (
            <Notice
              tone="danger"
              icon={CircleAlert}
              title="Why this return was not accepted"
              action={
                <Link href={`/account/support?order=${r.orderId}&topic=guarantee`} className="text-[13px] font-semibold text-brand-700 hover:underline">
                  File a BluBuy Guarantee claim
                </Link>
              }
            >
              {r.rejectionReason}
            </Notice>
          )}
          {r.comment && <p className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600">&ldquo;{r.comment}&rdquo;</p>}
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5 sm:px-6">
        <ReturnActions returnId={r.id} canCancel={beforePickup} canReschedule={r.status === "pickup_scheduled"} slots={slots} />
        <ButtonLink href={`/account/orders/${r.orderId}`} size="sm" variant="ghost">
          View order
        </ButtonLink>
        <ButtonLink href={`/account/support?order=${r.orderId}&topic=return`} size="sm" variant="ghost" className="ml-auto">
          Need help
        </ButtonLink>
      </footer>
    </article>
  );
}
