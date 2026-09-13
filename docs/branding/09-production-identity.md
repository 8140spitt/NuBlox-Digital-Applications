# 09 — NuBlox production identity

**Status:** Canonical production identity  
**Effective:** 13 September 2026  
**Applies to:** NuBlox V2 product, public onboarding, internal application, portals, documentation and future F01–F29 workspaces.

## Source of truth

The approved production logo is:

```text
appv2/src/lib/assets/brand/nublox-logo.svg
```

This vector is the authoritative NuBlox identity supplied and approved on 13 September 2026. Earlier V1 identity experiments and derivative artwork are historical reference only and must not override this asset.

The approved logo uses:

- NuBlox Blue 10 — `#09263B`;
- NuBlox Blue 90 — `#D3E9F8`.

The authored geometry, proportions, engineered-grid mark, NuBlox wordmark and `Construction & Built Environment` descriptor must not be redrawn or approximated independently.

## Typography

The canonical NuBlox application typeface is **Noto Sans**.

V2 bundles Noto Sans locally through:

```text
@fontsource-variable/noto-sans
```

and exposes it through the design-system font token:

```text
--nb-font-sans
```

Product surfaces must consume the design-system typography contract rather than selecting their own UI font.

## Product usage

Use the complete approved lockup for identity moments such as public onboarding, registration and authentication.

Compact application chrome may use the canonical mark together with the NuBlox wordmark rendered in Noto Sans where the full horizontal lockup would be impractical. The mark must be derived from the approved SVG; do not replace it with a letter tile or invented icon.

The tenant or CRM Party name is application context and must remain visually distinct from the NuBlox master brand.

## Brand implementation rules

- Do not use the temporary boxed `N` treatment introduced during V2 prototyping.
- Do not introduce alternative NuBlox logos per business function.
- Do not recolour the master identity arbitrarily.
- Do not use tenant route slugs as presentation names.
- Do not use raw palette colours as workflow semantics; workflow status remains governed by design-system semantic tokens.
- Keep the master SVG vector-based and scalable.
- Future favicon/app-icon derivatives must preserve the canonical mark geometry.

## Relationship to the design system

This identity standard sits below `docs/world-class/14-nublox-design-system.md`:

```text
NuBlox identity
  → Noto Sans + canonical logo + master blue scale
  → semantic design tokens
  → reusable components and enterprise patterns
  → F01–F29 workspaces
```

Brand identity establishes who NuBlox is. The design system establishes how NuBlox behaves as an enterprise application.
