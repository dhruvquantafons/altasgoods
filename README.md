# BluBuy

BluBuy is a multi-vendor marketplace for India, modelled on how Amazon.in and Flipkart work end to end: shoppers, sellers, BluBuy staff, logistics teams and support agents each get their own workspace. Phase 1 built every dashboard and storefront screen against realistic mock data. Phase 2 adds the core backend (`apps/api`) and moves the buying journey, seller registration and KYC, seller order processing, returns and the Care Desk onto it. The research and specification for everything, including the Flutter apps that come next, live in `docs/`.

## Run it

Sign in, search, cart, checkout and payment, My Account orders, returns and support, seller registration, seller application review in BluBuy Control, Seller Hub orders and returns, and the Care Desk use the API, which needs PostgreSQL 16 and Redis. Other screens still render the shared sample data, which uses the same ids and prices as the seeded database.

```bash
# 1. API (see apps/api/README.md for details)
cd apps/api && npm install && cp .env.example .env
createdb blubuy_dev && createdb blubuy_test
npm run db:migrate && npm run db:seed
npm run dev                      # http://localhost:4000, docs at /docs

# 2. Web, in a second terminal
cd apps/web && npm install
echo "BLUBUY_API_URL=http://localhost:4000" > .env.local
npm run dev                      # http://localhost:3000
```

Demo accounts (outside production the one-time code is shown on the sign in page, so no SMS is needed):

| Who | Mobile | Try |
|---|---|---|
| Shopper (Ananya Sharma) | 98450 12345 | Shop, check out, track and cancel orders, return items, chat with BluBuy Care |
| Seller (Rohan Mehta, Apex Retail) | 98200 11223 | Process orders and returns in Seller Hub |
| BluBuy staff (Kavya Iyer) | 98110 12345 | Review seller applications at `/admin/sellers/approvals`; BluBuy Control needs a staff account |
| Applicant (Lakshmi Nair) | 97000 11004 | Fix the change a verifier requested and resubmit |
| Care agent (Revathi Subramanian, L2) | 98110 20001 | Work tickets at `/support`; the supervisor (98110 20099) approves refunds above an agent's limit |
| Anyone new | any other number | Register as a seller at `/seller/register` |

Open `http://localhost:3000/portals` to reach every workspace. The KYC checks run against a sandbox; its test values are listed in `apps/api/README.md`.

| Workspace | Start here | For |
|---|---|---|
| Storefront | `/` | Shoppers: home, search, category, product page, cart, checkout |
| My Account | `/account` | Shoppers: orders and tracking, returns, wallet, BluCoins, Plus |
| Seller Hub | `/seller` | Sellers: orders, listings, inventory, pricing, ads, payments, health |
| Seller registration | `/seller/register` | New sellers: KYC and onboarding |
| BluBuy Control | `/admin` | BluBuy staff: operations, catalog, sellers, finance, risk |
| Hub Console | `/logistics` | Logistics: hub, shipments, runs, NDR, COD, Rider app preview |
| Care Desk | `/support` | Support agents: tickets with full order context |

## What is built

### Phase 2: core backend

| Area | What works end to end |
|---|---|
| Identity | OTP sign in for shoppers and sellers (development code shown outside production), httpOnly session cookies, silent token refresh, refresh token rotation with reuse detection, protected areas |
| Catalog and search | Categories, brands, products, offers and the buy box from PostgreSQL; typo tolerant search ranked by the API |
| Cart and checkout | Cart kept in the browser and synced to the account across devices, saved addresses, a server priced quote (coupons, delivery fees, Plus, COD limits) |
| Orders and payments | Idempotent order placement with stock reservation, a sandbox payment gateway with signed webhooks, retry after a failed payment, a 30 minute payment window with automatic release, refunds on cancellation |
| My Account | Order list and detail from the API, live tracking states and AWB, cancel whole orders or single items; a return wizard with photo upload, refund or replacement and a pickup slot, then cancel or reschedule the pickup; returns and refunds history; conversations with BluBuy Care, tickets, Guarantee claims and call back requests |
| Seller registration and KYC | An 11 step wizard that saves every step: mobile sign in, email verification, GSTIN lookup with check digit validation, PAN name match, ₹1 penny drop with name match, documents by business type, a drawn or uploaded signature, categories, Brand Registry, agreement and submission. Automatic checks and duplicate screening run on submission; a status page tracks the review |
| BluBuy Control | Staff only sign in; the seller application queue with live SLAs, check results and risk flags; a review panel with every check, documents and history; approve (creates the seller account), request changes on specific items, reject with a reason, reopen after the cool-off |
| Seller Hub | Live order queue, dashboard counts and sidebar badge; accept, pack and ready to ship one by one or in bulk; AWB assignment; the real fee and settlement breakdown per line; a development only courier simulator for pickup, out for delivery and delivered; a getting started home for newly approved sellers. Returns: approve or reject late requests within 48 hours, see the customer's photos, record the quality check (a pass releases the refund, a fail goes to BluBuy), with a development only pickup simulator |
| Care Desk | Staff only; the ticket inbox with reply SLAs and bulk assignment; a ticket workspace where status, priority, assignee, replies, internal notes and attachments are saved and logged; refunds to the original payment within the agent's limit, with supervisor approval above it; open a ticket from the order lookup |

Tests: 58 API tests (unit and integration, including the rate card's worked example and the onboarding, support and returns lifecycles), 28 web unit tests for the API adapters, and Playwright browser tests (`npm run test:e2e` in `apps/web`) for checkout and payment, cancellation, returns from request to quality check, seller order processing, application approval, Care Desk changes, access control, plus crawlers that open every page and press every button in every workspace. See `apps/api/README.md` for the design.

### Phase 1: every workspace

98 routes (668 pages once product, order, seller, customer, shipment and ticket detail pages are generated), all rendering from the shared mock data layer:

| Area | Routes | Highlights |
|---|---|---|
| Storefront, checkout, sign in | 14 | Home with hero and live sale countdown, URL-driven search filters, product page with buy box, other sellers, offers, reviews and Q&A, persistent cart, five-step checkout (UPI, cards, EMI, Pay Later, COD), OTP login, Sell on BluBuy, BluBuy Plus |
| My Account | 15 | Order tracking with Secure Delivery OTP, cancel and return wizards, refunds, wishlist, addresses, Credits, BluCoins, Plus, privacy controls |
| Seller Hub | 23 | Order processing with bulk actions and dispatch SLAs, listings and add-product wizard, inventory and inbound, pricing rules, ads, promotions, analytics, payouts with fee, GST, TCS and TDS statements, Seller Health, 10-step registration and KYC |
| BluBuy Control | 25 | Marketplace overview, orders, returns, customers, seller KYC approvals, catalog moderation, categories, brands, payments, payouts, rate card and fee calculator, coupons and sale events, storefront CMS, ads, reviews, risk, disputes, reports, RBAC, audit log, settings |
| Hub Console | 12 | Hub overview, shipments with scan history, inbound and sorting, runsheets, associates, NDR, reverse and RTO, COD remittance, fulfilment centres, network and serviceability, BluBuy Rider app preview |
| Care Desk | 8 | Queue with spec SLAs, three-pane ticket workspace with macros, refunds within agent limits and Guarantee claims, customer and order lookup, knowledge base, team performance |

Quality gates passing: TypeScript strict with zero errors in both apps, ESLint clean, both production builds clean, API tests green, no em dashes or emojis anywhere.

## Repository

```
apps/api/                 NestJS 12 API on PostgreSQL and Redis (phase 2)
  src/modules/            auth, catalog, commerce (cart, checkout, orders, payments, returns), sellers (onboarding, KYC, review), support, files
  src/db/                 Drizzle schema, SQL migrations, demo seed
  test/                   unit and integration tests
packages/openapi/         the API contract the web and Flutter clients are generated from
apps/web/                 Next.js 16 web app with every workspace
  src/app/                routes, one folder or route group per workspace
  src/components/         design system (ui, charts, shell) and area components
  src/lib/                domain types, state machines, formatting, mock data
  public/images/          product and banner photography (Unsplash, see CREDITS.md)
  tests/unit/             Vitest tests for the API adapters, with fixtures captured from the API
  tests/e2e/              Playwright journeys and the page and button crawlers
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

See `docs/architecture/system-architecture.md` for the phased roadmap. Still open from phase 2: moving the category and product pages onto the API, and real KYC, SMS, email and payment providers in place of the sandboxes. Still on sample data: Seller Hub listings, inventory, pricing, ads, promotions, analytics and payments, SafeClaims, most of BluBuy Control apart from seller applications, and the Hub Console. Then phase 3: listings for new sellers, logistics integration, settlements and payouts, followed by the Flutter customer app.
