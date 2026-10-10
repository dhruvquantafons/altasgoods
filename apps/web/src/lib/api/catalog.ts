import "server-only";
import type { StoreCatalog } from "@/lib/store-catalog";
import type { Product } from "@/lib/types";
import { publicApi } from "./server";

/** Every search term appears in the product's title, brand, category or subcategory. */
function localMatch(products: Product[], q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const hay = `${p.title} ${p.brandName} ${p.subcategory} ${p.categoryName}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

/**
 * Storefront search ranked by the API (typo tolerant, category aware), shown
 * as the live catalog's products. If the search call fails, a simple local
 * match over the same products is used instead.
 */
export async function searchCatalog(catalog: StoreCatalog, q: string): Promise<{ products: Product[]; ranked: boolean }> {
  try {
    const client = publicApi();
    const ids: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const r = await client.GET("/v1/products", { params: { query: { q, page, pageSize: 60 } } });
      if (!r.data) throw r.error;
      ids.push(...r.data.items.map((i) => i.id));
      if (ids.length >= r.data.total) break;
    }
    return { products: ids.map((id) => catalog.product(id)).filter((p): p is Product => !!p), ranked: true };
  } catch {
    return { products: localMatch(catalog.products, q), ranked: false };
  }
}
