# NuBlox production brand assets

This directory contains deterministic vector assets for the NuBlox application and website.

## Canonical assets

- `nublox-mark.svg` — full-colour, full-detail folded-ribbon N master.
- `nublox-mark-mono.svg` — single-colour silhouette for print, documents and restricted-colour contexts.
- `nublox-app-icon.svg` — deep-navy rounded-square application/PWA icon built from the same master geometry.
- `nublox-lockup.svg` — portable light-background lockup using the full-detail mark.
- `nublox-lockup-on-dark.svg` — portable dark-background lockup using the full-detail mark.

For Svelte application UI, prefer the components under `app/src/lib/components/brand` because they inherit the shared design tokens and keep typography responsive.

## Full-detail master rule

The selected NuBlox identity is a dimensional folded-ribbon N. Production colour artwork must preserve the designed planes rather than reducing the mark to three flat geometric shapes. The canonical master includes:

- separate blue and cyan upright planes;
- a front diagonal ribbon plane;
- recessed left and right fold shading;
- directional surface lighting;
- restrained top-edge highlights; and
- lower-edge depth treatment.

The monochrome variant intentionally collapses those colour/depth cues into the same canonical silhouette. It is a functional restricted-colour variant, not the primary master.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They are retained temporarily as visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

The production path is:

```text
concept artwork (.webp)
        ↓
full-detail controlled vector master (.svg)
        ↓
Svelte brand components
        ↓
shared CSS design tokens
        ↓
application / website composition
```

## Production rules

- SVG is the canonical format for marks and scalable identity graphics.
- Do not simplify or redraw the full-colour mark independently for individual UI surfaces.
- The application favicon and app icon must derive from the same folded-ribbon geometry as the master mark.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand blue/cyan palette.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
