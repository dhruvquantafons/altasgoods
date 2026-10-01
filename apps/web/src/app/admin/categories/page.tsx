import Link from "next/link";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { Chip } from "@/components/admin/bits";
import { sp } from "@/components/admin/helpers";
import { KpiStrip } from "@/components/admin/kpi-strip";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { categories, COMMISSION_FREE_UPTO } from "@/lib/mock";
import { categoryMeta, LEGAL_ATTRIBUTES, type AttributeDef } from "@/lib/mock/admin-extra";
import { cn, formatCompact, formatINR, formatNumber } from "@/lib/utils";

export const metadata = { title: "Categories" };

const TYPE_LABEL: Record<AttributeDef["type"], string> = { text: "Text", number: "Number", enum: "Single choice", multi_enum: "Multiple choice", boolean: "Yes or no", unit_value: "Value with unit" };

function AttributeList({ items }: { items: AttributeDef[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.code} className="flex items-start justify-between gap-3 px-5 py-2.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-900">
              {a.label}
              {a.mandatory && <span className="ml-1 text-xs font-normal text-danger-700">Required</span>}
            </p>
            <p className="font-mono text-xs text-ink-500">{a.code}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Chip>{TYPE_LABEL[a.type]}</Chip>
            {a.variant && <Chip className="border-brand-100 bg-brand-50 text-brand-700">Variant</Chip>}
            {a.filterable && <Chip>Filter</Chip>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function CategoriesPage(props: PageProps<"/admin/categories">) {
  const params = await props.searchParams;
  const selectedId = categories.find((c) => c.slug === sp(params, "cat"))?.id ?? categories[0]!.id;
  const selected = categories.find((c) => c.id === selectedId)!;
  const meta = categoryMeta.find((m) => m.categoryId === selectedId)!;
  const leaves = categories.reduce((a, c) => a + (c.children?.length ?? 0), 0);
  const listings = categoryMeta.reduce((a, m) => a + m.liveListings, 0);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Taxonomy, commission, return policy and attribute templates. Changes to commission and return windows are versioned and need Finance approval (maker-checker)."
        actions={
          <ActionButton
            label="Add category"
            icon="plus"
            variant="primary"
            title="Add a category"
            description="New leaf categories inherit the parent's attribute template and return policy until edited."
            fields={[
              { name: "parent", label: "Parent", type: "select", options: ["None (top level)", ...categories.map((c) => c.name)] },
              { name: "name", label: "Name", placeholder: "For example Smart home" },
              { name: "hsn", label: "Default HSN code", placeholder: "8517" },
            ]}
            note="optional"
            confirmLabel="Create category"
            toast="Category created as draft"
          />
        }
      />

      <KpiStrip
        className="mb-6"
        items={[
          { label: "Top-level categories", value: categories.length, hint: `${leaves} leaf categories` },
          { label: "Gated categories", value: categoryMeta.filter((m) => m.gated).length, hint: "need approval to sell" },
          { label: "Live listings", value: formatCompact(listings), hint: "across all leaf categories" },
          { label: "Commission-free band", value: `Up to ${formatINR(COMMISSION_FREE_UPTO)}`, hint: "0% in every category" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Category tree" description="Select a category to see its attribute template" />
          <TableContainer className="mt-3">
            <Table>
              <THead>
                <TR>
                  <TH>Category</TH>
                  <TH align="right">Commission</TH>
                  <TH className="hidden md:table-cell">Return window</TH>
                  <TH className="hidden 2xl:table-cell">HSN and GST</TH>
                  <TH align="right" className="hidden 2xl:table-cell">
                    Live listings
                  </TH>
                  <TH className="hidden md:table-cell">Access</TH>
                </TR>
              </THead>
              <TBody>
                {categories.map((c) => {
                  const m = categoryMeta.find((x) => x.categoryId === c.id)!;
                  const open = c.id === selectedId;
                  return [
                    <TR key={c.id} className={cn(open && "bg-brand-50/50 hover:bg-brand-50/60")}>
                      <TD>
                        <Link href={`/admin/categories?cat=${c.slug}`} scroll={false} className="flex items-center gap-2 font-medium text-ink-900 hover:text-brand-700" aria-expanded={open}>
                          {open ? <ChevronDown size={15} className="text-ink-400" aria-hidden="true" /> : <ChevronRight size={15} className="text-ink-400" aria-hidden="true" />}
                          {c.name}
                          <span className="text-xs font-normal text-ink-400">{c.children?.length ?? 0}</span>
                        </Link>
                      </TD>
                      <TD align="right">
                        <span className="font-medium text-ink-900">{c.commission}%</span>
                        <p className="text-xs text-ink-500">range {m.commissionRange}</p>
                      </TD>
                      <TD className="hidden text-[13px] md:table-cell">
                        {m.returnWindow}
                        <p className="max-w-[180px] truncate text-xs text-ink-500">{m.resolution}</p>
                      </TD>
                      <TD className="hidden text-[13px] 2xl:table-cell">
                        <span className="font-mono">{m.hsn}</span>
                        <p className="text-xs text-ink-500">GST {m.gstLabel}</p>
                      </TD>
                      <TD align="right" className="hidden 2xl:table-cell">
                        {formatNumber(m.liveListings)}
                      </TD>
                      <TD className="hidden md:table-cell">
                        {m.gated ? (
                          <Badge tone="warning" size="sm" icon={Lock}>
                            Gated
                          </Badge>
                        ) : (
                          <span className="text-[13px] text-ink-500">Open</span>
                        )}
                      </TD>
                    </TR>,
                    ...(open
                      ? (c.children ?? []).map((sub) => (
                          <TR key={sub.id} className="bg-ink-25">
                            <TD className="text-[13px] text-ink-700 first:pl-12">{sub.name}</TD>
                            <TD align="right" className="text-[13px] text-ink-600">
                              {sub.commission}%
                            </TD>
                            <TD className="hidden text-[13px] text-ink-500 md:table-cell">Inherits</TD>
                            <TD className="hidden text-[13px] text-ink-500 2xl:table-cell">Inherits</TD>
                            <TD align="right" className="hidden text-[13px] text-ink-600 2xl:table-cell">
                              {formatNumber(Math.round(m.liveListings / (c.children?.length ?? 1)))}
                            </TD>
                            <TD className="hidden md:table-cell" />
                          </TR>
                        ))
                      : []),
                  ];
                })}
              </TBody>
            </Table>
          </TableContainer>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-500">
            Commission applies to items priced above {formatINR(COMMISSION_FREE_UPTO)} on the GST-inclusive selling price. Rates are per leaf category in rate card RC-2026-EXAMPLE.
          </p>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title={selected.name}
              description={`${meta.variationTheme} variations, ${meta.pendingApprovals} seller approval requests pending`}
              action={meta.gated ? <Badge tone="warning" icon={Lock}>Gated</Badge> : <Badge tone="neutral">Open</Badge>}
            />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line px-5 py-4 text-[13px]">
              <div>
                <dt className="text-xs text-ink-500">Commission</dt>
                <dd className="font-medium text-ink-900">{selected.commission}% above {formatINR(COMMISSION_FREE_UPTO)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Return window</dt>
                <dd className="font-medium text-ink-900">{meta.returnWindow}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Default HSN</dt>
                <dd className="font-mono text-ink-900">{meta.hsn}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">GST on products</dt>
                <dd className="font-medium text-ink-900">{meta.gstLabel}</dd>
              </div>
              {meta.gateRequirement && (
                <div className="col-span-2">
                  <dt className="text-xs text-ink-500">Approval requirement</dt>
                  <dd className="text-ink-900">{meta.gateRequirement}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              <ActionButton
                label="Edit commission"
                icon="edit"
                size="xs"
                title={`Commission for ${selected.name}`}
                description="Creates a draft rate card version. A Finance Manager must approve before it takes effect."
                fields={[
                  { name: "rate", label: "Rate for items above ₹999 (%)", type: "number", defaultValue: String(selected.commission) },
                  { name: "from", label: "Effective from", type: "date", defaultValue: "2026-11-01" },
                ]}
                warning="Maker-checker: you cannot approve a change you created."
                note="required"
                confirmLabel="Submit for approval"
                toast="Draft submitted to Finance for approval"
              />
              <ActionButton label="Edit template" icon="edit" size="xs" variant="ghost" title="Edit attribute template" description="Adding a mandatory attribute suppresses live listings that miss it until sellers update them." fields={[{ name: "attr", label: "New attribute label" }, { name: "type", label: "Type", type: "select", options: Object.values(TYPE_LABEL) }]} note="optional" toast="Template change saved as draft, impact preview queued" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Attribute template" description="Legal declarations are mandatory for every physical product" />
            <p className="mt-3 border-t border-line bg-ink-50/60 px-5 py-2 text-xs font-medium text-ink-500">Legal Metrology</p>
            <AttributeList items={LEGAL_ATTRIBUTES} />
            <p className="border-t border-line bg-ink-50/60 px-5 py-2 text-xs font-medium text-ink-500">{selected.name}</p>
            <AttributeList items={meta.attributes} />
          </Card>
        </div>
      </div>
    </>
  );
}
