# NuBlox Digital Brand Implementation

**Document status:** Implementation v1.0  
**Date:** 2026-08-25  
**Scope:** Production digital assets, Svelte components, design tokens and migration away from generated bitmap brand artwork  
**Parent documents:** `docs/branding/04-visual-identity-brief.md`, `docs/branding/06-logo-concept-evaluation.md`, `docs/branding/07-selected-identity-direction.md`

## 1. Purpose

This document moves the selected NuBlox identity from concept artwork into an implementable digital brand system.

The generated `.webp` boards and mockups remain useful visual references, but they are not production UI. Brand elements that are structural, interactive or expected to scale must now be represented as:

- controlled SVG geometry;
- reusable Svelte components;
- shared CSS design tokens; and
- semantic HTML/CSS composition.

## 2. Production identity decision

The current digital implementation uses:

> **Modular N + precise NuBlox wordmark + restrained technical-blue system.**

The modular N is now represented by controlled SVG/Svelte geometry rather than a cropped image extracted from a concept board.

This is the application identity baseline. Formal similarity/trademark review remains a governance requirement before broad public launch.

## 3. Canonical digital assets

Production vector masters live under:

`app/src/lib/assets/brand/`

Current files:

```text
nublox-mark.svg
nublox-mark-mono.svg
nublox-app-icon.svg
nublox-lockup.svg
nublox-lockup-on-dark.svg
README.md
```

The existing `.webp` artwork under `app/src/lib/assets` is classified as **legacy concept/reference material**. New code must not add dependencies on those bitmaps for logos, navigation, headers, buttons or other UI.

## 4. Svelte brand component layer

Reusable brand components live under:

`app/src/lib/components/brand/`

Current components:

```text
NuBloxMark.svelte
NuBloxLockup.svelte
MarketingHeader.svelte
MarketingHero.svelte
index.ts
```

### `NuBloxMark`

The canonical in-app mark component. It supports:

- scalable sizing;
- full-colour brand treatment;
- monochrome treatment;
- decorative or labelled accessibility behaviour; and
- design-token inheritance.

### `NuBloxLockup`

The standard Svelte identity lockup. It supports:

- light, dark and monochrome themes;
- small, medium and large sizing;
- optional product endorsement; and
- optional linked/home behaviour.

Examples of endorsed product naming remain:

```text
NuBlox Projects
NuBlox Commercial
NuBlox Procurement
NuBlox Workforce
```

They are not separate visual brands.

### `MarketingHeader`

A real responsive Svelte website header replacing the rasterised header mockup concept.

It includes:

- NuBlox identity;
- semantic navigation;
- sign-in and primary CTA actions;
- responsive mobile navigation; and
- accessible focus behaviour.

### `MarketingHero`

A real Svelte/CSS hero composition replacing the generated website-hero bitmap.

The architectural/technical visual language is built with CSS geometry and gradients rather than baked text or navigation inside a raster image.

## 5. Design tokens

The master digital brand tokens live in:

`app/src/lib/styles/brand.css`

Lead tokens include:

| Token | Value / role |
|---|---|
| `--nb-ink` | `#07182E` — primary dark brand surface |
| `--nb-blue` | `#146EF5` — primary action/brand accent |
| `--nb-cyan` | `#20B8D8` — secondary brand accent |
| `--nb-cloud` | `#F7F9FC` — light canvas |
| `--nb-white` | `#FFFFFF` — reverse/light surface |
| `--nb-font-sans` | Inter-first system sans stack |
| `--nb-brand-gradient` | controlled blue-to-cyan digital expression |

`global.css` imports the brand token layer and supplies application-wide structural defaults.

Semantic success/warning/error/status colours must continue to be defined independently from brand colours.

## 6. Favicon and application icon

The default Svelte favicon has been replaced with the NuBlox modular N.

The vector app-icon master is:

`app/src/lib/assets/brand/nublox-app-icon.svg`

Future packaging work may generate raster PNG sizes from this master for platforms that explicitly require fixed-size PNG files (for example PWA manifests, mobile launchers or social metadata). Those PNGs are derivatives, not masters.

## 7. Public website implementation

The `/web` route is now the first live composition using the production brand layer rather than a placeholder or screenshot.

The initial page includes:

- the real `MarketingHeader` component;
- the real `MarketingHero` component;
- live semantic copy;
- responsive layout;
- accessible navigation and calls to action; and
- a platform-positioning section built from HTML/CSS.

## 8. Raster-image migration rule

Use this rule when reviewing remaining `.webp` files:

### Convert/rebuild as SVG when the asset is

- a logo or symbol;
- an icon;
- a diagram made from simple geometry;
- a product endorsement mark; or
- a scalable identity graphic.

### Rebuild as Svelte/CSS when the asset is

- a header;
- navigation;
- a hero with live copy/CTAs;
- a dashboard mockup intended to become UI;
- a product lockup used inside application layout; or
- any interactive/semantic composition.

### Keep raster only when the asset is genuinely photographic or illustrative

Examples include real project photography or deliberately rasterised campaign artwork.

## 9. Legacy asset policy

The historical `.webp` files are not deleted in this implementation because they remain useful comparison/reference material while the identity is being rolled into the wider application.

They should be moved to an explicit archive/reference location or removed once all remaining runtime references have been migrated and the final vector geometry is approved.

No new production feature should import them.

## 10. Accessibility requirements

Production brand components must:

- preserve visible keyboard focus;
- maintain accessible contrast;
- avoid communicating meaning through colour alone;
- use semantic links/navigation rather than flattened artwork;
- provide appropriate accessible labels for identity marks; and
- remain legible under responsive resizing and browser zoom.

## 11. Next implementation slice

The next brand-engineering slice should migrate the remaining authenticated-shell bitmap identity reference to `NuBloxLockup`, then progressively replace any product-specific raster lockups with the endorsed Svelte lockup API.

After that, the legacy `.webp` files can be quarantined under a reference/archive directory and excluded from normal application imports.

## 12. Current status

The NuBlox brand is no longer defined only by generated concept images.

The repository now contains the first production-capable digital identity layer:

> **SVG masters + Svelte brand primitives + shared tokens + a real public website composition.**
