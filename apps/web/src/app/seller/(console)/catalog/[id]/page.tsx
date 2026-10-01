import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, Lightbulb, Warehouse } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { ToastButton } from "@/components/seller/client-kit";
import { ListingEditor } from "@/components/seller/catalog/listing-editor";
import { Callout, ChannelBadge, Mono } from "@/components/seller/primitives";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CURRENT_SELLER_ID, getProduct, sellers } from "@/lib/mock";
import { getListing, RATE_CARD, sellerListings } from "@/lib/mock/seller-extra";
import { LISTING_STATUS, type Tone } from "@/lib/status";
import { cn, formatCompact, formatINR, formatNumber } from "@/lib/utils";

export function generateStaticParams() {
  return sellerListings.map((l) => ({ id: l.id }));
}

export async function generateMetadata(props: PageProps<"/seller/catalog/[id]">) {
  const { id } = await props.params;
  const l = getListing(id);
  return { title: l ? `Edit ${l.title.split(/[,(]/)[0]!.trim()}` : "Listing" };
}

const NOTE_TONE: Partial<Record<string, Tone>> = { suppressed: "warning", rejected: "danger", blocked: "danger", draft: "neutral", pending_review: "info", inactive: "neutral", out_of_stock: "warning" };

export default async function ListingPage(props: PageProps<"/seller/catalog/[id]">) {
  const { id } = await props.params;
  const listing = getListing(id);
  if (!listing) notFound();
  const product = getProduct(listing.productId)!;
  const suppressedImage = listing.issues.some((i) => i.toLowerCase().includes("image"));
  const offers = product.offers
    .map((o) => ({ ...o, name: sellers.find((s) => s.id === o.sellerId)?.displayName ?? o.sellerId, mine: o.sellerId === CURRENT_SELLER_ID, featured: o.sellerId === product.featuredSellerId && (o.sellerId !== CURRENT_SELLER_ID || listing.featured === "won") }))
    .sort((a, b) => a.price - b.price);

  const qualityTone = listing.quality >= 85 ? "success" : listing.quality >= 70 ? "brand" : listing.quality >= 55 ? "warning" : "danger";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Listings", href: "/seller/catalog" }, { label: listing.sku }]}
        title={<span className="line-clamp-2 max-w-3xl">{listing.title}</span>}
        meta={
          <>
            <StatusBadge meta={LISTING_STATUS[listing.status]} />
            <ChannelBadge channel={listing.channel} size="md" />
            <span className="text-[13px] text-ink-500">
              BSIN <Mono className="text-ink-700">{listing.bsin}</Mono>
            </span>
            <span className="text-[13px] text-ink-500">
              SKU <Mono className="text-ink-700">{listing.sku}</Mono>
            </span>
          </>
        }
        actions={
          listing.status === "inactive" ? (
            <ToastButton icon="play" message="Listing resumed. It is buyable again within 15 minutes.">
              Resume listing
            </ToastButton>
          ) : ["live", "out_of_stock"].includes(listing.status) ? (
            <ToastButton icon="pause" message="Listing paused. Customers can no longer buy it; open orders are not affected.">
              Pause listing
            </ToastButton>
          ) : undefined
        }
      />

      {listing.note && (
        <Callout tone={NOTE_TONE[listing.status] ?? "neutral"} icon={CircleAlert} title={LISTING_STATUS[listing.status].label} className="mb-6">
          {listing.note}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <ListingEditor
            rateCard={RATE_CARD}
            initialTab={suppressedImage ? "images" : listing.status === "suppressed" ? "compliance" : "offer"}
            initial={{
              id: listing.id,
              title: listing.title,
              brand: listing.brand,
              image: listing.image,
              categoryId: listing.categoryId,
              subcategory: listing.subcategory,
              price: listing.price,
              mrp: listing.mrp,
              stock: listing.stock,
              channel: listing.channel,
              handlingDays: listing.handlingDays,
              bullets: listing.bullets,
              description: product.description,
              keywords: `${listing.subcategory.toLowerCase()}, ${listing.brand.toLowerCase()}, ${product.variants[0]?.values.map((x) => x.label.toLowerCase()).join(", ") ?? ""}`.replace(/, $/, ""),
              hsn: listing.hsn,
              gst: listing.gst,
              weightKg: listing.weightKg,
              dims: listing.dims,
              origin: "India",
              manufacturer: `${listing.brand} India Private Limited, Plot 21, MIDC Industrial Area, Pune, Maharashtra 411026`,
              packer: "Apex Retail Private Limited, Unit 14, Marol Industrial Estate, Andheri East, Mumbai 400072",
              imageChecks: [
                { label: "Pure white background (RGB 255, 255, 255)", passed: !suppressedImage },
                { label: "At least 1000 px on the longest side", passed: !suppressedImage },
                { label: "Product fills 85% or more of the frame", passed: true },
                { label: "No text, logos, borders or watermarks", passed: true },
              ],
              imageCount: listing.status === "draft" ? 1 : suppressedImage ? 3 : 5,
              featuredPrice: listing.featuredPrice,
              heavy: ["Laptops", "Monitors", "Kitchen Appliances"].includes(listing.subcategory),
            }}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader
              title="Featured offer"
              description={`${offers.length} ${offers.length === 1 ? "seller offers" : "sellers offer"} this product`}
              action={
                listing.featured === "won" ? (
                  <Badge tone="success">Won, {listing.featuredPct}%</Badge>
                ) : listing.featured === "lost" ? (
                  <Badge tone="warning">Lost</Badge>
                ) : (
                  <Badge tone="neutral">Not eligible</Badge>
                )
              }
            />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {offers.map((o) => (
                <li key={o.sellerId} className={cn("flex items-center justify-between gap-3 px-5 py-3", o.mine && "bg-brand-50/40")}>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink-900">
                      {o.mine ? "You (Apex Retail)" : o.name}
                      {o.featured && <span className="ml-2 text-xs font-normal text-success-700">Featured</span>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                      {o.fulfilledBy === "blubuy" && <Warehouse size={12} aria-hidden="true" />}
                      {o.fulfilledBy === "blubuy" ? "BluBuy Fulfilled" : "Seller shipped"}, delivery in {o.deliveryDays} {o.deliveryDays === 1 ? "day" : "days"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(o.mine ? listing.price : o.price)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3.5 text-xs leading-relaxed text-ink-500">
              The featured offer weighs landed price (50%), delivery promise (20%), Seller Health (15%), fulfilment program (10%) and seller rating (5%).
            </p>
          </Card>

          <Card>
            <CardHeader title="Listing quality" description="How complete and compliant this listing is" />
            <div className="px-5 pt-3 pb-5">
              <div className="flex items-end gap-2">
                <p className="text-[34px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">{listing.quality}</p>
                <p className="pb-1 text-sm text-ink-500">of 100</p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`Quality score ${listing.quality} of 100`}>
                <div className={cn("h-full rounded-full", { success: "bg-success-500", brand: "bg-brand-500", warning: "bg-warning-500", danger: "bg-danger-500" }[qualityTone])} style={{ width: `${listing.quality}%` }} />
              </div>
              {listing.issues.length ? (
                <ul className="mt-4 flex flex-col gap-2.5">
                  {listing.issues.map((i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-ink-700">
                      <Lightbulb size={15} className="mt-0.5 shrink-0 text-warning-600" aria-hidden="true" />
                      {i}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-[13px] text-success-700">
                  <CircleCheck size={15} aria-hidden="true" /> Nothing to improve right now
                </p>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Last 30 days" className="pb-4" />
            <dl className="grid grid-cols-2 gap-px border-t border-line bg-line">
              {[
                { label: "Sessions", value: formatNumber(listing.sessions30d) },
                { label: "Units sold", value: formatNumber(listing.units30d) },
                { label: "Conversion", value: listing.units30d ? `${listing.conversion}%` : "None" },
                { label: "Sales", value: listing.sales30d ? formatCompact(listing.sales30d, true) : "None" },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-5 py-3.5">
                  <dt className="text-xs text-ink-500">{s.label}</dt>
                  <dd className="mt-1 text-[17px] font-semibold text-ink-900 tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <ProductImage src={listing.image} alt="" size={48} rounded="md" />
            <p className="text-xs leading-relaxed text-ink-500">
              Catalog content for this BSIN is shared by every seller. Brand owners with BluBuy Brand Registry control the title, images and A+ content.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
