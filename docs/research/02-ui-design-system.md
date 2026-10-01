# BluBuy UI Design System: Research and v1 Specification

| Field | Value |
|---|---|
| Document | 02-ui-design-system |
| Version | 1.0 |
| Date | 2026-10-01 |
| Status | Source of truth for visual design on web (Next.js, lucide-react) and the later Flutter app |
| Scope | Storefront (web), customer account, Seller Central, Admin console, Logistics console, Support console |
| Related | 01-marketplace-workflows.md (canonical status names, business rules) |

How to read this document:

- Part A (sections 1 to 6) is research: what leading marketplaces, D2C brands and dashboard design systems do well, with numbers from Baymard Institute and other sources where available. Observations about specific Indian storefronts are marked "observed" and should be re-checked against the live sites before copying any detail.
- Part B (sections 7 to 22) is the BluBuy Design System v1: principles, tokens (color, type, spacing, radius, elevation, motion), component rules, status semantics, page layouts, accessibility and the Flutter mapping.
- Every color pair quoted with a ratio was computed with the WCAG 2.x relative luminance formula. Font glyph and feature claims in section 3.1 were verified by opening the actual font files from the google/fonts repository with fontTools.
- Writing rules for all BluBuy UI copy and docs: no em dash character anywhere (use commas, colons, parentheses or hyphens), no emojis, no emoji used as an icon. Icons come from lucide (lucide-react on web).

## Table of contents

- Part A: Research
  - 1. Storefront design (consumer web)
  - 2. Dashboard design (Seller, Admin, Logistics, Support)
  - 3. Typography, color and spacing research
  - 4. Status color semantics research
  - 5. Accessibility and regulation research
  - 6. Responsive, mobile-first and Flutter research
- Part B: BluBuy Design System v1
  - 7. Design principles and the 10 rules
  - 8. Color tokens
  - 9. Typography tokens
  - 10. Spacing, layout grid and breakpoints
  - 11. Radius, borders, elevation
  - 12. Motion
  - 13. Iconography
  - 14. Core components
  - 15. Commerce components (product card, price, rating, deal, delivery)
  - 16. Dashboard components (top bar, sidebar, stat card, tables, charts, action center)
  - 17. Status semantics: orders, shipments, returns, payouts
  - 18. Storefront page layouts
  - 19. Dashboard page layouts
  - 20. Content and formatting rules
  - 21. Accessibility checklist (WCAG 2.2 AA)
  - 22. Token implementation: CSS and Flutter ThemeData
- Sources

---

# Part A: Research

## 1. Storefront design (consumer web)

### 1.1 What the leaders do well

| Site | What to learn | What to avoid |
|---|---|---|
| Amazon.in | Dense but predictable buy box: price, M.R.P., "Inclusive of all taxes", delivery date for the user's pincode, stock, seller, Add to Cart and Buy Now stacked in one column. Deep search with scoped suggestions. Ratings with a distribution histogram. | Visual noise: many competing badges, ads and cross-sells on one screen. BluBuy should keep the information, drop the clutter. |
| Flipkart | Clear India-specific price row ("price, struck M.R.P., % off in green"), compact rating pill, pincode check on the product page, bank offers block, bottom-anchored Add to Cart / Buy Now pair on mobile. | Heavy yellow and blue saturation and banner-dense homepages. Our palette must not read as a Flipkart clone (section 3.3). |
| Myntra | Fashion grid discipline: consistent image ratio (portrait), brand name above product name, size chips (buttons, not dropdowns), "inclusive of all taxes" on PDP, wishlist as a first-class action. | All caps and orange discount text everywhere reduces elegance. |
| Nykaa | Editorial minimalism for beauty: neutral white and black frame so product colors read accurately, Inter as UI typeface, small body text with generous line height. A branded accent color used sparingly. | Very small body text (13 px) is too small for the mass Indian audience on low-end phones. |
| Ajio / Tata CLiQ | Curated brand storefronts and editorial heroes; Tata CLiQ Luxury shows how a sub-brand can switch to a quieter, typographic luxury mode on the same platform. | Carousels with auto-rotation and text baked into images (not accessible, not translatable). |
| Apple Store | Product first, whitespace, no fake urgency, sticky purchase bar with price and one primary action, clear delivery and pickup dates. | Too sparse for a 10-million-SKU marketplace; borrow restraint, not emptiness. |
| Zalando | Clean grid, filters as chips above results, clear size and delivery information, its own Zalando Sans typeface (now on Google Fonts). | Zalando Sans lacks the rupee glyph (verified in 3.1), so it is not an option. |
| SSENSE | Typographic restraint: monochrome, hairlines, one type family, editorial imagery. Proves that elegance is mostly subtraction. | Low-contrast gray text and tiny labels: fails accessibility for a mass audience. |
| Mercado Libre | The closest analog to an emerging-market mass marketplace: prominent delivery promise ("arrives tomorrow"), free shipping and installment messaging near the price, green for savings, yellow brand used sparingly. | Busy homepage modules. |

Synthesis for BluBuy: Amazon/Flipkart information architecture (users are trained on it), Apple/SSENSE restraint (whitespace, hairlines, few colors), Mercado Libre's delivery-promise emphasis, Myntra's grid discipline for fashion.

### 1.2 Header and search

- Search is the primary navigation on a marketplace. Baymard: autocomplete is offered on 80% of sites but only 19% implement it fully correctly. Recommendations: max 10 suggestions on desktop and 4 to 8 on mobile, no inner scrollbars, highlight the predicted part (not the typed part), style category-scoped suggestions differently ("in Mobiles"), support arrow keys and Enter, and dim the page behind the open suggestion panel to create depth.
- Mobile: keep the search field visible by default rather than hidden behind an icon (Baymard's mobile benchmark flags search collapsed behind an icon or inside the hamburger menu). In an A/B test reported by Blend Commerce, USA Containers saw conversion rise 13% when the mobile search bar was made visible.
- India convention: a "Deliver to" location chip (city and pincode) in the header. It drives delivery dates, serviceability, COD availability and price on every page.
- Header contents on desktop (left to right): logo, Deliver to chip, search (flex), account, orders, cart with count. A second thin row holds top categories and the mega menu trigger.

### 1.3 Mega menu

- Hover-based mega menus are used as main navigation on 88% of top US e-commerce sites, but 60% of sites do not add the 300 to 500 ms hover delay that prevents accidental opening ("flickering"). Vertical menus are especially prone to the user's diagonal mouse path activating sibling categories.
- Rules for BluBuy: open after a 300 ms hover intent delay, close after a 300 ms grace period, tolerate the diagonal path toward the submenu (menu aim), also open on click and on keyboard (Enter/Space, arrow keys), and on touch devices use a full-screen drill-down sheet instead of hover.

### 1.4 Homepage, hero and carousels

- 33% of e-commerce sites have a homepage carousel and 46% of those have usability issues. Auto-rotating carousels get more clicks (Baymard cites 8 to 10% versus 1 to 2% for manual), but only if: slides stay 5 to 7 seconds (up to 10 for text-heavy), rotation pauses on hover, and it stops permanently after any interaction. On mobile, turn auto-rotation off. WCAG 2.2.2 also requires a visible pause control for anything that moves for more than 5 seconds.
- Better default: stacked, dedicated homepage sections (category tiles, deals rail, recently viewed, curated collections) with a single static hero.
- Never bake text into hero images. Use live text over a scrim or beside the image so it can be translated, read by screen readers, and stay sharp.

### 1.5 Product listing and product cards

- Baymard: 64% of sites fail to display list item attributes adequately, which causes abandonment. Key principles: include category-specific attributes consistently across all items in a list (for example RAM and storage for phones, fabric for apparel), make each information element visually distinct, label numeric specs with units, keep prices scannable, show essential variations (color swatches) and accurate availability.
- 58% of desktop and 78% of mobile sites are "mediocre to poor" on product list UX.
- Filters: show an overview of applied filters (28% of sites do not). Horizontal filter bars suit up to 6 to 8 filter types; beyond that a vertical panel is needed. On mobile, minimize round trips between the list and the filter sheet (show live result counts on the Apply button).
- Image thumbnails: in the product list, additional images (hover swap on desktop, swipeable on mobile) help evaluation; on mobile PDPs use thumbnails, not just dots (76% of mobile sites use only dots and users miss images).

### 1.6 Price, M.R.P. and discount display in India

Regulation (binding):

- Legal Metrology (Packaged Commodities) Rules apply to e-commerce since January 2018: the platform must display the declarations required under Rule 6(1) on the listing, including name and address of manufacturer/packer/importer, generic name, net quantity, retail sale price in the form "MRP (inclusive of all taxes)", consumer care details and country of origin for imports. Dual MRP on identical goods is prohibited.
- Consumer Protection (E-Commerce) Rules, 2020: display total price with a break-up of other charges, seller name, address and helpline, country of origin, and return, refund, exchange, warranty, delivery and shipment terms.
- CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 (in force from 30 November 2023) list 13 patterns including false urgency, basket sneaking, drip pricing, confirm shaming, forced action, subscription trap, interface interference, bait and switch, disguised advertisement and nagging. On 5 June 2025 the CCPA advised all e-commerce platforms to self-audit for dark patterns within three months and submit self-declarations.

Observed conventions (verify against live sites):

| Site | Listing / PDP price pattern |
|---|---|
| Amazon.in | Savings as a negative percentage next to the price ("-35%"), large price, "M.R.P.: ₹1,999" struck through below, "Inclusive of all taxes" under the price on the PDP. |
| Flipkart | Bold price, struck M.R.P. in gray, "35% off" in green on the same line; "Special price" label in green for time-bound prices. |
| Myntra | Price, struck M.R.P., "(35% OFF)" in orange; "inclusive of all taxes" in green on the PDP. |
| Nykaa | "MRP: ₹1,999" struck, selling price, "35% Off" in green. |

Usability research (Baymard): make the price large and bold, keep original and sale price adjacent with the original struck through, place all discount messaging next to the price in the buy section, mention a discount only once per page, and show both absolute and relative savings where space allows. 18% of desktop sites make the price unnecessarily hard to find.

Rupee formatting: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` produces Indian digit grouping. Verified output in Node: `₹1,23,456.50`; with `maximumFractionDigits: 0`: `₹12,34,567`; with `notation: 'compact'`: `₹1.2Cr` and `₹2.5L`.

### 1.7 Ratings and reviews

- 95% of test users relied on reviews. The rating distribution summary (5 bars) was the most used feature of the review section, yet 43% of top sites lack it.
- 90% of users tried to click the bars to filter by star rating; only 61% of sites support it. Requirements: graphical bars, clickable bars acting as mutually exclusive filters (radio logic), expanded by default, hidden when there are 5 or fewer ratings.
- Respond to negative reviews with visually distinct seller or brand replies (89% of sites do not respond).
- Review list: rating, title, verified purchase marker, variant purchased (size, color), date, helpful votes, customer photos. Offer sort by "Most helpful" and "Most recent" and a "with photos" filter.

### 1.8 Badges, deal timers and urgency (and the law)

- Badges must be few and mutually exclusive on a card (one marketing badge maximum). Typical set: Deal, Bestseller, New, BluBuy brand program badge.
- Countdown timers are legal only for real deadlines. False urgency (fake timers that reset, invented "X people are viewing") is a listed dark pattern. "Only 3 left" must reflect real inventory.
- Ads in results must carry a clear "Sponsored" label (disguised advertisement is a listed dark pattern).
- Nothing may be added to the cart by default (basket sneaking: insurance, donations, extended warranty must be opt-in).
- Fees must not appear for the first time at payment (drip pricing): delivery, COD and platform fees are shown from the cart onward.

### 1.9 Product detail page (PDP)

- Baymard 2026 product page benchmark: 52% of desktop sites, 62% of mobile sites and 64% of apps are mediocre or worse. 57% still use dropdowns for size selection (use buttons), 67% show no total cost estimate near the buy button, 44% never surface the return policy from the product page. About 20% of cart abandonments are attributed to insufficient product information.
- 64% of shoppers look for a delivery date on the product page before adding to cart. Show "Delivery by Fri, 9 Oct" for the user's pincode, with a cutoff ("Order within 2 hrs 13 mins") only when real.
- Desktop layout pattern shared by Amazon, Flipkart and Apple: gallery left (about 55 to 60%), buy box right; the buy box sticks while the long description scrolls. Mobile: gallery first, then title, rating, price, variants, delivery, and a sticky bottom bar with Add to Cart and Buy Now.
- Mandatory listing data (section 1.6) lives in a "Product details" and "Seller and legal information" section, never hidden behind a click-only modal.

### 1.10 Cart and checkout (Baymard)

| Finding | Number |
|---|---|
| Average documented cart abandonment rate | 70.22% (Sept 2025) |
| Abandon because extra costs (shipping, tax, fees) too high | 48% (2025 survey), 39% in the cart abandonment article |
| Abandon because account creation required | 26% (2024/2025 survey) |
| Abandon because checkout too long or complicated | 22% |
| Abandon because delivery too slow | 21% |
| Average checkout form fields | 14.88, versus 7 to 8 needed |
| Conversion gain possible from better checkout design | 35.26% |
| Sites that fail to make guest checkout the most prominent option | 62% |
| Sites that do not show actual delivery dates in checkout | 48% |
| Sites that do not mark both required and optional fields | 61% |
| Sites without adaptive, specific error messages | 94% |
| Sites that do not explain why the phone number is required | 49% |
| Sites without +/- quantity buttons in the cart | 97% |
| Mobile sites without postal code autodetection of city/state | 28% |

Implications for BluBuy:

- Login by mobile number and OTP is the India default and doubles as a light "guest" path: no password, no forced account form. Accessible Authentication (WCAG 3.3.8) means OTP fields must accept paste and autofill (`autocomplete="one-time-code"`).
- Pincode autofills city and state (Baymard "zip code autodetection").
- Show the full cost (items, delivery, COD fee, platform fee, discounts) in the cart, not just at payment.
- Enclosed checkout: remove the main site navigation, keep the logo and a "Secure checkout" label.
- India payments: UPI is the default digital rail (about 81 to 85% of retail digital payments), while cash on delivery still accounts for an estimated 60 to 65% of e-commerce orders (higher in Tier 2 and 3 cities). Show UPI first, then cards, net banking, EMI, wallets and COD (with its fee shown upfront).

### 1.11 Trust signals

- Real, specific statements beat seals: "7-day replacement", "Cash on delivery available", "Sold by Ravi Electronics (4.6, 12,345 ratings)", "GST invoice available", "Secure payments by RBI-regulated gateways".
- Seller identity is a legal requirement and a trust signal: name, location and rating near the buy box.
- Consistent help location (WCAG 3.2.6): "Help" in the same place in the header and footer on every page, and in the order detail page.

## 2. Dashboard design (Seller, Admin, Logistics, Support)

### 2.1 What the leaders do well

| System | Lessons for BluBuy |
|---|---|
| Shopify Polaris | Token architecture (primitive and semantic), a 4 px space scale named by multiplier (space-100 = 4 px, space-400 = 16 px), badge tones (neutral, info, success, caution, warning, critical) with short one or two word labels, shadow tokens split into elevation, inset and bevel. Cards on a light gray canvas. |
| Stripe Dashboard | Minimal chrome, KPI-first overview, compact sortable and filterable tables, context-aware money formatting, a color system built in a perceptually uniform space (CIELAB) with rules like "text must be at least 5 levels apart from its background". |
| Linear | 2024 and 2026 refreshes: dimmer navigation sidebar so the content area dominates; consistent headers and view controls across pages; colors generated in LCH from three inputs (base, accent, contrast); Inter Display for headings and Inter for body; aligned icons and labels to reduce perceived clutter. |
| Vercel Geist | High-contrast gray scale, one blue for actions, tight negative tracking at display sizes, Geist Mono for technical labels, materials as presets (radius, fill, stroke, shadow). |
| Amazon Seller Central | 2025 homepage redesign: account health and a simplified action center first, clickable KPIs, a business performance chart, top products on the home page, customizable layout. |
| Flipkart Seller Hub | Mobile parity for sellers: orders, returns, payments, listings and stock updates in a few taps. |
| Atlassian | Lozenges for status: subtle (tinted background, colored text) by default, bold (solid) sparingly. Jira mapped phases to color: new (blue-gray), in progress (blue), done (green). |
| IBM Carbon | Data table rules: 5 row heights (24, 32, 40, 48, 64 px), toolbar and batch action bar heights match the row height, toolbar holds max 5 actions with the rest in overflow, sortable headers, pagination at the bottom, zebra stripes optional for dense scanning, expandable rows. Charts: a 14-color categorical sequence ordered for neighbor contrast, monochrome sequential palettes, diverging palettes, and a separate alert palette. |

### 2.2 Sidebar navigation

- Grouped vertical sidebar (240 to 260 px expanded, 64 px collapsed rail), section labels in small text, 32 to 36 px item height, 20 px icons aligned on one column, active item shown by a tinted background plus a brand-colored icon (not a heavy solid fill).
- Linear's lesson: the sidebar should be a few notches quieter than the content.
- Workspace or store switcher at the top (sellers with multiple stores; admins switching environment), user menu and help at the bottom.
- Badges with counts on items that represent work queues ("Pending orders 12").

### 2.3 KPI stat cards

- One metric per card: plain label, value, comparison (delta versus previous period), optional sparkline. The KPI row carries the heaviest visual weight on the overview page.
- Make KPIs clickable through to the filtered list or report (Amazon's 2025 Seller Central change).
- Color the delta by meaning, not direction: a rising return rate is bad even though it goes up.

### 2.4 Tables

- Density is a user setting in operations consoles: Carbon heights 32 (compact), 40 (default), 48 (comfortable).
- Sticky header and first column on wide tables, right-aligned numbers with tabular figures, status pills in a dedicated column, row hover background, checkbox column for bulk selection, and a batch action bar that replaces the toolbar while rows are selected.
- Filters as a toolbar row above the table: search, quick filter chips with counts (for example "To ship 34", "Overdue 5"), "More filters" panel, saved views.
- Pagination with page size selector for operational lists (predictable, shareable URLs) rather than infinite scroll.

### 2.5 Empty states, loading and onboarding

- Empty states explain what will appear, why it is empty (no data versus no permission versus filtered out) and the next action. Size them to the container: in small cards use text only.
- Nielsen Norman Group: show a progress indicator for anything over about 1 second; skeleton screens suit content-heavy views (lists, dashboards, search results) in familiar layouts; spinners are fine for short operations; avoid skeletons for loads under 1 second.
- Seller onboarding checklist (KYC, GST, bank account, pickup address, first listing, first shipment) as a persistent card on the home page until complete, with progress ("3 of 6 done").

### 2.6 Notification and action center

- Separate "action items" (things the user must do, with deadlines: orders to dispatch by 6 pm, returns to review, KYC documents) from "notifications" (FYI updates). Amazon's action center prioritizes alerts by urgency and links straight to the task.
- Action items show count, deadline and a direct action button; notifications show unread state and are dismissible.

## 3. Typography, color and spacing research

### 3.1 Font audit (verified from font files)

The font files were downloaded from github.com/google/fonts and inspected with fontTools for the Indian rupee sign (U+20B9), tabular figures (`tnum`) and axes.

| Family (Google Fonts) | ₹ glyph | tnum | Axes | Verdict |
|---|---|---|---|---|
| Inter | Yes | Yes | opsz 14 to 32, wght 100 to 900 | Recommended UI and body face. The opsz axis gives Inter Display shapes at large sizes. 2,800+ glyphs, 147 languages. |
| Plus Jakarta Sans | Yes | Yes | wght 200 to 800 | Recommended display face. |
| Geist Mono | Yes | No | wght 100 to 900 | Recommended for codes (order IDs, AWB, SKU). |
| Inter Tight | Yes | Yes | wght 100 to 900 | Good alternative display face (single-family look). |
| Geist | Yes | Yes | wght 100 to 900 | Good, but closely associated with Vercel. |
| Manrope | Yes | Yes | wght 200 to 800 | Acceptable alternative display face. |
| Figtree, Public Sans, Schibsted Grotesk, Bricolage Grotesque | Yes | Yes | wght | Acceptable. |
| IBM Plex Sans | Yes | No | wght, wdth | No tabular figures. |
| DM Sans | Yes | No | opsz, wght | No tabular figures. |
| Instrument Sans, Hanken Grotesk, Outfit, Sora, Urbanist, Onest, Zalando Sans | No | Mixed | wght | Rejected: rupee sign would fall back to another font. |
| JetBrains Mono | No | No | wght | Rejected for money contexts. |
| Newsreader (serif) | Yes | Yes | opsz, wght | Optional editorial serif for campaigns only. |
| Noto Sans, Mukta | Yes | Yes | wght | Devanagari coverage for future Hindi UI (use Noto Sans Devanagari or Mukta). |

Important implementation finding: on Google Fonts the ₹ glyph (U+20B9) is in the latin-ext subset (unicode-range U+20AD-20C0), not in latin. With `next/font/google`, include `subsets: ['latin', 'latin-ext']`, otherwise the rupee file is not preloaded and prices can render the rupee sign late or in a fallback font.

### 3.2 Color methodology

- Stripe built its palette in a perceptually uniform space so that equal steps look equal and contrast can be guaranteed by step distance. Linear moved from HSL to LCH for the same reason. BluBuy's ramps were generated in OKLCH (perceptually uniform, CSS-native) and every working pair was then checked with the WCAG formula (section 8.6).
- Restraint is the core of "elegant": one brand hue, one warm accent reserved for commerce moments, a cool near-neutral ink scale, and semantic hues used only for status.

### 3.3 Differentiating "blue" in the Indian market

Flipkart owns a bright azure blue with yellow, Paytm a cyan-blue, PhonePe purple, Amazon black with orange. BluBuy uses a deeper, slightly violet-leaning cobalt (OKLCH hue 264) with a marigold accent. Cobalt plus gold is a classic premium pairing, marigold has strong Indian cultural resonance (festivals, garlands), and both are distinct from Flipkart's azure and yellow.

### 3.4 Spacing

All reference systems (Polaris, Carbon, Material, Tailwind) use a 4 px base with an 8 px rhythm. BluBuy adopts the same so web and Flutter share values exactly (Flutter logical pixels equal CSS pixels at 1x).

## 4. Status color semantics research

- Polaris badge tones: neutral, info, success, caution or attention, warning, critical, with brief labels.
- Atlassian lozenges: subtle style by default, bold style for the one status that must stand out; Jira groups statuses into three phases (to do, in progress, done) each with one color.
- Carbon alert palette: red (danger/error), orange (serious), yellow (warning), green (success); never reuse alert colors for data series.
- Consensus: status color must be paired with text (and ideally an icon), tones should map to a small set of meanings rather than one color per status, and the meaning should reflect what the viewer must do.

## 5. Accessibility and regulation research

- WCAG 2.2 new criteria relevant to BluBuy: 2.4.11 Focus Not Obscured (sticky headers, cookie bars and bottom buy bars must not cover the focused element), 2.5.7 Dragging Movements (every slider or drag-to-reorder needs a non-drag alternative), 2.5.8 Target Size Minimum (24 by 24 CSS px or sufficient spacing), 3.2.6 Consistent Help, 3.3.7 Redundant Entry (do not ask for the same address twice; "billing same as shipping" by default), 3.3.8 Accessible Authentication (no cognitive tests; allow paste and password managers; OTP autofill).
- India: the Rights of Persons with Disabilities Act, 2016 (sections 40 and 42) puts ICT in scope, and IS 17802 (Parts 1 and 2) is the Indian ICT accessibility standard, aligned with WCAG 2.1 and EN 301 549, applicable to public and private establishments. Designing to WCAG 2.2 AA covers it.

## 6. Responsive, mobile-first and Flutter research

- Indian traffic is overwhelmingly mobile and often on mid or low-end Android devices: design at 360 px wide first, keep JavaScript and image weight low, avoid layout shift around prices and buttons.
- Baymard 2024 mobile study: 67% of mobile sites have tap target or navigation accessibility issues.
- Flutter Material 3 provides `ColorScheme` roles (primary, onPrimary, primaryContainer, secondary, tertiary, error, surface, onSurface, surfaceContainerLowest to surfaceContainerHighest, outline, outlineVariant, inverseSurface) and `ThemeExtension` for custom tokens (status colors, accent, spacing). Lucide is available for Flutter (`lucide_icons_flutter`, MIT, with stroke weight variants), so the icon language is shared across platforms.

---

# Part B: BluBuy Design System v1

## 7. Design principles and the 10 rules

Principles:

1. Quiet frame, loud product. Chrome is white, ink and hairlines; color and imagery belong to products, prices and the primary action.
2. Honest commerce. Every price, timer, stock count and fee is real, complete and shown early. BluBuy treats the CCPA dark pattern list as a design checklist.
3. Hierarchy through type and space, not boxes and color.
4. One system, many densities. The storefront breathes; the consoles are dense; both use the same tokens.
5. Built for the next billion. 360 px first, readable at arm's length on a budget phone, fast on 4G.

The 10 rules:

1. One primary action per view. Blue (`blu-600`) is for primary actions and links; marigold is reserved for Buy Now and genuine deals; status colors are never decorative.
2. Hairlines before shadows. Resting surfaces use a 1 px `#E3E6EC` border and no shadow. Shadows only for things that float (menus, popovers, dialogs, sticky bars).
3. The price block is sacred: ₹ with Indian grouping, selling price largest, M.R.P. struck through, "% off" in green (rounded down), "Inclusive of all taxes" on the PDP, and the full cost (delivery, COD and platform fees) visible from the cart onward.
4. Promise dates, not speeds: "Delivery by Fri, 9 Oct" for the user's pincode on cards, PDP, cart and checkout.
5. No dark patterns: timers only for real deadlines, scarcity only when true, nothing pre-ticked, ads labeled "Sponsored", no confirm shaming, OTP login instead of forced sign-up, COD and UPI clearly offered.
6. Two typefaces only: Plus Jakarta Sans for display and page headings, Inter for everything else. Tabular figures for numbers in tables and price columns; numbers right-aligned in tables.
7. 4 px grid everywhere. Storefront sections 48 to 80 px apart; console tables default to 40 px rows.
8. Status equals color plus icon plus words, using one tone map (neutral, info, success, warning, danger, highlight) across every console. Warning means "you need to act".
9. WCAG 2.2 AA is the floor: 4.5:1 text, 3:1 component boundaries and icons, 24 px minimum targets (44 px on touch for primary controls), a visible 2 px focus ring never hidden by sticky bars, reduced motion respected.
10. Tokens first: every color, size, radius, shadow and duration comes from a named token, with identical names in CSS variables and the Flutter ThemeExtension. Icons are lucide only, never emojis.

## 8. Color tokens

### 8.1 Primitive ramps

Ratios are WCAG contrast against white (#FFFFFF).

Blu (brand, cobalt, OKLCH hue 264)

| Token | Hex | vs white | Typical use |
|---|---|---|---|
| blu-50 | #F2F7FF | 1.08 | Info and selected backgrounds |
| blu-100 | #E2EDFF | 1.18 | Hover on selected, chips |
| blu-200 | #C5DBFF | 1.40 | Info border, progress track |
| blu-300 | #98BDFF | 1.90 | Dark-mode link, illustrations |
| blu-400 | #6193FF | 2.95 | Dark-mode accents, chart ramp start |
| blu-500 | #3A70F3 | 4.38 | Large text and icons only |
| blu-600 | #2358E0 | 5.93 | PRIMARY: buttons, links, focus ring |
| blu-700 | #1A48BC | 7.79 | Primary hover, info text |
| blu-800 | #163A95 | 10.13 | Primary pressed |
| blu-900 | #112C6F | 13.01 | Brand dark surfaces (footer, hero) |
| blu-950 | #0A1B43 | 16.79 | Deepest brand surface |

Ink (cool neutral, OKLCH hue 262, very low chroma)

| Token | Hex | vs white | Typical use |
|---|---|---|---|
| ink-0 | #FFFFFF | 1.00 | Surface |
| ink-25 | #FBFCFD | 1.03 | Subtle alternate rows |
| ink-50 | #F7F8FB | 1.06 | Dashboard canvas, image wells, section bands |
| ink-100 | #F0F2F7 | 1.12 | Hover, table header, neutral pill bg |
| ink-200 | #E3E6EC | 1.25 | Hairline borders and dividers |
| ink-300 | #CED3DB | 1.50 | Strong borders, secondary button border |
| ink-400 | #A5ABB5 | 2.31 | Disabled text, decorative icons |
| ink-500 | #898F9B | 3.25 | Input borders, meaningful icons (3:1) |
| ink-600 | #6B727E | 4.85 | Tertiary text, placeholders, captions |
| ink-700 | #5A616D | 6.24 | Secondary text |
| ink-800 | #434955 | 9.04 | Strong secondary text, neutral pill text |
| ink-850 | #2C323C | 12.89 | Dark-mode hairline |
| ink-900 | #181C23 | 17.08 | Primary text, inverse surfaces |
| ink-925 | #12161D | 18.13 | Dark-mode surface |
| ink-950 | #0A0D13 | 19.45 | Dark-mode canvas, text on accent |

Marigold (commerce accent, OKLCH hue 72)

| Token | Hex | vs white | Typical use |
|---|---|---|---|
| marigold-50 | #FFF8E8 | 1.06 | Deal strip background |
| marigold-100 | #FFEAC5 | 1.18 | Deal badge background |
| marigold-200 | #FFD78F | 1.37 | Deal border |
| marigold-300 | #FFC357 | 1.59 | Dark-mode accent |
| marigold-400 | #FFB330 | 1.79 | ACCENT: Buy Now button (with ink-950 text) |
| marigold-500 | #FAA617 | 1.99 | Accent hover, rating stars |
| marigold-600 | #D78C00 | 2.75 | Accent pressed |
| marigold-700 | #9A6000 | 5.19 | Deal text on white |
| marigold-800 | #7D5002 | 6.95 | Deal text, strong |
| marigold-900 | #5C3A02 | 10.19 | Text on marigold-100 |

Semantic hues

| Token | Green (success) | Amber (warning) | Red (danger) | Violet (highlight) |
|---|---|---|---|---|
| 50 | #EAFCF0 | #FFF5E9 | #FFF2F1 | #F7F5FF |
| 100 | #D4F7DE | #FFE6CC | #FFE2DE | #EDE6FF |
| 200 | #ABEDC1 | #FFCD9E | #FFC7C0 | #DCD0FF |
| 300 | #72D699 | #FFB474 | #F69B94 | #BCA9F7 |
| 400 | #43C07A | #F79645 | #F2716A | #A689F1 |
| 500 | #0FA05C | #E87F25 | #E64343 | #8A63DE |
| 600 | #048149 (4.95) | #C26300 (4.13) | #CC272E (5.39) | #7447C8 (6.04) |
| 700 | #0A693C (6.78) | #9D4D00 (6.01) | #A92227 (7.13) | #5F38A7 (8.05) |
| 800 | #07502C (9.58) | #753B07 (8.80) | #7F2021 (9.85) | n/a |

Amber (warning) is deliberately more orange than marigold (accent) so a warning never reads as a deal. Accent is never used for status.

### 8.2 Semantic tokens, light theme (default for all surfaces)

Backgrounds and surfaces

| Token | Value | Use |
|---|---|---|
| bg-canvas | #FFFFFF storefront, #F7F8FB consoles | Page background |
| bg-surface | #FFFFFF | Cards, panels, tables, dialogs |
| bg-subtle | #F7F8FB | Image wells, section bands, sidebar |
| bg-muted | #F0F2F7 | Hover, table header, pressed ghost |
| bg-selected | #F2F7FF | Selected row, selected chip |
| bg-inverse | #181C23 | Tooltips, toasts |
| bg-brand | #2358E0 | Primary button |
| bg-brand-hover | #1A48BC | |
| bg-brand-pressed | #163A95 | |
| bg-accent | #FFB330 | Buy Now |
| bg-accent-hover | #FAA617 | |
| bg-accent-pressed | #D78C00 | |
| bg-accent-subtle | #FFF8E8 | Deal strip |
| bg-danger | #CC272E | Destructive button |
| bg-danger-hover | #A92227 | |
| bg-scrim | rgba(10, 13, 19, 0.48) | Modal and drawer overlay |

Text and icons

| Token | Value | Contrast on white | Use |
|---|---|---|---|
| text-primary | #181C23 | 17.08 | Body, titles, prices |
| text-secondary | #5A616D | 6.24 | Meta, labels, helper text |
| text-tertiary | #6B727E | 4.85 | Placeholders, captions, struck M.R.P. (not on bg-muted, see 8.6) |
| text-disabled | #A5ABB5 | 2.31 | Disabled controls only (exempt) |
| text-inverse | #FFFFFF | n/a | On bg-brand, bg-inverse, bg-danger |
| text-on-accent | #0A0D13 | 10.87 on #FFB330 | Buy Now label |
| text-link | #2358E0 | 5.93 | Links (underline on hover; always underlined in body copy) |
| text-link-hover | #1A48BC | 7.79 | |
| text-savings | #0A693C | 6.78 | "35% off", "You save ₹700" |
| text-deal | #9A6000 | 5.19 | "Deal of the day" text on white |
| icon-default | #5A616D | 6.24 | Standard icons |
| icon-subtle | #898F9B | 3.25 | Secondary icons (meets 3:1) |
| icon-brand | #2358E0 | 5.93 | Active nav icon |
| rating-star | #FAA617 | decorative | Star fill (the numeric rating carries the meaning) |

Borders

| Token | Value | Use |
|---|---|---|
| border-subtle | #F0F2F7 | Inner dividers inside a card |
| border-default | #E3E6EC | Hairline: cards, tables, header bottom |
| border-strong | #CED3DB | Secondary button, hovered card |
| border-input | #898F9B | Text inputs, checkboxes, radios (3.25:1, meets 1.4.11) |
| border-focus | #2358E0 | Focus ring color |
| border-brand | #2358E0 | Selected variant chip |
| border-danger | #CC272E | Invalid input |

Status tones (used by pills, banners, toasts, timeline icons)

| Tone | bg | fg (text) | border | icon / solid | fg on bg |
|---|---|---|---|---|---|
| neutral | #F0F2F7 | #434955 | #E3E6EC | #6B727E | 8.07 |
| info | #F2F7FF | #1A48BC | #C5DBFF | #2358E0 | 7.24 |
| success | #EAFCF0 | #0A693C | #ABEDC1 | #048149 | 6.35 |
| warning | #FFF5E9 | #9D4D00 | #FFCD9E | #C26300 | 5.58 |
| danger | #FFF2F1 | #A92227 | #FFC7C0 | #CC272E | 6.53 |
| highlight | #F7F5FF | #5F38A7 | #DCD0FF | #7447C8 | 7.46 |

Rule: white text is allowed on solid info (#2358E0), success (#048149, 4.95) and danger (#CC272E) only. Warning never uses a solid fill with white text (#C26300 gives 4.13, below AA); warning banners always use the subtle style.

### 8.3 Semantic tokens, dark theme (consoles, optional at v1; storefront stays light at v1)

| Token | Value | Notes |
|---|---|---|
| bg-canvas | #0A0D13 | |
| bg-surface | #12161D | Cards, tables |
| bg-raised | #181C23 | Menus, popovers, dialogs (elevation by lightness, not shadow) |
| bg-muted | #2C323C | Hover, table header |
| bg-selected | rgba(97, 147, 255, 0.14) | |
| text-primary | #F7F8FB | 17.07 on surface |
| text-secondary | #CED3DB | 12.06 on surface |
| text-tertiary | #898F9B | 5.58 on surface |
| text-link | #98BDFF | 9.55 on surface |
| border-default | #2C323C | Hairline |
| border-strong | #434955 | |
| border-input | #6B727E | 3.74 on surface |
| bg-brand | #2358E0 | White text 5.93 (same as light) |
| bg-accent | #FFB330 | ink-950 text |
| status fg | success #43C07A, warning #F79645, danger #F2716A, info #6193FF, highlight #A689F1, neutral #CED3DB | All 5.9:1 or more on #181C23 |
| status bg | the same hue at 14% alpha over surface | |

### 8.4 Data visualization palette

Validated with a color-vision-deficiency palette validator (OKLab Delta E x 100, Machado-Oliveira-Fernandes 2009 protanopia and deuteranopia simulation; targets: adjacent CVD Delta E of 8 or more, normal-vision Delta E of 15 or more). Light results: worst adjacent CVD Delta E 12.2, normal-vision 18.3, first three slots pass all-pairs (CVD 12.2). Dark results: worst adjacent CVD 11.7, normal-vision 16.2, all eight 3:1 or more on #181C23.

| Slot | Hue | Light (on #FFFFFF) | Dark (on #181C23) |
|---|---|---|---|
| 1 | Blue (brand) | #2358E0 | #497EF7 |
| 2 | Teal | #009D90 | #00A396 |
| 3 | Orange | #E4762C | #E07227 |
| 4 | Magenta | #D14186 | #DB5392 |
| 5 | Gold | #DD9314 | #C38700 |
| 6 | Red | #D33A3C | #CC3143 |
| 7 | Violet | #7C54CD | #8F6CE0 |
| 8 | Green | #1C8742 | #2E9E52 |

- Assign slots in this fixed order, never cycled. A 9th series folds into "Other". Color follows the entity (a filter must not repaint survivors).
- Slot 5 gold is 2.54:1 on white: charts that reach slot 5 must have direct labels or a table view.
- Scatter, maps and small multiples: max 3 series (slots 1 to 3).
- Sequential (one hue): blu-400 #6193FF, blu-500 #3A70F3, blu-600 #2358E0, blu-700 #1A48BC, blu-800 #163A95, blu-900 #112C6F (validated as an ordinal ramp: monotone, light end 2.95:1). Heatmaps may start lighter (blu-100) when "near zero" is meant to recede.
- Diverging: blue arm (blu ramp) and red arm (red ramp) with a neutral gray midpoint #F0F2F7 (light) or #2C323C (dark). Never a hue at the midpoint.
- Status in charts (SLA met or breached, pass or fail) uses status tokens with icon and label, never categorical slots.

### 8.5 Brand usage

- Logo wordmark in blu-600 on white or white on blu-900. The marigold accent may appear in the logo mark as a single detail, never as a large field.
- Ratio guideline for any screen: about 90% neutrals (white, ink), 8% blue, 2% marigold.

### 8.6 Contrast verification (computed)

| Pair | Ratio | Result |
|---|---|---|
| text-primary #181C23 on #FFFFFF | 17.08 | AAA |
| text-secondary #5A616D on #FFFFFF / on #F7F8FB / on #F0F2F7 | 6.24 / 5.88 / 5.57 | AA |
| text-tertiary #6B727E on #FFFFFF / on #F7F8FB | 4.85 / 4.56 | AA |
| text-tertiary #6B727E on #F0F2F7 | 4.33 | Fails: use text-secondary on bg-muted |
| white on blu-600 #2358E0 | 5.93 | AA |
| link #2358E0 on #F7F8FB / on #F2F7FF | 5.58 / 5.51 | AA |
| ink-950 on marigold-400 #FFB330 | 10.87 | AAA |
| ink-950 on marigold-600 #D78C00 (pressed) | 7.08 | AAA |
| marigold-700 #9A6000 on white / on #FFF8E8 | 5.19 / 4.90 | AA |
| savings #0A693C on white | 6.78 | AA |
| white on success #048149 | 4.95 | AA |
| white on danger #CC272E | 5.39 | AA |
| border-input #898F9B on white | 3.25 | Meets 1.4.11 (3:1) |
| focus ring #2358E0 on white | 5.93 | Meets 2.4.13 contrast (3:1) |
| dark text #F7F8FB on #12161D | 17.07 | AAA |
| dark link #98BDFF on #12161D | 9.55 | AAA |
| dark input border #6B727E on #12161D | 3.74 | Meets 3:1 |

## 9. Typography tokens

### 9.1 Font families

| Role | Family | Source | Weights used | Why |
|---|---|---|---|---|
| Display and headings (H1 to H3, hero, page titles, section titles) | Plus Jakarta Sans | Google Fonts, next/font `Plus_Jakarta_Sans` | 600, 700 | Modern geometric grotesque with open, slightly wide forms: friendly and premium at large sizes, distinct from Inter so the pairing has contrast. Has ₹ and tabular figures (verified). Variable font, one file. |
| UI, body, labels, prices, numbers | Inter (variable, with opsz) | Google Fonts, next/font `Inter` | 400, 500, 600 | Designed for screens: tall x-height, ink traps, optical size axis, `tnum`, `zero`, `case`, 147 languages, ₹ glyph (verified). The most legible choice for dense consoles and small mobile text. |
| Codes and identifiers | Geist Mono | Google Fonts, next/font `Geist_Mono` | 400, 500 | For order IDs, AWB numbers, SKUs, API keys. Has ₹. Never for prices (prices use Inter with tnum). |
| Future Hindi and regional UI | Noto Sans Devanagari (and other Noto Indic families) | Google Fonts | 400, 500, 600 | Wide script coverage and matching metrics; add per locale. |

Fallback stacks:

- `--font-display: "Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- `--font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`
- `--font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`

Loading (Next.js):

```ts
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';

// latin-ext is required: the rupee sign U+20B9 lives in the latin-ext subset on Google Fonts.
export const fontSans = Inter({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], display: 'swap', variable: '--font-sans' });
export const fontDisplay = Plus_Jakarta_Sans({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-display' });
export const fontMono = Geist_Mono({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-mono' });
```

Global OpenType settings: `font-feature-settings: "cv11" 1` is optional (single-storey a in Inter, softer look; decide in visual QA). Tables, price columns and timers use `font-variant-numeric: tabular-nums`. Large standalone figures (stat card values, PDP price) keep proportional figures.

### 9.2 Type scale

Sizes in px (use rem in CSS, base 16). Line heights are multiples of 4. Mobile values apply below 768 px.

| Token | Family | Desktop size / line | Mobile size / line | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| display-xl | Jakarta | 56 / 64 | 36 / 44 | 700 | -0.02em | Campaign hero only |
| display-lg | Jakarta | 44 / 52 | 32 / 40 | 700 | -0.02em | Landing headers, sale event titles |
| heading-1 | Jakarta | 32 / 40 | 26 / 34 | 700 | -0.015em | Page title (storefront), PDP product title uses heading-3 |
| heading-2 | Jakarta | 26 / 34 | 22 / 30 | 600 | -0.01em | Section titles ("Deals for you") |
| heading-3 | Jakarta | 22 / 30 | 20 / 28 | 600 | -0.005em | PDP title, dashboard page title, dialog title |
| heading-4 | Inter | 18 / 26 | 17 / 24 | 600 | 0 | Card titles, panel titles |
| heading-5 | Inter | 16 / 24 | 16 / 24 | 600 | 0 | Sub-sections, table group headers |
| body-lg | Inter | 18 / 28 | 16 / 26 | 400 | 0 | Product description, editorial |
| body-md | Inter | 16 / 24 | 15 / 22 | 400 | 0 | Default storefront text |
| body-sm | Inter | 14 / 20 | 14 / 20 | 400 | 0 | Default console text, card meta, table cells |
| caption | Inter | 12 / 16 | 12 / 16 | 500 | 0.01em | Helper text, timestamps, footnotes |
| overline | Inter | 12 / 16 | 12 / 16 | 600 | 0.06em, uppercase | Sidebar section labels only |
| label-lg | Inter | 16 / 24 | 16 / 24 | 600 | 0 | Large buttons (48 px) |
| label-md | Inter | 14 / 20 | 14 / 20 | 500 | 0 | Buttons, tabs, form labels |
| label-sm | Inter | 12 / 16 | 12 / 16 | 500 | 0.01em | Pills, badges, small buttons |
| price-xl | Inter | 32 / 40 | 28 / 36 | 600 | -0.01em | PDP selling price |
| price-lg | Inter | 20 / 28 | 18 / 24 | 600 | 0 | Product card price (desktop), cart total |
| price-md | Inter | 16 / 24 | 16 / 24 | 600 | 0 | Product card price (mobile), cart line |
| metric-lg | Inter | 30 / 38 | 26 / 34 | 600 | -0.01em | Stat card value |
| metric-md | Inter | 20 / 28 | 20 / 28 | 600 | 0 | Secondary KPI, table summary row |
| code | Geist Mono | 13 / 20 | 13 / 20 | 400 | 0 | IDs, AWB, SKU |

Typography rules:

- Minimum text size 12 px anywhere; minimum 16 px for text inputs on mobile (prevents iOS zoom on focus).
- Sentence case for all headings, buttons and labels ("Add to cart", not "ADD TO CART"). Uppercase is only for overline labels.
- Max 3 type sizes inside any one component. Weight contrast (400 vs 600) before size contrast.
- Measure (line length) 60 to 75 characters for long text (PDP description max-width 720 px).
- Product titles clamp to 2 lines on cards, never truncated on the PDP.

## 10. Spacing, layout grid and breakpoints

### 10.1 Spacing scale (4 px base)

| Token | px | Typical use |
|---|---|---|
| space-0 | 0 | |
| space-0.5 | 2 | Icon-to-text optical nudge, pill inner gap |
| space-1 | 4 | Tight inline gaps |
| space-1.5 | 6 | Pill padding y |
| space-2 | 8 | Icon-to-label gap, compact stacks |
| space-3 | 12 | Input padding x, card inner gaps on mobile |
| space-4 | 16 | Card padding (mobile), mobile page gutter, default stack gap |
| space-5 | 20 | Card padding (console) |
| space-6 | 24 | Card padding (storefront desktop), grid gutter |
| space-8 | 32 | Desktop page gutter, between card groups |
| space-10 | 40 | Section gap (console) |
| space-12 | 48 | Section gap (storefront mobile) |
| space-16 | 64 | Section gap (storefront desktop) |
| space-20 | 80 | Hero padding, major section breaks |
| space-24 | 96 | Campaign pages |
| space-32 | 128 | Rare, editorial |

Names match Tailwind's numeric scale (1 unit = 4 px), so `p-4` equals space-4.

### 10.2 Breakpoints and grid

| Name | Min width | Columns | Gutter | Side margin | Notes |
|---|---|---|---|---|---|
| xs (base) | 0 | 4 | 12 | 16 | Design at 360 px |
| sm | 480 | 4 | 16 | 16 | Large phones |
| md | 768 | 8 | 24 | 24 | Tablets, console sidebar becomes a rail |
| lg | 1024 | 12 | 24 | 32 | Laptops, console sidebar expanded |
| xl | 1280 | 12 | 24 | 32 | Desktop |
| 2xl | 1536 | 12 | 32 | 40 | Wide |

Max content widths: storefront 1440 px (homepage rails, PLP), PDP 1280 px, cart and checkout 1080 px, account area 1080 px, console content fluid with readable forms max 720 px and detail pages max 1280 px.

Product grid columns: 2 (xs, sm), 3 (md), 4 (lg with filter sidebar), 5 (xl and up with filter sidebar), 6 (2xl without sidebar, e.g. homepage rails).

## 11. Radius, borders, elevation

### 11.1 Radius

| Token | px | Use |
|---|---|---|
| radius-none | 0 | Full-bleed images, tables inside cards |
| radius-xs | 4 | Checkboxes, small tags, tooltips |
| radius-sm | 6 | Chips, small buttons (32 px), inputs in dense tables |
| radius-md | 8 | Buttons, inputs, selects, segmented controls, menu items |
| radius-lg | 12 | Cards, product image wells, popovers, dropdown menus |
| radius-xl | 16 | Dialogs, large promo tiles, hero media |
| radius-2xl | 24 | Mobile bottom sheets (top corners only) |
| radius-full | 9999 | Pills, avatars, status pills, rating pill, icon-only round buttons |

Nested rule: inner radius = outer radius minus padding (a 12 px card with 4 px inset image uses 8 px on the image).

### 11.2 Borders

- Width: 1 px everywhere; 2 px only for focus rings and the selected variant chip.
- Hairline color border-default #E3E6EC for cards, header bottom, table row dividers, section dividers.
- Inputs use border-input #898F9B (needed for 3:1 boundary contrast). On hover border-strong is too light for inputs, so input hover darkens to ink-700 #5A616D.

### 11.3 Shadows (elevation)

Shadow color is ink-950 (10, 13, 19) at low opacity, two layers (ambient plus key).

| Token | CSS value | Use |
|---|---|---|
| shadow-none | none | Resting cards (border only) |
| shadow-xs | 0 1px 2px rgba(10, 13, 19, 0.05) | Inputs (optional), sticky header after scroll, segmented control thumb |
| shadow-sm | 0 1px 3px rgba(10, 13, 19, 0.08), 0 1px 2px rgba(10, 13, 19, 0.04) | Raised buttons on images, small floating chips |
| shadow-md | 0 4px 12px -2px rgba(10, 13, 19, 0.08), 0 2px 4px -2px rgba(10, 13, 19, 0.04) | Product card hover (desktop), sticky buy bar |
| shadow-lg | 0 12px 24px -6px rgba(10, 13, 19, 0.12), 0 4px 8px -4px rgba(10, 13, 19, 0.06) | Dropdowns, popovers, mega menu, autocomplete panel |
| shadow-xl | 0 24px 48px -12px rgba(10, 13, 19, 0.18), 0 8px 16px -8px rgba(10, 13, 19, 0.08) | Dialogs, drawers, bottom sheets |
| focus-ring | 0 0 0 2px #FFFFFF, 0 0 0 4px #2358E0 | Keyboard focus (2 px white gap plus 2 px blue ring) |
| focus-ring-danger | 0 0 0 2px #FFFFFF, 0 0 0 4px #CC272E | Focus on invalid input |

Dark theme: replace shadows with surface lightness (bg-raised) plus border-default; keep only shadow-xl for dialogs at doubled opacity.

Z-index scale: base 0, sticky 100 (headers, sticky columns), dropdown 200, sticky-bottom bar 300, drawer 400, modal 500, toast 600, tooltip 700.

## 12. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| motion-instant | 0 ms | n/a | Color change on press for reduced motion |
| motion-fast | 120 ms | standard | Hover and press colors, checkbox ticks |
| motion-base | 200 ms | standard | Dropdown open, tab indicator slide, accordion |
| motion-slow | 300 ms | emphasized-decelerate (enter), emphasized-accelerate (exit, 200 ms) | Drawers, dialogs, bottom sheets |
| motion-slower | 450 ms | emphasized-decelerate | Page-level transitions, skeleton to content cross-fade |

Easing curves (Material 3 values, available in Flutter as `Easing.standard`, `Easing.emphasizedDecelerate`, `Easing.emphasizedAccelerate`):

- standard: cubic-bezier(0.2, 0, 0, 1)
- emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1)
- emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15)

Motion rules:

- Motion explains change (where did the item go: fly-to-cart is not needed; a cart count bump of 120 ms is enough). No decorative looping animation.
- Never animate prices, timers or counts in a way that delays reading the final value.
- `prefers-reduced-motion: reduce`: remove transforms and parallax, keep opacity fades at 120 ms or less, stop carousels.
- Hover lift on product cards is at most translateY(-2px) plus shadow-md; no scale above 1.02 on images.

## 13. Iconography

- Library: lucide (lucide-react on web, `lucide_icons_flutter` in Flutter). All names below exist in lucide-static 1.49.0.
- Sizes: 16 px (dense tables, inline with 12 to 14 px text), 20 px (default UI), 24 px (storefront header, mobile tab bar, empty states use 32 or 40).
- Stroke: 1.75 at 20 and 24 px for a lighter, more elegant line; 2 at 16 px for legibility. Keep stroke consistent within a screen.
- Color: icon-default; brand color only for active navigation and primary inline actions; status icons use the tone icon color.
- Icon-only buttons always have an accessible name (`aria-label`) and a tooltip on desktop.
- Never use emojis as icons, bullets, or status markers. Never mix icon libraries.
- Core set: `search`, `map-pin`, `shopping-cart`, `shopping-bag`, `heart`, `star`, `truck`, `package`, `package-check`, `package-x`, `rotate-ccw`, `undo-2`, `shield-check`, `badge-percent`, `timer`, `wallet`, `banknote`, `landmark`, `bell`, `inbox`, `list-checks`, `store`, `users`, `layout-dashboard`, `chart-column`, `chart-line`, `settings`, `life-buoy`, `headset`, `circle-help`, `sliders-horizontal`, `funnel`, `circle-check`, `circle-x`, `circle-alert`, `triangle-alert`, `info`, `clock`, `hourglass`, `circle-pause`, `calendar-clock`, `warehouse`, `clipboard-check`, `clipboard-list`, `trending-up`, `trending-down`.

## 14. Core components

### 14.1 Buttons

| Size | Height | Padding x | Text | Icon | Radius | Where |
|---|---|---|---|---|---|---|
| sm | 32 | 12 | label-sm 12/16 or label-md | 16 | radius-sm 6 | Table toolbars, dense consoles |
| md | 40 | 16 | label-md 14/20 | 20 | radius-md 8 | Default everywhere |
| lg | 48 | 20 | label-lg 16/24 | 20 | radius-md 8 | Storefront CTAs (Add to cart, Buy Now, Place order), all mobile primary actions |

| Variant | Rest | Hover | Pressed | Text | Use |
|---|---|---|---|---|---|
| Primary | #2358E0 | #1A48BC | #163A95 | #FFFFFF | One per view: Add to cart, Save, Continue |
| Accent (Buy) | #FFB330 | #FAA617 | #D78C00 | #0A0D13 | Buy Now, Grab deal. Storefront only. Never in consoles |
| Secondary | #FFFFFF + 1 px #CED3DB | bg #F7F8FB | bg #F0F2F7 | #181C23 | Secondary actions, Cancel |
| Tertiary (ghost) | transparent | bg #F0F2F7 | bg #E3E6EC | #181C23 or #2358E0 | Toolbar actions, "View all" |
| Destructive | #CC272E | #A92227 | #7F2021 | #FFFFFF | Delete, Cancel order (confirm step only) |
| Destructive secondary | #FFFFFF + 1 px #FFC7C0 | bg #FFF2F1 | bg #FFE2DE | #A92227 | First step of destructive flows |
| Link | none | underline | #163A95 | #2358E0 | Inline actions |

Rules: disabled uses bg #F0F2F7, text #A5ABB5, no border, and a tooltip or helper text explaining why; loading keeps the button width and replaces the label with a spinner plus "Adding" style text for screen readers; never two primary buttons side by side (Add to cart is primary, Buy Now is accent; in consoles the second action is secondary); icon-only buttons 40 x 40 (desktop) and 44 x 44 (touch).

### 14.2 Inputs, selects, checkboxes, radios, switches

- Height 40 (console) or 48 (storefront and mobile), radius-md 8, padding x 12, border-input #898F9B, bg #FFFFFF, text body-md, placeholder text-tertiary.
- States: hover border #5A616D; focus border #2358E0 plus focus-ring; invalid border #CC272E plus message below in #A92227 with `circle-alert` 16 icon; disabled bg #F7F8FB, border #E3E6EC.
- Labels always visible above the field (label-md, text-primary). Never placeholder-only labels. Mark both required and optional ("Optional" in text-secondary next to the label).
- Helper text caption in text-secondary below the field. Error messages are specific ("Enter a 6-digit pincode", not "Invalid input").
- Indian specifics: pincode field numeric (`inputmode="numeric"`, 6 digits) that autofills city and state; mobile number with fixed "+91" prefix segment; OTP input as a single field with `autocomplete="one-time-code"` (visual boxes allowed, but must accept paste); GSTIN uppercase with format hint; state as a searchable select.
- Checkbox and radio: 20 x 20 visual, 40 x 40 hit area, radius-xs for checkbox, checked fill #2358E0 with white tick.
- Switch: 36 x 20 track, only for settings that apply immediately (never in forms with a Save button).
- Variant selectors (size, color, storage) are buttons (chips), never dropdowns: 44 px min height, radius-md, selected state 2 px #2358E0 border plus bg #F2F7FF; unavailable variants struck with a diagonal line and "Notify me" on select.

### 14.3 Cards

- Storefront card: bg-surface, 1 px border-default or no border on white with a subtle image well, radius-lg 12, padding 16 (mobile) or 24 (desktop), no shadow at rest.
- Console card: bg-surface on bg-canvas #F7F8FB, 1 px border-default, radius-lg 12, padding 20, header row (heading-4 title, optional caption, actions on the right as tertiary buttons), content, optional footer link ("View all orders").
- Never nest bordered cards more than one level. Inside cards use dividers (border-subtle) or spacing.

### 14.4 Badges and pills

| Type | Shape | Size | Style | Use |
|---|---|---|---|---|
| Status pill | radius-full | 24 high, padding x 8, label-sm | Tone bg, tone fg, 6 px dot or 14 px icon in tone icon color | State of an entity (orders, payouts) |
| Count badge | radius-full | 18 high, min width 18, caption 600 | bg #CC272E with white (alerts) or bg #F0F2F7 with #434955 (neutral counts) | Cart count, nav queue counts |
| Marketing badge | radius-xs 4 | 22 high, padding x 6, label-sm 600 | Deal: bg #FFEAC5 text #5C3A02; Bestseller: bg #F0F2F7 text #181C23; New: highlight tone | Max one per product card |
| Trust badge | inline | icon 16 + caption | `shield-check` in #2358E0, text #1A48BC | Brand assurance program badge |

Pill text is a short phrase in sentence case ("Out for delivery"), never all caps. Color never stands alone: the label is always visible.

### 14.5 Tabs and segmented controls

- Underline tabs for page-level sections: label-md, text-secondary at rest, text-primary 600 when selected, 2 px #2358E0 indicator (radius-full ends), 1 px border-default baseline, optional count in a neutral count badge ("Returns 12").
- Segmented control for view switches inside a card (Day, Week, Month): 32 high, bg #F0F2F7 track, selected thumb white with shadow-xs, radius-md.
- Tabs scroll horizontally on mobile with edge fade; never wrap to two rows.

### 14.6 Dialogs, drawers, sheets, toasts, banners, tooltips

- Dialog: max width 480 (confirm) or 640 (forms), radius-xl 16, padding 24, shadow-xl, scrim. Title heading-3, primary action on the right, destructive confirmations name the object ("Cancel order 402-1234567?").
- Drawer (right side, consoles): 480 or 640 wide for record previews without leaving the list.
- Bottom sheet (mobile): radius-2xl top corners, drag handle 32 x 4 in #CED3DB, also closable by button (WCAG 2.5.7).
- Toast: bg-inverse #181C23, white text, radius-md, bottom-left desktop and bottom-center mobile above the sticky bar, auto-dismiss 5 s (never for errors), with an Undo action where possible.
- Inline banner: subtle tone style, 1 px tone border, radius-md, icon 20, title label-md 600, body body-sm, optional action link. Page-level banners sit under the page header.
- Tooltip: bg-inverse, caption, radius-xs, max width 240, shows on hover and focus after 300 ms, dismissible with Escape.

### 14.7 Loading, empty and error states

- Skeletons for lists, grids and dashboards (shapes of real content, bg #F0F2F7, slow shimmer disabled in reduced motion). Spinners for actions under 2 to 3 s. Progress with percentage for uploads and bulk jobs.
- Empty state: 40 px lucide icon in icon-subtle inside a 64 px #F7F8FB circle, heading-4 title, body-sm explanation, one primary action, optional secondary link. Distinguish "nothing yet" (onboarding), "no results" (offer to clear filters) and "no permission" (who to ask).
- Error state: what happened, what the user can do, a retry action, and a reference ID in code style for support.

## 15. Commerce components

### 15.1 Product card anatomy (listing grid)

Top to bottom, mobile first:

1. Media well: aspect 1:1 (default) or 3:4 (fashion and beauty categories), bg #F7F8FB, radius-lg 12, image `object-fit: contain` with 8 px inset for packshots (`cover` for fashion model shots). Lazy loaded with fixed aspect to prevent layout shift.
   - Top right: wishlist button (`heart`, 20 icon, 40 x 40 hit area, white circle bg with shadow-sm).
   - Top left: at most one marketing badge (Deal, Bestseller, New).
   - Desktop hover: swap to the second image, shadow-md on the card, no zoom jump.
   - Mobile: optional dot indicator of image count only if swipe is enabled.
2. Sponsored label when the placement is paid: caption "Sponsored" in text-secondary above the title (not inside the image, never disguised).
3. Brand (fashion and beauty): label-md 600 text-primary, one line.
4. Title: body-sm 14/20 (mobile) or body-md 15 to 16 (desktop), text-primary 400, clamp 2 lines, full title in `title` attribute.
5. Key attributes (category-specific, consistent across the grid): caption text-secondary, 1 line, e.g. "8 GB RAM, 128 GB storage".
6. Rating row: numeric average (label-sm 600 text-primary) plus filled `star` 14 in #FAA617 plus count "(12,345)" caption text-tertiary. Screen reader text: "Rated 4.3 out of 5 from 12,345 ratings". If no ratings: omit the row (do not show empty stars).
7. Price row (single line, wraps gracefully):
   - Selling price: price-md (mobile) or price-lg (desktop), text-primary 600, e.g. "₹1,299".
   - M.R.P.: body-sm text-tertiary with line-through, preceded by visually hidden "M.R.P." (or visible "M.R.P." on PDP), e.g. "₹1,999".
   - Discount: label-md 600 text-savings, e.g. "35% off".
   - Screen reader: "Price ₹1,299. M.R.P. ₹1,999. 35% off."
8. Offer line (optional, max one): caption text-secondary, e.g. "Extra ₹100 off with UPI". Never stack multiple offer lines on cards.
9. Delivery promise: caption text-primary with `truck` 14 icon, e.g. "Delivery by Fri, 9 Oct" or "Free delivery tomorrow" when both are true for this pincode.
10. Stock or urgency (only when true): caption in warning fg #9D4D00, e.g. "Only 3 left".
11. Quick add (grocery and FMCG categories only): sm secondary "Add" button that becomes a quantity stepper (minus, count, plus) after adding.

Card mechanics: the whole card is one link (title anchor stretched over the card) with the wishlist and quick add as separate buttons. Card padding 0 with 12 px gap between media and text block on mobile; desktop text block padding 4 px horizontal. Grid gap 12 (mobile) and 24 (desktop) horizontally, 32 vertically.

### 15.2 Price block (PDP)

```
₹1,299                          price-xl 600 text-primary
M.R.P.: ₹1,999   35% off         M.R.P. struck in text-tertiary; % off in text-savings 600
Inclusive of all taxes           caption text-secondary
You save ₹700                    caption text-savings (shown when savings >= ₹100, else % only)
```

Rules:

- Discount percent = floor((MRP minus price) divided by MRP times 100). Never round up. Show only when MRP is greater than price and the discount is at least 1%.
- Show M.R.P. only if it is the legally declared MRP for that SKU. Do not invent a "was" price.
- Show the discount once on the page (Baymard). Bank and coupon offers are a separate "Offers" section listing conditions, never folded into the headline price unless applied in cart.
- Price per unit for consumables when net quantity is known: caption text-secondary "(₹249 / 100 g)".
- Paise: storefront hides ".00"; shows paise when non-zero ("₹499.50"). Consoles and finance views always show 2 decimals.

### 15.3 Rating summary and reviews (PDP)

- Header: average as metric-lg ("4.3"), 5 stars (decorative), "12,345 ratings and 1,204 reviews".
- Distribution: five rows (5 to 1 star), bar 8 px high, radius-full, track #F0F2F7, fill #434955 for every row (bars stay neutral; no green or red judgement on star levels), percentage or count on the right in tnum. Each row is a button that filters reviews (single selection, with a "Clear" link). Hidden when 5 or fewer ratings.
- Review item: star rating and short title (label-md 600), "Verified purchase" in caption with `shield-check`, variant purchased, date, body text (body-md, clamp 6 lines with "Read more"), photos as 64 px thumbnails, "Helpful" button with count, seller or BluBuy replies in a bg-subtle block with a "Response from seller" label.
- Sort: Most helpful (default), Most recent, Highest, Lowest. Filters: with photos, by variant.

### 15.4 Deal strip and timers

- Deal strip on PDP and cards: bg #FFF8E8, text #5C3A02, `timer` icon, label "Deal ends in 02:14:09" (tnum, hh:mm:ss) when under 24 hours, else "Deal ends Sun, 12 Oct, 11:59 pm".
- The end time comes from the server; reloading must not reset it. When a deal ends, the price updates and the strip changes to neutral "Deal ended".
- "62% claimed" progress bar only when backed by real allocation data; bar track #FFEAC5, fill #D78C00.
- Timer is not announced every second: the element has `aria-live="off"` and an accessible static text "Deal ends at 11:59 pm today".

### 15.5 Delivery and pincode module (PDP buy box)

- "Deliver to Mumbai 400001" with a Change link (opens pincode sheet: input plus saved addresses plus "Use my location").
- Promise line: `truck` icon, "Delivery by Fri, 9 Oct" (label-md 600) plus "Free" or "₹40 delivery" and a cutoff "if ordered within 2 hrs 13 mins" (only when real).
- Service lines with icons, one per line: "Cash on delivery available", "7-day replacement" (links to policy), "GST invoice available", "Sold by Ravi Electronics" (link to seller page with rating), "Country of origin: India".
- Not serviceable: neutral banner "Not deliverable to 403001" plus "Notify me" or "Check another pincode". Never hide the price.

### 15.6 Buy box

Desktop (right column, sticky with `top: header height + 16`): price block, variant selectors, delivery module, quantity stepper (minus, value, plus: buttons, not a dropdown), Add to cart (primary lg, full width), Buy Now (accent lg, full width) stacked, offers summary, seller block, returns line. Max width 400.

Mobile: inline buy box after the gallery and title; once it scrolls out of view a sticky bottom bar (64 px plus safe area, bg-surface, top hairline, shadow-md) shows Add to cart (secondary style with brand text) and Buy Now (accent) as a 50/50 pair. The sticky bar must not cover focused elements (WCAG 2.4.11): add matching `scroll-padding-bottom`.

### 15.7 Cart and checkout components

- Cart line: 96 px image, title (2 lines), variant, seller, price block (compact), delivery date, quantity stepper, "Save for later" and "Remove" as tertiary text buttons. Removing shows an Undo toast.
- Price details card (sticky on desktop): "Price (3 items)" at MRP sum, "Discount on M.R.P." in text-savings with minus sign, "Coupons", "Delivery charges" ("Free" in text-savings or amount), "Platform fee" (if any, with info tooltip), divider, "Total amount" price-lg, and "You will save ₹1,240 on this order" in text-savings. Same breakdown appears in cart and checkout (no drip pricing).
- Checkout steps: Login (mobile and OTP) or continue, Address, Delivery options with dates per shipment, Payment. One column, max width 720 for the form, order summary on the right (desktop) or collapsible at top (mobile). Enclosed: header shows only logo, "Secure checkout" with `shield-check`, and Help.
- Payment list order: UPI (apps and UPI ID, QR on desktop), Cards, Net banking, EMI, Wallets, Cash on delivery (fee shown inline). Selected method expands inline; no hidden fees.
- Order confirmation: success icon, order ID in code style, delivery date per shipment, "Track order", and only then optional account preferences or offers.

## 16. Dashboard components

### 16.1 App shell

- Top bar: 56 px, bg-surface, bottom hairline. Left: product switcher or logo plus console name ("Seller Central"), store or environment switcher. Center or left-of-actions: global search (command palette on Cmd/Ctrl + K) 400 to 560 wide. Right: help (`life-buoy`), notifications (`bell` with count badge), user avatar menu. Environment banners (for example "Staging" in Admin) are a 4 px top stripe in highlight color plus a pill.
- Sidebar: 248 expanded, 64 collapsed rail (md breakpoint), off-canvas drawer on mobile. bg-subtle #F7F8FB with a right hairline, so it is quieter than white content (Linear lesson). Items 36 px high, radius-md, 20 icon in icon-default, label-md text-secondary; hover bg #F0F2F7; active item uses bg #FFFFFF with a 1 px border-default and shadow-xs, text-primary 600, icon #2358E0 (a white "raised" item on the gray rail reads as selected without a loud blue fill). Section labels in overline text-tertiary. Queue counts right-aligned as neutral count badges (danger count badge only for SLA-breaching items).
- Page header: breadcrumb (caption), heading-3 page title, optional description (body-sm text-secondary), primary action on the right (one), secondary actions as secondary or tertiary buttons and an overflow menu.

### 16.2 Stat card (KPI)

- Container: console card, padding 20, min height 120.
- Label: body-sm 500 text-secondary with optional `info` 14 tooltip for the definition ("Orders placed, excluding cancelled").
- Value: metric-lg text-primary (proportional figures), compact Indian notation for money above ₹1 lakh ("₹12.4L", "₹1.2Cr") with the exact value in a tooltip.
- Delta: label-sm pill with `trending-up` or `trending-down` 14 icon and "12.4%", colored by meaning: success tone if good, danger tone if bad, neutral if no judgement. Followed by caption text-tertiary "vs previous 7 days".
- Optional sparkline: 2 px line in blu-600, 32 px tall, no axes, no fill or a 8% fill, last point marked 6 px.
- The whole card is a link to the filtered report when a destination exists (hover border-strong, focus ring).
- KPI row: 4 cards across at xl, 2 at md, horizontal scroll or stacked at xs.

### 16.3 Data tables

| Property | Spec |
|---|---|
| Row height | 40 default; 32 compact; 48 comfortable (density toggle in the table settings menu; persisted per user) |
| Header | 40 high, bg #F7F8FB, caption 600 text-secondary, sentence case, sticky, bottom hairline |
| Cells | body-sm text-primary, padding x 12 (16 for first column), single line with ellipsis plus tooltip, or two-line variant (primary plus caption meta) at 56 height |
| Numbers | right-aligned, `tabular-nums`, currency with 2 decimals in finance tables, units in header ("Weight (kg)") |
| IDs | Geist Mono 13, with copy button on hover |
| Status | status pill column, left-aligned, never more than one pill per cell (put SLA risk as a separate icon or column) |
| Row states | hover bg #F7F8FB, selected bg #F2F7FF with left 2 px #2358E0 indicator, focus ring on keyboard row focus |
| Dividers | 1 px border-default between rows; zebra striping off by default, optional for very wide logistics manifests |
| Selection | checkbox column 40 wide; header checkbox selects page, then a banner offers "Select all 1,240 matching" |
| Batch bar | replaces the toolbar while selection is active: "12 selected", actions (max 5 visible, rest in overflow), Cancel |
| Toolbar | search (left), filter chips with counts, "More filters" (drawer), saved views dropdown, column settings, density, export (right). Same height as rows |
| Sorting | click header to sort; sort icon visible on hover and when active; announce sort via `aria-sort` |
| Pagination | bottom: "1 to 50 of 1,240", page size (25, 50, 100), previous and next, page jump for large sets |
| Row actions | 1 to 2 inline icon buttons on hover and focus, others in a `ellipsis` overflow menu that is always visible on touch |
| Wide tables | sticky first column (identifier) and sticky last column (actions); horizontal scroll with edge shadow |
| Empty, loading | skeleton rows (6 to 10), table-shaped empty state with filter reset |
| Mobile | collapse to stacked list cards: identifier plus status in the first row, 2 to 3 key fields, chevron to detail |

### 16.4 Charts

- Use the palette in 8.4. Hairline solid gridlines in #E3E6EC (never dashed), axes labels caption text-tertiary, no chart borders, no 3D, no dual y-axes (use two charts or index to 100).
- Lines 2 px, bars with 4 px rounded data ends and 2 px surface gap between adjacent bars or stacked segments, markers at least 8 px, a legend whenever there are 2 or more series, direct labels for at most the last point or extremes.
- Hover: crosshair plus tooltip on line and area charts, per-bar tooltip on bars; tooltip bg-inverse, values in tnum with Indian formatting.
- Every chart offers a "View as table" toggle (accessibility and export).
- Time range control: preset list (Today, Yesterday, Last 7 days, Last 30 days, This month, Custom) as a single filter row above all charts on a page; all charts on the page obey it.
- Use a stat card instead of a chart when the story is a single number; bars instead of pies; pie or donut only for part-to-whole with at most 5 segments.

### 16.5 Action center and notifications

- Bell opens a 400 px panel with two tabs: "Action items" (default when non-empty) and "Updates".
- Action item: tone icon (warning for due soon, danger for overdue), title ("Dispatch 12 orders"), deadline in caption ("Due today, 6:00 pm"), primary inline button ("Go to orders"). Sorted by deadline. Items disappear when resolved, not when read.
- Update: neutral icon, title, timestamp, unread dot (blu-600, 8 px), "Mark all as read".
- The seller home page repeats the top 5 action items as a card above KPIs.

### 16.6 Onboarding checklist (Seller Central)

- Card at the top of Home until complete: title "Set up your store", progress bar (8 px, radius-full, fill blu-600, track #F0F2F7) and "3 of 6 complete".
- Steps as rows: status icon (`circle-check` success or empty circle), title, one-line description, action button on the current step only. Completed rows collapse to one line. Order: Business details and GSTIN, PAN and KYC, Bank account (penny drop verification), Pickup address, First listing, Store page.

## 17. Status semantics: orders, shipments, returns, payouts

### 17.1 Tone meanings

| Tone | Meaning | Examples |
|---|---|---|
| neutral | Not started, inactive, closed without outcome, or informational with no action | Draft, Scheduled, Cancelled by customer, Closed |
| info | In progress, the system or a partner is working, nobody needs to act | Confirmed, Packed, Shipped, In transit, Processing, Refund initiated |
| highlight | A positive, time-sensitive moment worth attention | Out for delivery, New feature |
| warning | The viewer needs to act or something is at risk | Payment pending, Delivery attempted, Return requested (seller), On hold |
| success | Terminal positive outcome | Delivered, Refunded, Paid, QC passed |
| danger | Failure or terminal negative outcome | Payment failed, Lost, RTO, Rejected, Payout failed |

Rules:

- The tone reflects what this viewer should do. The same state can be info for the customer and warning for the seller (return requested). The mapping lives in one shared table in code, keyed by state and audience.
- One pill per entity. Risk flags (SLA breach risk, fraud flag, high value) are separate indicators (icon with tooltip or a separate column), not a second status pill.
- Labels are customer-friendly on the storefront and precise in consoles. State keys below are proposals; align them with the canonical UPPER_SNAKE_CASE names in 01-marketplace-workflows.md section 11 when that section is final. The tone rules apply regardless of naming.

### 17.2 Orders

| State key | Customer label | Customer tone | Seller / ops tone | Icon |
|---|---|---|---|---|
| PAYMENT_PENDING | Payment pending | warning | neutral | `hourglass` |
| PAYMENT_FAILED | Payment failed | danger | neutral | `circle-x` |
| CONFIRMED | Order confirmed | info | warning (to pack, with ship-by date) | `clipboard-check` |
| PACKED | Packed | info | info | `package` |
| SHIPPED | Shipped | info | info | `truck` |
| OUT_FOR_DELIVERY | Out for delivery | highlight | info | `map-pin` |
| DELIVERED | Delivered | success | success | `package-check` |
| CANCELLED_BY_CUSTOMER | Cancelled | neutral | neutral | `ban` |
| CANCELLED_BY_SELLER | Cancelled by seller | neutral (with refund note) | danger (counts against seller metrics) | `ban` |
| ON_HOLD | On hold | warning (with reason) | warning | `circle-pause` |
| RETURN_REQUESTED | Return requested | info | warning | `rotate-ccw` |
| RETURNED | Returned | neutral | neutral | `undo-2` |
| REFUNDED | Refunded | success | neutral | `circle-check` |

### 17.3 Shipments (Logistics console)

| State key | Label | Tone | Icon |
|---|---|---|---|
| READY_TO_SHIP | Ready to ship | neutral | `clipboard-list` |
| PICKUP_SCHEDULED | Pickup scheduled | info | `calendar-clock` |
| PICKUP_FAILED | Pickup missed | warning | `triangle-alert` |
| PICKED_UP | Picked up | info | `package` |
| IN_TRANSIT | In transit | info | `truck` |
| AT_DESTINATION_HUB | At delivery hub | info | `warehouse` |
| OUT_FOR_DELIVERY | Out for delivery | highlight | `map-pin` |
| DELIVERY_ATTEMPTED | Delivery attempted (NDR) | warning | `triangle-alert` |
| DELIVERED | Delivered | success | `package-check` |
| RTO_INITIATED | Return to origin | danger | `undo-2` |
| RTO_DELIVERED | Returned to seller | neutral | `undo-2` |
| LOST | Lost | danger | `package-x` |
| DAMAGED | Damaged | danger | `package-x` |

### 17.4 Returns and refunds

| State key | Label | Customer tone | Seller / ops tone | Icon |
|---|---|---|---|---|
| RETURN_REQUESTED | Return requested | info | warning | `rotate-ccw` |
| RETURN_APPROVED | Return approved | info | info | `circle-check` |
| RETURN_REJECTED | Return rejected | danger (with reason and appeal link) | neutral | `circle-x` |
| RETURN_PICKUP_SCHEDULED | Pickup scheduled | info | info | `calendar-clock` |
| RETURN_PICKED_UP | Picked up | info | info | `truck` |
| RETURN_RECEIVED | Received at warehouse | info | info | `warehouse` |
| QC_PASSED | Quality check passed | success | success | `shield-check` |
| QC_FAILED | Quality check failed | danger | warning (claim window open) | `shield-alert` |
| REFUND_INITIATED | Refund initiated | info | neutral | `hourglass` |
| REFUND_COMPLETED | Refunded | success | neutral | `circle-check` |
| REPLACEMENT_SHIPPED | Replacement shipped | info | info | `truck` |
| CLOSED | Closed | neutral | neutral | `circle-check` |

### 17.5 Seller payouts

| State key | Label | Tone | Icon |
|---|---|---|---|
| PAYOUT_SCHEDULED | Scheduled | neutral | `calendar-clock` |
| PAYOUT_PROCESSING | Processing | info | `hourglass` |
| PAYOUT_ON_HOLD | On hold | warning (reason and fix link) | `circle-pause` |
| PAYOUT_PAID | Paid | success | `circle-check` |
| PAYOUT_FAILED | Failed | danger (for example bank details invalid) | `circle-x` |
| PAYOUT_REVERSED | Reversed | warning | `undo-2` |

### 17.6 Order tracking timeline (customer)

Vertical stepper: 24 px circle icons connected by a 2 px line. Completed steps: success icon color for the final step, info color for intermediate steps, solid line in blu-600. Current step: highlight or info icon with bold label and timestamp. Future steps: neutral outline icon, line in #E3E6EC. Exceptions (delivery attempted) insert a warning step with explanation and actions (reschedule, update address).

## 18. Storefront page layouts

### 18.1 Global header

- Desktop: row 1 (64 px): logo, "Deliver to" chip (`map-pin`, city and pincode), search field (flex, 44 high, radius-md, bg #F7F8FB with border-default, focus to white with brand border), account menu, Orders, cart (`shopping-cart` with count badge). Row 2 (44 px): "All categories" mega menu trigger plus 6 to 8 top categories as text links, right side "Sell on BluBuy" and "Help". Bottom hairline; on scroll row 2 collapses and the header gets shadow-xs.
- Mobile: row 1 (56 px): menu, logo, account, cart. Row 2 (52 px): full-width search field always visible. Row 3 (36 px, optional): "Deliver to" line. Header hides row 1 on scroll down and returns on scroll up; search stays.
- Mobile bottom tab bar is for the Flutter app (Home, Categories, Account, Cart). The mobile web uses the header plus sticky buy bars to avoid double fixed bars.

### 18.2 Homepage

Order: static hero (one message, live text, 1 CTA) or a manually controlled carousel, category tiles (8 to 12 icons or images in a grid, 2 rows on mobile), Deals rail (with real end times), Recently viewed, curated collections, brand stores, editorial or seasonal blocks, footer. Sections separated by 64 px (desktop) or 48 px (mobile), each with heading-2 and a "View all" link. Rails scroll horizontally with visible next and previous buttons on desktop and partially visible next card on mobile.

### 18.3 Product listing and search results

- Breadcrumb, H1 (query or category) with result count, sort select on the right.
- Desktop: left filter sidebar 264 wide (category tree, price range with inputs, brand with search, rating, discount, delivery by date, availability, category-specific attributes); applied filters as removable chips above results with "Clear all".
- Mobile: sticky row with "Sort" and "Filter" buttons; filter in a full-screen sheet with groups on the left and options on the right, live result count on "Show 1,240 results".
- Results grid as in 10.2; sponsored items labeled; pagination or "Load more" button (not endless auto-load, so the footer and help stay reachable).

### 18.4 Product detail page

- Desktop: breadcrumb; two columns, gallery 7 of 12 columns (thumbnails vertical left, main image, click to open zoom viewer with keyboard support) and buy box 5 of 12 columns (title heading-3, brand link, rating summary link, price block, variants, delivery module, actions, offers, seller block). Below: highlights (bullets), product details table (including mandatory Legal Metrology fields and country of origin), description (max 720 wide), "Frequently bought together" (opt-in, nothing pre-added), ratings and reviews, questions and answers, similar products rail.
- Mobile: gallery (full width, swipe, thumbnails strip below), title, rating, price block, variants, delivery module, offers, highlights, details, reviews, sticky bottom bar.

### 18.5 Cart, checkout, account

- Cart: two columns on desktop (lines 8 of 12, price details 4 of 12 sticky), single column on mobile with sticky bottom "Place order" bar showing the total.
- Checkout: enclosed layout (section 15.7), progress shown as numbered steps with completed steps summarized and editable.
- Account: left navigation (Orders, Returns, Addresses, Payments and refunds, Wishlist, Notifications, Profile, Help) on desktop; list menu on mobile. Orders list: cards with image, status pill, delivery date, and primary action per state ("Track", "Return or replace", "Rate product").

### 18.6 Footer

bg #112C6F (blu-900) or bg-subtle; four link columns (About, Help, Policies, Sell), registered office address and grievance officer contact (required for marketplaces), payment method marks, app download links, social links. Text 14 px with 4.5:1 contrast (white on #112C6F is 13.01).

## 19. Dashboard page layouts

### 19.1 Page archetypes

| Archetype | Layout |
|---|---|
| Overview (Home) | Page header, action items card (top 5), KPI row (4 stat cards), main chart card (8 of 12) plus side list (4 of 12, for example "Top products" or "Low stock"), secondary cards grid. Global date range control in the page header. |
| List | Page header, optional tabs with counts (All, To pack, To ship, Shipped, Delivered, Returns), table card with toolbar, pagination. Row click opens a right drawer preview; "Open" goes to the full detail page. |
| Detail | Page header with ID (mono), status pill, primary action and overflow. Two columns: main (8 of 12) with sections as cards (items, timeline, payment, shipping), side (4 of 12) with summary, customer or seller, notes, audit log. |
| Form / settings | Max width 720, left section nav for long settings pages, grouped cards with a sticky bottom save bar that appears when there are unsaved changes. |
| Queue (Support, Logistics) | Three panes on xl: queue list (360), work area (flex), context panel (360). Collapses to list then detail on smaller screens. Keyboard shortcuts listed in a "?" dialog. |

### 19.2 Console specifics

- Seller Central: friendliest density (comfortable 48 px rows default for sellers new to software), onboarding checklist, action items, inventory alerts, payout summary card with next payout date.
- Admin console: compact 40 px rows, environment indicator, audit trail on every detail page, destructive actions behind a confirm dialog naming the object, role badge in the user menu.
- Logistics console: compact or condensed rows, large scannable identifiers (AWB in mono), bulk actions (manifest, print labels), status tabs per shipment state, map views only as a complement to tables.
- Support console: queue layout, customer and order context side panel, macro (canned reply) picker, SLA timer per ticket (real time remaining, warning under 1 hour, danger when breached), conversation in a chat-style thread with clear internal note styling (highlight tone background).

## 20. Content and formatting rules

- No em dash character in any UI copy, notification, email or document. Use commas, colons, parentheses or hyphens. Lint for U+2014 in CI on copy files and templates.
- No emojis in UI copy, push notifications or emails. Icons only from lucide.
- Currency: "₹" directly before the number with no space, Indian grouping via `Intl.NumberFormat('en-IN')` (web) and `NumberFormat.currency(locale: 'en_IN', symbol: '₹')` (Flutter intl). Never "Rs." or "INR" in consumer UI; "INR" is acceptable in finance exports and API docs.
- Compact money in consoles: "₹12.4L", "₹1.2Cr" (en-IN compact notation), exact value on hover.
- Percentages: "35% off" on storefront; consoles use one decimal for rates ("4.2%").
- Dates (Asia/Kolkata): "Fri, 9 Oct" for delivery promises, "9 Oct 2026, 3:30 pm" for timestamps, relative time ("2 hrs ago") only under 24 hours with the absolute time in a tooltip.
- Phone: "+91 98765 43210". Pincode: 6 digits, no space.
- Tone of voice: plain, specific, warm; tell users what happens next ("Refund of ₹1,299 to your UPI ID within 2 days").
- Button labels are verbs ("Track order", "Add to cart"). Error messages say what went wrong and how to fix it.

## 21. Accessibility checklist (WCAG 2.2 AA, IS 17802)

- Contrast: text 4.5:1 (3:1 at 24 px or 18.66 px bold and above), UI component boundaries and meaningful icons 3:1. Use the verified pairs in 8.6; do not invent new pairs without checking.
- Focus: visible focus-ring on every interactive element (`:focus-visible`), never removed; sticky headers and bottom bars must not hide focused items (2.4.11), use `scroll-padding-top` and `scroll-padding-bottom`.
- Targets: minimum 24 x 24 CSS px (2.5.8); BluBuy standard 40 x 40 desktop, 44 x 44 touch for primary controls, 8 px spacing between adjacent small targets.
- Dragging (2.5.7): sliders (price range) also have number inputs; drag-to-reorder has move up and down buttons; bottom sheets close with a button.
- Help (3.2.6): Help link in the same header position on all pages, and in the same place in checkout.
- Redundant entry (3.3.7): reuse saved addresses, "billing same as shipping" default, prefill known data in returns and support forms.
- Authentication (3.3.8): OTP fields accept paste and autofill, no CAPTCHA puzzles without alternatives, password managers allowed.
- Semantics: landmarks (header, nav, main, footer), one H1 per page, headings in order, tables with `th` and `scope`, `aria-sort` on sorted columns, form labels bound to inputs, errors linked via `aria-describedby`, status changes announced via a polite live region ("Added to cart").
- Prices and strikethrough: screen readers ignore line-through, so provide visually hidden "M.R.P." and "Price" labels.
- Images: meaningful alt text for product images ("Front view, navy cotton kurta"); decorative images `alt=""`.
- Motion: respect `prefers-reduced-motion`; carousels have pause controls and stop on interaction (2.2.2).
- Color is never the only signal: status pills include text, charts include legends and a table view, errors include an icon and message.
- Zoom and reflow: usable at 200% zoom and at 320 px width without horizontal scrolling (except data tables, which scroll inside their container).
- Language: `lang="en-IN"`; future Hindi pages `lang="hi"` with Noto Sans Devanagari.

## 22. Token implementation: CSS and Flutter ThemeData

### 22.1 Token structure

Three layers, same names on every platform:

1. Primitive: `blu-600`, `ink-200`, `marigold-400`, `green-700`, `space-4`, `radius-lg`.
2. Semantic: `bg-surface`, `text-secondary`, `border-input`, `status-warning-fg`, `bg-accent`.
3. Component (only where needed): `button-primary-bg`, `table-row-height-default`, `product-card-gap`.

Source of truth: one JSON token file (W3C Design Tokens format) in the monorepo, compiled to CSS variables (web, including a Tailwind theme) and to Dart constants plus a `ThemeExtension` (Flutter).

### 22.2 CSS variables (excerpt)

```css
:root {
  --blu-50: #F2F7FF; --blu-100: #E2EDFF; --blu-200: #C5DBFF; --blu-300: #98BDFF; --blu-400: #6193FF;
  --blu-500: #3A70F3; --blu-600: #2358E0; --blu-700: #1A48BC; --blu-800: #163A95; --blu-900: #112C6F; --blu-950: #0A1B43;
  --ink-0: #FFFFFF; --ink-25: #FBFCFD; --ink-50: #F7F8FB; --ink-100: #F0F2F7; --ink-200: #E3E6EC; --ink-300: #CED3DB;
  --ink-400: #A5ABB5; --ink-500: #898F9B; --ink-600: #6B727E; --ink-700: #5A616D; --ink-800: #434955;
  --ink-850: #2C323C; --ink-900: #181C23; --ink-925: #12161D; --ink-950: #0A0D13;
  --marigold-50: #FFF8E8; --marigold-100: #FFEAC5; --marigold-400: #FFB330; --marigold-500: #FAA617;
  --marigold-600: #D78C00; --marigold-700: #9A6000; --marigold-900: #5C3A02;

  --bg-canvas: var(--ink-0);
  --bg-surface: var(--ink-0);
  --bg-subtle: var(--ink-50);
  --bg-muted: var(--ink-100);
  --bg-brand: var(--blu-600);
  --bg-accent: var(--marigold-400);
  --text-primary: var(--ink-900);
  --text-secondary: var(--ink-700);
  --text-tertiary: var(--ink-600);
  --text-link: var(--blu-600);
  --text-savings: #0A693C;
  --border-default: var(--ink-200);
  --border-strong: var(--ink-300);
  --border-input: var(--ink-500);

  --status-success-bg: #EAFCF0; --status-success-fg: #0A693C; --status-success-border: #ABEDC1; --status-success-icon: #048149;
  --status-warning-bg: #FFF5E9; --status-warning-fg: #9D4D00; --status-warning-border: #FFCD9E; --status-warning-icon: #C26300;
  --status-danger-bg: #FFF2F1; --status-danger-fg: #A92227; --status-danger-border: #FFC7C0; --status-danger-icon: #CC272E;
  --status-info-bg: #F2F7FF; --status-info-fg: #1A48BC; --status-info-border: #C5DBFF; --status-info-icon: #2358E0;
  --status-neutral-bg: #F0F2F7; --status-neutral-fg: #434955; --status-neutral-border: #E3E6EC; --status-neutral-icon: #6B727E;
  --status-highlight-bg: #F7F5FF; --status-highlight-fg: #5F38A7; --status-highlight-border: #DCD0FF; --status-highlight-icon: #7447C8;

  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --radius-2xl: 24px; --radius-full: 9999px;
  --shadow-xs: 0 1px 2px rgba(10, 13, 19, 0.05);
  --shadow-sm: 0 1px 3px rgba(10, 13, 19, 0.08), 0 1px 2px rgba(10, 13, 19, 0.04);
  --shadow-md: 0 4px 12px -2px rgba(10, 13, 19, 0.08), 0 2px 4px -2px rgba(10, 13, 19, 0.04);
  --shadow-lg: 0 12px 24px -6px rgba(10, 13, 19, 0.12), 0 4px 8px -4px rgba(10, 13, 19, 0.06);
  --shadow-xl: 0 24px 48px -12px rgba(10, 13, 19, 0.18), 0 8px 16px -8px rgba(10, 13, 19, 0.08);
  --focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px #2358E0;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  --duration-fast: 120ms; --duration-base: 200ms; --duration-slow: 300ms; --duration-slower: 450ms;
}
.console { --bg-canvas: var(--ink-50); }
```

### 22.3 Flutter mapping

| BluBuy token | Flutter Material 3 target |
|---|---|
| bg-brand #2358E0 | `ColorScheme.primary` |
| text-inverse #FFFFFF | `ColorScheme.onPrimary` |
| blu-50 #F2F7FF / blu-800 #163A95 | `primaryContainer` / `onPrimaryContainer` |
| bg-accent #FFB330 / #0A0D13 | `ColorScheme.tertiary` / `onTertiary` (used only by the Buy Now style) |
| marigold-50 / marigold-900 | `tertiaryContainer` / `onTertiaryContainer` |
| ink-800 #434955 / white | `secondary` / `onSecondary` (neutral emphasis, chips) |
| danger #CC272E / white | `error` / `onError` |
| red-50 / red-700 | `errorContainer` / `onErrorContainer` |
| bg-surface #FFFFFF / text-primary #181C23 | `surface` / `onSurface` |
| text-secondary #5A616D | `onSurfaceVariant` |
| ink-0, ink-25, ink-50, ink-100, ink-200 | `surfaceContainerLowest`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest` |
| border-input #898F9B | `outline` |
| border-default #E3E6EC | `outlineVariant` |
| bg-inverse #181C23 / white | `inverseSurface` / `onInverseSurface` |
| blu-300 #98BDFF | `inversePrimary` |
| bg-scrim | `scrim` (ink-950; apply opacity in the barrier) |
| status tones, savings, deal, rating star, spacing, radius, shadows, durations | `ThemeExtension<BluTokens>` with `copyWith` and `lerp` (light and dark instances) |

Typography mapping (`TextTheme`): displayLarge = display-xl, displayMedium = display-lg, displaySmall = heading-1, headlineMedium = heading-2, headlineSmall = heading-3, titleLarge = heading-4, titleMedium = heading-5, bodyLarge = body-md (16/24), bodyMedium = body-sm (14/20), bodySmall = caption, labelLarge = label-md, labelMedium = label-sm, labelSmall = label-sm (BluBuy never uses Material's 11 px size; the minimum is 12). Price and metric styles live in the ThemeExtension. Flutter `height` is line-height divided by font size (for example 24 / 16 = 1.5).

Implementation notes for Flutter:

- Bundle the font files (Inter variable, Plus Jakarta Sans variable, Geist Mono) as assets rather than fetching at runtime; if using the `google_fonts` package, set `GoogleFonts.config.allowRuntimeFetching = false` in release builds and ship the files.
- Tabular figures: `TextStyle(fontFeatures: [FontFeature.tabularFigures()])` for tables and prices in lists.
- Shapes: `RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))` for buttons and inputs (radius-md), 12 for cards, 16 for dialogs, 24 top corners for bottom sheets.
- Elevation: set Material `elevation` to 0 on cards and use `BorderSide(color: outlineVariant)`; set `surfaceTintColor: Colors.transparent` to avoid the Material 3 tint and keep surfaces pure white; use custom `BoxShadow` lists that mirror the CSS shadow tokens for menus and sheets.
- Motion: `Durations.short2` (100 ms) is close to motion-fast, but use explicit BluBuy durations (120, 200, 300, 450 ms) from the extension; curves `Easing.standard`, `Easing.emphasizedDecelerate`, `Easing.emphasizedAccelerate`.
- Touch targets: `MaterialTapTargetSize.padded` (48 dp) by default; BluBuy 44 px minimum is satisfied.
- Icons: `lucide_icons_flutter` with the same icon names; use the stroke weight variants to match the web stroke of 1.75.
- Currency: `NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0)`; test Indian grouping (12,34,567) in unit tests.

---

# Sources

Storefront and checkout research

- Baymard Institute, cart abandonment rate statistics: https://baymard.com/lists/cart-abandonment-rate
- Baymard, current state of checkout UX: https://baymard.com/blog/current-state-of-checkout-ux
- Baymard, checkout usability report and benchmark: https://baymard.com/blog/ecommerce-checkout-usability-report-and-benchmark
- Baymard, how to reduce cart abandonment: https://baymard.com/blog/reduce-cart-abandonment
- Baymard, autocomplete design: https://baymard.com/blog/autocomplete-design
- Baymard, drop-down menu flickering (hover delay): https://baymard.com/blog/dropdown-menu-flickering-issue
- Baymard, drop-down menu benchmark: https://baymard.com/homepage-and-category-usability/benchmark/page-types/drop-down-menu
- Baymard, homepage carousel: https://baymard.com/blog/homepage-carousel
- Baymard, homepage and category navigation research: https://baymard.com/research/homepage-and-category-usability
- Baymard, product list item information: https://baymard.com/research-articles/product-listing-information
- Baymard, list item design: https://baymard.com/research-articles/list-item-design-ecommerce
- Baymard, current state of product list and filtering: https://baymard.com/research-articles/current-state-product-list-and-filtering
- Baymard, horizontal filtering and sorting: https://baymard.com/blog/horizontal-filtering-sorting-design
- Baymard, applied filters on mobile: https://baymard.com/guidelines/2572-applied-filters-on-mobile
- Baymard, product page price discounts: https://baymard.com/blog/product-page-price-discounts
- Baymard, user ratings distribution summary: https://baymard.com/blog/user-ratings-distribution-summary
- Baymard, shipping speed versus delivery date: https://baymard.com/blog/shipping-speed-vs-delivery-date
- Baymard, zip code auto detection: https://baymard.com/blog/zip-code-auto-detection
- Baymard, always use thumbnails for additional images: https://baymard.com/blog/always-use-thumbnails-additional-images
- Baymard, mobile search field benchmark: https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/search-field
- Baymard, product page research topic: https://baymard.com/product-page
- Product page benchmark summary (Baymard 2026 figures quoted): https://www.whatmore.ai/blog/winning-product-detail-page/
- Visible mobile search A/B test: https://blendcommerce.com/blogs/ab-tests-shopify/visible-mobile-search-bar-usa-containers
- Smashing Magazine, mega dropdown hover menus: https://smashingmagazine.com/2021/05/frustrating-design-patterns-mega-dropdown-hover-menus/
- Pratt IXD, design critique of SSENSE: https://ixd.prattsi.org/2023/09/design-critique-ssense/
- Nykaa design system summary: https://aiskill.market/skills/nykaa-design-system
- Zalando Sans and new Google Fonts 2025: https://fontalternatives.com/blog/best-new-google-fonts-2025/

India regulation and payments

- India Briefing, Legal Metrology rules apply to e-commerce: https://www.india-briefing.com/news/consumer-protection-india-lm-rules-now-apply-e-commerce-notified-medical-devices-16587.html
- HSA Advocates, Consumer Protection (E-Commerce) Rules 2020: https://hsalegal.com/wp-content/uploads/2020/09/HSA-Corp-Comm-Law-Policy-The-Consumer-Protection-E-commerce-Rules-2020.pdf
- The Week, new rules for e-commerce entities: https://www.theweek.in/news/biz-tech/2020/07/25/govt-notifies-new-rules-for-e-commerce-entities.html
- Trilegal, Guidelines for Prevention and Regulation of Dark Patterns 2023: https://trilegal.com/knowledge_repository/guidelines-for-prevention-and-regulation-of-dark-patterns-2023/
- SCC Online, CCPA notifies dark pattern guidelines: https://www.scconline.com/blog/post/2023/12/04/ccpa-notifies-guidelines-for-prevention-and-regulation-of-dark-patterns-2023-legal-news/
- AZB and Partners, CCPA self-audit advisory (June 2025): https://www.azbpartners.com/bank/central-consumer-protection-authority-issues-advisory-to-e-commerce-platforms-for-self-audit-to-detect-dark-patterns-on-their-platforms/
- Storyboard18, self-audit within 3 months: https://www.storyboard18.com/digital/ccpa-warns-e-comm-firms-over-dark-patterns-self-audit-within-3-months-69249.htm
- Razorpay, cash on delivery in India: https://razorpay.com/blog/cash-on-delivery/
- Gr4vy, payment methods in India: https://gr4vy.com/posts/payment-methods-in-india-a-complete-guide-for-2026/
- MDN, Intl.NumberFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- W3C, number, currency and unit formatting: https://www.w3.org/International/questions/qa-number-format

Dashboards and design systems

- Shopify Polaris, layout and space tokens: https://polaris.shopify.com/design/layout/layout-tokens
- Shopify Polaris, shadow tokens: https://polaris-react.shopify.com/design/depth/shadow-tokens
- Shopify Polaris, new design language: https://polaris.shopify.com/new-design-language
- Shopify, Badge (Polaris web components): https://shopify.dev/docs/api/app-home/polaris-web-components/titles-and-text/badge
- Shopify, storefront filtering UX guidelines: https://shopify.dev/themes/navigation-search/filtering/storefront-filtering/storefront-filtering-ux
- Stripe, designing accessible color systems: https://stripe.com/blog/accessible-color-systems
- Stripe Apps, chart layout pattern: https://docs.stripe.com/stripe-apps/patterns/chart-layout
- Linear, how we redesigned the Linear UI: https://linear.app/blog/how-we-redesigned-the-linear-ui
- Linear, behind the latest design refresh: https://linear.app/blog/behind-the-latest-design-refresh
- Linear changelog, UI refresh (March 2026): https://linear.app/changelog/2026-03-12-ui-refresh
- Vercel Geist design system: https://vercel.com/geist
- Vercel Geist font: https://vercel.com/geist/font
- IBM Carbon, data table usage: https://carbondesignsystem.com/components/data-table/usage/
- IBM Carbon, data table style: https://carbondesignsystem.com/components/data-table/style
- IBM Carbon, data visualization color palettes: https://carbondesignsystem.com/data-visualization/color-palettes/
- Atlassian AUI, lozenges: https://aui.atlassian.com/aui/7.1/docs/lozenges.html
- My Amazon Guy, Seller Central homepage overhaul: https://myamazonguy.com/news/seller-central-homepage-update/
- eStore Factory, Amazon next-gen selling dashboard: https://www.estorefactory.com/amazon-update/amazon-s-next-gen-selling-dashboard/
- YourStory, Flipkart seller app: https://yourstory.com/2015/06/flipkart-new-logo-seller-hub-app/
- Inc42, Flipkart seller app v2: https://inc42.com/flash-feed/flipkart-launches-second-version-of-sellers-app/amp/
- Nielsen Norman Group, skeleton screens vs progress bars vs spinners: https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/
- Innovaccer design system, empty state usage: https://design.innovaccer.com/components/emptyState/usage/
- Setproduct, dashboard UI design (KPI cards): https://setproduct.com/blog/dashboard-ui-design

Typography

- Inter: https://rsms.me/inter/
- Google Fonts repository (font files inspected): https://github.com/google/fonts
- Google Fonts CSS API (subset unicode ranges checked): https://fonts.googleapis.com/css2?family=Inter
- Next.js font optimization: https://nextjs.org/docs/app/getting-started/fonts
- Unicode, U+20B9 Indian Rupee Sign: https://codepoints.net/U+20B9

Accessibility

- W3C WAI, what's new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Deque, RPwD Act and digital accessibility in India: https://www.deque.com/blog/how-the-rights-of-persons-with-disabilities-act-rpwd-impacts-digital-accessibility-in-india
- AZB and Partners, India's evolving accessibility framework: https://www.azbpartners.com/bank/bridging-the-digital-divide-indias-evolving-accessibility-framework/

Flutter and icons

- Flutter, ColorScheme class: https://api.flutter.dev/flutter/material/ColorScheme-class.html
- Flutter, new ColorScheme roles for Material 3: https://docs.flutter.dev/release/breaking-changes/new-color-scheme-roles
- Material 3 type scale tokens: https://m3.material.io/styles/typography/type-scale-tokens
- Material Web, typography tokens: https://material-web.dev/theming/typography
- lucide_icons_flutter: https://pub.dev/packages/lucide_icons_flutter
- Lucide icons: https://lucide.dev
- lucide-static (icon names verified): https://unpkg.com/lucide-static/
