# NuBlox production brand assets

This directory contains the production vector assets for the NuBlox application and website.

## Canonical assets

- `nublox-mark.svg` — canonical full-colour NuBlox N master.
- `nublox-mark-light.svg` — exact-geometry colour derivative for light surfaces.
- `nublox-mark-dark.svg` — exact-geometry colour derivative for dark surfaces.
- `nublox-mark-mono.svg` — single-colour derivative for print, documents and restricted-colour contexts.
- `nublox-lockup-light.svg` — portable light-surface lockup using Blue 5 wordmark typography.
- `nublox-lockup-dark.svg` — portable dark-surface lockup using Blue 95 wordmark typography.
- `nublox-app-icon.svg` — Blue 5/10 application icon derived from the canonical mark.
- `nublox-lockup.svg` and `nublox-lockup-on-dark.svg` — compatibility lockups retained for existing consumers.

For Svelte application UI, prefer the components under `app/src/lib/components/brand`. `NuBloxMark` accepts `theme="light" | "dark"`; `NuBloxLockup` uses the same theme to switch both the mark and wordmark together.

## Source-of-truth rule

`nublox-mark.svg` is the approved source-of-truth vector. Its authored geometry is `335 × 338`; the stem paths, diagonal ribbon, overlay fold treatments, gloss stroke and gradients define the NuBlox N.

Do **not** redraw, reinterpret, simplify or replace the structural paths with an approximation. The light and dark derivatives use the same authored paths and differ only in palette treatment. The monochrome derivative removes material effects but retains the same structural silhouette.

## Light and dark identity modes

### Light surfaces

Use `nublox-mark-light.svg` / `nublox-lockup-light.svg` on Blue 90–100, white and other light surfaces.

- structural range: Blue 5–45
- ribbon range: Blue 20 → Blue 55 → Blue 70 → Blue 55 → Blue 20
- highlight: Blue 95
- wordmark: Blue 5 `#05131E`

### Dark surfaces

Use `nublox-mark-dark.svg` / `nublox-lockup-dark.svg` on Blue 5–10 and other dark surfaces.

- structural range: Blue 10–50
- ribbon range: Blue 30 → Blue 60 → Blue 80 → Blue 60 → Blue 30
- highlight: Blue 95
- wordmark: Blue 95 `#E9F4FC`

Dark mode is a tonal lift of the same logo, not a different logo. No structural geometry, proportions, fold placement or ribbon angle may change between modes.

## NuBlox blue scale

The master-brand colour system is defined in `app/src/lib/styles/brand.css` as Blue 5 through Blue 100:

- Blue 5 `#05131E`
- Blue 10 `#09263B`
- Blue 20 `#0C334F`
- Blue 30 `#114870`
- Blue 40 `#155C8F`
- Blue 45 `#196AA4`
- Blue 50 `#1C7ABD`
- Blue 55 `#208AD6`
- Blue 60 `#3599E1`
- Blue 65 `#66B2E8`
- Blue 70 `#8DC6EE`
- Blue 80 `#B8DBF4`
- Blue 90 `#D3E9F8`
- Blue 95 `#E9F4FC`
- Blue 100 `#FFFFFF`

The full-colour mark and both mode derivatives are intentionally built from this same scale so the identity and application UI use one coherent colour language.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They remain visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

## Production rules

- SVG is the canonical format for marks and scalable identity graphics.
- Do not independently simplify or redraw the full-colour mark for individual UI surfaces.
- Choose the light/dark colour derivative according to its surrounding surface; do not recolour the SVG ad hoc in components.
- The favicon, app icon and portable lockups must derive from the same canonical geometry.
- Keep logo material effects vector-based; do not rasterise the master identity.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand blue scale.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
