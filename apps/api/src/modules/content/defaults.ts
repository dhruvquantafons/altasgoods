/**
 * The starting content of the storefront's policy, help, careers, press, about and spotlight pages.
 * ContentService.ensureDefaults() inserts each kind once, while its table is empty, so edits made in
 * AltasGoods Control are never overwritten. Page bodies are Markdown.
 */
import type { AboutDoc } from "../../db/schema.js";

export interface DefaultPage { slug: string; kind: "policy" | "page"; title: string; nav: string; summary: string; /** YYYY-MM-DD */ updated: string; related: string[]; sections: { id: string; heading: string; body: string }[] }
export interface DefaultRole { slug: string; title: string; team: string; location: string; type: string; experience: string; posted: string; summary: string; responsibilities: string[]; requirements: string[]; niceToHave: string[] }
export interface DefaultPress { slug: string; date: string; title: string; summary: string; category: string }
export interface DefaultSpotlight { brand: string; tagline: string; productSlug: string; tone: string; image: string }

export const DEFAULT_PAGES: DefaultPage[] = [
  {
    "slug": "returns",
    "kind": "policy",
    "title": "Returns and refunds policy",
    "nav": "Returns and refunds",
    "summary": "How long you have to return an item, how pickups work and when your money comes back.",
    "updated": "2026-09-20",
    "related": [
      "cancellation",
      "guarantee",
      "payments"
    ],
    "sections": [
      {
        "id": "windows",
        "heading": "Return windows",
        "body": "Return windows are counted from the date your item was delivered. The window for each product is shown on its product page before you buy and again on your order.\n\n| Category | Window | Resolution |\n| --- | --- | --- |\n| Fashion: apparel, footwear, bags, watches, eyewear | 10 days | Refund, replacement or exchange |\n| Furniture and large home | 10 days | Refund or replacement |\n| Home decor, furnishing, kitchen | 7 days | Refund or replacement |\n| Mobiles, tablets, laptops | 7 days | Replacement only |\n| Electronics and small appliances | 7 days | Replacement only |\n| Large appliances | 10 days | Replacement after a technician visit |\n| Books, toys, sports, stationery | 7 days | Replacement only |\n| Beauty and personal care | 7 days | Refund if unopened and sealed |\n| Grocery and packaged food | 2 days | Refund for damaged, expired or wrong items |"
      },
      {
        "id": "how",
        "heading": "How to return an item",
        "body": "1. **Start from your order.** Open Your orders, choose the item and select Return or replace. Tell us what went wrong and add photos if the item is damaged or wrong.\n2. **Choose your resolution.** Pick a refund, a replacement or an exchange where the category allows it, and where the refund should go.\n3. **Pick a pickup slot.** Doorstep pickup is free. Keep the item with its tags, accessories, manuals and original box ready.\n4. **Hand over after a quick check.** The associate checks the item at your door against a short checklist and gives you a pickup receipt."
      },
      {
        "id": "refunds",
        "heading": "Refund timelines",
        "body": "Refunds start as soon as your item passes the doorstep check, or after it reaches the seller for categories that need inspection. You can follow every step on the order page.\n\n| Refund to | Time after refund starts |\n| --- | --- |\n| UPI | 1 to 2 business days |\n| Credit or debit card, net banking | 3 to 5 business days |\n| AltasGoods Pay Later | Adjusted in your next statement |\n| Cash on delivery orders | To your bank account by UPI, in 1 to 3 business days after you give your UPI ID |"
      },
      {
        "id": "not-returnable",
        "heading": "Items that cannot be returned",
        "body": "- Innerwear, lingerie and swimwear\n- Opened hygiene, personal care and consumable products\n- Personalised or made-to-order items\n- Gift cards and digital products\n- Items marked non-returnable on the product page\n\n> **Note:** Damaged, defective, wrong or missing items can always be reported within 7 days of delivery, even if the category is otherwise non-returnable."
      }
    ]
  },
  {
    "slug": "shipping",
    "kind": "policy",
    "title": "Shipping and delivery policy",
    "nav": "Shipping and delivery",
    "summary": "Delivery charges, promise dates, Secure Delivery and what happens if we miss you.",
    "updated": "2026-09-12",
    "related": [
      "cancellation",
      "returns",
      "payments"
    ],
    "sections": [
      {
        "id": "promise",
        "heading": "Delivery promise",
        "body": "Every product shows a delivery date calculated for your pincode before you buy. Orders confirmed before 2 pm count from the same day. If an item from one seller ships separately from another, each shipment shows its own date."
      },
      {
        "id": "charges",
        "heading": "Delivery charges",
        "body": "| Order | Delivery charge |\n| --- | --- |\n| Each seller shipment of ₹499 or more | Free |\n| Each seller shipment under ₹499 | ₹40 |\n| Cash on delivery | No extra charge |\n\n> **Note:** AltasGoods does not charge a platform fee, a payment handling fee or a cash on delivery fee. Every charge is shown before you pay."
      },
      {
        "id": "speeds",
        "heading": "Delivery speeds",
        "body": "- Standard delivery to 19,000+ pincodes across India\n- One-day delivery on eligible items in 60+ cities\n- Same-day delivery in select pincodes of Bengaluru, Mumbai, Delhi NCR, Hyderabad and Pune"
      },
      {
        "id": "secure",
        "heading": "Secure Delivery and Open Box",
        "body": "High value orders, such as phones and laptops, are delivered with a one-time code sent to your registered mobile number. Share it only after you have the package in hand. For selected categories you can open the box at your door and refuse the item if it is damaged or wrong."
      },
      {
        "id": "missed",
        "heading": "If we miss you",
        "body": "We try up to three times. After a missed attempt you can choose a new date, update your address or ask us to cancel from the order page. If all three attempts fail, the item returns to the seller and any amount you paid is refunded in full."
      }
    ]
  },
  {
    "slug": "cancellation",
    "kind": "policy",
    "title": "Cancellation policy",
    "nav": "Cancellation",
    "summary": "Cancel any item before it ships for a full refund, with no fee.",
    "updated": "2026-08-28",
    "related": [
      "returns",
      "payments",
      "shipping"
    ],
    "sections": [
      {
        "id": "before",
        "heading": "Before your item ships",
        "body": "Open Your orders and select Cancel on any item that has not shipped yet. You get a full refund and there is no cancellation fee. Coupons used on the item are restored immediately."
      },
      {
        "id": "after",
        "heading": "After your item ships",
        "body": "You can request cancellation and the parcel returns to the seller, or simply refuse it at your door. Once the seller receives it back, your refund starts automatically."
      },
      {
        "id": "seller",
        "heading": "If a seller cancels",
        "body": "Sellers can only cancel when an item is genuinely unavailable. You are notified at once, refunded in full, and shown other sellers offering the same product where available. Repeated seller cancellations count against the seller's Seller Health score."
      },
      {
        "id": "refund",
        "heading": "Refunds for cancelled items",
        "body": "Prepaid refunds start within 1 hour of cancellation and follow the timelines in the returns and refunds policy. Nothing is charged for cash on delivery orders cancelled before delivery."
      }
    ]
  },
  {
    "slug": "payments",
    "kind": "policy",
    "title": "Payments policy",
    "nav": "Payments",
    "summary": "Ways to pay, cash on delivery limits, EMI, and what happens when a payment fails.",
    "updated": "2026-09-05",
    "related": [
      "returns",
      "privacy"
    ],
    "sections": [
      {
        "id": "methods",
        "heading": "Ways to pay",
        "body": "- UPI, by UPI ID or QR code\n- Credit and debit cards, including RuPay\n- Net banking with major Indian banks\n- No cost and standard EMI on eligible cards\n- AltasGoods Pay Later, offered with a regulated lending partner\n- Cash on delivery, paid in cash or by UPI at your door"
      },
      {
        "id": "cod",
        "heading": "Cash on delivery",
        "body": "Pay on delivery is available for orders up to ₹50,000 in serviceable pincodes. There is never an extra charge for it. It may be unavailable for some sellers, categories or accounts with repeated refused deliveries; the reason is always shown at checkout."
      },
      {
        "id": "failed",
        "heading": "Failed payments",
        "body": "If money leaves your account but your order is not placed, it is reversed automatically within 1 business day, in line with Reserve Bank of India timelines. You can see the reversal status in the help centre without contacting us."
      },
      {
        "id": "security",
        "heading": "Payment security",
        "body": "AltasGoods never stores your card number. Saved cards are tokenised by our payment partner, and every payment is authenticated by your bank. AltasGoods staff will never ask for your OTP, PIN or CVV."
      }
    ]
  },
  {
    "slug": "guarantee",
    "kind": "policy",
    "title": "AltasGoods Guarantee",
    "nav": "AltasGoods Guarantee",
    "summary": "Our promise that you get what you ordered, on time and as described, or your money back.",
    "updated": "2026-09-01",
    "related": [
      "returns",
      "grievance",
      "terms"
    ],
    "sections": [
      {
        "id": "covers",
        "heading": "What it covers",
        "body": "- Your item was not delivered\n- Your item arrived materially different from its listing, or damaged\n- A refund you are owed was not issued on time\n- A seller did not honour a warranty or return they offered"
      },
      {
        "id": "claim",
        "heading": "How to file a claim",
        "body": "1. **Contact the seller first.** Use Contact seller on the order page. Sellers must reply within 48 hours.\n2. **File a claim.** If it is not resolved, file an AltasGoods Guarantee claim from the order page within 90 days of the latest promised delivery date.\n3. **We decide.** AltasGoods reviews the evidence from both sides and decides within 7 days. If the claim is granted, you are refunded in full."
      }
    ]
  },
  {
    "slug": "terms",
    "kind": "policy",
    "title": "Terms of use",
    "nav": "Terms of use",
    "summary": "The agreement between you and AltasGoods when you use the AltasGoods website and apps.",
    "updated": "2026-06-10",
    "related": [
      "privacy",
      "payments",
      "grievance"
    ],
    "sections": [
      {
        "id": "marketplace",
        "heading": "AltasGoods is a marketplace",
        "body": "AltasGoods is operated by AltasGoods Commerce Private Limited as an e-commerce marketplace. Products are sold by independent sellers. The seller's name, address, rating and return policy are shown on every product page, and each seller issues its own GST invoice."
      },
      {
        "id": "account",
        "heading": "Your account",
        "body": "You sign in with your mobile number and a one-time password. You are responsible for activity on your account, and must tell us straight away if you think someone else has used it. Accounts are for personal, non-commercial use unless registered for AltasGoods Business."
      },
      {
        "id": "pricing",
        "heading": "Prices and availability",
        "body": "Prices include GST. If an item is listed at an obviously incorrect price, we or the seller may cancel the order with a full refund. Deal prices and strike-through prices are checked against the lowest price of the previous 30 days."
      },
      {
        "id": "conduct",
        "heading": "Acceptable use",
        "body": "- Do not post reviews you were paid for, or reviews of products you did not use\n- Do not misuse returns, coupons or cash on delivery\n- Do not scrape, resell or copy AltasGoods content without permission\n- Do not impersonate another person or seller"
      },
      {
        "id": "law",
        "heading": "Governing law",
        "body": "These terms are governed by the laws of India, and the courts of Bengaluru have jurisdiction, without affecting your rights under the Consumer Protection Act, 2019."
      }
    ]
  },
  {
    "slug": "privacy",
    "kind": "policy",
    "title": "Privacy notice",
    "nav": "Privacy",
    "summary": "What personal data we collect, why we need it and the choices you have, under the Digital Personal Data Protection Act, 2023.",
    "updated": "2026-08-14",
    "related": [
      "terms",
      "account-security",
      "grievance"
    ],
    "sections": [
      {
        "id": "collect",
        "heading": "What we collect",
        "body": "- Your name, mobile number, email and delivery addresses\n- Orders, returns, payments status and support conversations\n- Device and app information used to keep your account secure\n- Browsing within AltasGoods, used to improve search and recommendations"
      },
      {
        "id": "use",
        "heading": "How we use it",
        "body": "To deliver your orders, process payments and refunds, prevent fraud, give support and, only with your consent, send offers. Sellers and delivery partners receive only what they need to fulfil your order, and your phone number is masked during delivery calls."
      },
      {
        "id": "choices",
        "heading": "Your choices and rights",
        "body": "- Ask AltasGoods Care for a copy of your data and we will send it to you\n- Correct or update your details at any time from Account, then Profile\n- Withdraw consent for promotional messages on any channel\n- Delete your account yourself from Account, then Profile. Your name, email, phone, saved addresses and cart are erased, and your orders stay only as anonymous records"
      },
      {
        "id": "retention",
        "heading": "Retention and security",
        "body": "We keep order and tax records for 8 years as Indian law requires. When you delete your account, those records stay without your name, phone or street address, and we delete other data when it is no longer needed. Data is encrypted in transit and at rest and stored in India."
      }
    ]
  },
  {
    "slug": "account-security",
    "kind": "policy",
    "title": "Account and security",
    "nav": "Account and security",
    "summary": "How sign in works and how to keep your account and money safe from fraud.",
    "updated": "2026-07-02",
    "related": [
      "privacy",
      "payments",
      "terms"
    ],
    "sections": [
      {
        "id": "signin",
        "heading": "Signing in",
        "body": "Sign in with your mobile number and a one-time password. Changing your mobile number needs codes sent to both the old and the new numbers, so nobody can take over your account with just one of them."
      },
      {
        "id": "fraud",
        "heading": "Staying safe from fraud",
        "body": "- AltasGoods will never ask for your OTP, PIN, CVV or passwords on a call, chat or email\n- Refunds never need you to scan a QR code or approve a UPI collect request\n- Our only customer care number is 1800 210 4455\n- Report a suspicious call or message from Help, then Report fraud"
      }
    ]
  },
  {
    "slug": "grievance",
    "kind": "policy",
    "title": "Grievance redressal",
    "nav": "Grievance redressal",
    "summary": "If you are not satisfied with how we resolved your issue, our Grievance Officer will review it.",
    "updated": "2026-06-10",
    "related": [
      "guarantee",
      "terms",
      "privacy"
    ],
    "sections": [
      {
        "id": "process",
        "heading": "How grievances are handled",
        "body": "1. **Write to the Grievance Officer.** Include your order ID and what happened. You can also raise it from Help, then Contact us.\n2. **Acknowledged within 48 hours.** You receive a grievance number and the name of the person handling it.\n3. **Resolved within one month.** We investigate with the seller and our teams and write back with a decision and reasons.\n\nThe Grievance Officer is appointed under the Consumer Protection (E-Commerce) Rules, 2020. If you are still not satisfied, you can approach the National Consumer Helpline (1915) or the consumer commission."
      }
    ]
  }
];

export const DEFAULT_HELP_TOPICS: { icon: string; title: string; body: string; href: string }[] = [
  {
    "icon": "Package",
    "title": "Orders and delivery",
    "body": "Track, change address, delivery OTP and missed deliveries",
    "href": "/account/orders"
  },
  {
    "icon": "Undo2",
    "title": "Returns and refunds",
    "body": "Return windows, pickup, refund timelines and status",
    "href": "/policies/returns"
  },
  {
    "icon": "XCircle",
    "title": "Cancellations",
    "body": "Cancel before dispatch for a full refund, no fees",
    "href": "/policies/cancellation"
  },
  {
    "icon": "CreditCard",
    "title": "Payments and EMI",
    "body": "UPI, cards, EMI, Pay Later and failed payments",
    "href": "/policies/payments"
  },
  {
    "icon": "ShieldCheck",
    "title": "AltasGoods Guarantee",
    "body": "Item not received or not as described",
    "href": "/policies/guarantee"
  },
  {
    "icon": "UserRound",
    "title": "Account and privacy",
    "body": "Login, mobile number, deleting your account and consent",
    "href": "/policies/account-security"
  }
];

export const DEFAULT_FAQS: { id: string; group: string; q: string; a: string }[] = [
  {
    "id": "cancellation",
    "group": "Cancellations",
    "q": "How do I cancel an order?",
    "a": "Open Your orders, choose the item and select Cancel. Items can be cancelled any time before they are shipped, with a full refund and no cancellation fee. After shipping you can request cancellation and the parcel will return to the seller, or simply refuse it at the door."
  },
  {
    "id": "returns",
    "group": "Returns and refunds",
    "q": "What is the return window for my item?",
    "a": "Return windows are counted from the delivery date: 10 days for fashion and furniture, 7 days for home, electronics, mobiles (replacement), books, toys and sports, 7 days for beauty if unopened, and 2 days for grocery. The exact window is shown on the product page and in your order."
  },
  {
    "id": "refund-time",
    "group": "Returns and refunds",
    "q": "When will I get my refund?",
    "a": "UPI refunds take 1 to 2 business days, cards and net banking 3 to 5 business days. Cash on delivery orders are refunded to your bank account by UPI once you give us your UPI ID."
  },
  {
    "id": "payments",
    "group": "Payments",
    "q": "Money was debited but my order failed. What happens now?",
    "a": "If a payment fails after your money is debited, AltasGoods reverses it automatically within 1 business day as required by RBI rules. You do not need to raise a request. If you do not see the reversal, contact us with the transaction reference."
  },
  {
    "id": "cod",
    "group": "Payments",
    "q": "Is there an extra charge for cash on delivery?",
    "a": "No. AltasGoods never charges a fee for cash on delivery, a payment handling fee or a platform fee. Pay on delivery is available for orders up to ₹50,000 on serviceable pincodes, and you can pay by cash or UPI QR at the door."
  },
  {
    "id": "guarantee",
    "group": "AltasGoods Guarantee",
    "q": "What does the AltasGoods Guarantee cover?",
    "a": "If an item was not delivered, arrived materially different from its listing, or a refund was not issued, contact the seller first. If it is not resolved in 48 hours, file an AltasGoods Guarantee claim from the order page within 90 days of the latest delivery date."
  },
  {
    "id": "account",
    "group": "Account and privacy",
    "q": "How do I download or delete my data?",
    "a": "You can delete your account yourself: go to Account, then Profile, and choose Delete account. Your name, contact details, saved addresses and cart are erased, and past orders are kept without your personal details because tax law requires the records. You cannot delete while an order or return is still in progress. To get a copy of your data, contact AltasGoods Care and we will send it to you."
  }
];

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    "slug": "senior-frontend-engineer-web-platform",
    "title": "Senior Frontend Engineer, Web Platform",
    "team": "Engineering",
    "location": "Bengaluru, hybrid",
    "type": "Full time",
    "experience": "5+ years",
    "posted": "2026-09-24",
    "summary": "Own the shared design system and performance of every AltasGoods web workspace, from the storefront to Seller Hub.",
    "responsibilities": [
      "Evolve our component library and design tokens with the design team",
      "Keep storefront pages fast on mid-range Android phones and 4G networks",
      "Build accessible, data-dense dashboards for sellers and operations teams",
      "Mentor engineers and review code across teams"
    ],
    "requirements": [
      "Deep experience with React and TypeScript",
      "Strong grasp of web performance, rendering strategies and accessibility",
      "Care for detail in typography, spacing and motion"
    ],
    "niceToHave": [
      "Experience with Next.js App Router",
      "Built a design system used by several teams"
    ]
  },
  {
    "slug": "flutter-engineer-customer-app",
    "title": "Flutter Engineer, Customer App",
    "team": "Engineering",
    "location": "Bengaluru, hybrid",
    "type": "Full time",
    "experience": "3+ years",
    "posted": "2026-09-18",
    "summary": "Help build the AltasGoods customer app from the first screen, sharing tokens and contracts with the web.",
    "responsibilities": [
      "Build product, cart, checkout and order tracking flows in Flutter",
      "Work with backend engineers on API contracts generated from OpenAPI",
      "Make the app fast and reliable on low-end devices and patchy networks"
    ],
    "requirements": [
      "Shipped at least one production Flutter app",
      "Comfort with state management (Riverpod or similar) and testing",
      "Understanding of Android and iOS release processes"
    ],
    "niceToHave": [
      "Payments or UPI intent integration experience",
      "Offline-first design experience"
    ]
  },
  {
    "slug": "backend-engineer-payments",
    "title": "Backend Engineer, Payments",
    "team": "Engineering",
    "location": "Bengaluru",
    "type": "Full time",
    "experience": "4+ years",
    "posted": "2026-09-10",
    "summary": "Build the money systems behind checkout, refunds and seller payouts, correct to the paisa.",
    "responsibilities": [
      "Design idempotent payment, refund and settlement services",
      "Build the fee engine and ledger behind seller statements",
      "Work with finance on reconciliation, TCS and TDS reporting"
    ],
    "requirements": [
      "Experience building payment or ledger systems",
      "Strong SQL and data modelling",
      "Comfort with distributed systems and failure handling"
    ],
    "niceToHave": [
      "Experience with Indian payment aggregators and UPI",
      "TypeScript or Go"
    ]
  },
  {
    "slug": "product-designer-seller-experience",
    "title": "Product Designer, Seller Experience",
    "team": "Design",
    "location": "Bengaluru or remote in India",
    "type": "Full time",
    "experience": "4+ years",
    "posted": "2026-09-21",
    "summary": "Make Seller Hub the calmest, clearest place for a small business to run its online store.",
    "responsibilities": [
      "Design onboarding, listing, order and payout flows with sellers",
      "Run research with sellers across cities and languages",
      "Contribute to the AltasGoods design system"
    ],
    "requirements": [
      "A portfolio of shipped product design for complex workflows",
      "Strong interaction and visual design craft",
      "Comfort working with data-dense interfaces"
    ],
    "niceToHave": [
      "Experience designing for small businesses in India",
      "Hindi or another Indian language"
    ]
  },
  {
    "slug": "data-scientist-search-relevance",
    "title": "Data Scientist, Search Relevance",
    "team": "Data",
    "location": "Bengaluru",
    "type": "Full time",
    "experience": "3+ years",
    "posted": "2026-09-02",
    "summary": "Help customers find the right product with the first search, across English, Hindi and Hinglish queries.",
    "responsibilities": [
      "Build ranking and query understanding models",
      "Design experiments and measure their impact on conversion",
      "Work with catalog teams on attribute quality"
    ],
    "requirements": [
      "Experience with search or recommendation systems",
      "Strong Python and statistics",
      "Clear communication of results"
    ],
    "niceToHave": [
      "Experience with multilingual text",
      "OpenSearch or Elasticsearch"
    ]
  },
  {
    "slug": "category-manager-electronics",
    "title": "Category Manager, Electronics",
    "team": "Category",
    "location": "Bengaluru",
    "type": "Full time",
    "experience": "5+ years",
    "posted": "2026-09-15",
    "summary": "Grow the electronics category with the right brands, sellers and selection at honest prices.",
    "responsibilities": [
      "Own selection, pricing health and growth for electronics",
      "Bring on brands and sellers and plan sale events",
      "Work with marketing on category campaigns"
    ],
    "requirements": [
      "Category or brand management experience in e-commerce or retail",
      "Strong commercial and analytical skills"
    ],
    "niceToHave": [
      "Relationships with electronics brands in India"
    ]
  },
  {
    "slug": "seller-success-manager",
    "title": "Seller Success Manager",
    "team": "Seller success",
    "location": "Mumbai",
    "type": "Full time",
    "experience": "2+ years",
    "posted": "2026-09-26",
    "summary": "Help growing sellers launch, list well, ship on time and scale on AltasGoods.",
    "responsibilities": [
      "Onboard and coach a portfolio of sellers",
      "Improve listing quality and Seller Health",
      "Turn seller feedback into product improvements"
    ],
    "requirements": [
      "Experience working with sellers or small businesses",
      "Clear communication in English and Hindi or Marathi"
    ],
    "niceToHave": [
      "Marketplace seller account management experience"
    ]
  },
  {
    "slug": "hub-operations-manager",
    "title": "Hub Operations Manager, AltasGoods Logistics",
    "team": "Operations",
    "location": "Bengaluru, Whitefield",
    "type": "Full time",
    "experience": "4+ years",
    "posted": "2026-09-08",
    "summary": "Run a last mile delivery hub with a team of delivery associates and a promise customers can trust.",
    "responsibilities": [
      "Plan daily runsheets and capacity",
      "Own first attempt delivery rate, NDR and COD reconciliation",
      "Lead, train and look after a team of 60+ associates"
    ],
    "requirements": [
      "Last mile or warehouse operations leadership experience",
      "Comfort with data and daily operating reviews"
    ],
    "niceToHave": [
      "Experience opening a new hub"
    ]
  },
  {
    "slug": "customer-experience-associate",
    "title": "Customer Experience Associate, Care Desk",
    "team": "Customer experience",
    "location": "Hyderabad",
    "type": "Full time",
    "experience": "0 to 2 years",
    "posted": "2026-09-29",
    "summary": "Be the person who fixes it when a customer needs help, by chat, email and phone.",
    "responsibilities": [
      "Resolve order, delivery, return and payment questions",
      "Issue refunds and replacements within your limits",
      "Spot patterns and suggest fixes to our teams"
    ],
    "requirements": [
      "Excellent written and spoken English, plus Hindi or Telugu",
      "Patience, empathy and attention to detail"
    ],
    "niceToHave": [
      "Previous customer support experience"
    ]
  },
  {
    "slug": "finance-manager-marketplace-payouts",
    "title": "Finance Manager, Marketplace Payouts",
    "team": "Finance",
    "location": "Bengaluru",
    "type": "Full time",
    "experience": "6+ years",
    "posted": "2026-08-30",
    "summary": "Make sure every seller is paid correctly and on time, and every tax obligation is met.",
    "responsibilities": [
      "Approve payout runs and manage holds",
      "Own TCS filings and 194-O TDS reporting with tax advisors",
      "Build controls for reconciliation and refunds"
    ],
    "requirements": [
      "Chartered Accountant or equivalent",
      "Experience in marketplace, payments or fintech finance"
    ],
    "niceToHave": [
      "Experience automating finance operations"
    ]
  }
];

export const DEFAULT_PRESS: DefaultPress[] = [
  {
    "slug": "big-days-2026-first-five-days",
    "date": "2026-09-30",
    "category": "Customers",
    "title": "AltasGoods Big Days crosses ₹300 crore in sales in its first five days",
    "summary": "More than 11 lakh orders were placed in the first week of the festive sale, with UPI used for nearly half of all payments."
  },
  {
    "slug": "zero-commission-under-1000",
    "date": "2026-09-02",
    "category": "Sellers",
    "title": "AltasGoods introduces zero commission on items priced up to ₹999",
    "summary": "Sellers keep more on everyday products, with a simpler rate card and payouts three times a week."
  },
  {
    "slug": "bengaluru-delivery-hubs",
    "date": "2026-08-12",
    "category": "Logistics",
    "title": "AltasGoods Logistics opens Whitefield and HSR Layout delivery hubs",
    "summary": "The two hubs bring same-day and next-day delivery to more than 40 pincodes across east and south Bengaluru."
  },
  {
    "slug": "marketplace-opens-to-sellers",
    "date": "2026-06-10",
    "category": "Company",
    "title": "AltasGoods opens its marketplace to sellers across India",
    "summary": "Sellers can register in minutes with GSTIN or PAN, list products and start receiving orders the same week."
  }
];

export const DEFAULT_ABOUT: AboutDoc = {
  "numbers": [
    {
      "value": "19,000+",
      "label": "pincodes served"
    },
    {
      "value": "12,000+",
      "label": "verified sellers"
    },
    {
      "value": "48 lakh",
      "label": "products listed"
    },
    {
      "value": "3 days",
      "label": "average delivery time"
    }
  ],
  "principles": [
    {
      "title": "Honest prices",
      "body": "Deal prices are checked against the lowest price of the last 30 days. No platform fees, no cash on delivery fees, nothing added at the last step."
    },
    {
      "title": "Real dates",
      "body": "We promise a delivery date for your pincode, not a vague speed, and we tell you early if anything changes."
    },
    {
      "title": "Fair to sellers",
      "body": "Clear rate cards, zero commission on everyday items under ₹1,000, and payouts three times a week."
    },
    {
      "title": "Calm by design",
      "body": "No fake timers, no pre-ticked boxes, no endless notifications. Shopping should feel good afterwards too."
    }
  ],
  "milestones": [
    {
      "date": "Jan 2025",
      "title": "Founded in Bengaluru",
      "body": "A small team of engineers, designers and operators set out to build a calmer marketplace for India."
    },
    {
      "date": "Jun 2026",
      "title": "Marketplace opens",
      "body": "Sellers across India can register, list and sell on AltasGoods."
    },
    {
      "date": "Aug 2026",
      "title": "AltasGoods Logistics",
      "body": "Our first delivery hubs open in Bengaluru, with Secure Delivery on high value orders."
    },
    {
      "date": "Sep 2026",
      "title": "AltasGoods Big Days",
      "body": "Our first festive sale, and zero commission on items up to ₹999 for sellers."
    }
  ],
  "offices": [
    {
      "city": "Bengaluru",
      "note": "Headquarters",
      "address": "Level 9, Lakeview Square, 14 Residency Road, Ashok Nagar, Bengaluru 560025"
    },
    {
      "city": "Mumbai",
      "note": "Seller success and partnerships",
      "address": "6th Floor, Harbour View Centre, Lower Parel, Mumbai 400013"
    },
    {
      "city": "Gurugram",
      "note": "Operations and logistics",
      "address": "Tower C, Cyber Greens, DLF Phase 3, Gurugram 122002"
    },
    {
      "city": "Hyderabad",
      "note": "Care Desk",
      "address": "Block 4, Orion Tech Park, Hitec City, Hyderabad 500081"
    }
  ]
};

/** Matched to products by slug when inserted; a spotlight whose product is not in the catalogue is skipped. */
export const DEFAULT_SPOTLIGHTS: DefaultSpotlight[] = [
  {
    "brand": "Kestrel",
    "tagline": "Laptops engineered in Bengaluru",
    "productSlug": "laptop-air",
    "tone": "#eef1f6",
    "image": "/images/products/laptop-air.jpg"
  },
  {
    "brand": "Auralis",
    "tagline": "Sound, with nothing in the way",
    "productSlug": "headphones-studio",
    "tone": "#f1efea",
    "image": "/images/products/headphones-studio.jpg"
  },
  {
    "brand": "Kiln & Co",
    "tagline": "Handmade stoneware from Khurja",
    "productSlug": "vase-ceramic",
    "tone": "#f4efe8",
    "image": "/images/products/vase-ceramic.jpg"
  },
  {
    "brand": "Linen & Loom",
    "tagline": "Everyday cotton, honestly made",
    "productSlug": "tee-classic",
    "tone": "#eef0ee",
    "image": "/images/products/tee-classic.jpg"
  }
];
