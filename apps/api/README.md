# AltasGoods API

The store's backend: a NestJS 12 modular monolith on PostgreSQL 16 (Drizzle ORM) and Redis. It serves the web app today and the Flutter apps next, through one OpenAPI contract.

## Run it

Prerequisites: Node 22.12 or newer (Node 24 LTS recommended for production), PostgreSQL 16 with the `pg_trgm` extension available, Redis.

```bash
cd apps/api
npm install
cp .env.example .env          # then set JWT_SECRET and PAYMENTS_WEBHOOK_SECRET
createdb altasgoods_dev && createdb altasgoods_test
npm run db:migrate             # apply SQL migrations
npm run db:seed                # demo catalog, shoppers, staff, orders, returns and Care tickets
npm run dev                    # http://localhost:4000, docs at /docs
```

`npm run db:reset` drops and recreates the dev schema, then seeds. Seeding refuses to run in production, and always uses the payment sandbox and the simulated courier whatever `.env` says.

Razorpay and Shiprocket are switched on in `.env` (`PAYMENTS_PROVIDER`, `LOGISTICS_PROVIDER`); every setting is listed in `.env.example` and explained in the root README.

### Demo accounts

| Who | Mobile | Notes |
|---|---|---|
| Ananya Sharma (shopper) | 98450 12345 | Saved addresses, orders in every state |
| Kavya Iyer (staff) | 98110 12345 | Super Admin in AltasGoods Control |
| Revathi Subramanian (Care Desk, L2) | 98110 20001 | Support specialist; refunds up to ₹10,000 |
| Kabir Anand (Care Desk, L1) | 98110 20002 | Support agent; refunds up to ₹2,000 |
| Arvind Menon (Care Desk supervisor) | 98110 20099 | Approves refunds and actions above an agent's limit |

Care agents run from 98110 20001 to 98110 20009. The seed also creates 48 Care tickets (TK-) and returns in several stages (RT-70001 onwards). Any other number signs up as a new shopper. Outside production, `POST /v1/auth/otp` and `POST /v1/me/email/otp` return the one-time code as `devCode` and the API logs it, so no SMS or email provider is needed; in production nothing sends it yet.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API with live reload (SWC, so OpenAPI includes request schemas) |
| `npm test` | Unit and integration tests against `TEST_DATABASE_URL` (resets it each run) |
| `npm run typecheck` | Strict TypeScript |
| `npm run build` / `npm start` | Production build to `dist/` and run |
| `npm run db:generate` | New SQL migration from schema changes in `src/db/schema.ts` |
| `npm run openapi` | Writes the contract to `packages/openapi/openapi.json`; then run `npm run api:types` in `apps/web` |

Tests read `TEST_DATABASE_URL` and `REDIS_URL` from the environment, not from `.env`. If your Postgres needs a password, export them first, for example `export $(grep -E '^(TEST_DATABASE_URL|REDIS_URL)=' .env | xargs) && npm test`.

## Design

- **Modules:** `auth` (OTP, email verification, sessions, guard, staff roles), `catalog` (categories, brands, products, search, admin catalog management), `commerce` (addresses, cart, quote, orders, fulfilment, payments, shipping, returns), `support` (Care Desk tickets and customer conversations), `files` (the shared file store), `health`.
- **One store:** AltasGoods sells its own catalog. Products belong to the house seller, and store staff fulfil every order line from the admin panel (accept, pack, ready to ship).
- **Staff:** `users.staff_roles` holds AltasGoods Control roles (`SUPER_ADMIN`, `OPS_ADMIN`, `CATALOG_MANAGER`, `AUDITOR`, and the Care Desk roles). They travel in the access token and `@StaffOnly(...)` checks them; `SUPER_ADMIN` passes every staff check. There is no API for inviting staff yet: roles are set in the database or the seed.
- **Files:** `FileStore` keeps uploads (product images, return photos, ticket attachments) in Postgres today (object storage later). Uploads are typed by their bytes, not their name, and limited to 4 MB.
- **Returns:** spec section 11.3. A request inside the return window is approved and its reverse pickup booked straight away; a late request for damage, a defect or a wrong item waits for the store (`PENDING_REVIEW`, 48 hours to approve or reject with a reason), while a late change of mind is refused. Low value returns (up to ₹5,000, not mobiles) are refunded at the doorstep; the rest wait for the store's quality check, where a pass completes the refund or replacement. Photos are uploaded first (`/v1/me/uploads`) and attached to the request. Reverse pickups are simulated (`/v1/dev/returns/{id}/advance`).
- **Support:** spec section 11.11 ticket states (`NEW`, `OPEN`, `PENDING_CUSTOMER`, `PENDING_INTERNAL`, `ESCALATED`, `RESOLVED`, `REOPENED`, `CLOSED`) with priority based reply SLAs. Agents reply (visible to the customer), add internal notes (never visible), attach files, assign in bulk and run actions: refunds go back to the original payment through `PaymentsService.refundToSource` within the agent's limit (L1 ₹2,000, L2 ₹10,000); anything above waits for a supervisor, and the maker cannot approve their own request. Every change is written to `support_events`. Customers open conversations and reply from My Account.
- **Money:** integer paise in the database and the API.
- **Statuses:** the canonical names from `docs/research/01-marketplace-workflows.md` section 11. One deliberate addition: order items start as `PENDING` while a prepaid order awaits payment, become `NEW` on capture, and are never shown to store staff before that.
- **State machine:** every item status change goes through `OrderWorkflow.transition`, which validates the move against `commerce/state.ts` (including which actor may make it), applies side effects (stock, refunds, courier cancellation, cash on delivery collection), writes `order_events`, and re-derives the order header status.
- **Orders:** placement locks the offer rows, re-prices, reserves stock atomically and is idempotent per `Idempotency-Key`. Unpaid orders expire after 30 minutes (stock and coupon released); before expiring, the gateway is asked whether the customer paid after all.
- **Payments:** `PaymentProvider` is the gateway boundary, chosen by `PAYMENTS_PROVIDER`. The sandbox provider sends HMAC-signed webhooks through the same code path a real aggregator uses; webhook events are stored by id, so redelivery is a no-op. With `razorpay`, each attempt is a Razorpay order; the customer pays in Razorpay Checkout on `/checkout/pay/{id}`, the browser's result is verified (`POST /v1/payments/{id}/confirm`: signature, then the payment is re-read from Razorpay and captured if only authorised), and the webhook at `POST /v1/payments/webhooks/razorpay` (`payment.captured`, `order.paid`, `payment.failed`) covers customers who close the tab. Both paths share one event id per Razorpay payment. A capture on an expired order, or a second capture on an order an earlier attempt already paid, is refunded automatically.
- **Shipping:** `LogisticsProvider` is the courier boundary, chosen by `LOGISTICS_PROVIDER`. One order line ships as one parcel. With `shiprocket`, marking a packed line ready to ship books it first (`ShippingService.book`: Shiprocket order, AWB and courier, pickup request, label), saving each step so a retry resumes rather than booking twice; a booking that fails leaves the line packed with the reason. Cancelling a booked line cancels the Shiprocket order. Tracking is polled every 10 minutes (`ShipmentTracker`), on demand from the admin order page, and optionally by webhook at `POST /v1/logistics/webhooks/tracking` (header `x-api-key`); a scan that skips steps walks the line through each one. The development courier simulator refuses lines Shiprocket carries. Reverse pickups for returns are still simulated.
- **Auth:** 15 minute access JWTs and 30 day rotating refresh tokens stored hashed. Reusing a rotated refresh token revokes every session of that user. Every route needs a token unless marked `@Public()`; staff routes check `@StaffOnly(...)`.
- **Errors:** RFC 7807 `application/problem+json` with a stable `code` and field level `errors` on validation failures (422).
- **Injection:** every dependency is injected explicitly with `@Inject(...)`, so the app runs the same under SWC, tsx, Vitest and tsc.

## Not yet built (next phases)

An SMS provider for sign in codes (with a DLT registered template) and an email provider, staff invites and the rest of the admin APIs (customers, coupons, reviews, reports), Shiprocket return pickups and pincode serviceability, refund status updates from Razorpay, object storage for files, search on OpenSearch, and the logistics console APIs. `/v1/dev/logistics/advance` and `/v1/dev/returns/{id}/advance` simulate courier scans in development (`deliveredDaysAgo` dates a delivery back to test return windows).
