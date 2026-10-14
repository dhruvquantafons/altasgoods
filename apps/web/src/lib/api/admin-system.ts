import "server-only";
import { api, unwrap } from "./server";
import type { paths } from "./schema";

export type AdminSettings = paths["/v1/admin/settings"]["get"]["responses"][200]["content"]["application/json"];
export type AuditList = paths["/v1/admin/audit"]["get"]["responses"][200]["content"]["application/json"];
export type AuditQuery = NonNullable<paths["/v1/admin/audit"]["get"]["parameters"]["query"]>;

export const loadSettings = async () => unwrap(await (await api()).GET("/v1/admin/settings"));

export const loadAudit = async (query: Partial<AuditQuery>) => unwrap(await (await api()).GET("/v1/admin/audit", { params: { query: query as AuditQuery } }));

export type AdminOverview = paths["/v1/admin/overview"]["get"]["responses"][200]["content"]["application/json"];
type PaymentsQuery = NonNullable<paths["/v1/admin/payments"]["get"]["parameters"]["query"]>;
type RefundsQuery = NonNullable<paths["/v1/admin/refunds"]["get"]["parameters"]["query"]>;

export const loadOverview = async () => unwrap(await (await api()).GET("/v1/admin/overview"));

export const loadPayments = async (query: Partial<PaymentsQuery>) => unwrap(await (await api()).GET("/v1/admin/payments", { params: { query: query as PaymentsQuery } }));

export const loadRefunds = async (query: Partial<RefundsQuery>) => unwrap(await (await api()).GET("/v1/admin/refunds", { params: { query: query as RefundsQuery } }));

export const loadAdminCustomers = async (q: string, page: number) =>
  unwrap(await (await api()).GET("/v1/admin/customers", { params: { query: { q: q || undefined, page, pageSize: 25 } } }));

export const loadAdminCustomer = async (id: string) => unwrap(await (await api()).GET("/v1/admin/customers/{id}", { params: { path: { id } } }), { notFoundOn404: true });

export type AdminSale = paths["/v1/admin/sales"]["get"]["responses"][200]["content"]["application/json"][number];
export type AdminCoupon = paths["/v1/admin/coupons"]["get"]["responses"][200]["content"]["application/json"][number];

export const loadSales = async () => unwrap(await (await api()).GET("/v1/admin/sales"));
export const loadCoupons = async () => unwrap(await (await api()).GET("/v1/admin/coupons"));

export type AdminBanner = paths["/v1/admin/banners"]["get"]["responses"][200]["content"]["application/json"][number];
export const loadBanners = async () => unwrap(await (await api()).GET("/v1/admin/banners"));

export type AdminReviewList = paths["/v1/admin/reviews"]["get"]["responses"][200]["content"]["application/json"];
type ReviewsQuery = NonNullable<paths["/v1/admin/reviews"]["get"]["parameters"]["query"]>;
export const loadAdminReviews = async (query: Partial<ReviewsQuery>) => unwrap(await (await api()).GET("/v1/admin/reviews", { params: { query: query as ReviewsQuery } }));
