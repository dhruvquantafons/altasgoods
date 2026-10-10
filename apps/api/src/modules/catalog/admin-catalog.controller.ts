import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { CurrentUser, Public, StaffOnly, type AuthUser } from "../auth/auth.guard.js";
import * as s from "./admin-catalog.schemas.js";
import { AdminCatalogService } from "./admin-catalog.service.js";

const idParam = { schema: z.string().min(1).max(120) };

@ApiTags("Admin catalog")
@ApiBearerAuth()
@StaffOnly("OPS_ADMIN", "CATALOG_MANAGER")
@Controller("v1/admin")
export class AdminCatalogController {
  constructor(@Inject(AdminCatalogService) private readonly svc: AdminCatalogService) {}

  @Get("products")
  @ApiResponse({ status: 200, standardSchema: s.adminProductList })
  products(@Query({ schema: s.adminProductQuery }) q: z.infer<typeof s.adminProductQuery>) {
    return this.svc.listProducts(q);
  }

  @Get("products/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminProduct })
  product(@Param("id", idParam) id: string) {
    return this.svc.product(id);
  }

  @Post("products")
  @ApiResponse({ status: 201, standardSchema: s.adminProduct })
  createProduct(@Body({ schema: s.productInput }) body: s.ProductInput) {
    return this.svc.createProduct(body);
  }

  @Patch("products/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminProduct })
  updateProduct(@Param("id", idParam) id: string, @Body({ schema: s.productPatch }) body: s.ProductPatch) {
    return this.svc.updateProduct(id, body);
  }

  @Get("categories")
  @ApiResponse({ status: 200, standardSchema: z.array(s.adminCategory) })
  categories() {
    return this.svc.categories();
  }

  @Post("categories")
  @ApiResponse({ status: 201, standardSchema: s.adminCategory })
  createCategory(@Body({ schema: s.categoryInput }) body: z.infer<typeof s.categoryInput>) {
    return this.svc.createCategory(body);
  }

  @Patch("categories/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminCategory })
  updateCategory(@Param("id", idParam) id: string, @Body({ schema: s.categoryPatch }) body: z.infer<typeof s.categoryPatch>) {
    return this.svc.updateCategory(id, body);
  }

  @Delete("categories/:id")
  @HttpCode(204)
  async deleteCategory(@Param("id", idParam) id: string) {
    await this.svc.deleteCategory(id);
  }

  @Get("brands")
  @ApiResponse({ status: 200, standardSchema: z.array(s.adminBrand) })
  brands() {
    return this.svc.brands();
  }

  @Post("brands")
  @ApiResponse({ status: 201, standardSchema: s.adminBrand })
  createBrand(@Body({ schema: s.brandInput }) body: z.infer<typeof s.brandInput>) {
    return this.svc.createBrand(body);
  }

  @Patch("brands/:id")
  @ApiResponse({ status: 200, standardSchema: s.adminBrand })
  updateBrand(@Param("id", idParam) id: string, @Body({ schema: s.brandPatch }) body: z.infer<typeof s.brandPatch>) {
    return this.svc.updateBrand(id, body);
  }

  @Delete("brands/:id")
  @HttpCode(204)
  async deleteBrand(@Param("id", idParam) id: string) {
    await this.svc.deleteBrand(id);
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
  constructor(@Inject(AdminCatalogService) private readonly svc: AdminCatalogService) {}

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
