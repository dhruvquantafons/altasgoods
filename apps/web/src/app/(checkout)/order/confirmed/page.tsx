import { OrderConfirmation } from "@/components/store/order-confirmation";
import { daysFromNow, DEFAULT_PINCODE, formatPromise, lookupPincode, promiseDays } from "@/components/store/delivery";
import { CURRENT_CUSTOMER, customerAddresses, getProduct, getSeller } from "@/lib/mock";
import type { PlacedOrder } from "@/components/store/types";

export const metadata = { title: "Order placed" };

/** Server-side fallback so a direct visit (or another device) still shows a complete page. */
function demoOrder(id: string): PlacedOrder {
  const lines = [
    { slug: "headphones-studio", qty: 1, variant: "Graphite" },
    { slug: "coffee-beans", qty: 2 },
    { slug: "vase-ceramic", qty: 1 },
  ];
  const pin = lookupPincode(DEFAULT_PINCODE);
  const items = lines.map((l) => {
    const p = getProduct(l.slug)!;
    const o = p.offers.find((x) => x.sellerId === p.featuredSellerId)!;
    return { title: p.title, image: p.image, qty: l.qty, price: o.price, seller: getSeller(o.sellerId)!.displayName, variant: l.variant, slug: p.slug, days: o.deliveryDays };
  });
  const sellers = [...new Set(items.map((i) => i.seller))];
  const payable = items.reduce((a, i) => a + i.price * i.qty, 0) - 150;
  return {
    id,
    placedAt: 0,
    items: items.map((i) => ({ title: i.title, image: i.image, qty: i.qty, price: i.price, seller: i.seller, variant: i.variant, slug: i.slug })),
    shipments: sellers.map((s) => {
      const its = items.filter((i) => i.seller === s);
      return { seller: s, date: formatPromise(daysFromNow(promiseDays(Math.max(...its.map((i) => i.days)), pin))), option: "Standard", items: its.length };
    }),
    address: customerAddresses[0]!,
    paymentLabel: "UPI (ananya.sharma@kaveri)",
    payable,
    savings: 8343,
    coinsEarned: 100,
    cod: false,
  };
}

export default async function OrderConfirmedPage(props: PageProps<"/order/confirmed">) {
  const sp = await props.searchParams;
  const id = typeof sp.id === "string" && /^BB-\d{6}-\d{5}$/.test(sp.id) ? sp.id : "";
  return (
    <OrderConfirmation
      fallback={demoOrder(id || "BB-261001-48213")}
      requestedId={id}
      firstName={CURRENT_CUSTOMER.name.split(" ")[0]!}
      phone={customerAddresses[0]!.phone}
    />
  );
}
