# NuBlox V2

NuBlox V2 is a clean application reset for the NuBlox construction and built-environment operating system.

## Boundary

- `appv2/` is the active V2 product surface.
- `appv1/` is retained as implementation history and business-logic evidence. V1 UI, navigation and route structure are **not** copied into V2 by default.
- Existing repository architecture, data models and domain services may be reused only through an explicit V2 design decision.
- The governing UI/UX standard remains `docs/world-class/13-ui-ux-operating-model.md`.

## Canonical route contract

Internal application routes are tenant-first:

```text
/[tenant]/dashboard
/[tenant]/my-work
/[tenant]/functions
/[tenant]/projects/[project]
```

External collaboration is party-scoped beneath the owning tenant:

```text
/[tenant]/portal/[party]/login
/[tenant]/portal/[party]/dashboard
/[tenant]/portal/[party]/actions
```

The tenant and party slugs establish route context only. They never replace server-side identity, relationship, grant or resource authorisation.

## V2 product rules

1. One coherent operating system, not 29 unrelated mini-applications.
2. The 29 enterprise functions govern user-facing information architecture; backend capability domains do not become navigation.
3. Every surface has one primary purpose: orientation, list/comparison, one record, one transaction or one decision.
4. Progressive disclosure is mandatory. Full lifecycle forms do not live permanently on landing pages.
5. Context is persistent and explicit: tenant → function → context → record → action.
6. External portal experiences are relationship-scoped views of canonical NuBlox records, not a separate duplicate application.
7. A feature is not complete until its end-to-end user journey is proven in the browser.

## Development gate

From `appv2/`:

```sh
pnpm install
pnpm lint
pnpm check
pnpm test:unit -- --run
pnpm build
```

Playwright journeys are added as real V2 workflows become available.
