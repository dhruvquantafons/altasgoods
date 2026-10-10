import "server-only";
import { cache } from "react";
import { api, unwrap } from "./server";

export interface ProductQuery {
  q?: string;
  category?: string;
  status?: "active" | "inactive" | "all";
  stock?: "out" | "low" | "all";
  page?: number;
  pageSize?: number;
}

/** One page of the store's products for AltasGoods Control, including inactive ones. */
export async function loadAdminProducts(query: ProductQuery) {
  return unwrap(
    await (await api()).GET("/v1/admin/products", {
      params: { query: { q: query.q || undefined, category: query.category || undefined, status: query.status ?? "all", stock: query.stock ?? "all", page: query.page ?? 1, pageSize: query.pageSize ?? 25 } },
    }),
  );
}

export const loadAdminProduct = cache(async (id: string) => unwrap(await (await api()).GET("/v1/admin/products/{id}", { params: { path: { id } } }), { notFoundOn404: true }));

export const loadAdminCategories = cache(async () => unwrap(await (await api()).GET("/v1/admin/categories")));

export const loadAdminBrands = cache(async () => unwrap(await (await api()).GET("/v1/admin/brands")));
