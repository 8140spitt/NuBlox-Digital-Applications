# NuBlox production brand assets

This directory contains the production vector assets for the NuBlox application and website.

## Canonical assets

- `nublox-mark.svg` — canonical full-colour NuBlox N master.
- `nublox-mark-mono.svg` — single-colour derivative for print, documents and restricted-colour contexts.
- `nublox-app-icon.svg` — Blue 5/10 application icon derived from the canonical mark.
- `nublox-lockup.svg` — portable light-background lockup using the canonical mark.
- `nublox-lockup-on-dark.svg` — portable dark-background lockup using the canonical mark.

For Svelte application UI, prefer the components under `app/src/lib/components/brand` because they inherit the shared design tokens and keep typography responsive.

## Source-of-truth rule

`nublox-mark.svg` is the approved source-of-truth vector. Its authored geometry is `335 × 338`; the stem paths, diagonal ribbon, overlay fold treatments, gloss stroke and gradients define the NuBlox N.

Do **not** redraw, reinterpret, simplify or replace the structural paths with an approximation. Derivative assets may scale, position or place the mark on a surface, but must preserve the approved geometry and material treatment.

The monochrome variant intentionally removes colour, filters and gloss while retaining the current structural silhouette. It is a restricted-colour derivative, not an alternative logo design.

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

The full-colour mark is intentionally built from this same scale so the identity and application UI use one coherent colour language.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They remain visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

## Production rules

- SVG is the canonical format for marks and scalable identity graphics.
- Do not independently simplify or redraw the full-colour mark for individual UI surfaces.
- The favicon, app icon and portable lockups must derive from the same canonical geometry.
- Keep logo material effects vector-based; do not rasterise the master identity.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand blue scale.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
