import type { Metadata } from "next";
import Link from "next/link";
import { ListingView, parseFilters, didYouMean } from "@/components/store/listing";
import { searchCatalog } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/store-catalog";

export async function generateMetadata(props: PageProps<"/s">): Promise<Metadata> {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return { title: q ? `Results for "${q}"` : "Search" };
}

export default async function SearchPage(props: PageProps<"/s">) {
  const f = parseFilters(await props.searchParams);
  const catalog = await getStoreCatalog();
  const { brands, categories, products } = catalog;
  const { products: base, ranked } = f.q ? await searchCatalog(catalog, f.q) : { products, ranked: false };
  const suggestion = f.q && base.length === 0 ? didYouMean(f.q, [...brands.map((b) => b.name), ...categories.map((c) => c.name), ...products.map((p) => p.title)]) : null;
  const cat = f.cat ? catalog.category(f.cat) : undefined;

  const heading = f.q ? (
    <>
      Results for <span className="text-brand-700">&ldquo;{f.q}&rdquo;</span>
      {cat && <span className="text-ink-500"> in {cat.name}</span>}
    </>
  ) : cat ? (
    cat.name
  ) : f.brands.length ? (
    `Shop ${f.brands.map((b) => brands.find((x) => x.slug === b)?.name ?? b).join(", ")}`
  ) : (
    "All products"
  );

  return (
    <ListingView
      base={base}
      ranked={ranked}
      filters={f}
      basePath="/s"
      mode="search"
      heading={heading}
      crumbs={[{ label: "Home", href: "/" }, { label: f.q ? "Search" : "All products" }]}
      intro={
        suggestion ? (
          <p className="mt-4 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-700">
            Did you mean{" "}
            <Link href={`/s?q=${encodeURIComponent(suggestion)}`} className="font-semibold text-brand-700 hover:underline">
              {suggestion}
            </Link>
            ?
          </p>
        ) : null
      }
      emptyHint={
        <>
          Check the spelling, use fewer words or browse{" "}
          <Link href="/deals" className="font-medium text-brand-700 hover:underline">
            today&apos;s deals
          </Link>
          .
        </>
      }
    />
  );
}
