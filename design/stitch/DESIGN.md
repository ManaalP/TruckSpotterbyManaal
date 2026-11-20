---
name: ClearHaul Nav
colors:
  surface: '#f8f9ff'
  surface-dim: '#d1daeb'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#e0e9f9'
  surface-container-highest: '#dae3f4'
  on-surface: '#131c28'
  on-surface-variant: '#424752'
  inverse-surface: '#28313d'
  inverse-on-surface: '#eaf1ff'
  outline: '#737784'
  outline-variant: '#c2c6d4'
  surface-tint: '#185bbb'
  primary: '#00479c'
  on-primary: '#ffffff'
  primary-container: '#1f5fbf'
  on-primary-container: '#d2deff'
  inverse-primary: '#aec6ff'
  secondary: '#545f6e'
  on-secondary: '#ffffff'
  secondary-container: '#d8e3f5'
  on-secondary-container: '#5a6574'
  tertiary: '#773a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#9a4e00'
  on-tertiary-container: '#ffd7be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d8e3f5'
  secondary-fixed-dim: '#bcc7d9'
  on-secondary-fixed: '#111c29'
  on-secondary-fixed-variant: '#3d4856'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#713700'
  background: '#f8f9ff'
  on-background: '#131c28'
  surface-variant: '#dae3f4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  metric-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  metric-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  metric-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an austere, mission-critical workspace tailored for long-haul commercial truck operators and freight dispatchers navigating volatile atmospheric conditions. The operational environment is taxing: high-glare daytime cabs, night-shift fatigue, mounting transit deadlines, and safety-critical decisions executed under tight timeframes.

The aesthetic fuses **Utilitarian Minimalism** with structured **Modern Corporate** clarity. It strips away decorative chrome, playful flourishes, ambient glows, gradients, and illustrative noise in favor of stark legibility, immediate visual triage, and physical predictability. The interface acts as a calibrated cockpit instrument—restrained, precise, and unobtrusive until an environmental hazard demands absolute focus.

## Colors

The palette operates under a strict rule of functional segregation: semantic risk signals are completely isolated from operational interactive states.

- **Background & Canvas:** `#F7F8FA` creates a low-strain, soft daylight foundation that resists screen glare without inducing the eye fatigue of pure white.
- **Surfaces & Cards:** Pure `#FFFFFF` elevates content cleanly above the muted grey canvas.
- **Structural Outlines:** `#E1E5EA` is the sole delineator of physical boundaries across components, inputs, tables, and panels.
- **Primary Text:** `#1B2430` provides high-contrast, non-glare legibility for route directives and metrics.
- **Secondary / Supporting Text:** `#5B6675` offers muted contrast for metadata, units, and structural labeling.
- **Interactive Accent (`#1F5FBF`):** Reserved exclusively for active inputs, focused controls, selection toggles, and primary navigation decisions. Never apply the blue accent to weather or safety signals.

### Risk Status Palette
These colors are restricted solely to environmental threats, highway warnings, and safety status indicators. Never employ them for decorative accents or brand styling:
- **Low Risk (`#2E8B57`):** Clear paths, permissible crosswinds, normal transit conditions.
- **Moderate Risk (`#E5B800`):** Minor precipitation, caution-level gusts, light congestion.
- **High Risk (`#E07A1F`):** Freezing rain, chain laws in effect, severe crosswinds affecting high-profile loads.
- **Severe Risk (`#C62828`):** Blizzards, black ice corridors, structural bridge closures, hail.
- **No Travel (`#4A0E1A`):** Complete roadway shutdown, mandatory state pull-off orders, catastrophic conditions.

## Typography

The type hierarchy is powered entirely by **Inter**, leveraging its tall x-height, neutral letterforms, and structural precision for rapid scanning across dash-mounted tablets and mobile cradles.

- **Tabular Numerals Rule:** All tokens tagged with `metric-*`, along with any dynamic numbers (mileage counter, remaining drive hours, ETA clocks, gross vehicle weight ratings, wind vector velocities, surface temperatures), must enforce `font-variant-numeric: tabular-nums`. This prevents layout shifts and misalignments when figures update in real time.
- **Hierarchy Restraint:** Headings are restrained (capping at 24px–28px) to prevent display sprawl and maximize spatial density for maps, routing tables, and corridor telemetry.
- **Upper-Case Application:** Reserved strictly for short metadata tags and status indicators (`label-md`), paired with gentle letter spacing (`0.02em`) for rapid categorization.

## Layout & Spacing

The layout utilizes a structured 12-column fluid grid system on desktop, an 8-column layout on tablet, and a 4-column layout on mobile devices.

- **Mobile (< 768px):** 4 columns, 16px margins, 16px gutters. Single-column stacked cards ensure tap targets remain generous during single-handed or in-cab device interaction.
- **Tablet (768px – 1024px):** 8 columns, 24px margins, 20px gutters. Optimized for horizontal vehicle dashboard docks, accommodating a split-screen viewport (e.g., 5 columns map, 3 columns corridor alert feed).
- **Desktop (> 1024px):** 12 columns, 32px margins, 24px gutters. Provides structured enterprise multi-panel dispatch screens.
- **Rhythm & Proportions:** Vertical stacks strictly adhere to multiples of 8px. Spacing between distinct operational panels relies on `space-lg` (24px), while internal card groupings leverage `space-md` (16px) and atomic pairings rely on `space-xs` (4px) or `space-sm` (8px).

## Elevation & Depth

This system intentionally rejects skeuomorphic drop shadows, heavy layered blurs, and floating elevations. The operating aesthetic is flat, low-contrast, and strictly architectural.

- **Boundary-Driven Surfaces:** Cards, panels, bottom sheets, and top bars rely on a crisp `1px solid #E1E5EA` border to establish structure against `#F7F8FA`.
- **Zero Cast Shadows:** Elevation levels (`0dp` through `24dp`) are collapsed. Cards rest flush on the background without drop shadows.
- **Modal & Popover Separation:** When a temporary layer (such as an emergency reroute dialog or weigh-station warning) must superimpose over active navigation, it utilizes an opaque `#FFFFFF` background enclosed by a `1px solid #1B2430` perimeter, backed by a subtle `rgba(27, 36, 48, 0.4)` scrim. No blurred glass effects or ambient tinted shadows are permitted.

## Shapes

The design system standardizes on a calibrated **8px (`0.5rem`)** corner radius across standard UI elements (inputs, buttons, cards, status pills, and tables), representing level `2`.

- **Standard Components:** 8px radius on cards, modal frames, inputs, and operational buttons. This provides subtle ergonomic softness while maintaining a crisp, architectural silhouette.
- **Compound Components:** Segmented route-toggles and nested split-buttons keep outer 8px perimeters, with interior adjacent corners squared to maintain monolithic form.
- **Strict Exception for Status Badges:** Risk and status indicators use a full pill radius (9999px) to distinctly contrast against the rectangular grid of data cards and form fields.

## Components

### Buttons
- **Touch Target:** Mandatory 48px height across all button tiers to ensure ease of tapping under vibration or while wearing work gloves.
- **Primary Action:** Solid `#1F5FBF` fill, white `#FFFFFF` text (`label-lg`), 8px border-radius, zero shadow. Active tap state: `#174A96`.
- **Secondary Action:** Transparent or `#FFFFFF` fill with `1px solid #E1E5EA` border, `#1B2430` text. Hover/tap state: `#F7F8FA`.
- **Destructive / Abort Action:** Transparent fill, `1px solid #C62828`, text `#C62828`. No solid red buttons unless confirming an irreversible route cancellation.

### Input Fields
- **Height & Spacing:** 48px field height, 16px horizontal internal padding (`space-md`).
- **Typography:** 16px body text (`#1B2430`) to avoid mobile browser auto-zoom. Placeholders set in `#5B6675`.
- **Labels:** Positioned cleanly above the input field (never floating or disappearing inside). Text style: `label-lg` in `#1B2430`, with a 4px gap to the input box.
- **Borders & Focus:** Default border `1px solid #E1E5EA`. Focused state transitions to `1px solid #1F5FBF` accompanied by an unblurred `2px` calm focus ring in `#1F5FBF` with zero offset.

### Risk Badges & Banners
- **Multimodal Identification:** Risk levels must never rely solely on color. Every badge must feature:
  1. A colored shape or icon (e.g., solid 6px dot or standardized SVG hazard glyph).
  2. The explicit textual risk tier (e.g., "HIGH RISK").
  3. A tinted light background surface corresponding to the risk color family at 10% opacity, framed by a `1px solid` border tinted at 25% opacity.
- **Execution:** Full pill radius (`rounded-full`), `space-xs` vertical padding, `space-sm` horizontal padding, paired with `label-md` uppercase text.

### Cards & Route Tiles
- **Structure:** Solid `#FFFFFF` fill, `1px solid #E1E5EA` outer perimeter, 8px radius, `space-md` (16px) internal padding.
- **Data Sections:** Separated internally with horizontal `1px solid #E1E5EA` hairline dividers rather than elevated containers.
- **Selected State:** Active/chosen route card swaps its default perimeter to a `2px solid #1F5FBF` border with no background shift.

### Checkboxes & Radio Controls
- **Size:** 20px x 20px hit marker centered within a 48px interactive target container.
- **Appearance:** 1px solid `#E1E5EA` unchecked border, switching to solid `#1F5FBF` fill with a crisp white checkmark/dot when active.

### Corridor Hazard List Items
- **Structure:** Flush full-width or card-bound lists. Height minimum 64px for one-touch acknowledgement.
- **Visuals:** Left border accent line (4px width) rendered in the respective Risk Status Color (e.g., `#E07A1F` for High Risk crosswinds), ensuring immediate peripheral detection along route timelines.