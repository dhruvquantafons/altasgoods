# BluBuy

BluBuy is a multi-vendor marketplace for India, modelled on how Amazon.in and Flipkart work end to end: shoppers, sellers, BluBuy staff, logistics teams and support agents each get their own workspace. This repository holds phase 1, which is every dashboard and storefront screen built against realistic mock data, plus the research and specification for the backend and the Flutter apps that come next.

## Run it

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
```

Open `http://localhost:3000/portals` to reach every workspace from one page.

| Workspace | Start here | For |
|---|---|---|
| Storefront | `/` | Shoppers: home, search, category, product page, cart, checkout |
| My Account | `/account` | Shoppers: orders and tracking, returns, wallet, BluCoins, Plus |
| Seller Hub | `/seller` | Sellers: orders, listings, inventory, pricing, ads, payments, health |
| Seller registration | `/seller/register` | New sellers: KYC and onboarding |
| BluBuy Control | `/admin` | BluBuy staff: operations, catalog, sellers, finance, risk |
| Hub Console | `/logistics` | Logistics: hub, shipments, runs, NDR, COD, Rider app preview |
| Care Desk | `/support` | Support agents: tickets with full order context |

## What is built (phase 1)

98 routes (668 pages once product, order, seller, customer, shipment and ticket detail pages are generated), all rendering from the shared mock data layer:

| Area | Routes | Highlights |
|---|---|---|
| Storefront, checkout, sign in | 14 | Home with hero and live sale countdown, URL-driven search filters, product page with buy box, other sellers, offers, reviews and Q&A, persistent cart, five-step checkout (UPI, cards, EMI, Pay Later, COD), OTP login, Sell on BluBuy, BluBuy Plus |
| My Account | 15 | Order tracking with Secure Delivery OTP, cancel and return wizards, refunds, wishlist, addresses, Credits, BluCoins, Plus, privacy controls |
| Seller Hub | 23 | Order processing with bulk actions and dispatch SLAs, listings and add-product wizard, inventory and inbound, pricing rules, ads, promotions, analytics, payouts with fee, GST, TCS and TDS statements, Seller Health, 10-step registration and KYC |
| BluBuy Control | 25 | Marketplace overview, orders, returns, customers, seller KYC approvals, catalog moderation, categories, brands, payments, payouts, rate card and fee calculator, coupons and sale events, storefront CMS, ads, reviews, risk, disputes, reports, RBAC, audit log, settings |
| Hub Console | 12 | Hub overview, shipments with scan history, inbound and sorting, runsheets, associates, NDR, reverse and RTO, COD remittance, fulfilment centres, network and serviceability, BluBuy Rider app preview |
| Care Desk | 8 | Queue with spec SLAs, three-pane ticket workspace with macros, refunds within agent limits and Guarantee claims, customer and order lookup, knowledge base, team performance |

Quality gates passing: TypeScript strict with zero errors, ESLint clean, production build clean, no em dashes or emojis anywhere, every route returns 200.

## Repository

```
apps/web/                 Next.js 16 web app with every workspace
  src/app/                routes, one folder or route group per workspace
  src/components/         design system (ui, charts, shell) and area components
  src/lib/                domain types, state machines, formatting, mock data
  public/images/          product and banner photography (Unsplash, see CREDITS.md)
docs/
  research/01-marketplace-workflows.md   how Amazon.in and Flipkart work, and the BluBuy spec
  research/02-ui-design-system.md        UI research and the design system rationale
  architecture/system-architecture.md    backend, API and Flutter plan, roadmap
  architecture/frontend-conventions.md   rules for building screens in apps/web
  architecture/design-tokens.md          implemented tokens and the Flutter theme mapping
```

## Principles

- One design system for every surface: Inter and Plus Jakarta Sans, a cobalt brand blue, marigold only for genuine deals and Buy now, hairline borders, generous whitespace.
- No em dashes and no emojis anywhere in the product. Icons come from lucide.
- Indian commerce conventions throughout: rupee formatting with lakh and crore grouping, UPI and cash on delivery, GST, TCS and TDS on seller payouts, pincode based delivery promises.
- Every status in every workspace comes from one set of state machines (`apps/web/src/lib/status.ts`), mapped to the canonical backend enums in the spec.
- The mock data layer (`apps/web/src/lib/mock`) mirrors the planned API so the backend can be swapped in screen by screen.

## Next steps

See `docs/architecture/system-architecture.md` for the phased roadmap: core backend (identity, catalog, checkout, payments, orders), fulfilment and money flows, then the Flutter customer app.
