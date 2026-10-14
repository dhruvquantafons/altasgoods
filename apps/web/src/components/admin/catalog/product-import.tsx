"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import { importProducts } from "@/app/actions/admin-catalog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { ProductImportResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const TEMPLATE_URL = "/templates/altasgoods-products-template.csv";

type Row = ProductImportResult["rows"][number];

/**
 * Bulk adds products from a spreadsheet: the admin picks a CSV, sees what it
 * will add, update and skip, then imports. The file is checked again on
 * import, so nothing saved depends on the preview being current.
 */
export function ProductImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProductImportResult | null>(null);
  const [done, setDone] = useState<ProductImportResult | null>(null);

  async function send(f: File, dryRun: boolean) {
    setBusy(dryRun ? "check" : "import");
    setError(null);
    const form = new FormData();
    form.set("file", f);
    const r = await importProducts(form, dryRun);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    if (dryRun) setPreview(r.data);
    else {
      setDone(r.data);
      setPreview(null);
    }
  }

  function choose(f: File | undefined) {
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setError("Choose a .csv file. In Excel or Google Sheets, use File › Download or Save as › CSV.");
    setFile(f);
    setPreview(null);
    setDone(null);
    void send(f, true);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (done) return <Finished result={done} onAgain={reset} />;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader title="Upload a CSV file" description="One product per row. Categories, subcategories and brands that do not exist yet are created for you." />
          <CardBody>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                choose(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-brand-400 bg-brand-50" : "border-line-strong hover:border-brand-300 hover:bg-ink-50",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {busy === "check" ? <Loader2 size={26} className="animate-spin text-brand-600" aria-hidden="true" /> : <FileSpreadsheet size={26} className="text-ink-400" aria-hidden="true" />}
              <span className="text-sm font-medium text-ink-900">{busy === "check" ? "Checking your file" : file ? file.name : "Drop a CSV file here or click to choose"}</span>
              <span className="text-xs text-ink-500">Up to 4 MB and 1,000 products per file</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} aria-label="Choose a CSV file" />
            </label>
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-700">
                {error}
              </p>
            )}
          </CardBody>
        </Card>

        {preview && file && <Preview result={preview} busy={busy} onImport={() => send(file, false)} onReset={reset} />}
      </div>

      <Guide />
    </div>
  );
}

function Preview({ result, busy, onImport, onReset }: { result: ProductImportResult; busy: "check" | "import" | null; onImport: () => void; onReset: () => void }) {
  const { summary } = result;
  const ready = summary.created + summary.updated;
  return (
    <>
      <Card>
        <CardHeader title="Preview" description="Nothing is saved until you import." />
        <CardBody className="space-y-4">
          <Counts created={summary.created} updated={summary.updated} skipped={summary.skipped} future />
          <NewNames summary={summary} future />
        </CardBody>
        <CardFooter className="justify-end">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} disabled={!!busy}>
            Choose another file
          </Button>
          <Button size="sm" icon={busy === "import" ? Loader2 : Upload} onClick={onImport} disabled={!ready || !!busy} className={cn(busy === "import" && "[&_svg]:animate-spin")}>
            {busy === "import" ? "Importing" : ready ? `Import ${ready} ${ready === 1 ? "product" : "products"}` : "Nothing to import"}
          </Button>
        </CardFooter>
      </Card>
      <Columns columns={result.columns} />
      <Rows rows={result.rows} />
    </>
  );
}

function Finished({ result, onAgain }: { result: ProductImportResult; onAgain: () => void }) {
  const { summary } = result;
  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 size={32} className="text-success-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink-900">Import finished</h2>
          <p className="max-w-md text-sm text-ink-500">The products are live in your store now. Products without photos show a placeholder until you add images.</p>
          <div className="mt-4 w-full max-w-xl">
            <Counts created={summary.created} updated={summary.updated} skipped={summary.skipped} />
          </div>
          <div className="mt-2 w-full max-w-xl text-left">
            <NewNames summary={summary} />
          </div>
          {summary.imagesFailed > 0 && (
            <p className="mt-2 text-[13px] text-warning-700">
              {summary.imagesFailed} image {summary.imagesFailed === 1 ? "link" : "links"} could not be downloaded; see the rows below.
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/admin/catalog" size="sm">
              View products
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm" target="_blank">
              Open the store
            </ButtonLink>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onAgain}>
              Import another file
            </Button>
          </div>
        </CardBody>
      </Card>
      <Rows rows={result.rows} problemsOnly />
    </div>
  );
}

function Counts({ created, updated, skipped, future }: { created: number; updated: number; skipped: number; future?: boolean }) {
  const items = [
    { label: future ? "Will be added" : "Added", value: created, tone: "text-success-700" },
    { label: future ? "Will be updated" : "Updated", value: updated, tone: "text-info-700" },
    { label: future ? "Will be skipped" : "Skipped", value: skipped, tone: skipped ? "text-danger-700" : "text-ink-900" },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-line px-4 py-3">
          <dt className="text-xs font-medium text-ink-500">{i.label}</dt>
          <dd className={cn("mt-1 text-xl font-semibold tabular-nums", i.tone)}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NewNames({ summary, future }: { summary: ProductImportResult["summary"]; future?: boolean }) {
  const groups = [
    { label: "categories", items: summary.newCategories },
    { label: "subcategories", items: summary.newSubcategories },
    { label: "brands", items: summary.newBrands },
  ].filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <div className="space-y-2.5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 text-xs font-medium text-ink-500">
            {future ? "New" : "Added"} {g.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((n) => (
              <Badge key={n} tone="brand" size="sm">
                {n}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const USE_LABELS: Record<string, string> = {
  title: "Title",
  sku: "SKU",
  category: "Category",
  subcategory: "Subcategory",
  brand: "Brand",
  price: "Price",
  mrp: "MRP",
  stock: "Stock",
  description: "Description",
  highlights: "Highlights",
  tags: "Tags",
  deliveryDays: "Delivery days",
  codAvailable: "Cash on delivery",
  returnWindowDays: "Return days",
  active: "On sale",
  images: "Images",
  ignored: "Not used",
};

function Columns({ columns }: { columns: ProductImportResult["columns"] }) {
  return (
    <Card>
      <CardHeader title="How your columns are read" description="Columns that are not standard product fields are shown on the product page as specifications." />
      <CardBody>
        <ul className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {columns.map((c, i) => (
            <li key={`${c.name}-${i}`} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-line py-1.5">
              <span className="truncate font-medium text-ink-800">{c.name || "(no header)"}</span>
              <span className={cn("shrink-0 text-ink-500", c.use === "ignored" && "text-warning-700")}>{USE_LABELS[c.use] ?? c.use.replace(/^spec: /, "Spec · ").replace(/^variant: /, "Variant · ")}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function Rows({ rows, problemsOnly }: { rows: Row[]; problemsOnly?: boolean }) {
  const problems = rows.filter((r) => r.errors.length || r.warnings.length);
  const [onlyProblems, setOnlyProblems] = useState(problemsOnly || problems.length > 0);
  const shown = onlyProblems ? problems : rows;
  if (problemsOnly && !problems.length) return null;
  return (
    <Card>
      <CardHeader
        title={problemsOnly ? "Rows to look at" : "Rows"}
        description={problems.length ? `${problems.length} ${problems.length === 1 ? "row has" : "rows have"} something to check` : "Every row looks good"}
        action={
          !problemsOnly &&
          problems.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => setOnlyProblems((v) => !v)}>
              {onlyProblems ? `Show all ${rows.length}` : "Show problems only"}
            </Button>
          )
        }
      />
      <TableContainer className="mt-3">
        <Table>
          <THead>
            <TR>
              <TH className="w-16">Line</TH>
              <TH>Product</TH>
              <TH>Result</TH>
              <TH>Notes</TH>
            </TR>
          </THead>
          <TBody>
            {shown.slice(0, 300).map((r) => (
              <TR key={r.line}>
                <TD className="tabular-nums text-ink-500">{r.line}</TD>
                <TD>
                  {r.productId && r.action !== "skip" ? (
                    <Link href={`/admin/catalog/${r.productId}`} className="line-clamp-1 text-[13px] font-medium text-ink-900 hover:text-brand-700">
                      {r.title || "(no title)"}
                    </Link>
                  ) : (
                    <span className="line-clamp-1 text-[13px] font-medium text-ink-900">{r.title || "(no title)"}</span>
                  )}
                  <span className="block font-mono text-xs text-ink-500">{r.sku}</span>
                </TD>
                <TD>
                  <Badge size="sm" tone={r.action === "create" ? "success" : r.action === "update" ? "info" : "danger"}>
                    {r.action === "create" ? "Add" : r.action === "update" ? "Update" : "Skip"}
                  </Badge>
                </TD>
                <TD className="min-w-[240px]">
                  <ul className="space-y-0.5 text-xs">
                    {r.errors.map((e) => (
                      <li key={e} className="flex gap-1.5 text-danger-700">
                        <XCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
                        {e}
                      </li>
                    ))}
                    {r.warnings.map((w) => (
                      <li key={w} className="flex gap-1.5 text-warning-700">
                        <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableContainer>
      {shown.length > 300 && <p className="px-5 py-3 text-xs text-ink-500">Showing the first 300 of {shown.length} rows.</p>}
    </Card>
  );
}

function Guide() {
  const rows = [
    ["Title", "Required. The product name."],
    ["Category", "Required. Created if it is new, e.g. Spices or Electronics."],
    ["Price", "Required. Selling price in rupees, e.g. 1299 or ₹1,299."],
    ["SKU", "Your product code. A SKU already in the store updates that product."],
    ["Subcategory, Brand", "Created if new. Default to General and Generic."],
    ["MRP, Stock", "MRP defaults to the price; stock to 0."],
    ["Images", "Public image links, separated by |. Up to 8."],
    ["Highlights", "Separated by |."],
    ["Active, COD", "yes or no."],
    ["Any other column", "Becomes a specification, e.g. Weight or RAM. Name it Group: Label to group them."],
    ["Variant: Name", "Options separated by |, e.g. Variant: Size with S|M|L."],
  ];
  return (
    <Card className="h-fit">
      <CardHeader title="Columns" description="Header names are flexible: Name, Product name and Title all work." />
      <CardBody className="space-y-4">
        <dl className="space-y-2.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium text-ink-900">{k}</dt>
              <dd className="text-ink-500">{v}</dd>
            </div>
          ))}
        </dl>
        <ButtonLink href={TEMPLATE_URL} variant="secondary" size="sm" icon={Download} download className="w-full">
          Download template
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
