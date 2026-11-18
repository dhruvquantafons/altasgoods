# AltasGoods

AltasGoods is an online store for India: one business selling its own catalog, with a storefront for shoppers and separate workspaces for the store's staff and support agents. Payments run on Razorpay and shipping on Shiprocket, each behind a switch so development can use a local sandbox instead.

| Workspace | Start here | For |
|---|---|---|
| Storefront | `/` | Shoppers: home, search, category, product page, cart, checkout |
| My Account | `/account` | Shoppers: orders and tracking, returns, support |
| AltasGoods Control | `/admin` | Store staff: orders, returns, customers, payments, products, sales and coupons, homepage banners, reviews, staff, pages and content, settings, exports, audit log |
| Care Desk | `/support` | Support agents: tickets with full order context, refunds |
| Shipping | `/logistics` | Admins: shipments, courier status, tracking and labels |

Admins can open `http://localhost:3000/portals` to reach every workspace. Shipping and `/portals` need the `SUPER_ADMIN` or `OPS_ADMIN` role.

## Project status (October 2026)

### Where it stands

| Area | State |
|---|---|
| Storefront, checkout, My Account | Done and on the API. Customers can buy again, delete their account (it is anonymised, orders are kept) and get order emails. Credits refunds are gone: refunds go to the payment method or a UPI id |
| AltasGoods Control (admin) | Done and on the API. Staff screen with invites, product archive, delete and slug, editable content pages (policies, help and FAQ, about, careers, press, brand spotlights), manual and goodwill refunds, mark paid, refund retry and the Needs attention list, order address edits and internal notes, lost and returned to store parcels, CSV exports, GST rates (store default, category, product), a COD switch, delivery areas (pincode rules), a customer email switch, sales and coupons, Storefront CMS, reviews, settings and the audit log |
| Care Desk | Done and on the API |
| Pincode check | Real: the admin's delivery area rules, plus Shiprocket serviceability when `SHIPROCKET_PICKUP_PINCODE` is set |
| Payments (Razorpay) | Integrated and tested with Razorpay **test** keys. Live keys need the business's KYC'd account |
| Shipping (Shiprocket) | Integrated (forward shipments, labels, tracking). Not yet switched on locally: the pickup address is not set. Return pickups are still booked by hand |
| Email (Titan SMTP) | Code done and tested: password and staff invite emails, and customer order emails (see [Customer emails](#customer-emails)). **Pending:** the mailbox password, and SPF and DKIM records on the sending domain. Until then `EMAIL_PROVIDER=console` |
| Production deployment | Not started. No hosting, CI or Docker setup exists yet |

Git history tells the same story: phase 1 (every screen on mock data), phase 2 (API, returns, Care Desk), the rebrand from BluBuy to AltasGoods, removing the seller side and the membership, then Razorpay, Shiprocket and email, then an admin and go live hardening pass (staff, content, refunds, GST, delivery areas, customer emails).

### Environment files

Two local files hold settings. Both are git ignored, so each developer creates their own. Every setting is listed with a comment in [`apps/api/.env.example`](apps/api/.env.example).

**`apps/api/.env`** (copy from `.env.example`). The API validates it at startup (`apps/api/src/config/env.ts`) and refuses to start with a readable message if something is missing.

| Setting | Notes |
|---|---|
| `NODE_ENV` | Required, no default: `development`, `test` or `production`. A missing value stops startup. `npm start` sets `production`. `db:migrate` and `admin:create` read `.env` too, so on a server set `NODE_ENV=production` for them as well (`db:seed` is for development only and refuses to run in production) |
| `DATABASE_URL`, `TEST_DATABASE_URL` | Your local Postgres. Tests wipe `TEST_DATABASE_URL` on every run, so never point it at real data |
| `REDIS_URL` | Any local Redis. Database 5 is used by default |
| `JWT_SECRET` | 32 characters or more. `openssl rand -base64 48` |
| `PAYMENTS_WEBHOOK_SECRET` | Any long random string (sandbox provider only) |
| `WEB_ORIGIN` | The web app's address, for CORS and payment return links |
| `TRUST_PROXY` | Which peers may name the real client IP in `X-Forwarded-For`. Default `loopback` (web and API on one machine). See [Reverse proxy](#reverse-proxy-and-trust_proxy) |
| `PAYMENTS_PROVIDER` | `sandbox` (no account needed) or `razorpay`, which needs `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` |
| `LOGISTICS_PROVIDER` | `simulated` (no account needed) or `shiprocket`, which needs `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` `SHIPROCKET_PICKUP_LOCATION`. Optional `SHIPROCKET_PICKUP_PINCODE` (6 digits) turns on Shiprocket's serviceability check for delivery pincodes |
| `EMAIL_PROVIDER` | `console` (prints emails in the API terminal) or `smtp`, which needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM`. Production refuses `console`. SMTP sends password and staff invite emails and all customer order emails |

**`apps/web/.env.local`** needs one line: `ALTASGOODS_API_URL=http://localhost:4000`. (An older copy may also have `BLUBUY_API_URL` from before the rebrand. It is unused and can be deleted.)

The fastest way to a working setup is the sandbox for everything: `PAYMENTS_PROVIDER=sandbox`, `LOGISTICS_PROVIDER=simulated`, `EMAIL_PROVIDER=console`. No outside account is needed.

### Outside accounts

Credentials are shared privately, never in the repository:

- **Razorpay**: the test mode key ID and secret currently in use, and later the live keys from the business's own account.
- **Shiprocket**: the API user (email and password). The current one is under a personal email; a business owned API user is better. Shiprocket has no test mode: every booking is real and charged to the wallet.
- **Titan Mail**: the `no-reply@` mailbox password, and access to the domain's DNS for SPF and DKIM.
- **GitHub**: repository access.

Note that `.env.example` uses `altasgoods.in` in `EMAIL_FROM` while the configured mailbox is on `altasgoods.com`. Confirm which domain is real before going live.

### Things to know first

- **Next.js 16 is new.** Its APIs differ from older versions. `apps/web/AGENTS.md` asks you (and any AI coding tool) to read the guides in `node_modules/next/dist/docs/` before changing web code. `next dev` re-adds that file if removed.
- **The API contract is generated.** After changing an API route or request schema, run `npm run openapi` in `apps/api`, then `npm run api:types` in `apps/web`, and commit both outputs.
- **Database changes** go in `apps/api/src/db/schema.ts`, then `npm run db:generate` writes a new SQL migration in `src/db/migrations`. There are 25 so far (`0000` to `0024`).
- **Seeding never touches real services.** `npm run db:seed` and the tests always use the payment sandbox, the simulated courier and console email, whatever `.env` says.
- **Staff accounts** are made in AltasGoods Control > Staff, where a Super Admin adds people in one of two ways: an emailed one-time link to choose their own password (mode `invite`), or a temporary password the admin passes on, which they must change at first sign in (mode `password`). `npm run admin:create` in `apps/api` is only for the first Super Admin.
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
- **Staff** (AltasGoods Control and Care Desk). The first Super Admin is created with `npm run admin:create` in `apps/api`, which asks for the password. After that, a Super Admin adds staff in AltasGoods Control > Staff: pick a role, then either email them a one-time link to choose their own password (it works once and expires in 72 hours; Resend invite sends a new one), or set a temporary password they must change at first sign in. If the invite email cannot be sent, the staff list shows Invite not sent until a resend goes through. Staff sign in at `/login?as=staff` (opening `/admin` takes you there). `admin:create` still takes `--role SUPPORT_AGENT`, `SUPPORT_SPECIALIST` or `SUPPORT_SUPERVISOR`; the default is `SUPER_ADMIN`.
- **Forgot password** emails a 6 digit code. In development the email is printed in the API terminal and the code is shown on the page, so no mail server is needed. Production sends through SMTP (see `EMAIL_PROVIDER` in `apps/api/.env.example`) and refuses to start without it.

## What is real and what is sample data

The buying journey and store operations run on the API and database. Almost nothing is sample data now.

| Area | Real (API and database) | Fixed content in the web app |
|---|---|---|
| Storefront | Catalog, category and product listings, search, cart, checkout, payment, order confirmation, product reviews, the Deals page and live sales, homepage hero slides and promo tiles, the company pages (About, Press, Careers, Policies, Help and FAQs) and brand spotlights from the content API, pincode serviceability, product legal declarations | Product page warranty text |
| My Account | Overview, orders, order detail and tracking, cancellation, buy again, returns, support conversations, profile (name, email, mobile, change password, sign out of other devices), delete account, addresses, reviews, and the wishlist | None. Credits, saved payment methods and notifications were removed |
| AltasGoods Control | Overview, orders (refunds, mark paid, address edit, internal notes, lost and returned parcels), returns, customers (with block), payments and refunds (retry, Needs attention), products (archive, delete, slug), categories, brands, sales and coupons, Storefront CMS, pages and content, reviews, staff, settings (delivery fee, COD switch and limit, GST rates, delivery areas, customer emails, review publishing, storefront notice, company and grievance details), CSV exports, audit log, your account | None |
| Care Desk | Overview (queue, response and resolution times, 14 day chart, team workload, all from the tickets), ticket inbox and workspace with the live customer and order, replies, notes, refunds, customer lookup and profiles, order lookup and order pages | None. Reply macros and SLA targets are settings in `apps/web/src/lib/care-policy.ts` |
| Shipping | Overview with the connected courier and a Shiprocket setup checklist, shipment counts by stage, late and returned parcels; the shipments list with AWB search, latest scan, label, tracking link and refresh | |
| Sign in | Email and password sign up and sign in, password reset by emailed code, change password, sessions | |

A few helpers the real pages import (listing filters, the state list, return reasons, return windows and pickup slots) still sit in `apps/web/src/lib`. They are rules, not sample data.

## Customer emails

Customers get these emails through the same SMTP setup as password reset. Each is sent once: it is deduplicated by a key, so a repeated courier scan or webhook never sends it twice.

| Email | Sent when |
|---|---|
| Order placed | A cash on delivery order is placed, or a prepaid payment is captured |
| Payment failed | The first failed attempt on an order still waiting for payment |
| Order not completed | An unpaid order expires (replaces the cancelled email) |
| Order cancelled | Lines are cancelled by the customer, staff or the system. States any refund on its way |
| Shipped | A parcel is on its way, with the tracking link |
| Out for delivery | The courier is out for delivery |
| Delivered | A parcel is delivered |
| Parcel lost | A parcel is marked lost. States any refund on its way |
| Parcel returned | A parcel comes back to the store. States any refund on its way |
| Refund started | An admin, goodwill, manual, Care Desk or late or duplicate payment refund begins. Cancellation, lost, returned and return refunds fold this into their own email |
| Refund completed | A refund is paid out |
| Return approved, rejected, picked up, quality check failed, refunded, replaced | The return reaches that step. Links go to `/account/returns#<id>` |
| Care Desk reply | An agent replies to a conversation. Internal notes send nothing |

- **Settings switch.** AltasGoods Control > Settings > Customer emails pauses them. The switch is read when an email is queued, so mail already queued still goes out.
- **Blocked and deleted customers get none.**
- **No staff notes.** Internal notes are never put in a customer email or on the customer's order page.

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

## Reverse proxy and TRUST_PROXY

Sign up, sign in and reset code limits count per client IP (10 signups per hour, 30 failed sign ins per 15 minutes). Shoppers never call the API directly: the Next.js server does, and forwards the shopper's address in `X-Forwarded-For`.

- In production a reverse proxy in front of Next.js must append the real client IP to `X-Forwarded-For` (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).
- `TRUST_PROXY` on the API must match the web to API hop: the address the web server connects from, or a number of hops. Nothing a shopper can reach directly may be listed.
- Get either wrong and the per IP limits are bypassable (anyone can name their own address) or shared by every visitor (all requests look like the web server).

## Before going live

- [ ] Razorpay account in the business's name with KYC done; live keys in `.env`
- [ ] Shiprocket account ready (KYC, bank, pickup address, wallet); `LOGISTICS_PROVIDER=shiprocket`, and `SHIPROCKET_PICKUP_PINCODE` set for serviceability checks
- [ ] On the first live use, check Shiprocket's serviceability field names against the real API. `estimated_delivery_days`, `etd` and `cod` are parsed defensively and were not verified
- [ ] Real product weights
- [ ] Titan SMTP mailbox password set, `EMAIL_PROVIDER=smtp`, and SPF and DKIM records on the sending domain (production will not start without SMTP; password reset, staff invites and order emails depend on it)
- [ ] Company and grievance details filled in AltasGoods Control > Settings. The admin shows a warning until they are set
- [ ] Legal declarations added to each product
- [ ] GST rates set (store default, then category or product where they differ)
- [ ] Delivery areas set in Settings
- [ ] `NODE_ENV=production` everywhere, including for `db:migrate` and `admin:create` (`db:seed` is never run in production, and refuses to); strong `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET`; `WEB_ORIGIN` set to the real site
- [ ] Reverse proxy in front of Next.js and `TRUST_PROXY` set to match (see above)
- [ ] Hosting for the API, web app, Postgres and Redis, with backups; run `npm run db:migrate` on each deploy and create the first Super Admin with `node dist/db/create-admin.js`

## Known limitations

- Subcategory GST rates are resolved but have no admin field. Category and product rates cover it.
- There is no GST invoice PDF yet.
- The per IP limits (10 signups per hour, 30 failed sign ins per 15 minutes per IP) may be tight behind mobile carrier NAT. They are tunable in `apps/api/src/modules/auth/auth.service.ts`.
- A staff bulk cancel sends one email per line.
- Return emails link to `/account/returns#<id>`. There is no per return page.
- Address autofill by pincode was removed from checkout, because it ran on mock data.

## Tests

| Where | Command | Covers |
|---|---|---|
| `apps/api` | `npm test` | About 360 unit and integration tests against `altasgoods_test`: orders, payments (sandbox and Razorpay), shipping (Shiprocket provider and a fake courier end to end), returns, support, auth (sign up, sign in, password reset, SMTP email), staff, content, refunds, GST, delivery areas, customer emails, catalog admin and CSV import |
| `apps/web` | `npm test` | Unit tests for the API adapters, pricing and formatting |
| `apps/web` | `npm run test:e2e` | Playwright journeys (sign up, sign in and password reset, checkout, cancellation, returns, Care Desk, access control, staff invites, content editing, buy again, account deletion, delivery areas) plus crawlers that open every page and press every button. Run with the sandbox and simulated courier; the global setup creates its own accounts with sign up and `admin:create`. Set `E2E_DATABASE_URL` to the API's (throwaway) database to also run `end-to-end.spec.ts`, which reads Postgres to confirm every admin change is stored, shown on the storefront and in the audit log |

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

1. Finish email: set the SMTP password and DNS records, then test password reset, staff invites and order emails end to end.
2. Switch on Shiprocket with the business's account (pickup address, wallet, real weights, pickup pincode) and run a few real bookings, cancelling before pickup. Verify the serviceability field names.
3. Production deployment: hosting, a reverse proxy with `TRUST_PROXY`, CI running typecheck, lint and tests, and the go live checklist above.
4. A GST invoice PDF, with a subcategory GST field in the admin if it is needed.
5. Shiprocket return pickups (today staff book them by hand).
6. Product images in object storage instead of Postgres.
7. A per return page, and grouping for staff bulk cancel emails.
8. The Flutter customer app described in `docs/architecture/system-architecture.md`, if it is still planned.
