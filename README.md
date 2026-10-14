# AltasGoods

AltasGoods is an online store for India: one business selling its own catalog, with a storefront for shoppers and separate workspaces for the store's staff and support agents. Payments run on Razorpay and shipping on Shiprocket, each behind a switch so development can use a local sandbox instead.

| Workspace | Start here | For |
|---|---|---|
| Storefront | `/` | Shoppers: home, search, category, product page, cart, checkout |
| My Account | `/account` | Shoppers: orders and tracking, returns, support |
| AltasGoods Control | `/admin` | Store staff: orders, returns, customers, payments, products, sales and coupons, homepage banners, reviews, settings, audit log |
| Care Desk | `/support` | Support agents: tickets with full order context, refunds |
| Shipping | `/logistics` | Admins: shipments, courier status, tracking and labels |

Admins can open `http://localhost:3000/portals` to reach every workspace. Shipping and `/portals` need the `SUPER_ADMIN` or `OPS_ADMIN` role.

## Run it

You need Node 22.12 or newer, PostgreSQL 16 (with `pg_trgm`) and Redis.

```bash
# 1. API (details in apps/api/README.md)
cd apps/api && npm install && cp .env.example .env    # then set JWT_SECRET and PAYMENTS_WEBHOOK_SECRET
createdb altasgoods_dev && createdb altasgoods_test    # or point DATABASE_URL and TEST_DATABASE_URL at your own
npm run db:migrate && npm run db:seed                  # catalog only, no accounts
npm run admin:create -- --email you@example.com --name "Your Name"   # your AltasGoods Control account
npm run dev                      # http://localhost:4000, API docs at /docs

# 2. Web, in a second terminal
cd apps/web && npm install
echo "ALTASGOODS_API_URL=http://localhost:4000" > .env.local
npm run dev                      # http://localhost:3000
```

Out of the box payments use the local sandbox and shipping uses the simulated courier, so nothing real is charged or booked. See [Payments](#payments-razorpay) and [Shipping](#shipping-shiprocket) to switch them on.

### Accounts

Everyone signs in with an email and a password. There are no demo accounts:

- **Shoppers** create an account at `/signup`.
- **Staff** (AltasGoods Control and Care Desk) are created with `npm run admin:create` in `apps/api`, which asks for the password. Add `--role SUPPORT_AGENT`, `SUPPORT_SPECIALIST` or `SUPPORT_SUPERVISOR` for the Care Desk; the default is `SUPER_ADMIN`. Staff sign in at `/login?as=staff` (opening `/admin` takes you there).
- **Forgot password** emails a 6 digit code. In development the email is printed in the API terminal and the code is shown on the page, so no mail server is needed. Production sends through SMTP (see `EMAIL_PROVIDER` in `apps/api/.env.example`) and refuses to start without it.

## What is real and what is sample data

The buying journey and store operations run on the API and database. Some screens still render built-in sample data: they look finished, but nothing done there is saved. Present those as design previews.

| Area | Real (API and database) | Sample data |
|---|---|---|
| Storefront | Catalog, category and product listings, search, cart, checkout, payment, order confirmation | Product reviews and Q&A, the homepage sale banner, the Deals page |
| My Account | Overview, orders, order detail and tracking, cancellation, returns, support conversations, profile (name, email, mobile, change password, sign out of other devices), addresses, reviews, and the wishlist (saved to the account like the cart, and cleared from the browser on sign out) | None. Credits, saved payment methods and notifications were removed until there is a backend for them |
| AltasGoods Control | Overview (sales, work waiting, 14 day chart, best sellers, low stock), orders, returns, customers (with block), payments and refunds, products, categories, brands, sales and coupons (prices change on the storefront and at checkout), Storefront CMS (homepage hero slides and promo tiles), reviews (moderation and replies), settings (delivery fee, COD limit, review publishing, storefront notice, company and grievance details), audit log, your account | None |
| Care Desk | Overview (queue, response and resolution times, 14 day chart, team workload, all from the tickets), ticket inbox and workspace with the live customer and order, replies, notes, refunds, customer lookup and profiles, order lookup and order pages | None. Reply macros and SLA targets are settings in `apps/web/src/lib/care-policy.ts` |
| Shipping | Overview with the connected courier and a Shiprocket setup checklist, shipment counts by stage, late and returned parcels; the shipments list with AWB search, latest scan, label, tracking link and refresh | |
| Sign in | Email and password sign up and sign in, password reset by emailed code, change password, sessions | |

Sample data lives in `apps/web/src/lib/mock` and is anchored to 1 Oct 2026, so dates on those screens (such as the sale banner) do not follow today's date.

## Payments (Razorpay)

Set in `apps/api/.env`. `PAYMENTS_PROVIDER=sandbox` (the default) uses a local stand-in page with "pay" and "fail" buttons.

```
PAYMENTS_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_...       # Razorpay Dashboard > Account & Settings > API Keys
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...        # any long random string; must match the webhook if you add one
```

- The customer pays in Razorpay Checkout on `/checkout/pay/{id}`. The API verifies the result (signature, then the payment itself with Razorpay) before confirming the order.
- No webhook is required: every minute the API asks Razorpay about open payments, so a customer who pays and closes the tab is still confirmed. To add one anyway, point it at `/v1/payments/webhooks/razorpay` with events `payment.captured`, `payment.failed` and `order.paid`.
- Keep automatic capture on (Account & Settings > Payment Capture).
- Test payments: UPI `success@razorpay` or `failure@razorpay`, or Razorpay's test cards.
- A payment that arrives after its order expired, or a second payment for an order already paid, is refunded automatically.

## Shipping (Shiprocket)

Set in `apps/api/.env`. `LOGISTICS_PROVIDER=simulated` (the default) hands out a dummy AWB, and in development the admin order page has "Simulate" buttons for courier scans.

```
LOGISTICS_PROVIDER=shiprocket
SHIPROCKET_EMAIL=...               # a Shiprocket API user (Settings > API > Create an API User), not the account login
SHIPROCKET_PASSWORD=...
SHIPROCKET_PICKUP_LOCATION=Primary # nickname of the verified pickup address in Shiprocket
SHIPPING_BOX_CM=20x15x10           # parcel size in cm; weight comes from each product
SHIPROCKET_WEBHOOK_TOKEN=          # optional
```

- When staff mark a packed line **Ready to ship**, the API books it with Shiprocket: order, AWB and courier, pickup request and label. The admin order page then shows the courier, a **Print label** link and tracking. If booking fails (for example an empty wallet) the line stays packed and the reason is shown.
- One order line ships as one parcel. For cash on delivery, the amount to collect is the line less its coupon share, plus the delivery fee on the order's first parcel.
- Cancelling a booked line cancels it in Shiprocket.
- Tracking updates every 10 minutes, on demand with **Refresh tracking**, and optionally by webhook at `/v1/logistics/webhooks/tracking` (header `x-api-key`). Shiprocket rejects webhook URLs that contain "shiprocket", "sr" or "kr", including in the domain.
- Shiprocket has no test mode: every booking is a real shipment charged to the wallet. Cancel test bookings before pickup.
- Before switching on, the Shiprocket account needs KYC, a bank account, a verified pickup address and a wallet balance, and products need their real packed weight (`weight_grams` on each offer, 800 g by default).
- Return pickups are not booked with Shiprocket yet. Staff book the reverse pickup in the Shiprocket panel and record each step on the admin return page with **Update pickup** (out for pickup, picked up, failed, in transit, received, plus the AWB). Low value returns are refunded when the pickup is marked picked up; the rest after the store's check. A failed check is settled with **Accept anyway** or **Reject and send back**.

`npm run db:seed` always uses the payment sandbox and the simulated courier, whatever `.env` says, so seeding never charges or ships anything.

## Before going live

- [ ] Razorpay account in the business's name with KYC done; live keys in `.env`
- [ ] Shiprocket account ready (KYC, bank, pickup address, wallet); `LOGISTICS_PROVIDER=shiprocket`
- [ ] Real product weights
- [ ] An SMS provider for sign in codes, with the template registered on DLT. With `NODE_ENV=production` the code is no longer shown on screen and nothing sends it yet, so nobody can sign in until this is done
- [ ] An email provider (verification codes are only logged today)
- [ ] A way to add staff accounts (the Team page is sample data; staff roles are set in the database today)
- [ ] `NODE_ENV=production`, strong `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET`, `WEB_ORIGIN` set to the real site

## Tests

| Where | Command | Covers |
|---|---|---|
| `apps/api` | `npm test` | 133 unit and integration tests against `altasgoods_test`: orders, payments (sandbox and Razorpay), shipping (Shiprocket provider and a fake courier end to end), returns, support, auth (sign up, sign in, password reset, SMTP email), catalog admin and CSV import |
| `apps/web` | `npm test` | Unit tests for the API adapters, pricing and formatting |
| `apps/web` | `npm run test:e2e` | Playwright journeys (sign up, sign in and password reset, checkout, cancellation, returns, Care Desk, access control) plus crawlers that open every page and press every button. Run with the sandbox and simulated courier; the global setup creates its own accounts with sign up and `admin:create`. Set `E2E_DATABASE_URL` to the API's (throwaway) database to also run `end-to-end.spec.ts`, which reads Postgres to confirm every admin change is stored, shown on the storefront and in the audit log |

Both apps typecheck in strict mode and lint clean (`npm run typecheck` in the API, `npx tsc --noEmit` and `npm run lint` in web).

## Repository

```
apps/api/                 NestJS 12 API on PostgreSQL (Drizzle ORM) and Redis
  src/modules/            auth, catalog, commerce (cart, checkout, orders, payments, shipping, returns), support, files, health
  src/db/                 schema, SQL migrations, demo seed
  test/                   unit and integration tests
packages/openapi/         the API contract the web app's types are generated from
apps/web/                 Next.js 16 app with every workspace
  src/app/                routes, one folder or route group per workspace
  src/components/         design system (ui, charts, shell) and area components
  src/lib/                API client and adapters, state machines, formatting, sample data
  tests/                  Vitest unit tests and Playwright end to end tests
docs/
  research/               marketplace workflows and UI design system research
  architecture/           system architecture, frontend conventions, design tokens
```

After changing an API route or schema, run `npm run openapi` in `apps/api`, then `npm run api:types` in `apps/web`.

## Principles

- One design system for every surface: Inter and Plus Jakarta Sans, a cobalt brand blue, marigold only for genuine deals and Buy now, hairline borders, generous whitespace.
- No em dashes and no emojis anywhere in the product. Icons come from lucide.
- Indian commerce conventions throughout: rupee formatting with lakh and crore grouping, UPI and cash on delivery, GST, pincode based delivery promises.
- Money is stored and sent as integer paise.
- Every order status in every workspace comes from one set of state machines (`apps/api/src/modules/commerce/state.ts` on the server, `apps/web/src/lib/status.ts` for display).
- Outside services (payments, couriers, SMS, email) sit behind one interface each, with a local stand-in for development.

## Next steps

Moving the remaining sample data screens onto the API (My Account addresses, admin customers, team and staff invites, coupons, reviews), an SMS and an email provider, Shiprocket return pickups, pincode serviceability at checkout from Shiprocket, then the Flutter customer app described in `docs/architecture/system-architecture.md`.
