# NuBlox production brand assets

This directory contains deterministic vector assets for the NuBlox application and website.

## Canonical assets

- `nublox-mark.svg` — full-colour modular N mark.
- `nublox-mark-mono.svg` — single-colour mark for print, documents and restricted colour contexts.
- `nublox-app-icon.svg` — rounded-square application/PWA icon master.
- `nublox-lockup.svg` — portable light-background lockup.
- `nublox-lockup-on-dark.svg` — portable dark-background lockup.

For Svelte application UI, prefer the components under `app/src/lib/components/brand` because they inherit the shared design tokens and keep typography responsive.

## Legacy `.webp` artwork

The older `.webp` files in `app/src/lib/assets` were generated during concept development. They are retained temporarily as visual-reference material only. New application or website code must not introduce additional dependencies on those bitmaps.

The production path is:

```text
concept artwork (.webp)
        ↓
controlled vector geometry (.svg)
        ↓
Svelte brand components
        ↓
shared CSS design tokens
        ↓
application / website composition
```

## Production rules

- SVG is the canonical format for marks and scalable identity graphics.
- The application favicon uses the NuBlox modular N rather than the Svelte starter logo.
- The wordmark in application UI is rendered by the Svelte lockup component so it follows application typography and remains accessible.
- Product names are endorsements (`NuBlox Projects`, `NuBlox Commercial`, etc.), not separate logos.
- Semantic workflow colours must remain independent of the master-brand blue/cyan palette.
- Do not rasterise headers, navigation bars, buttons or UI compositions. Build them as Svelte/CSS components.
