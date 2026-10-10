import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { ActiveToggle } from "@/components/admin/catalog/active-toggle";
import { FilterBar } from "@/components/admin/filter-bar";
import { hrefWith, sp } from "@/components/admin/helpers";
import { Pager } from "@/components/admin/pager";
import { ProductImage } from "@/components/commerce/product-image";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TabLinks } from "@/components/ui/tabs";
import { loadAdminCategories, loadAdminProducts } from "@/lib/api/admin-catalog";
import { paise } from "@/lib/api/format";
import { cn, formatDateShort } from "@/lib/utils";

export const metadata = { title: "Products" };

const PAGE_SIZE = 25;
const VIEWS = [
  { key: "all", label: "All" },
  { key: "active", label: "On sale" },
  { key: "inactive", label: "Off sale" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
] as const;

export default async function ProductsPage(props: PageProps<"/admin/catalog">) {
  const params = await props.searchParams;
  const view = VIEWS.find((v) => v.key === sp(params, "view"))?.key ?? "all";
  const q = sp(params, "q")?.trim() ?? "";
  const category = sp(params, "category") ?? "all";
  const page = Math.max(1, Number(sp(params, "page") ?? 1) || 1);

  const [data, categories] = await Promise.all([
    loadAdminProducts({
      q,
      category: category === "all" ? undefined : category,
      status: view === "active" || view === "inactive" ? view : "all",
      stock: view === "low" || view === "out" ? view : "all",
      page,
      pageSize: PAGE_SIZE,
    }),
    loadAdminCategories(),
  ]);
  const current = { view: view === "all" ? undefined : view, q: q || undefined, category: category === "all" ? undefined : category };
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const from = data.total ? (data.page - 1) * PAGE_SIZE + 1 : 0;

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything the store sells. Changes here show in the store straight away."
        actions={
          <ButtonLink href="/admin/catalog/new" size="sm" icon={Plus}>
            Add product
          </ButtonLink>
        }
      />
      <TabLinks className="mb-5" active={view} items={VIEWS.map((v) => ({ key: v.key, label: v.label, href: hrefWith("/admin/catalog", { ...current, page: undefined, view: v.key === "all" ? undefined : v.key }) }))} />
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <FilterBar
            path="/admin/catalog"
            q={q}
            placeholder="Title, SKU or product id"
            keep={{ view: current.view }}
            selects={[{ name: "category", label: "Category", value: category, className: "sm:w-48", options: [{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] }]}
          />
        </div>
        {data.items.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={q || category !== "all" || view !== "all" ? "No products match" : "No products yet"}
            description={q || category !== "all" || view !== "all" ? "Try a different search or clear the filters." : "Add your first product to start selling."}
          />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Product</TH>
                  <TH className="hidden md:table-cell">Category</TH>
                  <TH align="right">Price</TH>
                  <TH align="right">Stock</TH>
                  <TH className="hidden lg:table-cell">Updated</TH>
                  <TH>On sale</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex max-w-[360px] items-center gap-3">
                        <ProductImage src={p.image} alt="" size={44} rounded="md" />
                        <span className="min-w-0">
                          <Link href={`/admin/catalog/${p.id}`} className="line-clamp-2 text-[13px] font-medium text-ink-900 hover:text-brand-700">
                            {p.title}
                          </Link>
                          <span className="block font-mono text-xs text-ink-500">{p.sku}</span>
                        </span>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="text-[13px] text-ink-800">{p.category.name}</p>
                      <p className="text-xs text-ink-500">
                        {p.subcategory}, {p.brand.name}
                      </p>
                    </TD>
                    <TD align="right">
                      <p className="font-medium text-ink-900">{paise(p.pricePaise)}</p>
                      {p.mrpPaise > p.pricePaise && <p className="text-xs text-ink-400 line-through">{paise(p.mrpPaise)}</p>}
                    </TD>
                    <TD align="right" className={cn("tabular-nums", p.stock === 0 ? "font-medium text-danger-700" : p.stock <= 10 ? "font-medium text-warning-700" : "text-ink-800")}>
                      {p.stock === 0 ? "Out" : p.stock}
                    </TD>
                    <TD className="hidden text-[13px] text-ink-600 lg:table-cell">{formatDateShort(p.updatedAt)}</TD>
                    <TD>
                      <ActiveToggle id={p.id} title={p.title} active={p.active} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
        <Pager path="/admin/catalog" params={current} label="products" page={data.page} pages={pages} from={from} to={Math.min(data.page * PAGE_SIZE, data.total)} total={data.total} />
      </Card>
    </>
  );
}
