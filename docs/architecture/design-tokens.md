# BluBuy Design Tokens (implemented v1)

These are the tokens shipped in `apps/web/src/app/globals.css`. They follow `docs/research/02-ui-design-system.md` with one deliberate deviation: the neutral (ink) scale uses darker mid steps so that `ink-500`, the lightest text colour used for content, passes WCAG AA (4.97:1 on white, 4.64:1 on the canvas). The Flutter apps must use the same names and values.

## Typography

| Role | Family | Weights | Web token |
|---|---|---|---|
| Headings, display | Plus Jakarta Sans | 500, 600, 700 | `--font-display` (applied to h1 to h4) |
| UI and body, prices, numbers | Inter | 400, 500, 600 | `--font-sans` |
| IDs (order, AWB, SKU, UTR) | Geist Mono | 400, 500 | `--font-mono` |

All three load the `latin-ext` subset because the rupee sign lives there.

## Colour

| Token | Hex | Use |
|---|---|---|
| brand-50 | #f2f7ff | Selected rows, active nav background |
| brand-100 | #e2edff | Rings, hover on soft buttons |
| brand-200 | #c5dbff | Outline button border |
| brand-500 | #3a70f3 | Focus ring, chart accents |
| brand-600 | #2358e0 | Primary actions (white text 5.93:1) |
| brand-700 | #1a48bc | Links, active nav text |
| brand-950 | #0a1b43 | Dark promotional surfaces |
| accent-400 | #ffb330 | Buy now, genuine deals only (ink text 9.9:1) |
| accent-50 / 700 | #fff8e8 / #9a6000 | Deal badges (4.9:1) |
| ink-900 | #101828 | Primary text |
| ink-600 | #475467 | Secondary text (7.69:1) |
| ink-500 | #667085 | Tertiary text, minimum for content (4.97:1) |
| ink-400 | #858fa1 | Icons, hints, axis ticks only (3.26:1) |
| ink-200 | #e4e7ec | Dividers |
| line | #e8ebf0 | Hairline borders on cards and tables |
| line-strong | #d0d5dd | Input and secondary button borders |
| canvas | #f6f7f9 | Dashboard page background |
| surface | #ffffff | Cards |
| success-50 / 700 | #ecfdf3 / #027a48 | Delivered, paid, healthy |
| warning-50 / 700 | #fffaeb / #b54708 | Needs action, NDR, on hold |
| danger-50 / 700 | #fef3f2 / #b42318 | Failed, rejected, RTO |
| info-50 / 700 | #f0f9ff / #026aa2 | Informational states |

Chart categorical slots, validated for colour vision deficiency in this order: `#2358e0, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948`.

## Shape and elevation

| Token | Value |
|---|---|
| Radius: controls | 8px |
| Radius: cards | 12px (`--radius-card`) |
| Radius: dialogs | 16px |
| Radius: pills, badges | 9999px |
| shadow-card | `0 1px 2px rgb(10 13 19 / 0.03)` (cards rely on the border) |
| shadow-raised | `0 4px 12px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)` (hover) |
| shadow-pop | `0 16px 40px -12px rgb(16 24 40 / 0.18), 0 4px 10px -4px rgb(16 24 40 / 0.06)` (menus, dialogs, tooltips) |

Spacing follows the 4px Tailwind scale. Motion: 150 to 220ms, ease out; all animation is disabled under `prefers-reduced-motion`.

## Flutter mapping

Put this in `packages/tokens` (or `lib/theme/` in each app) so widgets read the same names:

```dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class BluColors {
  static const brand600 = Color(0xFF2358E0);
  static const brand700 = Color(0xFF1A48BC);
  static const brand50 = Color(0xFFF2F7FF);
  static const accent400 = Color(0xFFFFB330);
  static const ink900 = Color(0xFF101828);
  static const ink600 = Color(0xFF475467);
  static const ink500 = Color(0xFF667085);
  static const line = Color(0xFFE8EBF0);
  static const canvas = Color(0xFFF6F7F9);
  static const success700 = Color(0xFF027A48);
  static const warning700 = Color(0xFFB54708);
  static const danger700 = Color(0xFFB42318);
}

ThemeData bluTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: BluColors.brand600,
      primary: BluColors.brand600,
      secondary: BluColors.accent400,
      surface: Colors.white,
      error: BluColors.danger700,
    ),
    scaffoldBackgroundColor: BluColors.canvas,
  );
  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
      headlineMedium: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, color: BluColors.ink900),
      titleLarge: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, color: BluColors.ink900),
    ),
    cardTheme: const CardThemeData(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        side: BorderSide(color: BluColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BluColors.brand600,
        minimumSize: const Size(64, 44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
  );
}
```

Status colours in Flutter come from the same tone names used in `apps/web/src/lib/status.ts` (neutral, info, brand, success, warning, danger, accent), so a status renders identically on web and mobile.
