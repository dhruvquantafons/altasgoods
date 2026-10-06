/**
 * Company, policy, careers and press content for the storefront's static pages.
 * Kept as data so it can move to the CMS (AltasGoods Control, Storefront CMS) later.
 */

export type PolicyBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: { title: string; body: string }[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "note"; text: string };

export interface PolicySection {
  id: string;
  heading: string;
  blocks: PolicyBlock[];
}

export interface Policy {
  slug: string;
  title: string;
  /** short label for navigation */
  nav: string;
  summary: string;
  updated: string;
  sections: PolicySection[];
  related: string[];
}

export const POLICIES: Policy[] = [
  {
    slug: "returns",
    title: "Returns and refunds policy",
    nav: "Returns and refunds",
    summary: "How long you have to return an item, how pickups work and when your money comes back.",
    updated: "2026-09-20",
    related: ["cancellation", "guarantee", "payments"],
    sections: [
      {
        id: "windows",
        heading: "Return windows",
        blocks: [
          { type: "p", text: "Return windows are counted from the date your item was delivered. The window for each product is shown on its product page before you buy and again on your order." },
          {
            type: "table",
            head: ["Category", "Window", "Resolution"],
            rows: [
              ["Fashion: apparel, footwear, bags, watches, eyewear", "10 days", "Refund, replacement or exchange"],
              ["Furniture and large home", "10 days", "Refund or replacement"],
              ["Home decor, furnishing, kitchen", "7 days", "Refund or replacement"],
              ["Mobiles, tablets, laptops", "7 days", "Replacement only"],
              ["Electronics and small appliances", "7 days", "Replacement only"],
              ["Large appliances", "10 days", "Replacement after a technician visit"],
              ["Books, toys, sports, stationery", "7 days", "Replacement only"],
              ["Beauty and personal care", "7 days", "Refund if unopened and sealed"],
              ["Grocery and packaged food", "2 days", "Refund for damaged, expired or wrong items"],
            ],
          },
        ],
      },
      {
        id: "how",
        heading: "How to return an item",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Start from your order", body: "Open Your orders, choose the item and select Return or replace. Tell us what went wrong and add photos if the item is damaged or wrong." },
              { title: "Choose your resolution", body: "Pick a refund, a replacement or an exchange where the category allows it, and where the refund should go." },
              { title: "Pick a pickup slot", body: "Doorstep pickup is free. Keep the item with its tags, accessories, manuals and original box ready." },
              { title: "Hand over after a quick check", body: "The associate checks the item at your door against a short checklist and gives you a pickup receipt." },
            ],
          },
        ],
      },
      {
        id: "refunds",
        heading: "Refund timelines",
        blocks: [
          { type: "p", text: "Refunds start as soon as your item passes the doorstep check, or after it reaches the seller for categories that need inspection. You can follow every step on the order page." },
          {
            type: "table",
            head: ["Refund to", "Time after refund starts"],
            rows: [
              ["AltasGoods Credits", "Within 2 hours"],
              ["UPI", "1 to 2 business days"],
              ["Credit or debit card, net banking", "3 to 5 business days"],
              ["AltasGoods Pay Later", "Adjusted in your next statement"],
              ["Cash on delivery orders", "To AltasGoods Credits instantly, or to your bank account in 1 to 3 business days"],
            ],
          },
        ],
      },
      {
        id: "not-returnable",
        heading: "Items that cannot be returned",
        blocks: [
          { type: "list", items: ["Innerwear, lingerie and swimwear", "Opened hygiene, personal care and consumable products", "Personalised or made-to-order items", "Gift cards and digital products", "Items marked non-returnable on the product page"] },
          { type: "note", text: "Damaged, defective, wrong or missing items can always be reported within 7 days of delivery, even if the category is otherwise non-returnable." },
        ],
      },
    ],
  },
  {
    slug: "shipping",
    title: "Shipping and delivery policy",
    nav: "Shipping and delivery",
    summary: "Delivery charges, promise dates, Secure Delivery and what happens if we miss you.",
    updated: "2026-09-12",
    related: ["cancellation", "returns", "payments"],
    sections: [
      {
        id: "promise",
        heading: "Delivery promise",
        blocks: [
          { type: "p", text: "Every product shows a delivery date calculated for your pincode before you buy. Orders confirmed before 2 pm count from the same day. If an item from one seller ships separately from another, each shipment shows its own date." },
        ],
      },
      {
        id: "charges",
        heading: "Delivery charges",
        blocks: [
          {
            type: "table",
            head: ["Order", "Delivery charge"],
            rows: [
              ["AltasGoods Plus members", "Free on every order"],
              ["Each seller shipment of ₹499 or more", "Free"],
              ["Each seller shipment under ₹499", "₹40"],
              ["Cash on delivery", "No extra charge"],
            ],
          },
          { type: "note", text: "AltasGoods does not charge a platform fee, a payment handling fee or a cash on delivery fee. Every charge is shown before you pay." },
        ],
      },
      {
        id: "speeds",
        heading: "Delivery speeds",
        blocks: [
          { type: "list", items: ["Standard delivery to 19,000+ pincodes across India", "One-day delivery for AltasGoods Plus members on eligible items in 60+ cities", "Same-day delivery in select pincodes of Bengaluru, Mumbai, Delhi NCR, Hyderabad and Pune"] },
        ],
      },
      {
        id: "secure",
        heading: "Secure Delivery and Open Box",
        blocks: [
          { type: "p", text: "High value orders, such as phones and laptops, are delivered with a one-time code sent to your registered mobile number. Share it only after you have the package in hand. For selected categories you can open the box at your door and refuse the item if it is damaged or wrong." },
        ],
      },
      {
        id: "missed",
        heading: "If we miss you",
        blocks: [
          { type: "p", text: "We try up to three times. After a missed attempt you can choose a new date, update your address or ask us to cancel from the order page. If all three attempts fail, the item returns to the seller and any amount you paid is refunded in full." },
        ],
      },
    ],
  },
  {
    slug: "cancellation",
    title: "Cancellation policy",
    nav: "Cancellation",
    summary: "Cancel any item before it ships for a full refund, with no fee.",
    updated: "2026-08-28",
    related: ["returns", "payments", "shipping"],
    sections: [
      {
        id: "before",
        heading: "Before your item ships",
        blocks: [{ type: "p", text: "Open Your orders and select Cancel on any item that has not shipped yet. You get a full refund and there is no cancellation fee. Coupons, AltasCoins and AltasGoods Credits used on the item are restored immediately." }],
      },
      {
        id: "after",
        heading: "After your item ships",
        blocks: [{ type: "p", text: "You can request cancellation and the parcel returns to the seller, or simply refuse it at your door. Once the seller receives it back, your refund starts automatically." }],
      },
      {
        id: "seller",
        heading: "If a seller cancels",
        blocks: [{ type: "p", text: "Sellers can only cancel when an item is genuinely unavailable. You are notified at once, refunded in full, and shown other sellers offering the same product where available. Repeated seller cancellations count against the seller's Seller Health score." }],
      },
      {
        id: "refund",
        heading: "Refunds for cancelled items",
        blocks: [{ type: "p", text: "Prepaid refunds start within 1 hour of cancellation and follow the timelines in the returns and refunds policy. Nothing is charged for cash on delivery orders cancelled before delivery." }],
      },
    ],
  },
  {
    slug: "payments",
    title: "Payments policy",
    nav: "Payments",
    summary: "Ways to pay, cash on delivery limits, EMI, and what happens when a payment fails.",
    updated: "2026-09-05",
    related: ["credits", "returns", "privacy"],
    sections: [
      {
        id: "methods",
        heading: "Ways to pay",
        blocks: [{ type: "list", items: ["UPI, by UPI ID or QR code", "Credit and debit cards, including RuPay", "Net banking with major Indian banks", "No cost and standard EMI on eligible cards", "AltasGoods Pay Later, offered with a regulated lending partner", "AltasGoods Credits and AltasGoods Gift Cards", "Cash on delivery, paid in cash or by UPI at your door"] }],
      },
      {
        id: "cod",
        heading: "Cash on delivery",
        blocks: [{ type: "p", text: "Pay on delivery is available for orders up to ₹50,000 in serviceable pincodes. There is never an extra charge for it. It may be unavailable for some sellers, categories or accounts with repeated refused deliveries; the reason is always shown at checkout." }],
      },
      {
        id: "failed",
        heading: "Failed payments",
        blocks: [{ type: "p", text: "If money leaves your account but your order is not placed, it is reversed automatically within 1 business day, in line with Reserve Bank of India timelines. You can see the reversal status in the help centre without contacting us." }],
      },
      {
        id: "security",
        heading: "Payment security",
        blocks: [{ type: "p", text: "AltasGoods never stores your card number. Saved cards are tokenised by our payment partner, and every payment is authenticated by your bank. AltasGoods staff will never ask for your OTP, PIN or CVV." }],
      },
    ],
  },
  {
    slug: "credits",
    title: "AltasGoods Credits, gift cards and AltasCoins",
    nav: "Credits, gift cards and AltasCoins",
    summary: "How stored value works: what expires, what can go back to your bank and how to use it.",
    updated: "2026-07-30",
    related: ["payments", "returns", "terms"],
    sections: [
      {
        id: "credits",
        heading: "AltasGoods Credits",
        blocks: [{ type: "p", text: "Credits from refunds never expire and can be moved back to your bank account on request. Goodwill credits issued by our support team expire after 1 year and cannot be withdrawn. Credits can pay for any part of an order." }],
      },
      {
        id: "gift-cards",
        heading: "AltasGoods Gift Cards",
        blocks: [{ type: "p", text: "Gift cards are valid for 1 year from activation. Once added to your account the balance becomes AltasGoods Credits. Gift cards cannot be reloaded, resold or exchanged for cash." }],
      },
      {
        id: "blucoins",
        heading: "AltasCoins",
        blocks: [{ type: "list", items: ["Earn 1 AltasCoin per ₹100 spent, or 2 per ₹100 with AltasGoods Plus", "Coins are credited once the return window for the item closes", "Use coins for up to 10% of an order, 1 coin equals ₹1", "Coins expire 6 months after they are credited, and we remind you 15 days before"] }],
      },
    ],
  },
  {
    slug: "guarantee",
    title: "AltasGoods Guarantee",
    nav: "AltasGoods Guarantee",
    summary: "Our promise that you get what you ordered, on time and as described, or your money back.",
    updated: "2026-09-01",
    related: ["returns", "grievance", "terms"],
    sections: [
      {
        id: "covers",
        heading: "What it covers",
        blocks: [{ type: "list", items: ["Your item was not delivered", "Your item arrived materially different from its listing, or damaged", "A refund you are owed was not issued on time", "A seller did not honour a warranty or return they offered"] }],
      },
      {
        id: "claim",
        heading: "How to file a claim",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Contact the seller first", body: "Use Contact seller on the order page. Sellers must reply within 48 hours." },
              { title: "File a claim", body: "If it is not resolved, file an AltasGoods Guarantee claim from the order page within 90 days of the latest promised delivery date." },
              { title: "We decide", body: "AltasGoods reviews the evidence from both sides and decides within 7 days. If the claim is granted, you are refunded in full." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of use",
    nav: "Terms of use",
    summary: "The agreement between you and AltasGoods when you use the AltasGoods website and apps.",
    updated: "2026-06-10",
    related: ["privacy", "payments", "grievance"],
    sections: [
      {
        id: "marketplace",
        heading: "AltasGoods is a marketplace",
        blocks: [{ type: "p", text: "AltasGoods is operated by AltasGoods Commerce Private Limited as an e-commerce marketplace. Products are sold by independent sellers. The seller's name, address, rating and return policy are shown on every product page, and each seller issues its own GST invoice." }],
      },
      {
        id: "account",
        heading: "Your account",
        blocks: [{ type: "p", text: "You sign in with your mobile number and a one-time password. You are responsible for activity on your account, and must tell us straight away if you think someone else has used it. Accounts are for personal, non-commercial use unless registered for AltasGoods Business." }],
      },
      {
        id: "pricing",
        heading: "Prices and availability",
        blocks: [{ type: "p", text: "Prices include GST. If an item is listed at an obviously incorrect price, we or the seller may cancel the order with a full refund. Deal prices and strike-through prices are checked against the lowest price of the previous 30 days." }],
      },
      {
        id: "conduct",
        heading: "Acceptable use",
        blocks: [{ type: "list", items: ["Do not post reviews you were paid for, or reviews of products you did not use", "Do not misuse returns, coupons or cash on delivery", "Do not scrape, resell or copy AltasGoods content without permission", "Do not impersonate another person or seller"] }],
      },
      {
        id: "law",
        heading: "Governing law",
        blocks: [{ type: "p", text: "These terms are governed by the laws of India, and the courts of Bengaluru have jurisdiction, without affecting your rights under the Consumer Protection Act, 2019." }],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy notice",
    nav: "Privacy",
    summary: "What personal data we collect, why we need it and the choices you have, under the Digital Personal Data Protection Act, 2023.",
    updated: "2026-08-14",
    related: ["terms", "account-security", "grievance"],
    sections: [
      {
        id: "collect",
        heading: "What we collect",
        blocks: [{ type: "list", items: ["Your name, mobile number, email and delivery addresses", "Orders, returns, payments status and support conversations", "Device and app information used to keep your account secure", "Browsing within AltasGoods, used to improve search and recommendations"] }],
      },
      {
        id: "use",
        heading: "How we use it",
        blocks: [{ type: "p", text: "To deliver your orders, process payments and refunds, prevent fraud, give support and, only with your consent, send offers. Sellers and delivery partners receive only what they need to fulfil your order, and your phone number is masked during delivery calls." }],
      },
      {
        id: "choices",
        heading: "Your choices and rights",
        blocks: [{ type: "list", items: ["Download a copy of your data from Account, then Privacy and data", "Correct or update your details at any time", "Withdraw consent for promotional messages on any channel", "Ask us to delete your account and data, subject to legal retention periods"] }],
      },
      {
        id: "retention",
        heading: "Retention and security",
        blocks: [{ type: "p", text: "We keep order and tax records for 8 years as Indian law requires, and delete other data when it is no longer needed. Data is encrypted in transit and at rest and stored in India." }],
      },
    ],
  },
  {
    slug: "account-security",
    title: "Account and security",
    nav: "Account and security",
    summary: "How sign in works and how to keep your account and money safe from fraud.",
    updated: "2026-07-02",
    related: ["privacy", "payments", "terms"],
    sections: [
      {
        id: "signin",
        heading: "Signing in",
        blocks: [{ type: "p", text: "Sign in with your mobile number and a one-time password. Changing your mobile number needs codes sent to both the old and the new numbers, so nobody can take over your account with just one of them." }],
      },
      {
        id: "fraud",
        heading: "Staying safe from fraud",
        blocks: [{ type: "list", items: ["AltasGoods will never ask for your OTP, PIN, CVV or passwords on a call, chat or email", "Refunds never need you to scan a QR code or approve a UPI collect request", "Our only customer care number is 1800 210 4455", "Report a suspicious call or message from Help, then Report fraud"] }],
      },
    ],
  },
  {
    slug: "grievance",
    title: "Grievance redressal",
    nav: "Grievance redressal",
    summary: "If you are not satisfied with how we resolved your issue, our Grievance Officer will review it.",
    updated: "2026-06-10",
    related: ["guarantee", "terms", "privacy"],
    sections: [
      {
        id: "process",
        heading: "How grievances are handled",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Write to the Grievance Officer", body: "Include your order ID and what happened. You can also raise it from Help, then Contact us." },
              { title: "Acknowledged within 48 hours", body: "You receive a grievance number and the name of the person handling it." },
              { title: "Resolved within one month", body: "We investigate with the seller and our teams and write back with a decision and reasons." },
            ],
          },
          { type: "p", text: "The Grievance Officer is appointed under the Consumer Protection (E-Commerce) Rules, 2020. If you are still not satisfied, you can approach the National Consumer Helpline (1915) or the consumer commission." },
        ],
      },
    ],
  },
];

export function getPolicy(slug: string) {
  return POLICIES.find((p) => p.slug === slug);
}

/* ------------------------------- Careers ------------------------------- */

export interface Role {
  slug: string;
  title: string;
  team: "Engineering" | "Design" | "Data" | "Category" | "Seller success" | "Operations" | "Customer experience" | "Finance";
  location: string;
  type: "Full time" | "Contract";
  experience: string;
  posted: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
}

export const ROLES: Role[] = [
  {
    slug: "senior-frontend-engineer-web-platform",
    title: "Senior Frontend Engineer, Web Platform",
    team: "Engineering",
    location: "Bengaluru, hybrid",
    type: "Full time",
    experience: "5+ years",
    posted: "2026-09-24",
    summary: "Own the shared design system and performance of every AltasGoods web workspace, from the storefront to Seller Hub.",
    responsibilities: ["Evolve our component library and design tokens with the design team", "Keep storefront pages fast on mid-range Android phones and 4G networks", "Build accessible, data-dense dashboards for sellers and operations teams", "Mentor engineers and review code across teams"],
    requirements: ["Deep experience with React and TypeScript", "Strong grasp of web performance, rendering strategies and accessibility", "Care for detail in typography, spacing and motion"],
    niceToHave: ["Experience with Next.js App Router", "Built a design system used by several teams"],
  },
  {
    slug: "flutter-engineer-customer-app",
    title: "Flutter Engineer, Customer App",
    team: "Engineering",
    location: "Bengaluru, hybrid",
    type: "Full time",
    experience: "3+ years",
    posted: "2026-09-18",
    summary: "Help build the AltasGoods customer app from the first screen, sharing tokens and contracts with the web.",
    responsibilities: ["Build product, cart, checkout and order tracking flows in Flutter", "Work with backend engineers on API contracts generated from OpenAPI", "Make the app fast and reliable on low-end devices and patchy networks"],
    requirements: ["Shipped at least one production Flutter app", "Comfort with state management (Riverpod or similar) and testing", "Understanding of Android and iOS release processes"],
    niceToHave: ["Payments or UPI intent integration experience", "Offline-first design experience"],
  },
  {
    slug: "backend-engineer-payments",
    title: "Backend Engineer, Payments",
    team: "Engineering",
    location: "Bengaluru",
    type: "Full time",
    experience: "4+ years",
    posted: "2026-09-10",
    summary: "Build the money systems behind checkout, refunds and seller payouts, correct to the paisa.",
    responsibilities: ["Design idempotent payment, refund and settlement services", "Build the fee engine and ledger behind seller statements", "Work with finance on reconciliation, TCS and TDS reporting"],
    requirements: ["Experience building payment or ledger systems", "Strong SQL and data modelling", "Comfort with distributed systems and failure handling"],
    niceToHave: ["Experience with Indian payment aggregators and UPI", "TypeScript or Go"],
  },
  {
    slug: "product-designer-seller-experience",
    title: "Product Designer, Seller Experience",
    team: "Design",
    location: "Bengaluru or remote in India",
    type: "Full time",
    experience: "4+ years",
    posted: "2026-09-21",
    summary: "Make Seller Hub the calmest, clearest place for a small business to run its online store.",
    responsibilities: ["Design onboarding, listing, order and payout flows with sellers", "Run research with sellers across cities and languages", "Contribute to the AltasGoods design system"],
    requirements: ["A portfolio of shipped product design for complex workflows", "Strong interaction and visual design craft", "Comfort working with data-dense interfaces"],
    niceToHave: ["Experience designing for small businesses in India", "Hindi or another Indian language"],
  },
  {
    slug: "data-scientist-search-relevance",
    title: "Data Scientist, Search Relevance",
    team: "Data",
    location: "Bengaluru",
    type: "Full time",
    experience: "3+ years",
    posted: "2026-09-02",
    summary: "Help customers find the right product with the first search, across English, Hindi and Hinglish queries.",
    responsibilities: ["Build ranking and query understanding models", "Design experiments and measure their impact on conversion", "Work with catalog teams on attribute quality"],
    requirements: ["Experience with search or recommendation systems", "Strong Python and statistics", "Clear communication of results"],
    niceToHave: ["Experience with multilingual text", "OpenSearch or Elasticsearch"],
  },
  {
    slug: "category-manager-electronics",
    title: "Category Manager, Electronics",
    team: "Category",
    location: "Bengaluru",
    type: "Full time",
    experience: "5+ years",
    posted: "2026-09-15",
    summary: "Grow the electronics category with the right brands, sellers and selection at honest prices.",
    responsibilities: ["Own selection, pricing health and growth for electronics", "Bring on brands and sellers and plan sale events", "Work with marketing and ads on category campaigns"],
    requirements: ["Category or brand management experience in e-commerce or retail", "Strong commercial and analytical skills"],
    niceToHave: ["Relationships with electronics brands in India"],
  },
  {
    slug: "seller-success-manager",
    title: "Seller Success Manager",
    team: "Seller success",
    location: "Mumbai",
    type: "Full time",
    experience: "2+ years",
    posted: "2026-09-26",
    summary: "Help growing sellers launch, list well, ship on time and scale on AltasGoods.",
    responsibilities: ["Onboard and coach a portfolio of sellers", "Improve listing quality and Seller Health", "Turn seller feedback into product improvements"],
    requirements: ["Experience working with sellers or small businesses", "Clear communication in English and Hindi or Marathi"],
    niceToHave: ["Marketplace seller account management experience"],
  },
  {
    slug: "hub-operations-manager",
    title: "Hub Operations Manager, AltasGoods Logistics",
    team: "Operations",
    location: "Bengaluru, Whitefield",
    type: "Full time",
    experience: "4+ years",
    posted: "2026-09-08",
    summary: "Run a last mile delivery hub with a team of delivery associates and a promise customers can trust.",
    responsibilities: ["Plan daily runsheets and capacity", "Own first attempt delivery rate, NDR and COD reconciliation", "Lead, train and look after a team of 60+ associates"],
    requirements: ["Last mile or warehouse operations leadership experience", "Comfort with data and daily operating reviews"],
    niceToHave: ["Experience opening a new hub"],
  },
  {
    slug: "customer-experience-associate",
    title: "Customer Experience Associate, Care Desk",
    team: "Customer experience",
    location: "Hyderabad",
    type: "Full time",
    experience: "0 to 2 years",
    posted: "2026-09-29",
    summary: "Be the person who fixes it when a customer needs help, by chat, email and phone.",
    responsibilities: ["Resolve order, delivery, return and payment questions", "Issue refunds and replacements within your limits", "Spot patterns and suggest fixes to our teams"],
    requirements: ["Excellent written and spoken English, plus Hindi or Telugu", "Patience, empathy and attention to detail"],
    niceToHave: ["Previous customer support experience"],
  },
  {
    slug: "finance-manager-marketplace-payouts",
    title: "Finance Manager, Marketplace Payouts",
    team: "Finance",
    location: "Bengaluru",
    type: "Full time",
    experience: "6+ years",
    posted: "2026-08-30",
    summary: "Make sure every seller is paid correctly and on time, and every tax obligation is met.",
    responsibilities: ["Approve payout runs and manage holds", "Own TCS filings and 194-O TDS reporting with tax advisors", "Build controls for reconciliation and refunds"],
    requirements: ["Chartered Accountant or equivalent", "Experience in marketplace, payments or fintech finance"],
    niceToHave: ["Experience automating finance operations"],
  },
];

export function getRole(slug: string) {
  return ROLES.find((r) => r.slug === slug);
}

/* -------------------------------- Press -------------------------------- */

export interface PressRelease {
  slug: string;
  date: string;
  title: string;
  summary: string;
  category: "Company" | "Sellers" | "Logistics" | "Customers";
}

export const PRESS_RELEASES: PressRelease[] = [
  { slug: "big-days-2026-first-five-days", date: "2026-09-30", category: "Customers", title: "AltasGoods Big Days crosses ₹300 crore in sales in its first five days", summary: "More than 11 lakh orders were placed in the first week of the festive sale, with UPI used for nearly half of all payments." },
  { slug: "zero-commission-under-1000", date: "2026-09-02", category: "Sellers", title: "AltasGoods introduces zero commission on items priced up to ₹999", summary: "Sellers keep more on everyday products, with a simpler rate card and payouts three times a week." },
  { slug: "bengaluru-delivery-hubs", date: "2026-08-12", category: "Logistics", title: "AltasGoods Logistics opens Whitefield and HSR Layout delivery hubs", summary: "The two hubs bring same-day and next-day delivery to more than 40 pincodes across east and south Bengaluru." },
  { slug: "altasgoods-plus-launch", date: "2026-07-15", category: "Customers", title: "AltasGoods Plus launches at ₹999 a year", summary: "Members get free delivery on every order, one-day delivery in 60+ cities and double AltasCoins." },
  { slug: "marketplace-opens-to-sellers", date: "2026-06-10", category: "Company", title: "AltasGoods opens its marketplace to sellers across India", summary: "Sellers can register in minutes with GSTIN or PAN, list products and start receiving orders the same week." },
];

/* -------------------------------- About -------------------------------- */

export const ABOUT_NUMBERS = [
  { value: "19,000+", label: "pincodes served" },
  { value: "12,000+", label: "verified sellers" },
  { value: "48 lakh", label: "products listed" },
  { value: "3 days", label: "average delivery time" },
];

export const ABOUT_PRINCIPLES = [
  { title: "Honest prices", body: "Deal prices are checked against the lowest price of the last 30 days. No platform fees, no cash on delivery fees, nothing added at the last step." },
  { title: "Real dates", body: "We promise a delivery date for your pincode, not a vague speed, and we tell you early if anything changes." },
  { title: "Fair to sellers", body: "Clear rate cards, zero commission on everyday items under ₹1,000, and payouts three times a week." },
  { title: "Calm by design", body: "No fake timers, no pre-ticked boxes, no endless notifications. Shopping should feel good afterwards too." },
];

export const ABOUT_MILESTONES = [
  { date: "Jan 2025", title: "Founded in Bengaluru", body: "A small team of engineers, designers and operators set out to build a calmer marketplace for India." },
  { date: "Jun 2026", title: "Marketplace opens", body: "Sellers across India can register, list and sell on AltasGoods." },
  { date: "Jul 2026", title: "AltasGoods Plus", body: "Free delivery on every order and one-day delivery in 60+ cities." },
  { date: "Aug 2026", title: "AltasGoods Logistics", body: "Our first delivery hubs open in Bengaluru, with Secure Delivery on high value orders." },
  { date: "Sep 2026", title: "AltasGoods Big Days", body: "Our first festive sale, and zero commission on items up to ₹999 for sellers." },
];

export const OFFICES = [
  { city: "Bengaluru", note: "Headquarters", address: "Level 9, Lakeview Square, 14 Residency Road, Ashok Nagar, Bengaluru 560025" },
  { city: "Mumbai", note: "Seller success and partnerships", address: "6th Floor, Harbour View Centre, Lower Parel, Mumbai 400013" },
  { city: "Gurugram", note: "Operations and logistics", address: "Tower C, Cyber Greens, DLF Phase 3, Gurugram 122002" },
  { city: "Hyderabad", note: "Care Desk", address: "Block 4, Orion Tech Park, Hitec City, Hyderabad 500081" },
];
