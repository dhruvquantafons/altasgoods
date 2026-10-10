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
export type Address = Json<"/v1/me/addresses", "get">[number];
export type Cart = Json<"/v1/cart", "get">;
export type CartLine = Cart["lines"][number];
export type Quote = Json<"/v1/checkout/quote", "post">;
export type PlacedOrder = Json<"/v1/orders", "post", 201>;
export type Order = Json<"/v1/me/orders/{id}", "get">;
export type OrderItem = Order["items"][number];
export type OrderList = Json<"/v1/me/orders", "get">;
export type PaymentDetail = Json<"/v1/payments/{id}", "get">;
export type AdminItemList = Json<"/v1/admin/order-items", "get">;
export type AdminItem = AdminItemList["items"][number];
export type AdminOrder = Json<"/v1/admin/orders/{id}", "get">;
export type AdminOrderItem = AdminOrder["items"][number];
export type AdminProductList = Json<"/v1/admin/products", "get">;
export type AdminProductRow = AdminProductList["items"][number];
export type AdminProduct = Json<"/v1/admin/products/{id}", "get">;
export type AdminCategory = Json<"/v1/admin/categories", "get">[number];
export type AdminBrand = Json<"/v1/admin/brands", "get">[number];
export type ApiOrderItemStatus = OrderItem["status"];
export type ApiOrderStatus = Order["status"];
export type PaymentMethod = Order["paymentMethod"];
export type EmailOtp = Json<"/v1/me/email/otp", "post">;
export type TicketList = Json<"/v1/support/tickets", "get">;
export type TicketSummary = TicketList["items"][number];
export type TicketDetail = Json<"/v1/support/tickets/{id}", "get">;
export type TicketAction = TicketDetail["actions"][number];
export type ApiTicketStatus = TicketSummary["status"];
export type CareAgentRow = Json<"/v1/support/agents", "get">[number];
export type CustomerTicket = Json<"/v1/me/support/tickets/{id}", "get">;
export type ReturnRequest = Json<"/v1/me/returns/{id}", "get">;
export type ApiReturnStatus = ReturnRequest["status"];

/** RFC 7807 problem returned by every failing API call. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: { path: string; message: string }[];
}
