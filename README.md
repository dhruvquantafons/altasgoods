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

## Handover (October 2026)

The project is moving to a new lead developer. This section says where things stand. The rest of this README is the reference.

### Where it stands

| Area | State |
|---|---|
| Storefront, checkout, My Account | Done and on the API |
| AltasGoods Control (admin) | Done and on the API, including sales and coupons, Storefront CMS, reviews, settings and the audit log |
| Care Desk | Done and on the API |
| Payments (Razorpay) | Integrated and tested with Razorpay **test** keys. Live keys need the business's KYC'd account |
| Shipping (Shiprocket) | Integrated (forward shipments, labels, tracking). Not yet switched on locally: the pickup address is not set. Return pickups are still booked by hand |
| Email (Titan SMTP) | Code done and tested. **Pending:** the mailbox password, and SPF and DKIM records on the sending domain. Until then `EMAIL_PROVIDER=console` |
| Production deployment | Not started. No hosting, CI or Docker setup exists yet |

Git history tells the same story: phase 1 (every screen on mock data), phase 2 (API, returns, Care Desk), the rebrand from BluBuy to AltasGoods, removing the seller side and the membership, then Razorpay, Shiprocket and email.

### Environment files

Two local files hold settings. Both are git ignored, so the new developer must create their own. Every setting is listed with a comment in [`apps/api/.env.example`](apps/api/.env.example).

**`apps/api/.env`** (copy from `.env.example`). The API validates it at startup (`apps/api/src/config/env.ts`) and refuses to start with a readable message if something is missing.

| Setting | Notes |
|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | Your local Postgres. Tests wipe `TEST_DATABASE_URL` on every run, so never point it at real data |
| `REDIS_URL` | Any local Redis. Database 5 is used by default |
| `JWT_SECRET` | 32 characters or more. `openssl rand -base64 48` |
| `PAYMENTS_WEBHOOK_SECRET` | Any long random string (sandbox provider only) |
| `WEB_ORIGIN` | The web app's address, for CORS and payment return links |
| `PAYMENTS_PROVIDER` | `sandbox` (no account needed) or `razorpay`, which needs `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` |
| `LOGISTICS_PROVIDER` | `simulated` (no account needed) or `shiprocket`, which needs `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` and `SHIPROCKET_PICKUP_LOCATION` |
| `EMAIL_PROVIDER` | `console` (prints emails in the API terminal) or `smtp`, which needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM`. Production refuses `console` |

**`apps/web/.env.local`** needs one line: `ALTASGOODS_API_URL=http://localhost:4000`. (An older copy may also have `BLUBUY_API_URL` from before the rebrand. It is unused and can be deleted.)

The fastest way to a working setup is the sandbox for everything: `PAYMENTS_PROVIDER=sandbox`, `LOGISTICS_PROVIDER=simulated`, `EMAIL_PROVIDER=console`. No outside account is needed.

### Accounts and credentials to hand over

These are shared privately, never in the repository:

- **Razorpay**: the test mode key ID and secret currently in use, and later the live keys from the business's own account.
- **Shiprocket**: the API user (email and password). The current one was made under the previous developer's email, so create a new API user for the new owner. Shiprocket has no test mode: every booking is real and charged to the wallet.
- **Titan Mail**: the `no-reply@` mailbox password, and access to the domain's DNS for SPF and DKIM.
- **GitHub**: repository access.

Note that `.env.example` uses `altasgoods.in` in `EMAIL_FROM` while the configured mailbox is on `altasgoods.com`. Confirm which domain is real before going live.

### Things to know first

- **Next.js 16 is new.** Its APIs differ from older versions. `apps/web/AGENTS.md` asks you (and any AI coding tool) to read the guides in `node_modules/next/dist/docs/` before changing web code. `next dev` re-adds that file if removed.
- **The API contract is generated.** After changing an API route or request schema, run `npm run openapi` in `apps/api`, then `npm run api:types` in `apps/web`, and commit both outputs.
- **Database changes** go in `apps/api/src/db/schema.ts`, then `npm run db:generate` writes a new SQL migration in `src/db/migrations`. There are 14 so far (`0000` to `0013`).
- **Seeding never touches real services.** `npm run db:seed` and the tests always use the payment sandbox, the simulated courier and console email, whatever `.env` says.
- **Staff accounts** come only from `npm run admin:create` in `apps/api`. There is no invite screen.
- `docs/architecture/` and `docs/research/` hold the original design (workflows, state machines, design tokens). Status names and return rules in the code follow `docs/research/01-marketplace-workflows.md` section 11.

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

The buying journey and store operations run on the API and database. A few pieces still come from fixed content in the web app rather than the API.

| Area | Real (API and database) | Fixed content in the web app |
|---|---|---|
| Storefront | Catalog, category and product listings, search, cart, checkout, payment, order confirmation, product reviews, the Deals page and live sales, homepage hero slides and promo tiles | The company pages (About, Press, Careers, Policies, Help FAQs), the brand spotlights on the homepage, and product page extras (warranty and legal text) |
| My Account | Overview, orders, order detail and tracking, cancellation, returns, support conversations, profile (name, email, mobile, change password, sign out of other devices), addresses, reviews, and the wishlist (saved to the account like the cart, and cleared from the browser on sign out) | None. Credits, saved payment methods and notifications were removed until there is a backend for them |
| AltasGoods Control | Overview (sales, work waiting, 14 day chart, best sellers, low stock), orders, returns, customers (with block), payments and refunds, products, categories, brands, sales and coupons (prices change on the storefront and at checkout), Storefront CMS (homepage hero slides and promo tiles), reviews (moderation and replies), settings (delivery fee, COD limit, review publishing, storefront notice, company and grievance details), audit log, your account | None |
| Care Desk | Overview (queue, response and resolution times, 14 day chart, team workload, all from the tickets), ticket inbox and workspace with the live customer and order, replies, notes, refunds, customer lookup and profiles, order lookup and order pages | None. Reply macros and SLA targets are settings in `apps/web/src/lib/care-policy.ts` |
| Shipping | Overview with the connected courier and a Shiprocket setup checklist, shipment counts by stage, late and returned parcels; the shipments list with AWB search, latest scan, label, tracking link and refresh | |
| Sign in | Email and password sign up and sign in, password reset by emailed code, change password, sessions | |

That content lives in `apps/web/src/lib/mock`, together with helpers the real pages still import (listing filters, the address form's short pincode list and state list, return reasons, return windows and pickup slots). Moving those rules to the API, and renaming the folder, is part of the remaining work.

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
- [ ] Titan SMTP mailbox password set, `EMAIL_PROVIDER=smtp`, and SPF and DKIM records on the sending domain (production will not start without SMTP, and password reset depends on it)
- [ ] Final company, policy and grievance details in AltasGoods Control > Settings and the company pages
- [ ] `NODE_ENV=production`, strong `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET`, `WEB_ORIGIN` set to the real site
- [ ] Hosting for the API, web app, Postgres and Redis, with backups; run `npm run db:migrate` on each deploy and create the first admin with `node dist/db/create-admin.js`

## Tests

| Where | Command | Covers |
|---|---|---|
| `apps/api` | `npm test` | About 120 unit and integration tests against `altasgoods_test`: orders, payments (sandbox and Razorpay), shipping (Shiprocket provider and a fake courier end to end), returns, support, auth (sign up, sign in, password reset, SMTP email), catalog admin and CSV import |
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

Roughly in order:

1. Finish email: set the SMTP password and DNS records, then test password reset and email verification end to end.
2. Switch on Shiprocket with the business's account (pickup address, wallet, real weights) and run a few real bookings, cancelling before pickup.
3. Production deployment: hosting, CI running typecheck, lint and tests, and the go live checklist above.
4. Shiprocket return pickups (today staff book them by hand) and pincode serviceability at checkout from Shiprocket.
5. Move the remaining fixed content in `apps/web/src/lib/mock` to the API or a CMS (company pages, pincode lookup, return rules).
6. A staff invite screen in AltasGoods Control instead of `npm run admin:create`.
7. Product images in object storage instead of Postgres.
8. The Flutter customer app described in `docs/architecture/system-architecture.md`.
