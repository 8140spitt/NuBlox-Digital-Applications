# NuBlox Branding

This directory contains the corporate, master-brand and digital implementation definition for NuBlox.

## Brand documents

1. [`00-business-entity.md`](00-business-entity.md) — corporate/business identity foundation.
2. [`01-brand-strategy.md`](01-brand-strategy.md) — positioning, audiences, value proposition and brand personality.
3. [`02-brand-architecture-and-naming.md`](02-brand-architecture-and-naming.md) — branded-house architecture and product naming rules.
4. [`03-verbal-identity-and-messaging.md`](03-verbal-identity-and-messaging.md) — voice, messaging hierarchy, terminology and copy standards.
5. [`04-visual-identity-brief.md`](04-visual-identity-brief.md) — design requirements for logo, typography, colour and product-system integration.
6. [`05-logo-concept-directions.md`](05-logo-concept-directions.md) — first-round visual identity territories.
7. [`06-logo-concept-evaluation.md`](06-logo-concept-evaluation.md) — first-round evaluation and selected refinement direction.
8. [`07-selected-identity-direction.md`](07-selected-identity-direction.md) — selected Modular N identity system, wordmark principles, colour shortlist and second-round design requirements.
9. [`08-digital-brand-implementation.md`](08-digital-brand-implementation.md) — production SVG assets, Svelte brand components, token system and bitmap-migration policy.

## Current identity direction

The current NuBlox digital identity is:

> **Modular N + precision NuBlox wordmark + restrained technical-blue visual system.**

The mark has now moved from generated concept artwork into controlled SVG and Svelte geometry. The public website header/hero are also implemented as semantic Svelte/CSS components rather than flattened raster mockups.

## Production colour tokens

The current digital implementation uses:

- **NuBlox Ink:** `#07182E`
- **NuBlox Blue:** `#146EF5`
- **NuBlox Cyan:** `#20B8D8`
- **NuBlox Cloud:** `#F7F9FC`
- **White:** `#FFFFFF`

Canonical tokens live in `app/src/lib/styles/brand.css`.

## Production implementation

### Vector masters

`app/src/lib/assets/brand/`

### Svelte brand components

`app/src/lib/components/brand/`

### Public implementation route

`/web`

The historical `.webp` concept assets are retained temporarily as references. New production code must use SVG/Svelte/CSS rather than introduce new dependencies on those raster compositions.

## Current implementation gate

The remaining brand-engineering work is to migrate any outstanding runtime `.webp` identity imports—particularly the authenticated application shell—to the new `NuBloxLockup` component, then quarantine/remove the legacy bitmap identity files once no runtime references remain.

## Brand governance

Before broad public adoption, the final identity must still be:

- reviewed at small icon sizes and in monochrome;
- reviewed across product and website contexts;
- checked for accessibility;
- checked for visual similarity/ownability;
- subject to appropriate trademark/legal clearance; and
- maintained through the controlled SVG/component/token pipeline.
