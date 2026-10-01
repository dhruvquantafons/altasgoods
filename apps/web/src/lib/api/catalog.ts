import "server-only";
import { getProduct, searchProducts } from "@/lib/mock";
import type { Product } from "@/lib/types";
import { publicApi } from "./server";

/**
 * Storefront search ranked by the API (typo tolerant, category aware). The
 * cards still render from the shared catalog data, which carries the same ids;
 * if the API is unreachable the simple local match is used instead.
 */
export async function searchCatalog(q: string): Promise<{ products: Product[]; ranked: boolean }> {
  try {
    const client = publicApi();
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const r = await client.GET("/v1/products", { params: { query: { q, page, pageSize: 60 } } });
      if (!r.data) throw r.error;
      ids.push(...r.data.items.map((i) => i.id));
      if (ids.length >= r.data.total) break;
    }
    return { products: ids.map((id) => getProduct(id)).filter((p): p is Product => !!p), ranked: true };
  } catch {
    return { products: searchProducts(q), ranked: false };
  }
}
