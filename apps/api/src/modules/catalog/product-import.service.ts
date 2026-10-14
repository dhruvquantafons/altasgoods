import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, unprocessable } from "../../common/errors.js";
import { HOUSE_SELLER_ID } from "../../common/house.js";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { offers, products } from "../../db/schema.js";
import { imagePath, PRODUCT_TAGS, productInput, productPatch, type importResult, type ProductInput, type ProductPatch } from "./admin-catalog.schemas.js";
import { AdminCatalogService, slugify } from "./admin-catalog.service.js";
import { parseCsv } from "./csv.js";
import { downloadImage } from "./remote-image.js";

export const MAX_IMPORT_ROWS = 1000;
export const PLACEHOLDER_IMAGE = "/images/products/placeholder.jpg";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DOWNLOADS_AT_ONCE = 6;
const DEFAULT_SUBCATEGORY = "General";
const DEFAULT_BRAND = "Generic";
const SPEC_GROUP = "Specifications";

/**
 * Column names an import understands, compared after lowercasing and dropping
 * punctuation and anything in brackets ("Price (INR)" is "price"). Spreadsheets
 * from other platforms use many names for the same thing.
 */
const FIELDS = {
  title: ["title", "name", "product", "product name", "product title", "item name", "item"],
  sku: ["sku", "sku code", "sku id", "product code", "item code", "code", "article number"],
  category: ["category", "category name", "department", "collection"],
  subcategory: ["subcategory", "sub category", "subcategory name", "type", "product type"],
  brand: ["brand", "brand name", "manufacturer", "make", "vendor"],
  price: ["price", "selling price", "sale price", "our price", "offer price", "unit price"],
  mrp: ["mrp", "max retail price", "maximum retail price", "list price", "original price", "compare at price", "regular price"],
  stock: ["stock", "quantity", "qty", "inventory", "stock quantity", "available quantity", "units"],
  description: ["description", "product description", "details", "about", "body"],
  highlights: ["highlights", "features", "key features", "bullet points", "bullets"],
  tags: ["tags", "labels", "badges"],
  deliveryDays: ["delivery days", "delivery time", "shipping days", "dispatch days"],
  codAvailable: ["cod", "cod available", "cash on delivery"],
  returnWindowDays: ["return days", "return window", "return window days", "returns"],
  active: ["active", "status", "on sale", "published", "visible", "enabled"],
} as const;
type Field = keyof typeof FIELDS;

const LABELS: Record<string, string> = {
  title: "Title",
  sku: "SKU",
  description: "Description",
  highlights: "Highlights",
  specs: "Specifications",
  variants: "Variants",
  images: "Images",
  subcategory: "Subcategory",
  tags: "Tags",
  pricePaise: "Price",
  mrpPaise: "MRP",
  stock: "Stock",
  deliveryDays: "Delivery days",
  codAvailable: "COD",
  returnWindowDays: "Return days",
};

type Column =
  | { kind: "field"; field: Field }
  | { kind: "images" }
  | { kind: "spec"; group: string; label: string }
  | { kind: "variant"; name: string }
  | { kind: "ignored" };

const normalize = (h: string) =>
  h
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[_\-./*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const IMAGE_HEADER = /^(images?|photos?|pictures?|image (url|link)s?|main image|thumbnail|additional images?)( \d+)?$/;

/** What each header means. Headers it does not recognise become specifications, so any kind of product fits. */
function mapColumns(header: string[]) {
  const seen = new Set<Field>();
  const columns: Column[] = header.map((raw) => {
    const name = raw.trim();
    const n = normalize(name);
    if (!n) return { kind: "ignored" };
    if (IMAGE_HEADER.test(n)) return { kind: "images" };
    const variant = /^variants?\s*:\s*(.+)$/i.exec(name);
    if (variant) return { kind: "variant", name: variant[1]!.trim().slice(0, 40) };
    const field = (Object.keys(FIELDS) as Field[]).find((f) => (FIELDS[f] as readonly string[]).includes(n));
    if (field) {
      if (seen.has(field)) return { kind: "ignored" };
      seen.add(field);
      return { kind: "field", field };
    }
    // "Display: Screen size" files the value under a group of its own
    const grouped = /^([^:]+):(.+)$/.exec(name);
    if (grouped && grouped[1]!.trim() && grouped[2]!.trim()) return { kind: "spec", group: grouped[1]!.trim().slice(0, 60), label: grouped[2]!.trim().slice(0, 60) };
    return { kind: "spec", group: SPEC_GROUP, label: name.slice(0, 60) };
  });
  const missing = (["title", "category", "price"] as const).filter((f) => !seen.has(f));
  if (missing.length)
    throw unprocessable(
      "IMPORT_COLUMNS_MISSING",
      `The file needs ${missing.map((f) => `a ${f === "title" ? "title (or name)" : f} column`).join(", ")}. Download the template to see the expected columns.`,
    );
  return columns;
}

/** "₹1,299.50", "Rs. 1299" or "1299.5" in paise; NaN when it is not a number. */
function parseMoney(v: string) {
  const n = Number(v.replace(/₹|rs\.?|inr|,|\s/gi, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function parseBool(v: string) {
  const s = v.trim().toLowerCase();
  if (["yes", "y", "true", "1", "active", "live", "published", "on", "enabled", "available"].includes(s)) return true;
  if (["no", "n", "false", "0", "inactive", "draft", "hidden", "off", "disabled", "unavailable", "archived"].includes(s)) return false;
  return undefined;
}

const parseInteger = (v: string) => (/^\s*\d+(\.0+)?\s*$/.test(v.replace(/,/g, "")) ? Number.parseInt(v.replace(/,/g, ""), 10) : NaN);
const splitList = (v: string) =>
  v
    .split(/\s*[|\n;]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
const splitImages = (v: string) =>
  v
    .split(/\s*\|\s*|\s+|,(?=\s*(?:https?:\/\/|\/))/)
    .map((x) => x.trim())
    .filter(Boolean);

type ImportResult = z.infer<typeof importResult>;
type RowResult = ImportResult["rows"][number];

interface Existing {
  id: string;
  sku: string;
  categoryId: string;
  subcategory: string;
  brandId: string;
  pricePaise: number;
  mrpPaise: number;
}

/** Names an import adds to the store, and how its image downloads went. */
interface RunState {
  newCategories: string[];
  newSubcategories: { category: string; name: string }[];
  newBrands: string[];
  imagesDownloaded: number;
  imagesFailed: number;
}

interface PlannedRow extends RowResult {
  category: string;
  subcategory: string;
  brand: string;
  images: string[];
  /** product fields from the file; placement and images are filled in at commit */
  fields: Partial<ProductInput>;
}

/**
 * Adds and updates products from a CSV a store admin uploads in AltasGoods
 * Control. Categories, subcategories and brands the file names are created
 * when the store has none by that name; a row whose SKU the store already
 * sells updates that product, and blank cells leave its details as they are.
 * A dry run checks every row and reports what would change without saving.
 */
@Injectable()
export class ProductImportService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AdminCatalogService) private readonly catalog: AdminCatalogService,
  ) {}

  async run(userId: string, file: { buffer: Buffer; size: number } | undefined, dryRun: boolean): Promise<ImportResult> {
    if (!file?.buffer?.length) throw unprocessable("FILE_REQUIRED", "Choose a CSV file");
    const text = decode(file.buffer);
    if (text.includes("\u0000")) throw new ApiError(415, "FILE_TYPE", "Save the sheet as CSV (comma separated values) and upload that file");
    const [header, ...body] = parseCsv(text);
    if (!header || !body.length) throw unprocessable("IMPORT_EMPTY", "The file has no product rows under its header row");
    if (body.length > MAX_IMPORT_ROWS) throw unprocessable("IMPORT_TOO_LARGE", `A file can have up to ${MAX_IMPORT_ROWS} products. Split it into smaller files.`);
    const columns = mapColumns(header);

    const run: RunState = { newCategories: [], newSubcategories: [], newBrands: [], imagesDownloaded: 0, imagesFailed: 0 };
    const plan = await this.plan(run, columns, body);
    if (!dryRun) await this.commit(run, userId, plan);

    const valid = plan.filter((r) => r.action !== "skip");
    const lc = (s: string) => s.toLowerCase();
    return {
      dryRun,
      columns: header.map((name, i) => {
        const c = columns[i]!;
        return {
          name: name.trim(),
          use: c.kind === "field" ? c.field : c.kind === "spec" ? `spec: ${c.group} › ${c.label}` : c.kind === "variant" ? `variant: ${c.name}` : c.kind,
        };
      }),
      summary: {
        rows: plan.length,
        created: plan.filter((r) => r.action === "create").length,
        updated: plan.filter((r) => r.action === "update").length,
        skipped: plan.length - valid.length,
        newCategories: run.newCategories.filter((n) => valid.some((r) => lc(r.category) === lc(n))),
        newSubcategories: run.newSubcategories.filter(({ category, name }) => valid.some((r) => lc(r.category) === lc(category) && lc(r.subcategory) === lc(name))).map((s) => `${s.category} › ${s.name}`),
        newBrands: run.newBrands.filter((n) => valid.some((r) => lc(r.brand) === lc(n))),
        imagesDownloaded: run.imagesDownloaded,
        imagesFailed: run.imagesFailed,
      },
      rows: plan.map(({ line, sku, title, action, productId, errors, warnings }) => ({ line, sku, title, action, productId, errors, warnings })),
    };
  }

  /* -------------------------------- Plan --------------------------------- */

  /** Reads and checks every row without saving anything. */
  private async plan(run: RunState, columns: Column[], body: string[][]): Promise<PlannedRow[]> {
    const [cats, brandList, existingRows] = await Promise.all([
      this.catalog.categories(),
      this.catalog.brands(),
      this.db
        .select({
          id: products.id,
          sku: products.sku,
          categoryId: products.categoryId,
          subcategory: products.subcategory,
          brandId: products.brandId,
          pricePaise: offers.pricePaise,
          mrpPaise: offers.mrpPaise,
        })
        .from(products)
        .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID))),
    ]);
    const bySku = new Map<string, Existing[]>();
    for (const p of existingRows) bySku.set(p.sku.toLowerCase(), [...(bySku.get(p.sku.toLowerCase()) ?? []), p]);
    const findCategory = (name: string) => {
      const n = name.toLowerCase();
      return cats.find((c) => c.name.toLowerCase() === n || c.slug === slugify(name) || c.id === name);
    };
    const findBrand = (name: string) => brandList.find((b) => b.name.toLowerCase() === name.toLowerCase() || b.slug === slugify(name) || b.id === name);
    const skuLines = new Map<string, number>();

    return body.map((cells, i) => {
      const line = i + 2;
      const errors: string[] = [];
      const warnings: string[] = [];
      const get = (f: Field) => {
        const at = columns.findIndex((c) => c.kind === "field" && c.field === f);
        return at < 0 ? "" : (cells[at] ?? "").trim();
      };

      const title = get("title");
      if (!title) errors.push("Title is empty");
      const sku = (get("sku") || slugify(title).toUpperCase()).slice(0, 64);
      if (!get("sku") && title) warnings.push(`No SKU given; using ${sku}`);

      const matches = bySku.get(sku.toLowerCase()) ?? [];
      if (matches.length > 1) errors.push(`SKU ${sku} is used by ${matches.length} products already. Give them different SKUs first.`);
      const earlier = skuLines.get(sku.toLowerCase());
      if (earlier) errors.push(`SKU ${sku} is also on line ${earlier}`);
      else skuLines.set(sku.toLowerCase(), line);
      const existing = matches.length === 1 ? matches[0]! : undefined;

      // placement: names, created at commit when the store has none by that name
      const categoryName = get("category");
      const category = categoryName ? findCategory(categoryName) : cats.find((c) => c.id === existing?.categoryId);
      let categoryLabel = category?.name ?? categoryName;
      if (!categoryLabel) errors.push("Category is empty");
      else if (!category) {
        if (categoryName.length < 2 || categoryName.length > 60) errors.push("Category names are 2 to 60 characters");
        const known = run.newCategories.find((n) => n.toLowerCase() === categoryName.toLowerCase());
        if (known) categoryLabel = known;
        else run.newCategories.push(categoryName);
      }
      const keepSub = existing && category?.id === existing.categoryId;
      const subName = get("subcategory") || (keepSub ? existing.subcategory : DEFAULT_SUBCATEGORY);
      const sub = category?.subcategories.find((s) => s.name.toLowerCase() === subName.toLowerCase());
      let subcategory = sub?.name ?? subName;
      if (subName.length > 60) errors.push("Subcategory names are up to 60 characters");
      else if (!sub && categoryLabel) {
        const known = run.newSubcategories.find((s) => s.category.toLowerCase() === categoryLabel.toLowerCase() && s.name.toLowerCase() === subName.toLowerCase());
        if (known) subcategory = known.name;
        else run.newSubcategories.push({ category: categoryLabel, name: subName });
      }
      const brandName = get("brand") || (existing ? (brandList.find((b) => b.id === existing.brandId)?.name ?? DEFAULT_BRAND) : DEFAULT_BRAND);
      const brand = findBrand(brandName);
      let brandLabel = brand?.name ?? brandName;
      if (brandName.length > 60) errors.push("Brand names are up to 60 characters");
      else if (!brand) {
        const known = run.newBrands.find((n) => n.toLowerCase() === brandName.toLowerCase());
        if (known) brandLabel = known;
        else run.newBrands.push(brandName);
      }

      // prices and numbers; blank cells keep an existing product's values
      const fields: Partial<ProductInput> = { sku, title };
      const price = get("price");
      if (price) {
        fields.pricePaise = parseMoney(price);
        if (!(fields.pricePaise > 0)) errors.push(`Price "${price}" is not a positive amount`);
      } else if (!existing) errors.push("Price is empty");
      const mrp = get("mrp");
      if (mrp) {
        fields.mrpPaise = parseMoney(mrp);
        if (!(fields.mrpPaise > 0)) errors.push(`MRP "${mrp}" is not a positive amount`);
      } else if (!existing && fields.pricePaise) fields.mrpPaise = fields.pricePaise;
      const finalPrice = fields.pricePaise ?? existing?.pricePaise ?? 0;
      const finalMrp = fields.mrpPaise ?? existing?.mrpPaise ?? 0;
      if (finalPrice > 0 && finalMrp > 0 && finalPrice > finalMrp) errors.push("The price cannot be more than the MRP");

      const stock = get("stock");
      if (stock) {
        fields.stock = parseInteger(stock);
        if (Number.isNaN(fields.stock)) errors.push(`Stock "${stock}" is not a whole number`);
      } else if (!existing) {
        fields.stock = 0;
        warnings.push("No stock given; it shows as out of stock until you add some");
      }
      for (const [f, label] of [
        ["deliveryDays", "Delivery days"],
        ["returnWindowDays", "Return days"],
      ] as const) {
        const v = get(f);
        if (!v) continue;
        fields[f] = parseInteger(v);
        if (Number.isNaN(fields[f])) errors.push(`${label} "${v}" is not a whole number`);
      }
      for (const [f, label] of [
        ["codAvailable", "COD"],
        ["active", "Active"],
      ] as const) {
        const v = get(f);
        if (!v) continue;
        const b = parseBool(v);
        if (b === undefined) errors.push(`${label} "${v}" should be yes or no`);
        else fields[f] = b;
      }

      if (get("description")) fields.description = get("description");
      if (get("highlights")) fields.highlights = splitList(get("highlights"));
      if (get("tags")) {
        const tags = splitList(get("tags").replace(/,/g, "|")).map((t) => t.toLowerCase());
        fields.tags = tags.filter((t): t is (typeof PRODUCT_TAGS)[number] => (PRODUCT_TAGS as readonly string[]).includes(t));
        const unknown = tags.filter((t) => !(PRODUCT_TAGS as readonly string[]).includes(t));
        if (unknown.length) warnings.push(`Tags ${unknown.join(", ")} were left out; tags can be ${PRODUCT_TAGS.join(", ")}`);
      }

      // the columns nobody planned for: specifications and variants
      const specs = new Map<string, { label: string; value: string }[]>();
      const variants: NonNullable<ProductInput["variants"]> = [];
      const images: string[] = [];
      columns.forEach((c, at) => {
        const v = (cells[at] ?? "").trim();
        if (!v) return;
        if (c.kind === "images") images.push(...splitImages(v));
        else if (c.kind === "spec") {
          if (v.length > 200) warnings.push(`${c.label} was cut to 200 characters`);
          specs.set(c.group, [...(specs.get(c.group) ?? []), { label: c.label, value: v.slice(0, 200) }]);
        } else if (c.kind === "variant") variants.push({ name: c.name, values: splitList(v.replace(/,/g, "|")).map((label) => ({ label: label.slice(0, 40), available: true })) });
      });
      if (specs.size) fields.specs = [...specs].map(([group, items]) => ({ group, items }));
      if (variants.length) fields.variants = variants;

      const usable = images.filter((src) => {
        if (/^https?:\/\//i.test(src) || imagePath.safeParse(src).success) return true;
        warnings.push(`Image "${src.slice(0, 80)}" was left out; use a full http(s) link`);
        return false;
      });
      if (usable.length > 8) warnings.push(`Only the first 8 of ${usable.length} images are used`);
      if (!usable.length && !existing) warnings.push("No image given; a placeholder is shown until you add one");

      // the same rules as the product form, with stand-ins for what is only known at commit
      const check = existing
        ? productPatch.safeParse({ ...fields, subcategory })
        : productInput.safeParse({ ...fields, subcategory, images: [PLACEHOLDER_IMAGE], categoryId: "-", brandId: "-" });
      if (!check.success)
        for (const issue of check.error.issues) {
          const label = LABELS[String(issue.path[0] ?? "")] ?? String(issue.path[0] ?? "Row");
          // one message per field: the plainer ones above win
          if (!errors.some((e) => e.toLowerCase().includes(label.toLowerCase()))) errors.push(`${label}: ${issue.message}`);
        }

      return {
        line,
        sku,
        title,
        action: errors.length ? "skip" : existing ? "update" : "create",
        productId: existing?.id ?? null,
        errors,
        warnings,
        category: categoryLabel,
        subcategory,
        brand: brandLabel,
        images: usable.slice(0, 8),
        fields,
      };
    });
  }

  /* ------------------------------- Commit -------------------------------- */

  private async commit(run: RunState, userId: string, plan: PlannedRow[]) {
    const rows = plan.filter((r) => r.action !== "skip");
    const fail = (r: PlannedRow, message: string) => {
      r.errors.push(message);
      r.action = "skip";
    };

    // categories and subcategories the file names that the store does not have yet
    const cats = await this.catalog.categories();
    const wanted = new Map<string, { name: string; subs: Map<string, string>; rows: PlannedRow[] }>();
    for (const r of rows) {
      const key = r.category.toLowerCase();
      const entry = wanted.get(key) ?? { name: r.category, subs: new Map<string, string>(), rows: [] as PlannedRow[] };
      entry.subs.set(r.subcategory.toLowerCase(), entry.subs.get(r.subcategory.toLowerCase()) ?? r.subcategory);
      entry.rows.push(r);
      wanted.set(key, entry);
    }
    const categoryIds = new Map<string, string>();
    for (const [key, w] of wanted) {
      const current = cats.find((c) => c.name.toLowerCase() === key || c.slug === slugify(w.name));
      try {
        if (!current) {
          const c = await this.catalog.createCategory({ name: w.name, subcategories: [...w.subs.values()] });
          categoryIds.set(key, c.id);
        } else {
          categoryIds.set(key, current.id);
          const have = new Set(current.subcategories.map((s) => s.name.toLowerCase()));
          const added = [...w.subs.values()].filter((s) => !have.has(s.toLowerCase()));
          if (added.length) await this.catalog.updateCategory(current.id, { subcategories: [...current.subcategories.map((s) => s.name), ...added] });
        }
      } catch (e) {
        for (const r of w.rows) fail(r, `Category ${w.name} could not be saved: ${messageOf(e)}`);
      }
    }

    // brands likewise
    const brandList = await this.catalog.brands();
    const brandIds = new Map<string, string>();
    for (const r of rows) {
      if (r.action === "skip") continue;
      const key = r.brand.toLowerCase();
      if (brandIds.has(key)) continue;
      const current = brandList.find((b) => b.name.toLowerCase() === key || b.slug === slugify(r.brand));
      try {
        brandIds.set(key, current?.id ?? (await this.catalog.createBrand({ name: r.brand })).id);
      } catch (e) {
        brandIds.set(key, "");
        fail(r, `Brand ${r.brand} could not be saved: ${messageOf(e)}`);
      }
    }

    // images by link, each fetched once however many rows use it
    const links = [...new Set(rows.filter((r) => r.action !== "skip").flatMap((r) => r.images.filter((src) => /^https?:\/\//i.test(src))))];
    const fetched = new Map<string, { url: string } | { reason: string }>();
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(DOWNLOADS_AT_ONCE, links.length) }, async () => {
        while (next < links.length) {
          const link = links[next++]!;
          const got = await downloadImage(link, MAX_IMAGE_BYTES);
          if (!got.ok) {
            fetched.set(link, { reason: got.reason });
            continue;
          }
          try {
            fetched.set(link, { url: (await this.catalog.uploadImage(userId, { buffer: got.buffer, size: got.buffer.length })).url });
          } catch (e) {
            fetched.set(link, { reason: e instanceof ApiError && e.code === "FILE_TYPE" ? "is not a PNG, JPG or WebP image" : messageOf(e) });
          }
        }
      }),
    );
    run.imagesDownloaded = [...fetched.values()].filter((f) => "url" in f).length;
    run.imagesFailed = fetched.size - run.imagesDownloaded;

    // the products, one at a time so a problem with one row never undoes the others
    for (const r of rows) {
      if (r.action === "skip") continue;
      const categoryId = categoryIds.get(r.category.toLowerCase());
      const brandId = brandIds.get(r.brand.toLowerCase());
      if (!categoryId || !brandId) continue;
      const images: string[] = [];
      for (const src of r.images) {
        const f = fetched.get(src);
        if (!f) images.push(src);
        else if ("url" in f) images.push(f.url);
        else r.warnings.push(`Image ${src.slice(0, 80)} ${f.reason}`);
      }
      try {
        if (r.action === "update") {
          const patch: ProductPatch = { ...r.fields, categoryId, brandId, subcategory: r.subcategory, ...(images.length ? { images } : {}) };
          await this.catalog.updateProduct(r.productId!, patch);
        } else {
          if (!images.length && r.images.length) r.warnings.push("No image could be added; a placeholder is shown until you add one");
          const input = productInput.parse({ ...r.fields, categoryId, brandId, subcategory: r.subcategory, images: images.length ? images : [PLACEHOLDER_IMAGE] });
          r.productId = (await this.catalog.createProduct(input)).id;
        }
      } catch (e) {
        fail(r, messageOf(e));
      }
    }
  }
}

function messageOf(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (e && typeof e === "object" && "issues" in e) return "Some details are not valid";
  return "Something went wrong";
}

/** UTF-8, or the Windows encoding Excel uses for "CSV" on many PCs. */
function decode(buf: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}
