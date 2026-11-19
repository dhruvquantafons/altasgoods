# AltasGoods

AltasGoods is an online store for India. One business sells its own catalog. There is a storefront for shoppers and separate workspaces for the store's staff, support agents and shipping.

The code is finished and tested against stand-ins for every outside service. What remains is connecting the real accounts (Razorpay, Shiprocket, SMTP) and deploying to production. This README is written for the developer doing that.

| Workspace | URL | Who uses it |
|---|---|---|
| Storefront | `/` | Shoppers: browse, search, cart, checkout |
| My Account | `/account` | Shoppers: orders, tracking, returns, support, profile |
| AltasGoods Control | `/admin` | Store staff: orders, refunds, catalog, content, settings, staff, exports |
| Care Desk | `/support` | Support agents: tickets with the customer's orders, refunds |
| Shipping | `/logistics` | Admins: shipments, courier status, labels |
| Workspace launcher | `/portals` | Super Admin and Ops Admin |

Signed-in staff also see their workspaces in the storefront's **Account and lists** menu.

## Contents

1. [Run it locally](#1-run-it-locally)
2. [Demo accounts](#2-demo-accounts)
3. [How the system fits together](#3-how-the-system-fits-together)
4. [Configuration](#4-configuration)
5. [Payments: Razorpay](#5-payments-razorpay)
6. [Shipping: Shiprocket](#6-shipping-shiprocket)
7. [Email: SMTP](#7-email-smtp)
8. [Deploying to production](#8-deploying-to-production)
9. [Go-live checklist](#9-go-live-checklist)
10. [Setting up the store after deploy](#10-setting-up-the-store-after-deploy)
11. [Developing](#11-developing)
12. [Known limitations and next steps](#12-known-limitations-and-next-steps)

## 1. Run it locally

You need Node 22.12 or newer, PostgreSQL 16 (with the `pg_trgm` extension available) and Redis.

```bash
# Terminal 1: API
cd apps/api
npm install
cp .env.example .env              # then set JWT_SECRET and PAYMENTS_WEBHOOK_SECRET
createdb altasgoods_dev && createdb altasgoods_test
npm run db:migrate                # create the tables
npm run db:seed                   # demo catalog (products, categories, banners, content pages)
npm run db:demo-accounts          # one sign-in per role, see section 2
npm run dev                       # http://localhost:4000 (API docs at /docs)

# Terminal 2: web
cd apps/web
npm install
echo "ALTASGOODS_API_URL=http://localhost:4000" > .env.local
npm run dev                       # http://localhost:3000
```

Out of the box nothing touches the outside world. Payments use a local sandbox page with Pay and Fail buttons. Shipping uses a simulated courier, and staff advance its scans with Simulate buttons on the admin order page. Emails print in the API terminal.

**Useful commands in `apps/api`:**

| Command | What it does |
|---|---|
| `npm run db:reset` | Drop and recreate the dev schema, then seed. Wipes all data |
| `npm run admin:create -- --email you@x.com --name "Name" [--role ROLE]` | Create a staff account, or add a role to an existing one. Asks for the password |
| `npm run db:demo-accounts` | Re-create the demo sign-ins. Safe to repeat |

## 2. Demo accounts

**Development only.** `npm run db:demo-accounts` creates these accounts. It refuses to run when `NODE_ENV=production` and is left out of the production build. Never create them on a live database.

Password for every account: **`Demo@12345`**

| Role | Email | Signs in at | Can do |
|---|---|---|---|
| Super Admin | `superadmin@altasgoods.test` | `/login?as=staff` | Everything, including managing staff and the Care Desk |
| Ops Admin | `ops@altasgoods.test` | `/login?as=staff` | Orders, returns, refunds, payments, customers, settings, catalog, content, exports, Shipping |
| Catalog Manager | `catalog@altasgoods.test` | `/login?as=staff` | Products, categories, brands, homepage banners, content pages, reviews |
| Auditor | `auditor@altasgoods.test` | `/login?as=staff` | Views every admin page and downloads exports. Cannot change anything |
| Support Agent (L1) | `agent@altasgoods.test` | `/login?as=staff` | Care Desk. Refunds up to ₹2,000 |
| Support Specialist (L2) | `specialist@altasgoods.test` | `/login?as=staff` | Care Desk. Refunds up to ₹10,000 |
| Support Supervisor | `supervisor@altasgoods.test` | `/login?as=staff` | Care Desk. Approves refunds above an agent's limit |
| Shopper | `shopper@altasgoods.test` | `/login` | The storefront and My Account |

Opening `/admin` while signed out takes you to the staff sign-in page. Shoppers can also make their own accounts at `/signup`.

**Real staff accounts.** In production there are no demo accounts:

- **The first Super Admin** is made on the server with `admin:create` (see [section 8](#8-deploying-to-production)).
- **Everyone else** is added in **AltasGoods Control > Staff**, in one of two ways:
  - **Invite:** an emailed one-time link (72 hours) where they choose their own password.
  - **Temporary password:** you share it privately, and they must change it at first sign-in.

Taking away someone's role signs them out on every device.

## 3. How the system fits together

```
Browser ──> Next.js web app (apps/web, port 3000) ──> NestJS API (apps/api, port 4000) ──> PostgreSQL
                                                          │                              └─> Redis
                                                          ├─> Razorpay   (payments, refunds)
                                                          ├─> Shiprocket (bookings, tracking, pincode checks)
                                                          └─> SMTP       (all emails)
```

- **Shoppers never call the API directly.** The Next.js server calls it, and forwards the shopper's IP and browser in `X-Forwarded-For`. This matters for deployment (see [section 8](#8-deploying-to-production)).
- **PostgreSQL** holds everything, including uploaded images and files, which are kept in Postgres for now.
- **Redis** holds sessions that are revoked, rate limits, short caches and one-time codes. It is required: signed-in pages stop working if it is down.
- **Each outside service sits behind one interface with a local stand-in:**
  - payments in `apps/api/src/modules/commerce/payments/provider.ts`
  - couriers in `.../shipping/provider.ts`
  - email in `apps/api/src/modules/auth/email.provider.ts`
  - Switching from stand-in to real is a `.env` change, not a code change.
- **The API contract is generated.** The web app's types come from `packages/openapi/openapi.json`.

**Background work inside the API process:**

| What | How often | Code |
|---|---|---|
| Job queue (refunds, emails), with retries and backoff | every 10 s, plus right after each request | `modules/jobs` |
| Ask Razorpay about unpaid orders, expire them after 30 min | every 60 s | `payments/sweeper.ts` |
| Re-check refunds still processing at Razorpay | every 15 min | `payments/sweeper.ts` |
| Shiprocket tracking updates | every 10 min | `shipping/tracker.ts` |
| Delete old finished jobs (14 days done, 90 days failed) | every 6 h | `jobs/jobs.worker.ts` |

Refunds and emails are queued in the same database transaction as the change that caused them. They are sent after it commits, at least once, with deduplication. So a refund is never lost, and an email is not sent twice.

## 4. Configuration

Two local files hold settings. Both are git ignored, so each developer and each server has their own.

### `apps/api/.env`

Copy it from [`apps/api/.env.example`](apps/api/.env.example), which lists every setting with a comment. The API checks the file at startup and refuses to start, with a readable message, if something is missing or wrong.

| Setting | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `development`, `test` or `production`. There is no default. `npm start` sets `production`. The `db:*` and `admin:create` commands read `.env`, so set it there on a server too |
| `PORT` | no | Default `4000` |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | dev only | Wiped on every test run. Never point it at real data |
| `REDIS_URL` | yes | For example `redis://localhost:6379/5` |
| `JWT_SECRET` | yes | 32+ random characters: `openssl rand -base64 48` |
| `PAYMENTS_WEBHOOK_SECRET` | yes | 16+ random characters. Used by the sandbox provider |
| `WEB_ORIGIN` | yes | The web app's public address, for CORS and links in emails and payments. For example `https://altasgoods.com` |
| `TRUST_PROXY` | yes in prod | Which hop may name the real client IP. Default `loopback`. See [section 8](#8-deploying-to-production) |
| `PAYMENTS_PROVIDER` | yes | `sandbox` or `razorpay`. See [section 5](#5-payments-razorpay) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | with razorpay | From the Razorpay dashboard |
| `LOGISTICS_PROVIDER` | yes | `simulated` or `shiprocket`. See [section 6](#6-shipping-shiprocket) |
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_PICKUP_LOCATION` | with shiprocket | A Shiprocket API user and the pickup address nickname |
| `SHIPROCKET_PICKUP_PINCODE` | optional | Turns on Shiprocket's check of each delivery pincode |
| `SHIPROCKET_WEBHOOK_TOKEN` | optional | For the tracking webhook |
| `SHIPPING_BOX_CM` | no | Parcel size, default `20x15x10` |
| `EMAIL_PROVIDER` | yes | `console` (prints emails) or `smtp`. Production refuses `console` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | with smtp | See [section 7](#7-email-smtp) |

### `apps/web/.env.local`

One line: `ALTASGOODS_API_URL=http://localhost:4000`, the address where the web server reaches the API. An old `BLUBUY_API_URL` line, if present, is unused and can be deleted.

## 5. Payments: Razorpay

The code is complete and was tested with Razorpay **test** keys. Going live needs the business's own KYC-verified Razorpay account.

**Switch it on** in `apps/api/.env`:

```
PAYMENTS_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_...        # Dashboard > Account & Settings > API Keys (rzp_live_... for live)
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...         # any long random string; must match the webhook below
```

**How a payment works:**

1. At checkout the API creates the order and reserves stock. After the database commits, it creates a Razorpay order. If Razorpay is slow or down, checkout is not held up: the shopper sees "Try again" on the pay page.
2. The shopper pays in Razorpay Checkout on `/checkout/pay/{id}`.
3. The browser's result is verified: the signature is checked, then the payment is read back from Razorpay and captured if it is only authorised.
4. **The webhook is optional.** The API also asks Razorpay about open payments every minute, so a shopper who pays and closes the tab is still confirmed. To add the webhook:
   - URL: `https://<api-host>/v1/payments/webhooks/razorpay`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Secret: the same `RAZORPAY_WEBHOOK_SECRET`
5. Unpaid orders expire after 30 minutes, and their stock and coupon are released.
6. A payment that arrives after its order expired, or a second payment for an already-paid order, is refunded automatically.

**How refunds work:**

- Every refund goes through one queue. Cancellations, lost parcels, returns, Care Desk and admin goodwill refunds all use it, and one limit stops the same money being refunded twice.
- The refund row is written first. A job then calls Razorpay with the refund id as the receipt.
- If Razorpay can't be reached, the job retries with backoff. If the result is still unclear, the refund is marked **Needs attention** with its amount still reserved. Staff check it in Payments and press Retry.
- Only a definite failure from Razorpay frees the amount.
- Refunds still processing at Razorpay are re-checked every 15 minutes. There is no refund webhook.
- Cash-on-delivery refunds are paid by staff outside the system, by UPI or bank transfer, and recorded with **Mark paid** and the transaction reference.

**Testing:** use UPI `success@razorpay` or `failure@razorpay`, or Razorpay's test cards. Keep automatic capture on (Account & Settings > Payment Capture).

**Code:** `apps/api/src/modules/commerce/payments/` (`razorpay.provider.ts`, `payments.service.ts`, `refunds.service.ts`, `sweeper.ts`). Calls time out after 10 seconds.

## 6. Shipping: Shiprocket

The code is complete: forward shipments, labels, tracking, cancellation and pincode serviceability. It has not been switched on yet, because the business's pickup address isn't set up.

**Shiprocket has no test mode.** Every booking is a real shipment charged to the wallet, so cancel test bookings before pickup.

**Switch it on** in `apps/api/.env`:

```
LOGISTICS_PROVIDER=shiprocket
SHIPROCKET_EMAIL=...                # an API user (Settings > API > Create an API User), not the account login
SHIPROCKET_PASSWORD=...
SHIPROCKET_PICKUP_LOCATION=Primary  # nickname of the verified pickup address in Shiprocket
SHIPROCKET_PICKUP_PINCODE=560001    # optional: also check each delivery pincode with Shiprocket
SHIPPING_BOX_CM=20x15x10            # parcel size in cm; weight comes from each product
SHIPROCKET_WEBHOOK_TOKEN=           # optional, for the tracking webhook
```

**Before switching on,** the Shiprocket account needs KYC, a bank account, a verified pickup address and a wallet balance. Each product needs its real packed weight (800 g by default).

**How shipping works:**

- **Booking.** One order line ships as one parcel. When staff mark a packed line **Ready to ship**, the API books it: Shiprocket order, AWB and courier, pickup request, then label. Each step is saved, so a retry resumes rather than booking twice. If booking fails (for example, an empty wallet), the line stays packed and the reason is shown.
- **Cash on delivery.** The amount to collect is the line minus its coupon share, plus the delivery fee on the order's first parcel.
- **Cancelling.** Cancelling a booked line cancels it in Shiprocket. Once booking has started, the delivery address can no longer be edited.
- **Tracking.** It updates every 10 minutes, on demand with **Refresh tracking**, and optionally by webhook:
  - URL: `/v1/logistics/webhooks/tracking`
  - Header: `x-api-key` set to `SHIPROCKET_WEBHOOK_TOKEN`
  - Shiprocket rejects webhook URLs containing "shiprocket", "sr" or "kr", even in the domain.
- **Lost and damaged.** Shiprocket's `DAMAGED`, `DESTROYED` and `DISPOSED OFF` scans mark a parcel lost, which refunds a prepaid line automatically. Staff can also mark lost or returned-to-store by hand.
- **Pincode checks.** The admin's Delivery areas rules (Settings) always apply. With `SHIPROCKET_PICKUP_PINCODE` set, Shiprocket is also asked, and answers are cached for 12 hours. If Shiprocket errors, the rules alone decide, so checkout is never blocked by a Shiprocket outage.
- **Return pickups** are not booked with Shiprocket yet. Staff book the reverse pickup in the Shiprocket panel and record each step on the admin return page with **Update pickup**.

**Verify on first live use:** the serviceability response is parsed by `estimated_delivery_days`, `etd` and `cod`. These field names come from Shiprocket's docs but haven't been checked against a live account. If they're wrong, the code falls back to the admin rules rather than blocking orders.

**Code:** `apps/api/src/modules/commerce/shipping/` (`shiprocket.provider.ts`, `shipping.service.ts`, `tracker.ts`) and `commerce/serviceability.service.ts`. Calls time out after 15 seconds.

## 7. Email: SMTP

All email goes through one SMTP mailbox: password reset codes, email verification, staff invites and customer order emails. The code is complete. What's pending is the mailbox password and the DNS records.

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.titan.email
SMTP_PORT=465                       # 465 with SMTP_SECURE=true, or 587 with STARTTLS
SMTP_SECURE=true
SMTP_USER=no-reply@<domain>
SMTP_PASSWORD=...
EMAIL_FROM="AltasGoods <no-reply@<domain>>"   # Titan rejects a From that is not SMTP_USER or its alias
```

- Add the provider's **SPF and DKIM** records to the sending domain, or mail lands in spam.
- **Confirm the domain.** `.env.example` uses `altasgoods.in`, but the configured mailbox is on `altasgoods.com`.
- **Development.** With `EMAIL_PROVIDER=console` the emails print in the API terminal. Password reset codes are also shown on the page, and staff invites show a "Copy invite link" button.

**Customer emails:**

| Email | Sent when |
|---|---|
| Order placed | A cash-on-delivery order is placed, or a prepaid payment is captured |
| Payment failed | The first failed attempt on an order still waiting for payment |
| Order not completed | An unpaid order expires |
| Order cancelled | The customer, staff or the system cancels lines. It states any refund on its way |
| Shipped / Out for delivery / Delivered | Courier updates. Shipped includes the tracking link |
| Parcel lost / Parcel returned | Staff or the courier mark it. It states any refund on its way |
| Refund started | Admin, goodwill, manual, Care Desk or duplicate-payment refunds. The emails above already cover the others |
| Refund completed | The refund is paid out |
| Return approved, rejected, picked up, check failed, refunded, replaced | The return reaches that step |
| Care Desk reply | An agent replies. Internal notes send nothing |

- **Sent once.** Each email is deduplicated, so a repeated webhook or scan never sends it twice.
- **Never to blocked or deleted customers.**
- **No staff notes.** They never appear in emails or on the customer's pages.
- **Pausing.** Store owners can pause all customer emails in **Settings > Customer emails**.

## 8. Deploying to production

No hosting, CI or Docker setup exists yet. Here is what you need, whatever host you choose.

### Components

| Piece | Runs | Notes |
|---|---|---|
| Web app | `apps/web`: `npm ci && npm run build && npm start` | Next.js 16 server, port 3000. Needs `ALTASGOODS_API_URL` pointing at the API's private address |
| API | `apps/api`: `npm ci && npm run build && npm start` | Port 4000. `npm start` sets `NODE_ENV=production`. Needs its `.env` |
| PostgreSQL 16 | managed or self-hosted | `pg_trgm` must be available. Turn on backups: it holds orders, payments and uploaded images |
| Redis | managed or self-hosted | Required for sign-in. Persistence is not critical |
| Reverse proxy | nginx, a load balancer, or the host's edge | TLS, and it must pass the real client IP (see below) |

Use Node 22.12 or newer (24 LTS recommended).

### Every deploy

```bash
cd apps/api
npm ci && npm run build
NODE_ENV=production node --env-file=.env dist/db/migrate.js   # apply new migrations before starting the new API
npm start
```

Migrations are plain SQL in `apps/api/src/db/migrations`: 25 so far, `0000` to `0024`. They only add things and are safe on a database with data. Never run `db:seed`, `db:reset` or `db:demo-accounts` in production. Seed and the demo accounts refuse to run there.

### First deploy only: create the first Super Admin

```bash
cd apps/api
NODE_ENV=production ADMIN_PASSWORD='a-strong-password' node --env-file=.env dist/db/create-admin.js --email owner@yourstore.com --name "Owner Name"
```

Then sign in at `https://<site>/login?as=staff` and add the rest of the team under **Staff**.

### Reverse proxy and `TRUST_PROXY` (important)

Sign-in, sign-up and reset-code limits are counted per client IP:

- 10 failed sign-ins per email and IP, then 30 per IP, per 15 minutes
- 10 sign-ups per IP per hour

The API sees the shopper's IP only through the web server's `X-Forwarded-For`. So:

1. **Proxy.** The reverse proxy in front of the web app must append the real client IP. With nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
2. **`TRUST_PROXY`.** On the API, it must describe the web-to-API hop: the address or CIDR the web server connects from, or a hop count. Use `loopback` only if both run on one machine.
3. **Keep the API private.** Don't expose the API to the internet directly, and never trust an address a shopper can reach.

If you get this wrong, either anyone can bypass the limits by naming their own IP, or every shopper shares the web server's IP, and a few failed sign-ins lock everyone out.

### Other production notes

- **Webhook paths.** The only API routes outside callers need are `/v1/payments/webhooks/razorpay` and `/v1/logistics/webhooks/tracking`. You can expose just those, or route them through the proxy.
- **API docs.** `/docs` (Swagger) is also served in production. Block it at the proxy if you don't want it public.
- **Health check.** `GET /health` on the API.
- **Several API instances.** The job queue is safe across instances (`FOR UPDATE SKIP LOCKED`). The payment sweeper and tracking poller run in every instance, which duplicates gateway calls but is harmless. One API instance is simplest to start with.
- **Settings cache.** Settings are cached for 15 seconds per instance, so changes reach other instances within that time.
- **Secrets.** Generate fresh `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET` values for production. Never reuse development values.

## 9. Go-live checklist

**Accounts and keys**
- [ ] Razorpay account in the business's name, KYC done, live keys in `.env`, automatic capture on
- [ ] Shiprocket ready (KYC, bank, verified pickup address, wallet balance), `LOGISTICS_PROVIDER=shiprocket`, `SHIPROCKET_PICKUP_PINCODE` set
- [ ] Shiprocket serviceability field names checked on the first live calls (section 6)
- [ ] SMTP mailbox password set, `EMAIL_PROVIDER=smtp`, SPF and DKIM on the sending domain, and the right domain confirmed (section 7)

**Server**
- [ ] `NODE_ENV=production` everywhere, fresh `JWT_SECRET` and `PAYMENTS_WEBHOOK_SECRET`, `WEB_ORIGIN` set to the real site
- [ ] Reverse proxy passing the client IP, `TRUST_PROXY` matching, API not public (section 8)
- [ ] Postgres backups on; migrations run on each deploy
- [ ] First Super Admin created with `create-admin.js`; no demo accounts on the live database

**Store content (section 10)**
- [ ] Company and grievance details filled in. The admin shows a warning until they are
- [ ] Legal declarations on every product, GST rates set, real product weights
- [ ] Delivery areas set; COD and customer email switches as wanted
- [ ] Policy pages reviewed in Pages & content

## 10. Setting up the store after deploy

Sign in as the Super Admin and work through **AltasGoods Control**:

| Where | What to set |
|---|---|
| Settings > Company and Grievance | Legal name, CIN, GSTIN, registered office, customer care contacts, Grievance Officer. Until set, the site shows "To be added by the store" and the admin shows a warning |
| Settings > Tax (GST) | Store default GST rate and HSN |
| Categories, then each product | GST rate and HSN per category, with product overrides where they differ. Prices stay GST-inclusive, and each order line stores its GST |
| Each product | Legal declarations (manufacturer, packer, importer, consumer care, country of origin), real packed weight |
| Settings > Delivery | Delivery fee, free delivery threshold, delivery areas (blocked pincodes, no-COD pincodes, extra delivery days) |
| Settings > Cash on delivery | On or off, and the maximum order value |
| Settings > Customer emails | On or off |
| Pages & content | Policies, Help/FAQ, About, Careers, Press, brand spotlights. Written in Markdown with a live preview |
| Storefront CMS | Homepage hero slides and promo tiles |
| Staff | Add the team with the right roles |

**Day-to-day work after launch:**

| Task | Where |
|---|---|
| Order handling: accept, pack, ready to ship, cancel, edit address before shipping, internal notes, mark lost or returned | Orders |
| Returns and refunds: goodwill and manual refunds, Mark paid for UPI refunds, Retry for refunds that need attention | Returns, Payments |
| Product lifecycle: archive (hidden but kept for order history), permanent delete (only if never ordered), URL slug changes (old links redirect) | Catalog |
| CSV exports of orders, order items (with GST), payments, refunds, customers and the audit log | Each list page |
| Every admin change is recorded | Audit log |

## 11. Developing

**Repository layout**

```
apps/api/                NestJS 12 API on PostgreSQL (Drizzle ORM) and Redis
  src/modules/           auth, admin (settings, staff, audit, exports), catalog, content, commerce
                         (cart, quote, orders, payments, refunds, shipping, returns, notifications),
                         support (Care Desk), jobs, files, health
  src/db/                schema, SQL migrations, seed, admin:create, demo accounts
  test/                  unit and integration tests (Vitest)
packages/openapi/        the generated API contract
apps/web/                Next.js 16 app with every workspace
  src/app/               routes, one folder or route group per workspace
  src/components/        design system (ui, charts, shell) and area components
  src/lib/               API client and adapters, roles, formatting, state labels
  tests/                 Vitest unit tests and Playwright end-to-end tests
docs/                    original research and architecture notes
```

**Rules of the codebase**

- **Next.js 16 is new.** Read `apps/web/AGENTS.md` and the guides in `apps/web/node_modules/next/dist/docs/` before changing web code.
- **API contract.** After changing an API route or schema, run `npm run openapi` in `apps/api`, then `npm run api:types` in `apps/web`, and commit both outputs.
- **Database changes.** Edit `apps/api/src/db/schema.ts`, then run `npm run db:generate -- --name <what_changed>` to write the SQL migration. Commit it.
- **Staff pages.** A new admin page must be added to `AREA_ROLES` in `apps/web/src/lib/api/staff.ts`. Unmapped pages are Super Admin only. API routes use `@StaffOnly(...)`, and Auditor only ever gets GET routes.
- **Money** is integer paise everywhere.
- **Order states.** Every order status change goes through `OrderWorkflow.transition` and `commerce/state.ts`.
- **Product copy.** No em dashes and no emojis. Icons come from lucide.

**Tests**

| Where | Command | Notes |
|---|---|---|
| `apps/api` | `npm test` | About 370 tests against `TEST_DATABASE_URL`, which is wiped each run. Always uses the sandbox, simulated courier and console email |
| `apps/api` | `npm run typecheck` | Strict TypeScript |
| `apps/web` | `npm test`, `npx tsc --noEmit`, `npm run lint` | Unit tests, types, lint |
| `apps/web` | `npm run test:e2e` | 61 Playwright journeys plus page and button crawlers |

Run the Playwright suite against a **throwaway** database: the admin specs change settings and products. Start the API on that database with `PAYMENTS_PROVIDER=sandbox LOGISTICS_PROVIDER=simulated EMAIL_PROVIDER=console`, start the web app, then run:

```bash
E2E_DATABASE_URL=<that db> E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:4000 npx playwright test
```

## 12. Known limitations and next steps

**Known limitations**

- **GST.** There is no GST invoice PDF yet. Subcategory GST rates have no admin field; category and product rates cover it.
- **Return pickups** are booked by hand in Shiprocket.
- **Sign-up limits.** The per-IP limits may be tight for many shoppers behind one mobile carrier IP. Tune them in `apps/api/src/modules/auth/auth.service.ts`.
- **Bulk cancel emails.** A staff bulk cancel sends one email per line.
- **Return links.** Return emails link to `/account/returns#<id>`; there is no separate page per return.
- **Address autofill.** Checkout doesn't fill in the city and state from the pincode, and the address book form uses a short built-in pincode list.
- **Pay page.** Revisiting an old pay link after a partial refund can show the wrong message.
- **Lost-parcel refunds.** Shiprocket's damaged or destroyed scans refund prepaid lines without staff confirmation. Decide whether that is wanted.

**Next steps, roughly in order**

1. Connect SMTP and test password reset, staff invites and order emails end to end.
2. Switch on Shiprocket with the business account, run a few real bookings (cancel before pickup), and verify the serviceability fields.
3. Deploy: hosting, reverse proxy with `TRUST_PROXY`, CI running typecheck, lint and tests, then the go-live checklist.
4. Switch Razorpay to live keys and do one real low-value payment and refund.
5. GST invoice PDF.
6. Shiprocket return pickups.
7. Product images in object storage instead of Postgres.
8. The Flutter customer app in `docs/architecture/system-architecture.md`, if it is still planned.
