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
npm run db:seed                # demo catalog (no accounts)
npm run admin:create -- --email you@example.com --name "Your Name"   # your staff account
npm run dev                    # http://localhost:4000, docs at /docs
```

`npm run db:reset` drops and recreates the dev schema, then seeds. Seeding refuses to run in production, and always uses the payment sandbox and the simulated courier whatever `.env` says.

Razorpay and Shiprocket are switched on in `.env` (`PAYMENTS_PROVIDER`, `LOGISTICS_PROVIDER`); every setting is listed in `.env.example` and explained in the root README.

### Accounts

There are no demo accounts. Shoppers sign up at `/signup` with their name, email and a password. Staff accounts are only made from the command line:

```bash
npm run admin:create -- --email you@example.com --name "Your Name"                       # Super Admin
npm run admin:create -- --email agent@example.com --name "Agent" --role SUPPORT_AGENT    # Care Desk L1
```

It asks for the password without echoing it (or reads `ADMIN_PASSWORD` where there is no terminal). Run against an existing email, it adds the role and keeps the password unless you type a new one. Roles: `SUPER_ADMIN`, `OPS_ADMIN`, `CATALOG_MANAGER`, `AUDITOR`, `SUPPORT_AGENT` (L1, refunds up to ₹2,000), `SUPPORT_SPECIALIST` (L2, ₹10,000), `SUPPORT_SUPERVISOR`. In production run the built copy: `node dist/db/create-admin.js --email ...`.

Forgotten passwords are reset with a 6 digit code sent by email. Outside production, `POST /v1/auth/password/forgot` and `POST /v1/me/email/otp` also return the code as `devCode` and the console provider logs the email, so no mail server is needed. Production refuses to start unless `EMAIL_PROVIDER=smtp`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API with live reload (SWC, so OpenAPI includes request schemas) |
| `npm test` | Unit and integration tests against `TEST_DATABASE_URL` (resets it each run) |
| `npm run typecheck` | Strict TypeScript |
| `npm run build` / `npm start` | Production build to `dist/` and run |
| `npm run db:generate` | New SQL migration from schema changes in `src/db/schema.ts` |
| `npm run admin:create` | Creates a staff account, or gives an existing account a staff role |
| `npm run openapi` | Writes the contract to `packages/openapi/openapi.json`; then run `npm run api:types` in `apps/web` |

Tests load `.env` for `TEST_DATABASE_URL` and `REDIS_URL` (anything already in the environment wins), and always use the payment sandbox, the simulated courier and the console email provider. Their demo accounts (`src/db/seed-demo.ts`) exist only in the test database.

## Design

- **Modules:** `auth` (email and password sign in, password reset by emailed code, email verification, sessions, guard, staff roles), `catalog` (categories, brands, products, search, admin catalog management, CSV product import), `commerce` (addresses, cart, quote, orders, fulfilment, payments, shipping, returns), `support` (Care Desk tickets and customer conversations), `files` (the shared file store), `health`.
- **One store:** AltasGoods sells its own catalog. Products belong to the house seller, and store staff fulfil every order line from the admin panel (accept, pack, ready to ship).
- **Staff:** `users.staff_roles` holds AltasGoods Control roles (`SUPER_ADMIN`, `OPS_ADMIN`, `CATALOG_MANAGER`, `AUDITOR`, and the Care Desk roles). They travel in the access token and `@StaffOnly(...)` checks them; `SUPER_ADMIN` passes every staff check. There is no API for inviting staff yet: `npm run admin:create` makes staff accounts.
- **Files:** `FileStore` keeps uploads (product images, return photos, ticket attachments) in Postgres today (object storage later). Uploads are typed by their bytes, not their name, and limited to 4 MB.
- **Returns:** spec section 11.3. A request inside the return window is approved and its reverse pickup booked straight away; a late request for damage, a defect or a wrong item waits for the store (`PENDING_REVIEW`, 48 hours to approve or reject with a reason), while a late change of mind is refused. Low value returns (up to ₹5,000, not mobiles) are refunded at the doorstep; the rest wait for the store's quality check, where a pass completes the refund or replacement. Photos are uploaded first (`/v1/me/uploads`) and attached to the request. Reverse pickups are not booked with a courier yet: staff book them by hand and record each step with `POST /v1/admin/returns/{id}/pickup` (a later step records the ones in between, and an AWB can be added); in development `/v1/dev/returns/{id}/advance` simulates the scans, and only there is a placeholder AWB issued. A failed check is settled with `POST /v1/admin/returns/{id}/settle`: accept anyway (refund or replacement goes out) or reject and send the item back.
- **Support:** spec section 11.11 ticket states (`NEW`, `OPEN`, `PENDING_CUSTOMER`, `PENDING_INTERNAL`, `ESCALATED`, `RESOLVED`, `REOPENED`, `CLOSED`) with priority based reply SLAs. Agents reply (visible to the customer), add internal notes (never visible), attach files, assign in bulk and run actions: refunds go back to the original payment through `PaymentsService.refundToSource` within the agent's limit (L1 ₹2,000, L2 ₹10,000); anything above waits for a supervisor, and the maker cannot approve their own request. Every change is written to `support_events`. Customers open conversations and reply from My Account.
- **Money:** integer paise in the database and the API.
- **Statuses:** the canonical names from `docs/research/01-marketplace-workflows.md` section 11. One deliberate addition: order items start as `PENDING` while a prepaid order awaits payment, become `NEW` on capture, and are never shown to store staff before that.
- **State machine:** every item status change goes through `OrderWorkflow.transition`, which validates the move against `commerce/state.ts` (including which actor may make it), applies side effects (stock, refunds, courier cancellation, cash on delivery collection), writes `order_events`, and re-derives the order header status.
- **Orders:** placement locks the offer rows, re-prices, reserves stock atomically and is idempotent per `Idempotency-Key`. Unpaid orders expire after 30 minutes (stock and coupon released); before expiring, the gateway is asked whether the customer paid after all.
- **Payments:** `PaymentProvider` is the gateway boundary, chosen by `PAYMENTS_PROVIDER`. The sandbox provider sends HMAC-signed webhooks through the same code path a real aggregator uses; webhook events are stored by id, so redelivery is a no-op. With `razorpay`, each attempt is a Razorpay order; the customer pays in Razorpay Checkout on `/checkout/pay/{id}`, the browser's result is verified (`POST /v1/payments/{id}/confirm`: signature, then the payment is re-read from Razorpay and captured if only authorised), and the webhook at `POST /v1/payments/webhooks/razorpay` (`payment.captured`, `order.paid`, `payment.failed`) covers customers who close the tab. Both paths share one event id per Razorpay payment. A capture on an expired order, or a second capture on an order an earlier attempt already paid, is refunded automatically.
- **Shipping:** `LogisticsProvider` is the courier boundary, chosen by `LOGISTICS_PROVIDER`. One order line ships as one parcel. With `shiprocket`, marking a packed line ready to ship books it first (`ShippingService.book`: Shiprocket order, AWB and courier, pickup request, label), saving each step so a retry resumes rather than booking twice; a booking that fails leaves the line packed with the reason. Cancelling a booked line cancels the Shiprocket order. Tracking is polled every 10 minutes (`ShipmentTracker`), on demand from the admin order page, and optionally by webhook at `POST /v1/logistics/webhooks/tracking` (header `x-api-key`); a scan that skips steps walks the line through each one. The development courier simulator refuses lines Shiprocket carries. Reverse pickups for returns are recorded by staff (see Returns).
- **Auth:** 15 minute access JWTs and 30 day rotating refresh tokens stored hashed. Reusing a rotated refresh token revokes every session of that user. Every route needs a token unless marked `@Public()`; staff routes check `@StaffOnly(...)`.
- **Errors:** RFC 7807 `application/problem+json` with a stable `code` and field level `errors` on validation failures (422).
- **Injection:** every dependency is injected explicitly with `@Inject(...)`, so the app runs the same under SWC, tsx, Vitest and tsc.

## Not yet built (next phases)

Staff invites, change password from My Account and the rest of the admin APIs (customers, coupons, reviews, reports), Shiprocket return pickups and pincode serviceability, refund status updates from Razorpay, object storage for files, search on OpenSearch, and the logistics console APIs. `/v1/dev/logistics/advance` and `/v1/dev/returns/{id}/advance` simulate courier scans in development (`deliveredDaysAgo` dates a delivery back to test return windows).
