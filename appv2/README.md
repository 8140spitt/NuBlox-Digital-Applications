# NuBlox V2

NuBlox V2 is a clean application reset for the NuBlox construction and built-environment operating system.

## Boundary

- `appv2/` is the active V2 product surface.
- `appv1/` is retained as implementation history and business-logic evidence. V1 UI, navigation and route structure are **not** copied into V2 by default.
- Existing repository architecture, data models and domain services may be reused only through an explicit V2 design decision.
- The governing UI/UX standard remains `docs/world-class/13-ui-ux-operating-model.md`.

## Canonical route contract

NuBlox has two explicit connected application surfaces over the same canonical platform.

Internal users enter the tenant operating system beneath `/app`:

```text
/app/[tenant]/dashboard
/app/[tenant]/my-work
/app/[tenant]/projects
/app/[tenant]/functions
```

External CRM Parties enter the connected portal beneath `/portal`:

```text
/portal/[tenant]/[crmParty]/login
/portal/[tenant]/[crmParty]/dashboard
/portal/[tenant]/[crmParty]/projects
/portal/[tenant]/[crmParty]/actions
```

The portal is **CRM Party project participation**, not a standalone external-work application. An authenticated external identity must resolve to an authorised CRM contact/user, then to a CRM Party, then to a valid tenant relationship and project association. The portal exposes only the canonical NuBlox records and business actions permitted by those relationships.

Route parameters establish context only. They never grant authority. Server-side authentication and authorisation must enforce identity → CRM Party → tenant relationship → project association → record/action permission before protected data is exposed.

There are no legacy aliases for the former tenant-first route tree. V2 uses `/app/[tenant]/...` and `/portal/[tenant]/[crmParty]/...` as the only canonical application boundaries.

## V2 product rules

1. One coherent operating system, not 29 unrelated mini-applications.
2. The 29 enterprise functions govern user-facing information architecture; backend capability domains do not become navigation.
3. Every surface has one primary purpose: orientation, list/comparison, one record, one transaction or one decision.
4. Progressive disclosure is mandatory. Full lifecycle forms do not live permanently on landing pages.
5. Internal context is explicit beneath `/app`: tenant → function/project → record → action.
6. `/portal` is a connected CRM Party view into canonical NuBlox projects and business processes, never a duplicate application or generic external-work engine.
7. A feature is not complete until its end-to-end user journey is proven in the browser.

## Development gate

From `appv2/`:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm check
pnpm test:unit
pnpm build
```

`pnpm test:unit` provisions the Chromium binary required by Vitest browser-mode component tests and then runs the suite once. Use `pnpm test:unit:watch` for interactive watch mode.

Playwright journeys are added as real V2 workflows become available.
