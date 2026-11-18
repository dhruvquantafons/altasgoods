import { rupees } from "../../../common/money.js";
import type { EmailMessage } from "../../auth/email.provider.js";
import { layout, type EmailLink } from "../../auth/emails.js";

/** A line in an email: what the customer bought, as on the order. */
export interface EmailItem {
  title: string;
  variant?: string | null;
  qty: number;
}

type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "EMI" | "PAY_LATER" | "COD";

/**
 * What each customer email needs, by kind. Only ids and small display
 * details: the address it goes to and the customer's name are read when it is
 * sent, so nothing personal sits in the job queue.
 */
export interface NotificationData {
  ORDER_PLACED: { orderId: string; totalPaise: number; paymentMethod: PaymentMethod; items: EmailItem[] };
  PAYMENT_FAILED: { orderId: string; amountPaise: number; payBy: string | null };
  ORDER_ABANDONED: { orderId: string; items: EmailItem[] };
  ORDER_CANCELLED: { orderId: string; items: EmailItem[]; byCustomer: boolean; reason: string | null; whole: boolean; prepaid: boolean };
  SHIPPED: { orderId: string; items: EmailItem[]; courier: string | null; awb: string | null; trackingUrl: string | null };
  OUT_FOR_DELIVERY: { orderId: string; items: EmailItem[]; trackingUrl: string | null; cod: boolean };
  DELIVERED: { orderId: string; items: EmailItem[] };
  PARCEL_LOST: { orderId: string; items: EmailItem[]; prepaid: boolean };
  PARCEL_RETURNED: { orderId: string; items: EmailItem[]; prepaid: boolean };
  REFUND_STARTED: { orderId: string; amountPaise: number; toSource: boolean };
  REFUND_COMPLETED: { orderId: string; amountPaise: number; toSource: boolean };
  RETURN_APPROVED: { returnId: string; orderId: string; title: string; pickupDate: string | null; pickupSlot: string | null };
  RETURN_REJECTED: { returnId: string; orderId: string; title: string; reason: string | null; afterCheck: boolean };
  RETURN_PICKED_UP: { returnId: string; orderId: string; title: string; refundNow: boolean };
  RETURN_QC_FAILED: { returnId: string; orderId: string; title: string; note: string | null };
  RETURN_REFUNDED: { returnId: string; orderId: string; title: string; amountPaise: number; toSource: boolean };
  RETURN_REPLACED: { returnId: string; orderId: string; title: string; exchangeSize: string | null };
  CARE_REPLY: { ticketId: string; messageId: number };
}

export type NotificationKind = keyof NotificationData;

/** The start of each kind's dedupe key; the rest identifies the order, parcel, refund, return or message. */
export const DEDUPE_PREFIX: Record<NotificationKind, string> = {
  ORDER_PLACED: "order-placed",
  PAYMENT_FAILED: "payment-failed",
  ORDER_ABANDONED: "order-abandoned",
  ORDER_CANCELLED: "order-cancelled",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out-for-delivery",
  DELIVERED: "delivered",
  PARCEL_LOST: "parcel-lost",
  PARCEL_RETURNED: "parcel-returned",
  REFUND_STARTED: "refund-started",
  REFUND_COMPLETED: "refund-completed",
  RETURN_APPROVED: "return-approved",
  RETURN_REJECTED: "return-rejected",
  RETURN_PICKED_UP: "return-picked-up",
  RETURN_QC_FAILED: "return-qc-failed",
  RETURN_REFUNDED: "return-refunded",
  RETURN_REPLACED: "return-replaced",
  CARE_REPLY: "care-reply",
};

/** Everything a template reads besides its data, resolved when the email is sent. */
export interface EmailContext {
  to: string;
  /** the customer's name, for the greeting */
  name: string | null;
  /** WEB_ORIGIN, for links */
  web: string;
  /** who signs the email: the company's legal name once it is set, otherwise AltasGoods */
  signOff: string;
  /** a Care Desk reply, loaded at send time */
  reply?: { agent: string; body: string };
}

const FOOTER = (signOff: string) => `Questions? Write to us from Help and support in your AltasGoods account.${signOff !== "AltasGoods" ? ` AltasGoods is run by ${signOff}.` : ""}`;
const BANK_DAYS = "Banks usually take 5 to 7 working days to show it in your account.";

const itemLine = (i: EmailItem) => `${i.title}${i.variant ? ` (${i.variant})` : ""}${i.qty > 1 ? `, qty ${i.qty}` : ""}`;
const what = (items: EmailItem[]) => (items.length === 1 ? itemLine(items[0]!) : `${items.length} items`);
const greeting = (name: string | null) => (name ? `Hello ${name.split(" ")[0]},` : "Hello,");
const payLabel: Record<PaymentMethod, string> = { UPI: "UPI", CARD: "card", NETBANKING: "net banking", EMI: "EMI", PAY_LATER: "Pay Later", COD: "cash on delivery" };
const istTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const pickupDay = (date: string) => new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short", timeZone: "Asia/Kolkata" });

interface Draft {
  subject: string;
  title: string;
  paragraphs: string[];
  list?: string[];
  link: EmailLink;
  secondaryLink?: EmailLink;
}

function compose(ctx: EmailContext, d: Draft): EmailMessage {
  const paragraphs = [greeting(ctx.name), ...d.paragraphs];
  const footer = FOOTER(ctx.signOff);
  const text = [
    ...paragraphs,
    ...(d.list?.length ? [d.list.map((l) => `- ${l}`).join("\n")] : []),
    `${d.link.label}: ${d.link.href}`,
    ...(d.secondaryLink ? [`${d.secondaryLink.label}: ${d.secondaryLink.href}`] : []),
    footer,
  ].join("\n\n");
  return { to: ctx.to, subject: d.subject, text, html: layout(d.title, paragraphs, { list: d.list, link: d.link, secondaryLink: d.secondaryLink, footer }) };
}

const orderLink = (ctx: EmailContext, orderId: string, label = "View your order"): EmailLink => ({ href: `${ctx.web}/account/orders/${orderId}`, label });
const returnsLink = (ctx: EmailContext): EmailLink => ({ href: `${ctx.web}/account/returns`, label: "View your return" });
const refundsLink = (ctx: EmailContext): EmailLink => ({ href: `${ctx.web}/account/returns?tab=refunds`, label: "View your refunds" });

type Builder<K extends NotificationKind> = (ctx: EmailContext, data: NotificationData[K]) => EmailMessage;

const BUILDERS: { [K in NotificationKind]: Builder<K> } = {
  ORDER_PLACED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods order ${d.orderId} is confirmed`,
      title: "Your order is confirmed",
      paragraphs: [
        `Thank you for shopping with AltasGoods. We have your order ${d.orderId} for ${rupees(d.totalPaise)}.`,
        d.paymentMethod === "COD" ? `Please keep ${rupees(d.totalPaise)} ready to pay when it is delivered.` : `Your payment by ${payLabel[d.paymentMethod]} has been received.`,
        "We will email you again when it ships.",
      ],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  PAYMENT_FAILED: (ctx, d) =>
    compose(ctx, {
      subject: `Payment for your AltasGoods order ${d.orderId} did not go through`,
      title: "Your payment did not go through",
      paragraphs: [
        `We could not take the payment of ${rupees(d.amountPaise)} for order ${d.orderId}. If any money left your account, it comes back to you automatically.`,
        d.payBy ? `Your items are held for you. You can try again until ${istTime(d.payBy)}.` : "You can try the payment again from your order.",
      ],
      link: orderLink(ctx, d.orderId, "Try the payment again"),
    }),

  ORDER_ABANDONED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods order ${d.orderId} was cancelled`,
      title: "Your unpaid order was cancelled",
      paragraphs: [`We did not receive the payment for order ${d.orderId} in time, so we cancelled it and released the items. You have not been charged.`, "You can place the order again at any time."],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  ORDER_CANCELLED: (ctx, d) =>
    compose(ctx, {
      subject: d.whole ? `Your AltasGoods order ${d.orderId} is cancelled` : `Items in your AltasGoods order ${d.orderId} are cancelled`,
      title: d.whole ? "Your order is cancelled" : "Items cancelled",
      paragraphs: [
        d.byCustomer
          ? `As you asked, we cancelled ${d.whole ? `order ${d.orderId}` : `${what(d.items)} from order ${d.orderId}`}.`
          : `We are sorry, we had to cancel ${d.whole ? `order ${d.orderId}` : `${what(d.items)} from order ${d.orderId}`}.${d.reason ? ` Reason: ${d.reason}` : ""}`,
        d.prepaid ? "Your refund is on its way. We will email you when it has been sent." : "You have not been charged for these items.",
      ],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  SHIPPED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods order ${d.orderId} has shipped`,
      title: d.items.length === 1 ? "Your item is on its way" : "Your items are on their way",
      paragraphs: [`${d.items.length === 1 ? "An item" : `${d.items.length} items`} from order ${d.orderId} left our warehouse${d.courier ? ` with ${d.courier}` : ""}.${d.awb ? ` Tracking number: ${d.awb}.` : ""}`],
      list: d.items.map(itemLine),
      link: d.trackingUrl ? { href: d.trackingUrl, label: "Track your parcel" } : orderLink(ctx, d.orderId, "Track your order"),
      secondaryLink: d.trackingUrl ? orderLink(ctx, d.orderId) : undefined,
    }),

  OUT_FOR_DELIVERY: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods order ${d.orderId} is out for delivery`,
      title: "Arriving today",
      paragraphs: [`Your parcel from order ${d.orderId} is out for delivery and should reach you today.`, ...(d.cod ? ["Please keep the cash on delivery amount ready."] : [])],
      list: d.items.map(itemLine),
      link: d.trackingUrl ? { href: d.trackingUrl, label: "Track your parcel" } : orderLink(ctx, d.orderId, "Track your order"),
      secondaryLink: d.trackingUrl ? orderLink(ctx, d.orderId) : undefined,
    }),

  DELIVERED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods order ${d.orderId} was delivered`,
      title: "Delivered",
      paragraphs: [`Your parcel from order ${d.orderId} was delivered. We hope you enjoy it.`, "If something is not right, you can ask for a return from your order."],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  PARCEL_LOST: (ctx, d) =>
    compose(ctx, {
      subject: `An update on your AltasGoods order ${d.orderId}`,
      title: "Your parcel was lost in transit",
      paragraphs: [
        `We are sorry. The courier has lost your parcel from order ${d.orderId}.`,
        d.prepaid ? "We have started a full refund for it. We will email you when it has been sent." : "You have not been charged for it.",
      ],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  PARCEL_RETURNED: (ctx, d) =>
    compose(ctx, {
      subject: `An update on your AltasGoods order ${d.orderId}`,
      title: "Your parcel came back to us",
      paragraphs: [
        `The courier could not deliver your parcel from order ${d.orderId} and returned it to us.`,
        d.prepaid ? "We have started a refund for it. We will email you when it has been sent." : "You have not been charged for it.",
      ],
      list: d.items.map(itemLine),
      link: orderLink(ctx, d.orderId),
    }),

  REFUND_STARTED: (ctx, d) =>
    compose(ctx, {
      subject: `Your refund of ${rupees(d.amountPaise)} for order ${d.orderId} has started`,
      title: "Your refund has started",
      paragraphs: [
        `We have started a refund of ${rupees(d.amountPaise)} for order ${d.orderId}.`,
        d.toSource ? "It goes back to the payment method you used. We will email you when it has been sent." : "Our team pays it to you directly. We will email you when it has been paid.",
      ],
      link: refundsLink(ctx),
    }),

  REFUND_COMPLETED: (ctx, d) =>
    compose(ctx, {
      subject: `Your refund of ${rupees(d.amountPaise)} for order ${d.orderId} is complete`,
      title: "Your refund is complete",
      paragraphs: [
        d.toSource ? `We have sent ${rupees(d.amountPaise)} back to the payment method you used for order ${d.orderId}.` : `We have paid you ${rupees(d.amountPaise)} for order ${d.orderId}.`,
        BANK_DAYS,
      ],
      link: refundsLink(ctx),
    }),

  RETURN_APPROVED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods return ${d.returnId} is approved`,
      title: "Your return is approved",
      paragraphs: [
        `We approved return ${d.returnId} for ${d.title}.`,
        d.pickupDate ? `We will pick it up on ${pickupDay(d.pickupDate)}${d.pickupSlot ? `, ${d.pickupSlot}` : ""}. Please pack the item with its tags and accessories.` : "We will let you know when the pickup is booked. Please pack the item with its tags and accessories.",
      ],
      link: returnsLink(ctx),
    }),

  RETURN_REJECTED: (ctx, d) =>
    compose(ctx, {
      subject: `An update on your AltasGoods return ${d.returnId}`,
      title: "We could not accept your return",
      paragraphs: [
        d.afterCheck ? `We checked the item from return ${d.returnId} (${d.title}) and could not accept it. We are sending it back to you.` : `We could not accept return ${d.returnId} for ${d.title}.`,
        ...(d.reason ? [`Reason: ${d.reason}`] : []),
        "If you think this is wrong, write to us from Help and support.",
      ],
      link: returnsLink(ctx),
    }),

  RETURN_PICKED_UP: (ctx, d) =>
    compose(ctx, {
      subject: `We picked up your AltasGoods return ${d.returnId}`,
      title: "Your return was picked up",
      paragraphs: [`We picked up ${d.title} for return ${d.returnId}.`, d.refundNow ? "Your refund has started." : "We will check the item when it reaches us and email you with the outcome."],
      link: returnsLink(ctx),
    }),

  RETURN_QC_FAILED: (ctx, d) =>
    compose(ctx, {
      subject: `An update on your AltasGoods return ${d.returnId}`,
      title: "Your returned item did not pass our check",
      paragraphs: [`We checked ${d.title} from return ${d.returnId} and found a problem.`, ...(d.note ? [`What we found: ${d.note}`] : []), "Our team will review it and contact you about what happens next."],
      link: returnsLink(ctx),
    }),

  RETURN_REFUNDED: (ctx, d) =>
    compose(ctx, {
      subject: `Your refund for AltasGoods return ${d.returnId} has started`,
      title: "Your return refund has started",
      paragraphs: [
        `We have started a refund of ${rupees(d.amountPaise)} for return ${d.returnId} (${d.title}).`,
        d.toSource ? "It goes back to the payment method you used. We will email you when it has been sent." : "Our team pays it to you directly. We will email you when it has been paid.",
      ],
      link: refundsLink(ctx),
    }),

  RETURN_REPLACED: (ctx, d) =>
    compose(ctx, {
      subject: `Your AltasGoods ${d.exchangeSize ? "exchange" : "replacement"} for return ${d.returnId} is on its way`,
      title: d.exchangeSize ? "Your exchange is on its way" : "Your replacement is on its way",
      paragraphs: [d.exchangeSize ? `We are sending ${d.title} in size ${d.exchangeSize} for return ${d.returnId}.` : `We are sending a replacement ${d.title} for return ${d.returnId}.`],
      link: returnsLink(ctx),
    }),

  CARE_REPLY: (ctx, d) =>
    compose(ctx, {
      subject: `New reply on your AltasGoods help request ${d.ticketId}`,
      title: "We replied to your help request",
      paragraphs: [
        `${ctx.reply?.agent ?? "Our team"} from AltasGoods replied to your request ${d.ticketId}:`,
        ...(ctx.reply ? ctx.reply.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : ["Open the request to read the reply."]),
      ],
      link: { href: `${ctx.web}/account/support`, label: "Reply or view the request" },
    }),
};

/** The email for one notification. */
export function buildEmail<K extends NotificationKind>(kind: K, ctx: EmailContext, data: NotificationData[K]): EmailMessage {
  return (BUILDERS[kind] as Builder<K>)(ctx, data);
}
