# BluBuy Web: Frontend Conventions

The web app lives in `apps/web` (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react icons). Every surface (storefront, account, Seller Hub, BluBuy Control, Hub Console, Care Desk) is one app with route groups, so they share one design system and one data layer.

## Copy and content rules (non-negotiable)

1. Never use the em dash character anywhere: UI copy, comments, docs. Use commas, colons, parentheses or a plain hyphen.
2. Never use emojis, including as icons. Icons come from `lucide-react` only.
3. Indian conventions: rupee amounts through `formatINR` (Indian digit grouping, "₹1,24,999"), compact amounts through `formatCompact` (K, L for lakh, Cr for crore), dates through the helpers in `src/lib/utils.ts` (en-IN). Show "M.R.P." struck through and "% off" in green, "Inclusive of all taxes" on product pages.
4. Sentence case for headings, labels and buttons ("Add a product", not "Add A Product").
5. Fictional brands, sellers and people only. Never use real brand names or logos.

## Next.js 16 specifics

- `params` and `searchParams` are Promises: `export default async function Page(props: PageProps<"/seller/orders/[id]">) { const { id } = await props.params; }`. Global `PageProps<"route">` and `LayoutProps<"route">` helpers are generated.
- Server Components by default. Add `"use client"` only for state, effects or event handlers, and keep client components small (leaf widgets).
- Never pass functions (including lucide icon components) from a Server Component into a Client Component. Chart formats are strings (`format="inr"`) for this reason.
- `useSearchParams` in a client component requires a `<Suspense>` boundary. Prefer reading `searchParams` in the server page and passing plain values down.
- Filtering, tabs and pagination are URL driven (`?status=packed&q=...`) and implemented in the server page with plain `<Link>`s or a `<form method="get">`.
- Use `next/image` (via `ProductImage`) for product photos. All photos live in `public/images` (see `public/images/manifest.json`).

## Directory map

```
src/
  app/
    layout.tsx                 root: fonts, metadata
    (store)/                   storefront route group (header + footer layout)
      account/                 customer account (own sub-layout with account nav)
    (checkout)/                checkout with a minimal, distraction free header
    (auth)/                    login, signup (OTP based)
    seller/(console)/          Seller Hub (DashboardShell); seller/register is outside the shell
    admin/                     BluBuy Control
    logistics/                 Hub Console (and the Rider app preview)
    support/                   Care Desk
    portals/                   launcher for every workspace
  components/
    ui/                        design system primitives (shared, do not fork)
    charts/                    SVG charts (shared)
    shell/                     DashboardShell, area shells, workspaces
    commerce/                  product image and shared commerce widgets
    brand/                     logo
    store/ account/ seller/ admin/ logistics/ support/   area-specific components
  lib/
    utils.ts                   cn, formatting, NOW, seeded random
    types.ts                   domain model (mirrors the future API)
    status.ts                  every state machine: labels, tones, transitions
    mock/                      mock data layer, to be replaced by API calls
```

## Design system usage

Tokens live in `src/app/globals.css` (`@theme`). Use the token utilities, never raw hex:

| Purpose | Classes |
|---|---|
| Page background (dashboards) | `bg-canvas` |
| Cards and surfaces | `bg-surface` / `bg-white`, `border border-line`, `rounded-[var(--radius-card)]` (use `<Card>`) |
| Primary text / secondary / muted | `text-ink-900` / `text-ink-600` or `text-ink-500` / `text-ink-400` (icons, hints only) |
| Brand actions and links | `bg-brand-600`, `text-brand-700` |
| Deals, Buy Now, timers | `accent-*` (marigold); never for anything else |
| Status | always through `StatusBadge` + the maps in `lib/status.ts` |
| Headings | `font-display` is applied to h1 to h4 automatically (Plus Jakarta Sans); body is Inter |
| IDs (order, AWB, SKU, UTR) | `font-mono text-[13px]` |
| Numbers in tables | right aligned (`<TD align="right">`), `tabular-nums` is applied |

Layout rhythm: dashboards use `gap-4` to `gap-6` between cards, card padding `p-5`, page header from `<PageHeader>`. The storefront is airier: `max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8`, 48 to 80px between sections.

Elegance rules: hairline borders before shadows, one primary button per view, generous whitespace, restrained colour (blue for action, marigold only for genuine deals, status colours only for status), consistent radii (8px controls, 12px cards, 16px dialogs, full for pills).

## Shared components (import, do not copy)

- `@/components/ui/button`: `Button`, `ButtonLink` (variants primary, secondary, outline, ghost, soft, accent, danger, dark, link; sizes xs, sm, md, lg, icon, icon-sm; `icon` / `iconRight` take a lucide component).
- `@/components/ui/badge`: `Badge` (tone), `StatusBadge` (meta from `lib/status`), `toneText`, `toneBg`.
- `@/components/ui/card`: `Card`, `CardHeader` (title, description, action), `CardBody`, `CardFooter`, `Divider`.
- `@/components/ui/input`: `Input` (icon, suffix), `Textarea`, `Select`, `Label`, `Field`, `Checkbox`, `Radio`.
- `@/components/ui/table`: `TableContainer`, `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` (cells are nowrap by default; add `whitespace-normal` for prose), `TableToolbar`, `TableFooter` (pass `prevHref` / `nextHref` to make pagination navigate).
- `@/components/ui/tabs`: `TabLinks` (URL driven, server safe; variants underline and pill).
- `@/components/ui/interactive` (client): `Tabs`, `Modal` (center or right sheet), `Switch`, `Popover`, `MenuItem`, `useToast`.
- `@/components/ui/page-header`: `PageHeader`, `SectionHeading`, `Breadcrumbs`.
- `@/components/ui/stat-card`: `StatCard` (label, value, delta, deltaLabel, upIsGood, icon, trend, href).
- `@/components/ui/misc`: `Avatar`, `Progress`, `EmptyState`, `RatingPill`, `Stars`, `Price`, `Kbd`, `Stepper`, `Timeline`, `DescriptionList`, `IconTile`.
- `@/components/charts/area-chart` (client): `AreaChart` (data `{ label, ...series }[]`, series, format). A `null` or missing value draws a gap, so a "today" series can stop at the last completed period.
- `@/components/charts/use-width` (client): `useWidth()` returns `[ref, width]` where width is `null` until measured; render the SVG only once it is a number.
- `@/components/charts/bar-chart` (client): `BarChart` (grouped columns, `emphasis` index).
- `@/components/charts/static`: `Sparkline`, `BarList`, `StackedBar`, `Funnel`.
- `@/components/commerce/product-image`: `ProductImage` (fixed `size` for thumbnails or fill mode).
- `@/components/brand/logo`: `Logo`, `LogoMark`.

Chart rules (from the data visualisation method): one y axis only (never dual axis); one series means no legend box; colours by entity in fixed slot order; thin marks; tooltips enhance and never gate; show completed periods so partial days do not read as drops; prefer a stat tile when the story is one number.

## Data layer

Import from `@/lib/mock` only. Everything is deterministic (seeded) and anchored to `NOW` (1 Oct 2026, 10:30 IST), so server and client renders agree. Key exports: `products`, `categories`, `brands`, `getProduct`, `searchProducts`, `sellers`, `CURRENT_SELLER_ID` (Apex Retail), `customers`, `CURRENT_CUSTOMER` (Ananya Sharma), `customerAddresses`, `orders`, `myOrders`, `getOrder`, `sellerOrderLines`, `returns`, `refunds`, `settlementsForSeller`, `allSettlements`, `feesForLine` and the rate card constants, `hubs`, `CURRENT_HUB_ID`, `associates`, `shipments`, `tickets`, `reviews`, `coupons`, `campaigns`, notifications, `platformDaily`, `sellerDaily`, `categoryMix`, `regionMix`, `funnel`, `paymentMix`, `SALE_EVENT`.

When a page needs data that does not exist yet, add a new file under `src/lib/mock/` named for the area (for example `seller-extra.ts`) and import it directly. Do not edit the shared mock files.

## Status mapping to the backend spec

`lib/status.ts` holds UI-level enums. They map to the canonical uppercase enums in `docs/research/01-marketplace-workflows.md` section 11. Order line statuses map as: `placed` = `NEW`, `confirmed` = `ACCEPTED`, `packed` = `PACKED`, `ready_to_ship` = `READY_TO_SHIP`, `shipped` and `in_transit` = `SHIPPED`, `out_for_delivery` = `OUT_FOR_DELIVERY`, `delivered` = `DELIVERED`, `cancelled` = `CANCELLED`, `undelivered` = shipment in `NDR`, `rto_in_transit` = `RTO_IN_TRANSIT`, `returned_to_seller` = `RTO_RECEIVED`, `return_requested` = `RETURN_REQUESTED` / `RETURN_IN_PROGRESS`, `returned` = `RETURNED`.

## Dates and time zones

All dates render in IST through `formatDate`, `formatDateShort`, `formatDateTime`, `formatTime` and `formatWeekday`, which pin `timeZone: "Asia/Kolkata"`. Never call `getHours()` or `toLocaleTimeString()` directly: use `istHour(d)` and `istMinuteOfDay(d)`, so output is identical on a UTC server, an IST laptop and a shopper's phone.

## Known follow-ups

- Area status maps that should move into `lib/status.ts` once the backend enums land: `components/logistics/meta.ts` (runsheet, NDR case, line haul, cash deposit, FC task) and `components/admin/admin-status.ts` (KYC, claims, payouts, moderation).
- A few areas keep local variants of shared widgets from before the shared fixes (store price row, account and Plus switches, admin share bar, logistics progress chart). They can be folded back into `components/ui` and `components/charts`.
- Every action is a mock (toasts and local state). Wire them to the API as described in `system-architecture.md`.

## Accessibility

WCAG 2.2 AA: 4.5:1 text contrast (`ink-500` is the lightest text colour allowed for content), visible focus (global `:focus-visible` ring), labels on every input (`Field`), `aria-label` on icon-only buttons, status never conveyed by colour alone (badges carry words), tap targets at least 24px (44px for primary mobile actions), charts include accessible names and data tables.
