import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";
import { AutoSubmitSelect } from "@/components/account/auto-submit-select";
import { CANCELLED_STATUSES, isActive } from "@/components/account/lib";
import { OrderCard } from "@/components/account/order-card";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { accountOrders, accountReturns } from "@/lib/mock/account-extra";
import type { Order } from "@/lib/types";
import { cn, NOW } from "@/lib/utils";

export const metadata = { title: "Your orders" };

const RANGES = [
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "2026", label: "2026" },
  { key: "2025", label: "2025" },
  { key: "all", label: "All time" },
] as const;

const STATUSES = [
  { key: "all", label: "All orders" },
  { key: "active", label: "On the way" },
  { key: "delivered", label: "Delivered" },
  { key: "returns", label: "Returns" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];
type StatusKey = (typeof STATUSES)[number]["key"];

const PAGE_SIZE = 8;
const withReturns = new Set(accountReturns.map((r) => r.orderId));

function inRange(o: Order, range: RangeKey) {
  const t = new Date(o.placedAt).getTime();
  const year = Number(new Intl.DateTimeFormat("en-IN", { year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(o.placedAt)));
  switch (range) {
    case "30d":
      return NOW.getTime() - t <= 30 * 86400_000;
    case "3m":
      return NOW.getTime() - t <= 92 * 86400_000;
    case "2026":
    case "2025":
      return year === Number(range);
    default:
      return true;
  }
}

function inStatus(o: Order, status: StatusKey) {
  switch (status) {
    case "active":
      return isActive(o.status);
    case "delivered":
      return o.status === "delivered" && !withReturns.has(o.id);
    case "returns":
      return withReturns.has(o.id) || o.status === "return_requested" || o.status === "returned";
    case "cancelled":
      return CANCELLED_STATUSES.includes(o.status);
    default:
      return true;
  }
}

function matches(o: Order, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return o.id.toLowerCase().includes(needle) || o.items.some((it) => it.title.toLowerCase().includes(needle));
}

export default async function OrdersPage(props: PageProps<"/account/orders">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim();
  const range = (RANGES.find((r) => r.key === one(sp.range))?.key ?? "3m") as RangeKey;
  const status = (STATUSES.find((s) => s.key === one(sp.status))?.key ?? "all") as StatusKey;

  const base = accountOrders.filter((o) => inRange(o, range) && matches(o, q));
  const filtered = base.filter((o) => inStatus(o, status));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.page)) || 1));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const href = (over: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (range !== "3m") p.set("range", range);
    const s = over.status ?? status;
    if (s !== "all") p.set("status", s);
    if (over.page && over.page > 1) p.set("page", String(over.page));
    const qs = p.toString();
    return `/account/orders${qs ? `?${qs}` : ""}`;
  };

  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();

  return (
    <>
      <PageHeader
        title="Your orders"
        description="Track packages, cancel before they ship, return or replace, and buy your favourites again."
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <TabLinks
          className="min-w-0 lg:flex-1"
          active={status}
          items={STATUSES.map((s) => ({ key: s.key, label: s.label, href: href({ status: s.key }), count: base.filter((o) => inStatus(o, s.key)).length }))}
        />
        <form method="get" action="/account/orders" className="flex w-full items-center gap-2 lg:w-auto" role="search">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q} icon={Search} placeholder="Search your orders" aria-label="Search your orders" className="min-w-0 flex-1 lg:w-72" />
          <AutoSubmitSelect name="range" defaultValue={range} aria-label="Time range" className="w-36 shrink-0">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>
      </div>

      <p className="mb-4 text-[13px] text-ink-500">
        <span className="font-medium text-ink-800">{filtered.length}</span> {filtered.length === 1 ? "order" : "orders"} placed in the {range === "all" ? "lifetime of your account" : range === "2026" || range === "2025" ? `year ${range}` : rangeLabel}
        {q && (
          <>
            {" "}
            matching <span className="font-medium text-ink-800">&ldquo;{q}&rdquo;</span>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <EmptyState
            icon={PackageSearch}
            title={q ? "No orders match your search" : "No orders here yet"}
            description={q ? "Try a different product name or the full order number, or widen the time range." : "Orders you place in this period will show up here."}
            action={
              <ButtonLink href="/account/orders?range=all" variant="secondary">
                Clear filters
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
          <PageLink href={href({ page: page - 1 })} disabled={page === 1} label="Previous page">
            <ChevronLeft size={16} aria-hidden="true" />
          </PageLink>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={href({ page: n })}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors",
                n === page ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-white hover:text-ink-900",
              )}
            >
              {n}
            </Link>
          ))}
          <PageLink href={href({ page: page + 1 })} disabled={page === pages} label="Next page">
            <ChevronRight size={16} aria-hidden="true" />
          </PageLink>
        </nav>
      )}
    </>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-600";
  if (disabled)
    return (
      <span className={cn(cls, "opacity-40")} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "hover:border-line-strong hover:text-ink-900")} aria-label={label}>
      {children}
    </Link>
  );
}
