import type { Campaign, Coupon, Notification, Review, Ticket } from "../types";
import type { CampaignStatus, OrderStatus, TicketPriority, TicketStatus } from "../status";
import { addDays, between, NOW, pick, seeded } from "../utils";
import { products } from "./catalog";
import { orders } from "./orders";

/* ------------------------------- Tickets ------------------------------ */

/** Template: category, subject, opening message, order states the complaint makes sense for (none = no order). */
const ticketTemplates: [Ticket["category"], string, string, OrderStatus[]][] = [
  ["Delivery", "Order not delivered but marked as delivered", "Hi, the app shows my order as delivered yesterday evening but I have not received anything. Please check with the delivery person.", ["delivered"]],
  ["Delivery", "Delivery delayed beyond promised date", "My order is still showing in transit and the promised date is close. Can you share an update?", ["in_transit", "shipped", "undelivered"]],
  ["Return and refund", "Refund not received after return pickup", "The return was picked up a few days ago but I have not received my refund yet.", ["returned", "return_requested"]],
  ["Return and refund", "Return request rejected", "My return request was rejected saying the product is not eligible, but the item is clearly defective.", ["delivered", "return_requested"]],
  ["Payment", "Amount debited but order not placed", "Money was debited from my UPI account but the order failed. Please help me get the amount back.", ["pending_payment", "cancelled"]],
  ["Payment", "EMI not applied on credit card", "I chose no cost EMI at checkout but my bank has charged the full amount.", ["confirmed", "packed", "ready_to_ship", "shipped", "in_transit", "delivered"]],
  ["Product quality", "Received damaged product", "The product I received is damaged. I want a replacement as soon as possible.", ["delivered"]],
  ["Product quality", "Wrong colour delivered", "I ordered a different colour from the one I received.", ["delivered"]],
  ["Account", "Unable to log in with OTP", "I am not receiving the OTP on my registered mobile number.", []],
  ["Seller dispute", "Seller cancelled my order without reason", "The seller cancelled my order. I want to know why and get it from another seller.", ["cancelled"]],
  ["Other", "Need GST invoice for business purchase", "Please share a GST invoice with my company GSTIN for order reimbursement.", ["delivered"]],
];

/** Resolution targets by priority (spec 11.11): urgent P1 24 h, high P2 48 h, normal P3 72 h, low P4 7 days. */
export const TICKET_RESOLUTION_HOURS: Record<TicketPriority, number> = { urgent: 24, high: 48, normal: 72, low: 168 };

const agents = ["Revathi S", "Kabir Anand", "Megha Pillai", "Joseph Mathew", "Ayesha Siddiqui"];
const tr = seeded(2718);
const clamp = (ms: number) => new Date(Math.min(ms, NOW.getTime() - 5 * 60_000)).toISOString();

export const tickets: Ticket[] = Array.from({ length: 48 }, (_, i) => {
  const [category, subject, body, fits] = ticketTemplates[i % ticketTemplates.length]!;
  const candidates = fits.length ? orders.filter((o) => fits.includes(o.status)) : orders;
  const order = candidates[(i * 7) % candidates.length] ?? orders[i % orders.length]!;
  const status = pick(tr, ["open", "open", "in_progress", "in_progress", "awaiting_customer", "escalated", "resolved", "resolved", "closed"] as TicketStatus[]);
  const priority = pick(tr, ["normal", "normal", "high", "low", "urgent"] as TicketPriority[]);
  const channel = pick(tr, ["chat", "chat", "app", "email", "phone"] as Ticket["channel"][]);
  const active = !["resolved", "closed"].includes(status);
  // active work is recent; resolved and closed tickets go back up to 9 days
  const ageHours = active ? 0.3 + Math.pow(tr(), 1.6) * (priority === "low" ? 96 : 40) : 24 + tr() * 190;
  // the complaint can never predate the order it is about
  const createdMs = Math.max(NOW.getTime() - ageHours * 3600_000, new Date(order.placedAt).getTime() + 30 * 60_000);
  const createdAt = new Date(Math.min(createdMs, NOW.getTime() - 10 * 60_000));
  const assignee = status === "open" && tr() < 0.6 ? undefined : pick(tr, agents);
  const via = { chat: "chat", app: "the app", email: "email", phone: "a phone call" }[channel];
  const messages: Ticket["messages"] = [
    { from: "customer", author: order.customerName, body, at: createdAt.toISOString() },
    { from: "system", author: "AltasGoods", body: `Ticket created via ${via}.${fits.length ? ` Linked to order ${order.id}.` : ""}`, at: clamp(createdAt.getTime() + 60_000) },
  ];
  if (status !== "open")
    messages.push({ from: "agent", author: assignee ?? "Support", body: "Thank you for reaching out. I have checked this and raised it with the concerned team. I will update you as soon as I hear back.", at: clamp(createdAt.getTime() + 40 * 60_000) });
  if (status === "awaiting_customer")
    messages.push({ from: "agent", author: assignee ?? "Support", body: "Could you please share a photo of the product and the packaging so we can process this faster?", at: clamp(createdAt.getTime() + 90 * 60_000) });
  return {
    id: `TK-${String(51840 + i * 17)}`,
    subject,
    customerName: order.customerName,
    orderId: fits.length ? order.id : undefined,
    category,
    channel,
    priority,
    status,
    assignee,
    createdAt: createdAt.toISOString(),
    updatedAt: messages.at(-1)!.at,
    slaDueAt: new Date(createdAt.getTime() + TICKET_RESOLUTION_HOURS[priority] * 3600_000).toISOString(),
    messages,
  };
}).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

/* ------------------------------- Reviews ------------------------------ */

const reviewBodies: [number, string, string][] = [
  [5, "Exceeded expectations", "Build quality is excellent and it arrived a day early. Packaging was neat and secure. Highly recommend."],
  [5, "Worth every rupee", "Have been using it for three weeks now. Performs exactly as described and looks premium."],
  [4, "Very good, minor niggles", "Great value for the price. Took off one star because the manual could be clearer."],
  [4, "Solid purchase", "Does the job well. Delivery associate was polite and the OTP based handover felt secure."],
  [3, "Decent but not great", "It is okay for the price. Expected slightly better finish based on the photos."],
  [2, "Quality could be better", "Started showing wear within two weeks. Customer support was helpful with the replacement though."],
  [1, "Not as described", "The colour is very different from the listing images. Returned it."],
  [5, "Beautifully made", "Feels handcrafted and premium. Gifted it and they loved it."],
];
const reviewers = ["Aditi R.", "Sanjay K.", "Fathima N.", "Rohan D.", "Megha S.", "Vikram P.", "Ira M.", "Naveen T.", "Ritu B.", "Harish V."];
const rv = seeded(1618);

export const reviews: Review[] = products.flatMap((p, pi) =>
  Array.from({ length: 4 }, (_, k) => {
    const [rating, title, body] = reviewBodies[(pi + k * 3) % reviewBodies.length]!;
    return {
      id: `rv-${pi}-${k}`,
      productId: p.id,
      author: pick(rv, reviewers),
      rating,
      title,
      body,
      createdAt: addDays(NOW, -between(rv, 1, 160)).toISOString(),
      verified: rv() > 0.12,
      helpful: between(rv, 0, 240),
      status: (k === 3 && pi % 6 === 0 ? "flagged" : k === 2 && pi % 9 === 0 ? "pending" : "published") as Review["status"],
    };
  }),
);

export function reviewsFor(productId: string) {
  return reviews.filter((r) => r.productId === productId && r.status === "published");
}

/* ------------------------------- Coupons ------------------------------ */

export const coupons: Coupon[] = [
  { id: "cp-1", code: "BIGDAYS10", description: "10% off sitewide during AltasGoods Big Days", type: "percent", value: 10, maxDiscount: 1500, minOrder: 999, usage: 48210, limit: 100000, startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "active", fundedBy: "blubuy" },
  { id: "cp-2", code: "BLUFIRST", description: "Flat 200 off on your first order", type: "flat", value: 200, minOrder: 499, usage: 12904, limit: 50000, startsAt: "2026-01-01T00:00:00+05:30", endsAt: "2026-12-31T23:59:00+05:30", status: "active", fundedBy: "blubuy" },
  { id: "cp-3", code: "UPI150", description: "Flat 150 off on UPI payments above 1,999", type: "flat", value: 150, minOrder: 1999, usage: 30877, limit: 60000, startsAt: "2026-09-20T00:00:00+05:30", endsAt: "2026-10-10T23:59:00+05:30", status: "active", fundedBy: "bank" },
  { id: "cp-4", code: "PLUS200", description: "Extra 200 off for AltasGoods Plus members", type: "flat", value: 200, minOrder: 1499, usage: 8120, limit: 25000, startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "active", fundedBy: "blubuy" },
  { id: "cp-5", code: "APEXAUDIO", description: "Apex Retail: 12% off headphones and speakers", type: "percent", value: 12, maxDiscount: 2000, minOrder: 2999, usage: 642, limit: 2000, startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "active", fundedBy: "seller" },
  { id: "cp-6", code: "DIWALI25", description: "Diwali specials, up to 25% off home decor", type: "percent", value: 25, maxDiscount: 2500, minOrder: 1999, usage: 0, limit: 40000, startsAt: "2026-10-28T00:00:00+05:30", endsAt: "2026-11-09T23:59:00+05:30", status: "scheduled", fundedBy: "blubuy" },
  { id: "cp-7", code: "HDFC1500", description: "Instant 1,500 off on HDFC credit cards", type: "flat", value: 1500, minOrder: 14999, usage: 6230, limit: 20000, startsAt: "2026-09-26T00:00:00+05:30", endsAt: "2026-10-05T23:59:00+05:30", status: "active", fundedBy: "bank" },
  { id: "cp-8", code: "MONSOON15", description: "Monsoon sale 15% off fashion", type: "percent", value: 15, maxDiscount: 800, minOrder: 999, usage: 22145, limit: 30000, startsAt: "2026-07-01T00:00:00+05:30", endsAt: "2026-07-31T23:59:00+05:30", status: "expired", fundedBy: "blubuy" },
  { id: "cp-9", code: "APEXKITCHEN", description: "Apex Retail: 300 off kitchen appliances", type: "flat", value: 300, minOrder: 2999, usage: 118, limit: 1000, startsAt: "2026-09-15T00:00:00+05:30", endsAt: "2026-10-15T23:59:00+05:30", status: "paused", fundedBy: "seller" },
];

/* ------------------------------ Campaigns ----------------------------- */

const cr = seeded(4242);
const campaignSeeds: [string, Campaign["type"], CampaignStatus, number][] = [
  ["Big Days: Headphones", "sponsored_products", "active", 6000],
  ["Big Days: Laptops", "sponsored_products", "active", 12000],
  ["Air fryer always on", "sponsored_products", "active", 2500],
  ["Kestrel brand store", "sponsored_brands", "active", 8000],
  ["Smartwatch retargeting", "display", "paused", 3000],
  ["Monitors launch", "sponsored_products", "scheduled", 4000],
  ["Kitchen essentials", "sponsored_products", "ended", 1500],
  ["Camera festive push", "sponsored_brands", "draft", 5000],
];

export const campaigns: Campaign[] = campaignSeeds.map(([name, type, status, dailyBudget], i) => {
  const live = status === "active" || status === "paused" || status === "ended";
  const impressions = live ? between(cr, 80000, 900000) : 0;
  // CPC, conversion and basket chosen so ACoS lands in a realistic 10% to 35% band
  const clicks = Math.round(impressions * (0.006 + cr() * 0.012));
  const ordersCount = Math.round(clicks * (0.03 + cr() * 0.03));
  const spend = Math.round(clicks * (24 + cr() * 36));
  return {
    id: `cm-${i + 1}`,
    name,
    type,
    status,
    dailyBudget,
    spend,
    impressions,
    clicks,
    orders: ordersCount,
    sales: ordersCount * between(cr, 2600, 7800),
    startedAt: addDays(NOW, -between(cr, 3, 60)).toISOString(),
  };
});

/* ---------------------------- Notifications --------------------------- */

const t = (mins: number) => new Date(NOW.getTime() - mins * 60_000).toISOString();

export const sellerNotifications: Notification[] = [
  { id: "n-1", kind: "order", title: "38 orders need confirmation", body: "Confirm before 2:00 PM today to avoid late dispatch.", at: t(12), read: false, href: "/seller/orders" },
  { id: "n-2", kind: "alert", title: "Listing suppressed", body: "Pulse Boom 2 is missing a required image. Fix it to restore visibility.", at: t(95), read: false, href: "/seller/catalog" },
  { id: "n-3", kind: "payment", title: "Payout scheduled", body: "Your next settlement will be credited on 6 Oct.", at: t(300), read: false, href: "/seller/payments" },
  { id: "n-4", kind: "promo", title: "Diwali Dhamaka deals open", body: "Nominate up to 50 products for the Diwali event by 10 Oct.", at: t(1440), read: true, href: "/seller/promotions" },
  { id: "n-5", kind: "account", title: "Account health is Healthy", body: "All performance targets met for the last 60 days.", at: t(2880), read: true, href: "/seller/performance" },
];

export const adminNotifications: Notification[] = [
  { id: "a-1", kind: "alert", title: "Payment gateway latency high", body: "UPI success rate dipped to 94.1% in the last 15 minutes.", at: t(6), read: false, href: "/admin/payments" },
  { id: "a-2", kind: "account", title: "4 sellers awaiting KYC review", body: "Oldest application is 3 days old.", at: t(40), read: false, href: "/admin/sellers/approvals" },
  { id: "a-3", kind: "system", title: "Catalog queue above threshold", body: "212 listings pending review, SLA is 48 hours.", at: t(130), read: false, href: "/admin/catalog" },
  { id: "a-4", kind: "order", title: "Big Days hourly peak", body: "19,867 orders placed between 9 and 10 PM yesterday, the busiest hour of the sale so far.", at: t(720), read: true },
];

export const customerNotifications: Notification[] = [
  { id: "c-1", kind: "order", title: "Your order is out for delivery", body: "Auralis Studio ANC headphones will arrive today by 7 PM. Share OTP 4821 at delivery.", at: t(30), read: false, href: "/account/orders" },
  { id: "c-2", kind: "promo", title: "Big Days: 2 days left", body: "Extra 10% off with code BIGDAYS10 on orders above 999.", at: t(240), read: false, href: "/deals" },
  { id: "c-3", kind: "payment", title: "Refund credited", body: "₹1,299 has been credited to your AltasGoods Credits balance.", at: t(1500), read: true, href: "/account/wallet" },
  { id: "c-4", kind: "account", title: "You earned 120 AltasCoins", body: "Coins from your last order are now available to use.", at: t(4000), read: true, href: "/account/rewards" },
];
