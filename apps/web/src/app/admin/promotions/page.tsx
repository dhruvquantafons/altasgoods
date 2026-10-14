import { BadgePercent, Ticket } from "lucide-react";
import { sp } from "@/components/admin/helpers";
import { CouponActions, CouponEditor, SaleActions, SaleEditor } from "@/components/admin/promotions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { loadCoupons, loadSales } from "@/lib/api/admin-system";
import { paise } from "@/lib/api/format";
import type { Tone } from "@/lib/status";
import { getStoreCatalog } from "@/lib/store-catalog";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Coupons and sales" };

const STATE: Record<string, { label: string; tone: Tone }> = {
  LIVE: { label: "Live", tone: "success" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PAUSED: { label: "Paused", tone: "warning" },
  ENDED: { label: "Ended", tone: "neutral" },
  USED_UP: { label: "Used up", tone: "neutral" },
};

export default async function PromotionsPage(props: PageProps<"/admin/promotions">) {
  const params = await props.searchParams;
  const tab = sp(params, "tab") === "coupons" ? "coupons" : "sales";
  const [sales, coupons, catalog] = await Promise.all([loadSales(), loadCoupons(), getStoreCatalog()]);
  const categories = catalog.categories.map((c) => ({ id: c.id, name: c.name }));
  const products = catalog.products.map((p) => ({ id: p.id, name: p.title })).sort((a, b) => a.name.localeCompare(b.name));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const covers = (s: (typeof sales)[number]) =>
    s.scope === "ALL"
      ? "Everything in the store"
      : s.scope === "CATEGORIES"
        ? s.categoryIds.map((id) => categoryName.get(id) ?? id).join(", ")
        : s.productIds.length === 1
          ? (productName.get(s.productIds[0]!) ?? "1 product")
          : `${s.productIds.length} products`;

  return (
    <>
      <PageHeader
        title="Coupons and sales"
        description="Sales cut prices for everything they cover while they run; coupons take money off an order when a customer enters the code. Both apply at checkout."
        actions={tab === "coupons" ? <CouponEditor /> : <SaleEditor categories={categories} products={products} />}
      />

      <TabLinks
        className="mb-5"
        active={tab}
        items={[
          { key: "sales", label: "Sales", count: sales.filter((s) => s.state === "LIVE").length || undefined, href: "/admin/promotions" },
          { key: "coupons", label: "Coupons", count: coupons.filter((c) => c.state === "LIVE").length || undefined, href: "/admin/promotions?tab=coupons" },
        ]}
      />

      <Card>
        {tab === "sales" ? (
          sales.length === 0 ? (
            <EmptyState icon={BadgePercent} title="No sales yet" description="Create one for a festival or a weekend: pick what it covers, the discount and when it runs." />
          ) : (
            <TableContainer>
              <Table>
                <THead className="border-t-0">
                  <TR>
                    <TH>Sale</TH>
                    <TH>Discount</TH>
                    <TH className="hidden lg:table-cell">Covers</TH>
                    <TH>When</TH>
                    <TH>State</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {sales.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <p className="text-[13px] font-medium text-ink-900">{s.name}</p>
                        {s.headline && <p className="max-w-64 truncate text-xs text-ink-500">{s.headline}</p>}
                      </TD>
                      <TD className="font-semibold text-ink-900">{s.discountPercent}% off</TD>
                      <TD className="hidden max-w-64 truncate text-[13px] text-ink-700 lg:table-cell">{covers(s)}</TD>
                      <TD className="text-xs whitespace-nowrap text-ink-600">
                        {formatDateTime(s.startsAt)}
                        <br />
                        to {formatDateTime(s.endsAt)}
                      </TD>
                      <TD>
                        <Badge tone={STATE[s.state]!.tone} size="sm" dot>
                          {STATE[s.state]!.label}
                        </Badge>
                      </TD>
                      <TD align="right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <SaleEditor sale={s} categories={categories} products={products} />
                          <SaleActions sale={s} />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )
        ) : coupons.length === 0 ? (
          <EmptyState icon={Ticket} title="No coupons yet" description="Create a code customers can enter in the cart, such as DIWALI500 for ₹500 off." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Code</TH>
                  <TH>Takes off</TH>
                  <TH className="hidden md:table-cell">Minimum order</TH>
                  <TH className="hidden lg:table-cell">Used</TH>
                  <TH>Ends</TH>
                  <TH>State</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {coupons.map((c) => (
                  <TR key={c.code}>
                    <TD>
                      <p className="font-mono text-[13px] font-semibold text-ink-900">{c.code}</p>
                      <p className="max-w-64 truncate text-xs text-ink-500">
                        {c.description}
                        {!c.showOnStorefront && " (hidden)"}
                      </p>
                    </TD>
                    <TD className="text-[13px] text-ink-800">
                      {c.type === "PERCENT" ? `${c.value}%` : paise(c.value)}
                      {c.maxDiscountPaise !== null && <span className="text-ink-500">, up to {paise(c.maxDiscountPaise)}</span>}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-700 md:table-cell">{c.minOrderPaise ? paise(c.minOrderPaise) : "None"}</TD>
                    <TD className="hidden text-[13px] text-ink-700 tabular-nums lg:table-cell">
                      {c.usageCount}
                      {c.usageLimit !== null && ` of ${c.usageLimit}`}
                    </TD>
                    <TD className="text-xs whitespace-nowrap text-ink-600">{formatDateTime(c.endsAt)}</TD>
                    <TD>
                      <Badge tone={STATE[c.state]!.tone} size="sm" dot>
                        {STATE[c.state]!.label}
                      </Badge>
                    </TD>
                    <TD align="right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <CouponEditor coupon={c} />
                        <CouponActions coupon={c} />
                      </div>
                    </TD>
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
