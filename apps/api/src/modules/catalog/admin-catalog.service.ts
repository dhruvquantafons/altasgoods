import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, conflict, notFound, unprocessable } from "../../common/errors.js";
import { HOUSE_SELLER_ID } from "../../common/house.js";
import { DB, FILE_STORE } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { brands, categories, files, media, offers, products } from "../../db/schema.js";
import { sniffMime, type FileStore } from "../files/file-store.js";
import type { adminProductQuery, brandInput, brandPatch, categoryInput, categoryPatch, ProductInput, ProductPatch } from "./admin-catalog.schemas.js";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** "Linen Cushion Covers (Set of 2)" to "linen-cushion-covers-set-of-2". */
export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "item";

type Product = typeof products.$inferSelect;
type Offer = typeof offers.$inferSelect;

/**
 * The store's catalog, edited in AltasGoods Control: products with their
 * price and stock (kept on the store's offer), categories, brands and
 * product images.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(FILE_STORE) private readonly files: FileStore,
  ) {}

  /* ------------------------------ Products ------------------------------ */

  async listProducts(q: z.infer<typeof adminProductQuery>) {
    const where: SQL[] = [];
    if (q.q) where.push(or(ilike(products.title, `%${q.q}%`), ilike(products.sku, `%${q.q}%`), ilike(products.id, `%${q.q}%`))!);
    if (q.category) where.push(eq(products.categoryId, q.category));
    const live = and(eq(products.listingStatus, "LIVE"), eq(offers.status, "ACTIVE"))!;
    if (q.status === "active") where.push(live);
    if (q.status === "inactive") where.push(sql`not (${live})`);
    if (q.stock === "out") where.push(eq(offers.stock, 0));
    if (q.stock === "low") where.push(sql`${offers.stock} between 1 and 10`);
    const filter = where.length ? and(...where) : undefined;

    const base = () =>
      this.db
        .select({ product: products, offer: offers, brand: { id: brands.id, name: brands.name }, category: { id: categories.id, name: categories.name } })
        .from(products)
        .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID)))
        .innerJoin(brands, eq(brands.id, products.brandId))
        .innerJoin(categories, eq(categories.id, products.categoryId));
    const [rows, [total]] = await Promise.all([
      base()
        .where(filter)
        .orderBy(desc(products.updatedAt), asc(products.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db
        .select({ n: count() })
        .from(products)
        .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID)))
        .where(filter),
    ]);
    return {
      items: rows.map(({ product: p, offer: o, brand, category }) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        title: p.title,
        image: p.images[0] ?? "",
        brand,
        category,
        subcategory: p.subcategory,
        pricePaise: o.pricePaise,
        mrpPaise: o.mrpPaise,
        stock: o.stock,
        active: isActive(p, o),
        updatedAt: p.updatedAt.toISOString(),
      })),
      page: q.page,
      pageSize: q.pageSize,
      total: Number(total?.n ?? 0),
    };
  }

  async product(id: string) {
    const [row] = await this.db
      .select({ product: products, offer: offers })
      .from(products)
      .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID)))
      .where(eq(products.id, id));
    if (!row) throw notFound("Product");
    return toAdminProduct(row.product, row.offer);
  }

  async createProduct(input: ProductInput) {
    const id = await this.db.transaction(async (tx) => {
      const names = await this.checkPlacement(tx, input.categoryId, input.subcategory, input.brandId);
      const slug = input.slug ?? (await uniqueSlug(tx, slugify(input.title)));
      const [taken] = await tx.select({ id: products.id }).from(products).where(or(eq(products.slug, slug), eq(products.id, `p-${slug}`)));
      if (taken) throw conflict("SLUG_TAKEN", `Another product already uses the address /p/${slug}`);
      const [p] = await tx
        .insert(products)
        .values({
          id: `p-${slug}`,
          slug,
          sku: input.sku,
          title: input.title,
          brandId: input.brandId,
          categoryId: input.categoryId,
          subcategory: input.subcategory,
          description: input.description,
          highlights: input.highlights,
          specs: input.specs,
          variants: input.variants,
          images: input.images,
          tags: input.tags,
          listingStatus: input.active ? "LIVE" : "INACTIVE",
          searchText: searchText(input.title, names.brand, names.category, input.subcategory),
        })
        .returning();
      await tx.insert(offers).values({
        productId: p!.id,
        sellerId: HOUSE_SELLER_ID,
        pricePaise: input.pricePaise,
        mrpPaise: input.mrpPaise,
        stock: input.stock,
        deliveryDays: input.deliveryDays,
        codAvailable: input.codAvailable,
        returnWindowDays: input.returnWindowDays,
        status: input.active ? "ACTIVE" : "PAUSED",
      });
      return p!.id;
    });
    return this.product(id);
  }

  async updateProduct(id: string, patch: ProductPatch) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ product: products, offer: offers })
        .from(products)
        .innerJoin(offers, and(eq(offers.productId, products.id), eq(offers.sellerId, HOUSE_SELLER_ID)))
        .where(eq(products.id, id))
        .for("update");
      if (!row) throw notFound("Product");
      const { product: p, offer: o } = row;
      const next = {
        categoryId: patch.categoryId ?? p.categoryId,
        subcategory: patch.subcategory ?? p.subcategory,
        brandId: patch.brandId ?? p.brandId,
        title: patch.title ?? p.title,
      };
      const price = patch.pricePaise ?? o.pricePaise;
      const mrp = patch.mrpPaise ?? o.mrpPaise;
      if (price > mrp) throw unprocessable("PRICE_ABOVE_MRP", "The selling price cannot be more than the MRP");
      const names = await this.checkPlacement(tx, next.categoryId, next.subcategory, next.brandId);

      await tx
        .update(products)
        .set({
          ...pick(patch, ["sku", "title", "description", "highlights", "specs", "variants", "images", "tags"]),
          ...next,
          ...(patch.active !== undefined ? { listingStatus: patch.active ? "LIVE" : "INACTIVE" } : {}),
          searchText: searchText(next.title, names.brand, names.category, next.subcategory),
        })
        .where(eq(products.id, id));
      await tx
        .update(offers)
        .set({
          pricePaise: price,
          mrpPaise: mrp,
          ...pick(patch, ["stock", "deliveryDays", "codAvailable", "returnWindowDays"]),
          ...(patch.active !== undefined ? { status: patch.active ? ("ACTIVE" as const) : ("PAUSED" as const) } : {}),
        })
        .where(eq(offers.id, o.id));
    });
    return this.product(id);
  }

  /** The category exists, the subcategory belongs to it and the brand exists; returns their names for search. */
  private async checkPlacement(tx: Tx, categoryId: string, subcategory: string, brandId: string) {
    const [category] = await tx.select().from(categories).where(and(eq(categories.id, categoryId), isNull(categories.parentId)));
    if (!category) throw unprocessable("CATEGORY_UNKNOWN", "Choose a category");
    const subs = await tx.select({ name: categories.name }).from(categories).where(eq(categories.parentId, categoryId));
    if (subs.length && !subs.some((s) => s.name === subcategory)) throw unprocessable("SUBCATEGORY_UNKNOWN", `Choose a subcategory of ${category.name}`);
    const [brand] = await tx.select({ name: brands.name }).from(brands).where(eq(brands.id, brandId));
    if (!brand) throw unprocessable("BRAND_UNKNOWN", "Choose a brand");
    return { category: category.name, brand: brand.name };
  }

  /* ----------------------------- Categories ----------------------------- */

  async categories() {
    const [rows, counts] = await Promise.all([
      this.db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      this.db.select({ categoryId: products.categoryId, subcategory: products.subcategory, n: count() }).from(products).groupBy(products.categoryId, products.subcategory),
    ]);
    return rows
      .filter((c) => !c.parentId)
      .map((c) => {
        const mine = counts.filter((n) => n.categoryId === c.id);
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          image: c.image,
          sortOrder: c.sortOrder,
          subcategories: rows
            .filter((x) => x.parentId === c.id)
            .map((x) => ({ id: x.id, name: x.name, productCount: Number(mine.find((n) => n.subcategory === x.name)?.n ?? 0) })),
          productCount: mine.reduce((a, n) => a + Number(n.n), 0),
        };
      });
  }

  private async category(id: string) {
    const c = (await this.categories()).find((x) => x.id === id);
    if (!c) throw notFound("Category");
    return c;
  }

  async createCategory(input: z.infer<typeof categoryInput>) {
    const slug = input.slug ?? slugify(input.name);
    const id = `cat-${slug}`;
    await this.db.transaction(async (tx) => {
      const [taken] = await tx.select({ id: categories.id }).from(categories).where(or(eq(categories.id, id), eq(categories.slug, slug)));
      if (taken) throw conflict("SLUG_TAKEN", `A category already uses the address /c/${slug}`);
      const [{ last }] = (await tx.select({ last: sql<number>`coalesce(max(${categories.sortOrder}), -1)::int` }).from(categories).where(isNull(categories.parentId))) as [{ last: number }];
      await tx.insert(categories).values({ id, slug, name: input.name, icon: input.icon ?? null, image: input.image ?? null, sortOrder: input.sortOrder ?? last + 1 });
      await this.syncSubcategories(tx, { id, slug, name: input.name }, input.subcategories ?? []);
    });
    return this.category(id);
  }

  async updateCategory(id: string, patch: z.infer<typeof categoryPatch>) {
    await this.db.transaction(async (tx) => {
      const [c] = await tx.select().from(categories).where(and(eq(categories.id, id), isNull(categories.parentId)));
      if (!c) throw notFound("Category");
      if (patch.slug && patch.slug !== c.slug) {
        const [taken] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, patch.slug));
        if (taken) throw conflict("SLUG_TAKEN", `A category already uses the address /c/${patch.slug}`);
      }
      const fields = pick(patch, ["name", "slug", "icon", "image", "sortOrder"]);
      if (Object.keys(fields).length) await tx.update(categories).set(fields).where(eq(categories.id, id));
      if (patch.subcategories) await this.syncSubcategories(tx, { id, slug: patch.slug ?? c.slug, name: patch.name ?? c.name }, patch.subcategories);
      if (patch.name && patch.name !== c.name) await refreshSearchText(tx, eq(products.categoryId, id));
    });
    return this.category(id);
  }

  /** Makes a category's subcategories exactly these names, in this order. One that products still use cannot be removed. */
  private async syncSubcategories(tx: Tx, parent: { id: string; slug: string; name: string }, names: string[]) {
    const wanted = [...new Map(names.map((n) => [n.toLowerCase(), n.trim()])).values()];
    const current = await tx.select().from(categories).where(eq(categories.parentId, parent.id));
    const gone = current.filter((c) => !wanted.includes(c.name));
    if (gone.length) {
      const used = await tx
        .select({ subcategory: products.subcategory, n: count() })
        .from(products)
        .where(and(eq(products.categoryId, parent.id), inArray(products.subcategory, gone.map((g) => g.name))))
        .groupBy(products.subcategory);
      if (used.length) throw conflict("SUBCATEGORY_IN_USE", `${used.map((u) => `${u.n} ${Number(u.n) === 1 ? "product uses" : "products use"} ${u.subcategory}`).join(", ")}. Move them to another subcategory first.`);
      await tx.delete(categories).where(inArray(categories.id, gone.map((g) => g.id)));
    }
    for (const [i, name] of wanted.entries()) {
      const existing = current.find((c) => c.name === name);
      if (existing) await tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, existing.id));
      else {
        const sub = slugify(name);
        await tx.insert(categories).values({ id: `${parent.id}-${sub}`, slug: `${parent.slug}-${sub}`, name, parentId: parent.id, sortOrder: i }).onConflictDoUpdate({ target: categories.id, set: { name, sortOrder: i } });
      }
    }
  }

  async deleteCategory(id: string) {
    await this.db.transaction(async (tx) => {
      const [c] = await tx.select().from(categories).where(and(eq(categories.id, id), isNull(categories.parentId)));
      if (!c) throw notFound("Category");
      const [{ n }] = (await tx.select({ n: count() }).from(products).where(eq(products.categoryId, id))) as [{ n: number }];
      if (Number(n)) throw conflict("CATEGORY_IN_USE", `${n} ${Number(n) === 1 ? "product is" : "products are"} in ${c.name}. Move them to another category first.`);
      await tx.delete(categories).where(or(eq(categories.id, id), eq(categories.parentId, id)));
    });
  }

  /* ------------------------------- Brands ------------------------------- */

  async brands() {
    const [rows, counts] = await Promise.all([
      this.db.select().from(brands).orderBy(asc(brands.name)),
      this.db.select({ brandId: products.brandId, n: count() }).from(products).groupBy(products.brandId),
    ]);
    const by = new Map(counts.map((c) => [c.brandId, Number(c.n)]));
    return rows.map((b) => ({ id: b.id, slug: b.slug, name: b.name, productCount: by.get(b.id) ?? 0 }));
  }

  private async brand(id: string) {
    const b = (await this.brands()).find((x) => x.id === id);
    if (!b) throw notFound("Brand");
    return b;
  }

  async createBrand(input: z.infer<typeof brandInput>) {
    const slug = input.slug ?? slugify(input.name);
    const id = `br-${slug}`;
    const [taken] = await this.db.select({ id: brands.id }).from(brands).where(or(eq(brands.id, id), eq(brands.slug, slug), ilike(brands.name, input.name)));
    if (taken) throw conflict("BRAND_EXISTS", `${input.name} is already a brand`);
    await this.db.insert(brands).values({ id, slug, name: input.name });
    return this.brand(id);
  }

  async updateBrand(id: string, patch: z.infer<typeof brandPatch>) {
    await this.db.transaction(async (tx) => {
      const [b] = await tx.select().from(brands).where(eq(brands.id, id));
      if (!b) throw notFound("Brand");
      if (patch.slug && patch.slug !== b.slug) {
        const [taken] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.slug, patch.slug));
        if (taken) throw conflict("SLUG_TAKEN", "Another brand already uses this address");
      }
      const fields = pick(patch, ["name", "slug"]);
      if (Object.keys(fields).length) await tx.update(brands).set(fields).where(eq(brands.id, id));
      if (patch.name && patch.name !== b.name) await refreshSearchText(tx, eq(products.brandId, id));
    });
    return this.brand(id);
  }

  async deleteBrand(id: string) {
    const b = await this.brand(id);
    if (b.productCount) throw conflict("BRAND_IN_USE", `${b.productCount} ${b.productCount === 1 ? "product uses" : "products use"} ${b.name}. Change their brand first.`);
    await this.db.delete(brands).where(eq(brands.id, id));
  }

  /* ------------------------------- Images ------------------------------- */

  async uploadImage(userId: string, file: { buffer: Buffer; size: number } | undefined) {
    if (!file?.buffer?.length) throw unprocessable("FILE_REQUIRED", "Choose an image");
    if (file.size > MAX_IMAGE_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "Images can be up to 4 MB");
    const mime = sniffMime(file.buffer);
    if (!mime || !(IMAGE_TYPES as readonly string[]).includes(mime)) throw new ApiError(415, "FILE_TYPE", "Add a PNG, JPG or WebP image");
    const fileId = await this.files.put(file.buffer, mime);
    const [row] = await this.db.insert(media).values({ fileId, mimeType: mime, sizeBytes: file.size, createdById: userId }).returning();
    return { id: row!.id, url: `/media/${row!.id}`, mimeType: row!.mimeType, sizeBytes: row!.sizeBytes };
  }

  /** A public image by its media id; files that are not media are never served here. */
  async publicImage(id: string) {
    const [row] = await this.db.select({ content: files.content, mimeType: media.mimeType }).from(media).innerJoin(files, eq(files.id, media.fileId)).where(eq(media.id, id));
    if (!row) throw notFound("Image");
    return row;
  }
}

const isActive = (p: Product, o: Offer) => p.listingStatus === "LIVE" && o.status === "ACTIVE";

function toAdminProduct(p: Product, o: Offer) {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    title: p.title,
    description: p.description,
    highlights: p.highlights,
    specs: p.specs,
    variants: p.variants.map((v) => ({ ...v, values: v.values.map((x) => ({ ...x, available: x.available ?? true })) })),
    images: p.images,
    categoryId: p.categoryId,
    subcategory: p.subcategory,
    brandId: p.brandId,
    tags: p.tags as ("bestseller" | "new" | "deal" | "limited")[],
    pricePaise: o.pricePaise,
    mrpPaise: o.mrpPaise,
    stock: o.stock,
    deliveryDays: o.deliveryDays,
    codAvailable: o.codAvailable,
    returnWindowDays: o.returnWindowDays,
    active: isActive(p, o),
    rating: p.rating,
    ratingCount: p.ratingCount,
    soldLast30d: p.soldLast30d,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** What the storefront search matches on: title, brand, category and subcategory. */
const searchText = (title: string, brand: string, category: string, subcategory: string) => `${title} ${brand} ${category} ${subcategory}`;

/** Rebuilds search text after a brand or category is renamed. */
async function refreshSearchText(tx: Tx, which: SQL) {
  await tx.execute(sql`
    update products set search_text = products.title || ' ' || brands.name || ' ' || categories.name || ' ' || products.subcategory
    from brands, categories
    where brands.id = products.brand_id and categories.id = products.category_id and ${which}`);
}

/** The base slug, or base-2, base-3 and so on when it is taken. */
async function uniqueSlug(tx: Tx, base: string) {
  const taken = new Set((await tx.select({ slug: products.slug }).from(products).where(or(eq(products.slug, base), ilike(products.slug, `${base}-%`)))).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

function pick<T extends object, K extends keyof T>(o: T, keys: K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
