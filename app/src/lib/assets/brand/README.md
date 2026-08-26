# NuBlox production brand assets

This directory contains the production vector assets for the NuBlox application and website.

## Canonical assets

- `nublox-mark.svg` — canonical full-colour NuBlox N master.
- `nublox-mark-mono.svg` — single-colour derivative for print, documents and restricted-colour contexts.
- `nublox-app-icon.svg` — deep-navy rounded-square application/PWA icon derived from the canonical mark.
- `nublox-lockup.svg` — portable light-background lockup using the canonical mark.
- `nublox-lockup-on-dark.svg` — portable dark-background lockup using the canonical mark.

For Svelte application UI, prefer the components under `app/src/lib/components/brand` because they inherit the shared design tokens and keep typography responsive.

## Source-of-truth rule

`nublox-mark.svg` is the approved source-of-truth vector supplied directly for production. Its authored geometry is `335 × 338` and includes the exact paths, gradients, overlay blur treatments and edge strokes that define the NuBlox N.

Do **not** redraw, reinterpret, simplify, normalise or replace the canonical full-colour geometry with an approximation. Derivative assets may scale, position or place the mark on a surface, but must preserve the supplied geometry and visual treatment.

The monochrome variant intentionally removes colour, filters and edge-light gradients while retaining the three canonical structural paths. It is a restricted-colour derivative, not an alternative logo design.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They are retained temporarily as visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

The production path is:

```text
approved supplied vector (`nublox-mark.svg`)
        ↓
derived SVG assets / Svelte brand components
        ↓
shared CSS design tokens
        ↓
application / website composition
```

## Production rules

- SVG is the canonical format for marks and scalable identity graphics.
- Do not simplify or redraw the full-colour mark independently for individual UI surfaces.
- The favicon, app icon and portable lockups must derive from the supplied canonical geometry.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand palette.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
