/**
 * Plain, serialisable shapes passed from server pages into storefront client
 * components (cart, checkout, buy box). Built by helpers in
 * src/lib/mock/store-extra.ts so client bundles never import the data layer.
 */

export interface CartOffer {
  sellerId: string;
  sellerName: string;
  sellerSlug: string;
  sellerRating: number;
  sellerRatingCount: number;
  sellerCity: string;
  price: number;
  mrp: number;
  stock: number;
  deliveryDays: number;
  fulfilledBy: "blubuy" | "seller";
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
  featuredSellerId: string;
  offers: CartOffer[];
  /** large items get a scheduled delivery slot at checkout */
  large: boolean;
  /** first variant option values, used for a default selection label */
  defaultVariant?: string;
}

export type CartCatalog = Record<string, CartProduct>;

export interface CartLine {
  /** productId + sellerId + variant */
  key: string;
  productId: string;
  sellerId: string;
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
  fundedBy: "blubuy" | "seller" | "bank";
  /** seller id for seller-funded coupons */
  sellerId?: string;
  plusOnly?: boolean;
  upiOnly?: boolean;
  firstOrderOnly?: boolean;
  /** limits a seller coupon to some sub-categories */
  subcategories?: string[];
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
  items: { title: string; image: string; qty: number; price: number; seller: string; variant?: string; slug: string }[];
  shipments: { seller: string; date: string; option: string; items: number }[];
  address: AddressLite;
  paymentLabel: string;
  payable: number;
  savings: number;
  coinsEarned: number;
  cod: boolean;
}
