/**
 * Friendly names for API shapes, derived from the generated OpenAPI types
 * (schema.d.ts, regenerate with `npm run api:types`).
 */
import type { paths } from "./schema";

type Json<P extends keyof paths, M extends keyof paths[P], S extends number = 200> = paths[P][M] extends {
  responses: { [K in S]: { content: { "application/json": infer T } } };
}
  ? T
  : never;

export type User = Json<"/v1/me", "get">;
export type Session = Json<"/v1/auth/otp/verify", "post">;
export type OtpChallenge = Json<"/v1/auth/otp", "post">;
export type CategoryNode = Json<"/v1/categories", "get">[number];
export type ProductList = Json<"/v1/products", "get">;
export type ProductSummary = ProductList["items"][number];
export type ProductDetail = Json<"/v1/products/{slug}", "get">;
export type ProductOffer = ProductDetail["offers"][number];
export type SellerProfile = Json<"/v1/sellers/{slug}", "get">;
export type Address = Json<"/v1/me/addresses", "get">[number];
export type Cart = Json<"/v1/cart", "get">;
export type CartLine = Cart["lines"][number];
export type Quote = Json<"/v1/checkout/quote", "post">;
export type PlacedOrder = Json<"/v1/orders", "post", 201>;
export type Order = Json<"/v1/me/orders/{id}", "get">;
export type OrderItem = Order["items"][number];
export type OrderList = Json<"/v1/me/orders", "get">;
export type PaymentDetail = Json<"/v1/payments/{id}", "get">;
export type SellerItemList = Json<"/v1/seller/order-items", "get">;
export type SellerItem = SellerItemList["items"][number];
export type SellerOrder = Json<"/v1/seller/orders/{id}", "get">;
export type ApiOrderItemStatus = OrderItem["status"];
export type ApiOrderStatus = Order["status"];
export type PaymentMethod = Order["paymentMethod"];
export type SellerApplication = Json<"/v1/me/seller-application", "get">;
export type ApplicationStatus = SellerApplication["status"];
export type ApplicationDocument = SellerApplication["documents"][number];
export type DocumentKind = ApplicationDocument["kind"];
export type Constitution = NonNullable<SellerApplication["business"]["constitution"]>;
export type ApplicationReview = Json<"/v1/admin/seller-applications/{id}", "get">;
export type ApplicationQueue = Json<"/v1/admin/seller-applications", "get">;
export type ApplicationSummary = ApplicationQueue["items"][number];
export type EmailOtp = Json<"/v1/me/email/otp", "post">;

/** RFC 7807 problem returned by every failing API call. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: { path: string; message: string }[];
}
