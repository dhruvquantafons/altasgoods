# BluBuy API

The marketplace backend: a NestJS 12 modular monolith on PostgreSQL 16 (Drizzle ORM) and Redis. It serves the web app today and the Flutter apps next, through one OpenAPI contract.

## Run it

Prerequisites: Node 22.12 or newer (Node 24 LTS recommended for production), PostgreSQL 16 with the `pg_trgm` extension available, Redis.

```bash
cd apps/api
npm install
cp .env.example .env          # then set JWT_SECRET and PAYMENTS_WEBHOOK_SECRET
createdb blubuy_dev && createdb blubuy_test
npm run db:migrate             # apply SQL migrations
npm run db:seed                # demo catalog, sellers, shoppers and 30 orders
npm run dev                    # http://localhost:4000, docs at /docs
```

`npm run db:reset` drops and recreates the dev schema, then seeds. Seeding refuses to run in production.

### Demo accounts

| Who | Mobile | Notes |
|---|---|---|
| Ananya Sharma (shopper) | 98450 12345 | BluBuy Plus member, 3 saved addresses, orders in every state |
| Rohan Mehta (seller) | 98200 11223 | Owner of Apex Retail (Platinum) in Seller Hub |
| Kavya Iyer (staff) | 98110 12345 | Super Admin in BluBuy Control; reviews seller applications |
| Lakshmi Nair (applicant) | 97000 11004 | Seller application with a change requested (SA-50004) |

The seed also creates seller applications in every review state (SA-50001 to SA-50006). Outside production, `POST /v1/auth/otp` and `POST /v1/me/email/otp` return the one-time code as `devCode` and the API logs it, so no SMS or email provider is needed.

### KYC sandbox test values

The sandbox KYC provider (`src/modules/sellers/kyc/sandbox.provider.ts`) stands in for the GST portal, the PAN service and penny drop, the way test card numbers work for payments:

| Check | Value | Result |
|---|---|---|
| GSTIN | any with a valid check character | Active, with a stable business name derived from its PAN |
| GSTIN | 27AAKFS4410M1ZX | Sahyadri Home Essentials LLP, Maharashtra |
| GSTIN | 29AAGCK7781Q1ZF | Cancelled registration |
| PAN (GST exempt sellers) | digits 0000 / 9999 | Not found / a different holder |
| Bank account | ending 0000 / 1111 / 2222 | Penny drop fails / another person's name / partial name match (bank proof requested) |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API with live reload (SWC, so OpenAPI includes request schemas) |
| `npm test` | Unit and integration tests against `blubuy_test` (resets it each run) |
| `npm run typecheck` | Strict TypeScript |
| `npm run build` / `npm start` | Production build to `dist/` and run |
| `npm run db:generate` | New SQL migration from schema changes in `src/db/schema.ts` |
| `npm run openapi` | Writes the contract to `packages/openapi/openapi.json`; then run `npm run api:types` in `apps/web` |

## Design

- **Modules:** `auth` (OTP, email verification, sessions, guard, staff roles), `catalog` (categories, products, search, sellers), `commerce` (addresses, cart, quote, orders, payments, seller orders), `sellers` (onboarding, KYC, application review), `health`.
- **Seller onboarding:** one application per user (`SA-50001`), following spec section 11.8: `KYC_IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `APPROVED`, `REJECTED`. Every move goes through `ApplicationStore.move` under a row lock and is recorded in `seller_application_events`. Submission runs the automatic checks and duplicate screening (PAN, GSTIN and bank account across sellers and applications, PAN type against business type, pickup state against GST state); approval is blocked by failed checks, missing or rejected documents and high severity flags, and creates the seller and the owner membership. A refreshed token then carries the new seller. Rejected applications can be reopened after 30 days.
- **KYC provider and files:** `KycProvider` is the boundary for GSTN, PAN and penny drop services; `FileStore` keeps document bytes in Postgres today (object storage later). Uploads are typed by their bytes, not their name, and limited to 4 MB (signatures 1 MB). Paid checks are rate limited per application per day.
- **Staff:** `users.staff_roles` holds BluBuy Control roles from spec section 8.1; they travel in the access token and `@StaffOnly(...)` checks them. Verifiers decide, risk analysts and auditors can read; `SUPER_ADMIN` passes every staff check. Reviewer notes stay internal.
- **Money:** integer paise in the database and the API.
- **Statuses:** the canonical names from `docs/research/01-marketplace-workflows.md` section 11. One deliberate addition: order items start as `PENDING` while a prepaid order awaits payment, become `NEW` on capture, and are never shown to sellers before that.
- **State machine:** every item status change goes through `OrderWorkflow.transition`, which validates the move against `commerce/state.ts` (including which actor may make it), applies side effects (stock, fees, refunds, AWB, cash on delivery collection), writes `order_events`, and re-derives the order header status.
- **Orders:** placement locks the offer rows, re-prices, reserves stock atomically and is idempotent per `Idempotency-Key`. Unpaid orders expire after 30 minutes (stock and coupon released). A payment that arrives after expiry is refunded automatically.
- **Payments:** `PaymentProvider` is the gateway boundary. The sandbox provider sends HMAC-signed webhooks through the same code path a real aggregator will use; webhook events are stored by id, so redelivery is a no-op.
- **Fees:** each confirmed line stores its settlement breakdown (commission, fixed fee, shipping, GST on fees, TCS, TDS) from the example rate card in `commerce/pricing.ts`. A unit test pins the spec's worked example (₹1,499 settles to ₹1,211.84).
- **Auth:** 15 minute access JWTs and 30 day rotating refresh tokens stored hashed. Reusing a rotated refresh token revokes every session of that user. Every route needs a token unless marked `@Public()`; seller routes are scoped to the caller's seller membership.
- **Errors:** RFC 7807 `application/problem+json` with a stable `code` and field level `errors` on validation failures (422).
- **Injection:** every dependency is injected explicitly with `@Inject(...)`, so the app runs the same under SWC, tsx, Vitest and tsc.

## Not yet built (next phases)

Catalog management for sellers (so new sellers can list), category and brand approval queues, returns, settlements and payouts, logistics integration (the `/v1/dev/logistics/advance` endpoint simulates courier scans until then), real payment, KYC, SMS and email providers, object storage for documents, the 30 day auto close of unanswered change requests, search on OpenSearch, and the rest of the admin, support and logistics APIs.
