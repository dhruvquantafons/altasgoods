# AltasGoods

AltasGoods is an online store for India: one business selling its own catalog, with a storefront for shoppers and separate workspaces for the store's staff, support agents and logistics team. Payments run on Razorpay and shipping on Shiprocket, each behind a switch so development can use a local sandbox instead.

| Workspace | Start here | For |
|---|---|---|
| Storefront | `/` | Shoppers: home, search, category, product page, cart, checkout |
| My Account | `/account` | Shoppers: orders and tracking, returns, support |
| AltasGoods Control | `/admin` | Store staff: orders, returns, products, categories, brands |
| Care Desk | `/support` | Support agents: tickets with full order context, refunds |
| Hub Console | `/logistics` | Logistics team (design preview, see below) |

Open `http://localhost:3000/portals` to reach every workspace.

## Run it

You need Node 22.12 or newer, PostgreSQL 16 (with `pg_trgm`) and Redis.

```bash
# 1. API (details in apps/api/README.md)
cd apps/api && npm install && cp .env.example .env    # then set JWT_SECRET and PAYMENTS_WEBHOOK_SECRET
createdb altasgoods_dev && createdb altasgoods_test    # or point DATABASE_URL and TEST_DATABASE_URL at your own
npm run db:migrate && npm run db:seed
npm run dev                      # http://localhost:4000, API docs at /docs

# 2. Web, in a second terminal
cd apps/web && npm install
echo "ALTASGOODS_API_URL=http://localhost:4000" > .env.local
npm run dev                      # http://localhost:3000
```

Out of the box payments use the local sandbox and shipping uses the simulated courier, so nothing real is charged or booked. See [Payments](#payments-razorpay) and [Shipping](#shipping-shiprocket) to switch them on.

### Demo accounts

Sign in with a mobile number and a one-time code. Outside production the code is shown on the sign in page and printed in the API terminal, so no SMS is needed.

| Who | Mobile | Try |
|---|---|---|
| Shopper (Ananya Sharma) | 98450 12345 | Shop, check out, track and cancel orders, return items, chat with AltasGoods Care |
| Store staff (Kavya Iyer, Super Admin) | 98110 12345 | Process orders and returns, manage products, categories and brands in `/admin` |
| Care agent (Revathi Subramanian, L2) | 98110 20001 | Work tickets at `/support`; refunds up to ₹10,000 |
| Care supervisor (Arvind Menon) | 98110 20099 | Approves refunds above an agent's limit |
| Anyone new | any other number | Signs up as a new shopper |

## What is real and what is sample data

The buying journey and store operations run on the API and database. Some screens still render built-in sample data: they look finished, but nothing done there is saved. Present those as design previews.

| Area | Real (API and database) | Sample data |
|---|---|---|
| Storefront | Catalog, category and product listings, search, cart, checkout, payment, order confirmation | Product reviews and Q&A, the homepage sale banner, the Deals page |
| My Account | Orders, order detail and tracking, cancellation, returns, support conversations | Addresses page (addresses saved at checkout are real but do not appear here yet), wishlist, wallet, saved payments, profile, notifications, my reviews |
| AltasGoods Control | Orders, returns and refunds, products, categories, brands, the order queue counts on Overview | Overview charts and KPIs, customers, payments, coupons and sales page, storefront CMS, reviews, reports, team and roles, audit log, settings |
| Care Desk | Ticket inbox and ticket workspace, replies, notes, refunds | Knowledge base, performance, order lookup, parts of customer pages |
| Hub Console | | All of it |
| Sign in | OTP sign in, sessions, new shopper sign up | |

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
- Returns (reverse pickups) are still simulated.

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
| `apps/api` | `npm test` | 85 unit and integration tests against `altasgoods_test`: orders, payments (sandbox and Razorpay), shipping (Shiprocket provider and a fake courier end to end), returns, support, auth, catalog admin |
| `apps/web` | `npm test` | Unit tests for the API adapters, pricing and formatting |
| `apps/web` | `npm run test:e2e` | Playwright journeys (checkout, cancellation, returns, Care Desk, access control) plus crawlers that open every page and press every button. Run with the sandbox and simulated courier |

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
