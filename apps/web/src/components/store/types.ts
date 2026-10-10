/**
 * Plain, serialisable shapes passed from server pages into storefront client
 * components (cart, checkout, buy box), so client bundles never import the
 * data layer.
 */

/** The store's price, stock and delivery terms for a product. */
export interface CartOffer {
  price: number;
  mrp: number;
  stock: number;
  deliveryDays: number;
  codAvailable: boolean;
  returnWindowDays: number;
  assured: boolean;
}

export interface CartProduct {
  id: string;
  slug: string;
  title: string;
  brand: string;
  image: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  rating: number;
  ratingCount: number;
  offer: CartOffer;
  /** large items get a scheduled delivery slot at checkout */
  large: boolean;
  /** first variant option values, used for a default selection label */
  defaultVariant?: string;
}

export type CartCatalog = Record<string, CartProduct>;

export interface CartLine {
  /** productId + variant */
  key: string;
  productId: string;
  qty: number;
  variant?: string;
  saved?: boolean;
}

export interface CouponLite {
  code: string;
  description: string;
  type: "percent" | "flat";
  value: number;
  maxDiscount?: number;
  minOrder: number;
  endsAt: string;
  fundedBy: "store" | "bank";
  plusOnly?: boolean;
  upiOnly?: boolean;
  firstOrderOnly?: boolean;
}

export interface WalletLite {
  credits: number;
  giftCard: number;
  bluCoins: number;
  payLaterLimit: number;
  plusMember: boolean;
}

export interface AddressLite {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
  isDefault?: boolean;
}

export interface BankOffer {
  id: string;
  kind: "Bank offer" | "Partner offer" | "No cost EMI" | "Cashback" | "UPI offer";
  title: string;
  detail: string;
  minOrder: number;
  /** percent or flat amount */
  percent?: number;
  flat?: number;
  cap?: number;
  method?: "card" | "upi" | "emi" | "paylater";
  bank?: string;
}

export interface Suggestion {
  label: string;
  href: string;
  kind: "product" | "category" | "brand";
  context?: string;
}

export interface NavCategory {
  slug: string;
  name: string;
  /** short label for the desktop category row, e.g. "Home" */
  short: string;
  icon: string;
  image: string;
  subs: { name: string; slug: string }[];
  brands: { name: string; slug: string }[];
  featured: { slug: string; title: string; image: string; price: number }[];
}

export interface PlacedOrder {
  id: string;
  placedAt: number;
  items: { title: string; image: string; qty: number; price: number; variant?: string; slug: string }[];
  /** everything ships together from the store */
  delivery: { date: string; option: string };
  address: AddressLite;
  paymentLabel: string;
  payable: number;
  savings: number;
  coinsEarned: number;
  cod: boolean;
}
