import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { Public } from "../auth/auth.guard.js";
import { categoryNode, productDetail, productList, productQuery, sellerProfile, type ProductQuery } from "./catalog.schemas.js";
import { CatalogService } from "./catalog.service.js";

@ApiTags("Catalog")
@Public()
@Controller("v1")
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("categories")
  @ApiResponse({ status: 200, standardSchema: z.array(categoryNode) })
  categories() {
    return this.catalog.categoryTree();
  }

  @Get("products")
  @ApiResponse({ status: 200, standardSchema: productList })
  list(@Query({ schema: productQuery }) query: ProductQuery) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:slug")
  @ApiResponse({ status: 200, standardSchema: productDetail })
  detail(@Param("slug") slug: string) {
    return this.catalog.productDetail(slug);
  }

  @Get("sellers/:slug")
  @ApiResponse({ status: 200, standardSchema: sellerProfile })
  seller(@Param("slug") slug: string) {
    return this.catalog.sellerProfile(slug);
  }
}
