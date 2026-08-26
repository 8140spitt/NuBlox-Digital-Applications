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

`nublox-mark.svg` is the approved source-of-truth vector supplied directly for production. Its authored geometry is `335 × 338` and its three structural paths, proportions, gradients and fold treatment define the NuBlox N.

Do **not** redraw, reinterpret, simplify or replace those structural paths with an approximation. Production refinements are limited to technical finishing that preserves the design, such as aligning highlight strokes precisely to the existing ribbon boundaries, clipping blur effects inside the authored stem geometry, and enabling geometric-precision rendering.

The current production master therefore preserves the supplied N while correcting visible registration artefacts from the exported SVG: the two diagonal edge strokes now use the exact ribbon-edge endpoints, the fold blurs are clipped to their respective stems, and the highlight strokes use restrained width/opacity with rounded caps.

The monochrome variant intentionally removes colour, filters and edge-light gradients while retaining the three canonical structural paths. It is a restricted-colour derivative, not an alternative logo design.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They are retained temporarily as visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

The production path is:

```text
approved supplied vector (`nublox-mark.svg`)
        ↓
professional vector finishing without redrawing
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
- The favicon, app icon and portable lockups must derive from the same polished canonical geometry.
- Edge highlights must sit on the actual diagonal ribbon boundaries rather than use visually offset guide lines.
- Blur/fold treatments must be clipped so they do not dirty the outer silhouette.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand palette.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
