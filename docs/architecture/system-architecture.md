# BluBuy System Architecture (proposal v1)

Status: proposal for review. The web dashboards are built (phase 1, mock data). This document describes how the backend and the Flutter apps plug in without rewriting the screens.

## 1. Surfaces and who uses them

| Surface | Users | Today | Next |
|---|---|---|---|
| Storefront (web) | Shoppers | `apps/web` routes `/`, `/s`, `/c`, `/p`, `/cart`, `/checkout` | Same, backed by the API |
| My Account (web) | Shoppers | `/account/*` | Same |
| Customer app | Shoppers | Not started | Flutter (`apps/mobile`), same API |
| Seller Hub (web) | Sellers and sub-users | `/seller/*`, `/seller/register` | Same; seller app in Flutter later |
| BluBuy Control (web) | BluBuy staff (RBAC) | `/admin/*` | Same |
| Hub Console (web) | Hub managers, operators, cashiers | `/logistics/*` | Same, plus handheld scanning views |
| BluBuy Rider app | Delivery associates | Preview at `/logistics/associate-app` | Flutter (`apps/rider`) |
| FC Console | Warehouse staff | `/logistics/fulfilment` overview | Web plus handheld (Flutter) |
| Care Desk (web) | Support agents | `/support/*` | Same |

## 2. Target architecture

```
                 Flutter apps (customer, rider, seller)      Next.js web (all workspaces)
                                 \                               /
                                  \        HTTPS, JSON          /
                                   +-------- API gateway -------+
                                   |  auth (OTP, JWT, RBAC)     |
                                   |  rate limits, idempotency  |
                                   +-------------+--------------+
                                                 |
                       Modular monolith (TypeScript, NestJS), one deployable, clear module boundaries
   +-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
   | Identity  | Catalog   | Offers &  | Cart &    | Orders    | Payments  | Logistics | Finance   |
   | & access  | & search  | pricing   | checkout  | & returns | & refunds | & FC      | & payouts |
   +-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
   | Sellers & | Promotions| Ads       | Reviews & | Support   | Risk &    | Notifica- | Reporting |
   | KYC       | & coupons |           | Q&A       | tickets   | fraud     | tions     | & exports |
   +-----------+-----------+-----------+-----------+-----------+-----------+-----------+-----------+
          |              |               |                 |                    |
     PostgreSQL     OpenSearch       Redis (cache,     Job queue (BullMQ,   Object storage
     (primary)      (search,         sessions,         later Kafka for      (images, invoices,
                    facets)          rate limits)      domain events)       KYC docs; India region)
```

Why a modular monolith first: one team, one deploy, transactions across orders, payments and inventory are simple, and module boundaries (one folder and one schema per module, communication through module services and domain events) let us split services later where load demands it (search, notifications, logistics tracking are the usual first candidates).

### Recommended stack

| Concern | Choice | Notes |
|---|---|---|
| Web | Next.js 16, React 19, Tailwind v4 | Already built in `apps/web` |
| Mobile | Flutter 3, Riverpod, go_router, dio, freezed | Flutter is installed on the dev machine |
| API | NestJS (TypeScript), REST with OpenAPI 3.1 | Generate the Dart and TypeScript clients from the OpenAPI file |
| Database | PostgreSQL 16 | Money as integer paise, percentages as basis points, `*_status_history` tables (spec section 12) |
| ORM | Drizzle or Prisma | Pick one; migrations in repo |
| Search | OpenSearch | Product search, facets, typo tolerance, Hindi analyser later |
| Cache and sessions | Redis | Cart, OTP throttling, rate limits, featured offer cache |
| Jobs and events | BullMQ on Redis, then Kafka | Settlement runs, notifications, SLA timers, NDR follow ups |
| Files | S3 compatible storage in an India region | KYC documents encrypted, signed URLs only |
| Payments | An RBI licensed payment aggregator with escrow and payouts | Spec decision D5; UPI, cards, net banking, EMI, COD reconciliation |
| OTP and messaging | SMS, WhatsApp Business and email providers with DLT registered templates | TRAI DLT rules apply to SMS |
| Invoicing | GST compliant invoices; e-invoicing (IRN) through a GSP in phase 2 | Spec decision D8 |
| Observability | OpenTelemetry, structured logs, error tracking | Trace ids on every order event |

## 3. How the web app connects to the API

The web app reads everything from `apps/web/src/lib/mock`. Each export maps to an endpoint, so the swap is mechanical:

| Mock export | Endpoint (planned) |
|---|---|
| `products`, `getProduct`, `searchProducts` | `GET /v1/products`, `GET /v1/products/{slug}`, `GET /v1/search?q=` |
| `categories`, `brands` | `GET /v1/categories`, `GET /v1/brands` |
| `orders`, `getOrder`, `myOrders` | `GET /v1/orders`, `GET /v1/orders/{id}`, `GET /v1/me/orders` |
| `sellerOrderLines(sellerId)` | `GET /v1/seller/order-items?status=` |
| `returns`, `refunds` | `GET /v1/returns`, `GET /v1/refunds` |
| `settlementsForSeller`, `allSettlements` | `GET /v1/seller/settlements`, `GET /v1/admin/payouts` |
| `feesForLine`, rate card constants | `POST /v1/fees/estimate`, `GET /v1/rate-cards/current` |
| `shipments`, `hubs`, `associates` | `GET /v1/logistics/shipments`, `/hubs`, `/associates` |
| `tickets` | `GET /v1/support/tickets` |
| `platformDaily`, `sellerDaily` | `GET /v1/analytics/platform/daily`, `GET /v1/seller/analytics/daily` |

Plan: introduce `src/lib/api/` with typed fetchers generated from OpenAPI, keep the function names identical to the mock exports, and switch imports page by page. Server Components call the API directly with the user's session; client components only call it for mutations (Server Actions or route handlers).

## 4. Core flows (backend responsibilities)

1. Checkout: price the cart (offers, coupons, BluCoins, Credits), reserve inventory for 30 minutes, create the order in `PAYMENT_PENDING`, hand off to the payment aggregator, confirm on webhook (idempotent), run risk checks, move to `CONFIRMED` or `ON_HOLD`, split into order items per seller.
2. Seller fulfilment: items arrive as `NEW`, sellers accept and pack within the dispatch SLA, the label and invoice are generated, manifests are closed, pickups are scheduled.
3. Logistics: shipment state machine (spec 11.6) driven by scans; NDR cases with up to 3 attempts; RTO after the last failed attempt; COD cash declared, accepted and banked.
4. Returns: eligibility by category window, pickup with doorstep QC, refund to source or instant BluBuy Credits, seller QC and SafeClaim.
5. Finance: per item settlement lines (spec 14.1), holds by tier, payout runs Monday, Wednesday and Friday, TCS and TDS ledgers, monthly fee invoices.
6. Support: tickets linked to orders, agent refund limits, BluBuy Guarantee claims, SLA timers.

All status changes are written through the state machines in spec section 11 (the web uses the UI mapping in `frontend-conventions.md`).

## 5. Security and compliance

- Consumer Protection (E-Commerce) Rules 2020: seller details and country of origin on product pages, grievance officer published, no manipulated prices or dark patterns, refunds within prescribed timelines.
- DPDP Act 2023: consent records, purpose limitation, data export and deletion requests (`/account/profile`), breach process.
- GST: TCS under section 52, monthly GSTR-8 data; Income Tax section 194-O TDS.
- RBI: card data never stored (tokenisation through the aggregator), escrow handled by the aggregator.
- RBAC for staff (spec section 8), audit log for every admin action, PII masked by default with a reveal permission.

## 6. Repository layout (target)

```
BluBuy/
  apps/
    web/        Next.js, every web workspace (built)
    api/        NestJS modular monolith (next)
    mobile/     Flutter customer app (next)
    rider/      Flutter delivery associate app (later)
  packages/
    openapi/    the API contract, source of generated clients
    tokens/     design tokens exported to CSS and to Dart (ThemeExtension)
  docs/
    research/       marketplace workflows spec, UI design research
    architecture/   this file, conventions, design tokens, roadmap
```

## 7. Phased roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 1. Dashboards (done) | Every web surface designed and built against mock data | All routes render; design system and state machines agreed |
| 2. Core backend | Identity and OTP, catalog and search, offers, cart and checkout, payments, orders, seller onboarding and KYC | A real order placed and paid end to end on staging |
| 3. Fulfilment and money | Seller order processing, labels and invoices, logistics integration (courier partners first, spec D6), returns, settlements and payouts, fee invoices | Seller paid for a delivered order; a return refunded |
| 4. Flutter customer app | Browse, search, product, cart, checkout, orders, returns, account | Store listing ready on Play Store and App Store |
| 5. Operations depth | Hub Console and Rider app on live data, Care Desk on live tickets, risk rules, ads, promotions engine | Pilot city running on BluBuy Logistics |
| 6. Scale | Search relevance, recommendations, Hindi, seller app, BluBuy Local and Business | Per spec phase 2 items |
