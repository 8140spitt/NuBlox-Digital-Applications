# NuBlox V2

NuBlox V2 is a clean application reset for the NuBlox construction and built-environment operating system.

## Boundary

- `appv2/` is the active V2 product surface.
- `appv1/` is retained as implementation history and business-logic evidence. V1 UI, navigation and route structure are **not** copied into V2 by default.
- Existing repository architecture, data models and domain services may be reused only through an explicit V2 design decision.
- The governing UI/UX standard remains `docs/world-class/13-ui-ux-operating-model.md`.

## Canonical route contract

NuBlox has one authentication boundary and two connected application surfaces over the same canonical platform.

The central authentication suite is:

```text
/auth/start
/auth
/auth/register
/auth/verify-email
/auth/forgot-password
/auth/reset-password
/auth/invite/[token]
```

`/auth/start` is the access-orientation route. `/auth` is the canonical sign-in route. `/auth/register` is exclusively for creating a **new NuBlox tenant and its first Owner**. Joining an existing tenant is invitation-only through `/auth/invite/[token]`; it is not generic public account registration.

Internal users enter the tenant operating system beneath `/app`:

```text
/app/[tenant]/dashboard
/app/[tenant]/my-work
/app/[tenant]/projects
/app/[tenant]/functions
```

External CRM Parties enter the connected portal beneath `/portal`:

```text
/portal/[tenant]/[crmParty]/dashboard
/portal/[tenant]/[crmParty]/projects
/portal/[tenant]/[crmParty]/actions
```

Anonymous access to protected `/app` or `/portal` routes is redirected to `/auth?returnTo=...`. Return destinations are restricted to canonical `/app/...`, `/portal/...` and active `/auth/invite/...` journeys so authentication cannot be used as an open redirect.

The portal is **CRM Party project participation**, not a standalone external-work application. An authenticated external identity must resolve to an authorised CRM contact/user, then to a CRM Party, then to a valid tenant relationship and project association. The portal exposes only the canonical NuBlox records and business actions permitted by those relationships.

Route parameters establish context only. They never grant authority. Server-side authentication and authorisation must enforce identity → CRM Party → tenant relationship → project association → record/action permission before protected data is exposed.

There are no legacy aliases for the former tenant-first route tree and no portal-specific login route. V2 uses `/auth`, `/app/[tenant]/...` and `/portal/[tenant]/[crmParty]/...` as the canonical application boundaries.

## Authentication implementation

V2 mounts Better Auth through the SvelteKit server handler at `/api/auth` and reuses the canonical `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications` and `auth_user_links` identity model rather than creating a second identity store.

Email/password signup is enabled at the Better Auth protocol layer only so governed NuBlox onboarding journeys can create identities. The server rejects signup unless exactly one approved provisioning intent is present:

- a signed, time-limited new-tenant bootstrap intent created by `/auth/register`; or
- a valid, time-limited organisation invitation opened through `/auth/invite/[token]`.

New-tenant registration creates a pending canonical organisation, domain user, Owner membership and Owner role. The registration becomes active only after email verification. The first Owner receives the active permission catalogue for the new tenant; additional roles and members are governed after tenant activation.

Organisation invitations remain canonical `organisation_invitations` records. Existing NuBlox identities can accept an invitation directly after authentication when the verified email matches. New invitees create an identity against the invitation, verify the email, and then receive the membership and roles selected by the inviting tenant.

Email verification is mandatory. Verification links expire after one hour. Password-reset links also expire after one hour, and successful password reset revokes existing account sessions. Forgot-password responses do not disclose whether an account exists.

Runtime configuration is provided through `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and the transactional email boundary. `EMAIL_DELIVERY_MODE=console` is available for local development and exposes one-time links in the local server console. Production must use a real transactional-email adapter rather than console delivery.

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
