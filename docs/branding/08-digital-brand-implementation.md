# NuBlox Digital Brand Implementation

**Document status:** Implementation v1.1  
**Date:** 2026-08-26  
**Scope:** Production digital assets, Svelte components, design tokens and migration away from generated bitmap brand artwork  
**Parent documents:** `docs/branding/04-visual-identity-brief.md`, `docs/branding/06-logo-concept-evaluation.md`, `docs/branding/07-selected-identity-direction.md`

## 1. Purpose

This document moves the selected NuBlox identity from concept artwork into an implementable digital brand system. Generated `.webp` boards and mockups remain useful visual references, but structural, interactive and scalable brand elements must be represented as controlled SVG geometry, reusable Svelte components, shared design tokens and semantic HTML/CSS composition.

## 2. Production identity decision

The production identity is:

> **Full-detail folded-ribbon N + precise NuBlox wordmark + restrained technical-blue system.**

The full-colour N is not a flat three-shape approximation. It is a designed dimensional mark whose production master preserves the visual language selected in the concept board:

- separate blue and cyan upright planes;
- a front diagonal ribbon plane;
- recessed left-fold shading;
- a recessed right upright behind the diagonal;
- directional blue/cyan surface lighting;
- restrained edge highlights; and
- darker lower-edge depth.

The monochrome variant intentionally collapses those lighting/depth cues into the same canonical silhouette for restricted-colour use. It is not the primary master.

Formal similarity/trademark review remains a governance requirement before broad public launch.

## 3. Canonical digital assets

Production vector masters live under `app/src/lib/assets/brand/`:

```text
nublox-mark.svg
nublox-mark-mono.svg
nublox-app-icon.svg
nublox-lockup.svg
nublox-lockup-on-dark.svg
README.md
```

`nublox-mark.svg` is the canonical colour geometry. The favicon, app icon and portable lockups must derive from that geometry rather than being redrawn independently.

The existing `.webp` artwork under `app/src/lib/assets` is **legacy concept/reference material**. New code must not add dependencies on those bitmaps for logos, navigation, headers, buttons or other UI.

## 4. Svelte brand component layer

Reusable brand components live under `app/src/lib/components/brand/`:

```text
NuBloxMark.svelte
NuBloxLockup.svelte
MarketingHeader.svelte
MarketingHero.svelte
index.ts
```

### `NuBloxMark`

The canonical in-app mark component supports scalable sizing, the full-colour master, a monochrome treatment, decorative or labelled accessibility behaviour and design-token inheritance.

The colour component imports `nublox-mark.svg` directly. It must not maintain an independent approximation of the full-colour geometry. The inline monochrome form uses the same silhouette.

### `NuBloxLockup`

The standard Svelte identity lockup supports light, dark and monochrome themes, small/medium/large sizing, optional product endorsement and optional linked/home behaviour.

Endorsed product naming remains:

```text
NuBlox Projects
NuBlox Commercial
NuBlox Procurement
NuBlox Workforce
```

These are not separate visual brands.

### `MarketingHeader` and `MarketingHero`

Headers, navigation, hero copy, calls to action and responsive behaviour are real Svelte/CSS compositions. Generated header/hero bitmaps are reference material only and must never become flattened production UI.

## 5. Design tokens

The master digital brand tokens live in `app/src/lib/styles/brand.css`.

| Token | Value / role |
|---|---|
| `--nb-ink` | `#07182E` — primary dark brand surface |
| `--nb-blue` | `#146EF5` — primary action/brand accent |
| `--nb-cyan` | `#20B8D8` — secondary brand accent |
| `--nb-cloud` | `#F7F9FC` — light canvas |
| `--nb-white` | `#FFFFFF` — reverse/light surface |
| `--nb-font-sans` | Inter-first system sans stack |
| `--nb-brand-gradient` | controlled blue-to-cyan digital expression |

The detailed gradients inside the master SVG are identity artwork, not general-purpose semantic UI colours. Success/warning/error/status colours remain independent from brand colours.

## 6. Favicon and application icon

The default Svelte favicon is replaced by the full-detail NuBlox N. The vector application icon master is `app/src/lib/assets/brand/nublox-app-icon.svg`, combining the same folded-ribbon geometry with a deep navy rounded-square container.

Future PNG packaging sizes are derivatives of that SVG master, not separate designs.

## 7. Raster-image migration rule

Rebuild as SVG when the source is a logo, symbol, icon, simple geometric diagram, product endorsement mark or scalable identity graphic.

Rebuild as Svelte/CSS when the source is a header, navigation, hero with live copy/CTAs, dashboard mockup intended to become UI, product lockup inside application layout or any interactive/semantic composition.

Keep raster only when the asset is genuinely photographic or deliberately rasterised campaign illustration.

## 8. Production master rules

1. Do not simplify the full-colour N for convenience.
2. Do not redraw the full-colour N independently inside Svelte components.
3. Keep favicon, app icon and portable lockups derived from the canonical master geometry.
4. Use the monochrome silhouette only where colour reproduction or contrast requires it.
5. Preserve transparent backgrounds for standalone mark assets.
6. Preserve accessible labels when the mark conveys identity rather than decoration.
7. Keep product endorsements typographic; do not create separate product symbols without a future brand-architecture decision.

## 9. Legacy asset policy

Historical `.webp` files remain temporarily available for visual comparison while the identity is rolled into the wider application. They should move to an explicit reference/archive location or be removed once all runtime references are migrated. No new production feature should import them.

## 10. Current status and next slice

The repository now contains a production-capable identity layer:

> **Full-detail SVG masters + Svelte brand primitives + shared tokens + real responsive UI composition.**

The next brand-engineering slice should migrate the remaining authenticated-shell bitmap reference to `NuBloxLockup`, then replace any remaining product-specific raster lockups with the endorsed Svelte lockup API before quarantining the legacy `.webp` files.
