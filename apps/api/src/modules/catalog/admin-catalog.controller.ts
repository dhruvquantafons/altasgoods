import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import { AuditService, diff } from "../admin/audit.service.js";
import * as s from "./admin-catalog.schemas.js";
import { AdminCatalogService } from "./admin-catalog.service.js";
import { ProductImportService } from "./product-import.service.js";

const idParam = { schema: z.string().min(1).max(120) };

@ApiTags("Admin catalog")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "CATALOG_MANAGER")
@Controller("v1/admin")
export class AdminCatalogController {
  constructor(
    @Inject(AdminCatalogService) private readonly svc: AdminCatalogService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ProductImportService) private readonly importer: ProductImportService,
  ) {}

  @Get("products")
  @ApiResponse({ status: 200, standardSchema: s.adminProductList })
  products(@Query({ schema: s.adminProductQuery }) q: z.infer<typeof s.adminProductQuery>) {
    return this.svc.listProducts(q);
  }

  /**
   * Adds and updates products from a CSV file (up to 4 MB and 1000 rows). Categories, subcategories and
   * brands it names are created when missing; a row whose SKU matches a product updates it. Columns
   * that are not product fields become specifications. Run with dryRun=true first to preview.
   */
  @Post("products/import")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiResponse({ status: 201, standardSchema: s.importResult })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  async importProducts(@CurrentUser() u: AuthUser, @Query({ schema: s.importQuery }) q: z.infer<typeof s.importQuery>, @UploadedFile() file: { buffer: Buffer; size: number } | undefined) {
    const result = await this.importer.run(u.id, file, q.dryRun);
    const { created, updated, skipped, newCategories, newBrands } = result.summary;
    if (!q.dryRun && (created || updated))
      await this.audit.log(
        u,
        "product.import",
        { type: "product" },
        `Imported products from CSV: ${created} added, ${updated} updated, ${skipped} skipped${newCategories.length ? `; new categories ${newCategories.join(", ")}` : ""}${newBrands.length ? `; new brands ${newBrands.join(", ")}` : ""}`,
      );
    return result;
  }

  @Get("products/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminProduct })
  product(@Param("id", idParam) id: string) {
    return this.svc.product(id);
  }

  @Post("products")
  @ApiResponse({ status: 201, standardSchema: s.adminProduct })
  async createProduct(@CurrentUser() u: AuthUser, @Body({ schema: s.productInput }) body: s.ProductInput) {
    const p = await this.svc.createProduct(body);
    await this.audit.log(u, "product.create", { type: "product", id: p.id }, `Added product ${p.title}`);
    return p;
  }

  @Patch("products/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminProduct })
  async updateProduct(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string, @Body({ schema: s.productPatch }) body: s.ProductPatch) {
    const before = await this.svc.product(id);
    const after = await this.svc.updateProduct(id, body);
    const changes = diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body));
    if (Object.keys(changes).length) await this.audit.log(u, "product.update", { type: "product", id }, `Edited product ${after.title}`, changes);
    return after;
  }

  @Get("categories")
  @ApiResponse({ status: 200, standardSchema: z.array(s.adminCategory) })
  categories() {
    return this.svc.categories();
  }

  @Post("categories")
  @ApiResponse({ status: 201, standardSchema: s.adminCategory })
  async createCategory(@CurrentUser() u: AuthUser, @Body({ schema: s.categoryInput }) body: z.infer<typeof s.categoryInput>) {
    const c = await this.svc.createCategory(body);
    await this.audit.log(u, "category.create", { type: "category", id: c.id }, `Added category ${c.name}`);
    return c;
  }

  @Patch("categories/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminCategory })
  async updateCategory(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string, @Body({ schema: s.categoryPatch }) body: z.infer<typeof s.categoryPatch>) {
    const before = (await this.svc.categories()).find((c) => c.id === id);
    const after = await this.svc.updateCategory(id, body);
    const changes = before ? diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body)) : {};
    await this.audit.log(u, "category.update", { type: "category", id }, `Edited category ${after.name}`, changes);
    return after;
  }

  @Delete("categories/:id")
  @HttpCode(204)
  async deleteCategory(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string) {
    const before = (await this.svc.categories()).find((c) => c.id === id);
    await this.svc.deleteCategory(id);
    await this.audit.log(u, "category.delete", { type: "category", id }, `Deleted category ${before?.name ?? id}`);
  }

  @Get("brands")
  @ApiResponse({ status: 200, standardSchema: z.array(s.adminBrand) })
  brands() {
    return this.svc.brands();
  }

  @Post("brands")
  @ApiResponse({ status: 201, standardSchema: s.adminBrand })
  async createBrand(@CurrentUser() u: AuthUser, @Body({ schema: s.brandInput }) body: z.infer<typeof s.brandInput>) {
    const b = await this.svc.createBrand(body);
    await this.audit.log(u, "brand.create", { type: "brand", id: b.id }, `Added brand ${b.name}`);
    return b;
  }

  @Patch("brands/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminBrand })
  async updateBrand(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string, @Body({ schema: s.brandPatch }) body: z.infer<typeof s.brandPatch>) {
    const before = (await this.svc.brands()).find((b) => b.id === id);
    const after = await this.svc.updateBrand(id, body);
    const changes = before ? diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(body)) : {};
    await this.audit.log(u, "brand.update", { type: "brand", id }, `Edited brand ${after.name}`, changes);
    return after;
  }

  @Delete("brands/:id")
  @HttpCode(204)
  async deleteBrand(@CurrentUser() u: AuthUser, @Param("id", idParam) id: string) {
    const before = (await this.svc.brands()).find((b) => b.id === id);
    await this.svc.deleteBrand(id);
    await this.audit.log(u, "brand.delete", { type: "brand", id }, `Deleted brand ${before?.name ?? id}`);
  }

  /** Uploads a product image (PNG, JPG or WebP, up to 4 MB); use the returned url in a product's images. */
  @Post("media")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } })
  @ApiResponse({ status: 201, standardSchema: s.mediaSchema })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 4 * 1024 * 1024 + 1, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: { buffer: Buffer; size: number } | undefined) {
    return this.svc.uploadImage(u.id, file);
  }
}

@ApiTags("Catalog")
@Public()
@Controller("v1/media")
export class MediaController {
  constructor(
    @Inject(AdminCatalogService) private readonly svc: AdminCatalogService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** A product image. Ids are random and the bytes never change, so it is cached for a year. */
  @Get(":id")
  @ApiProduces("image/png", "image/jpeg", "image/webp")
  async image(@Param("id", { schema: z.uuid() }) id: string, @Res() res: Response) {
    const img = await this.svc.publicImage(id);
    res.setHeader("Content-Type", img.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(img.content);
  }
}
