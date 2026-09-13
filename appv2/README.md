# NuBlox V2

NuBlox V2 is the active product surface for the NuBlox construction and built-environment operating system. `appv1/` remains implementation history and business-logic evidence; its UI and route structure are not canonical for V2.

The governing UI/UX standard remains `docs/world-class/13-ui-ux-operating-model.md`.

## Canonical route architecture

NuBlox is tenant-first. Public onboarding creates a tenancy; existing users enter through the URL of the tenancy or CRM Party relationship they are trying to access.

### Public onboarding

```text
/start
/register
/verify-email
```

`/start` is the public entry for a new organisation. `/register` creates a new canonical organisation and its first Owner identity. Joining an existing organisation is invitation-only and does not use public registration.

### Internal tenant application

```text
/[tenant]/app
/[tenant]/app/auth/signin
/[tenant]/app/auth/forgot-password
/[tenant]/app/auth/reset-password
/[tenant]/app/auth/verify-email
/[tenant]/app/auth/invite/[token]
/[tenant]/app/auth/no-access

/[tenant]/app/dashboard
/[tenant]/app/my-work
/[tenant]/app/projects
/[tenant]/app/functions
```

`[tenant]` is the stable `tenant_route_contexts.route_slug`. It is URL context, not authority. Every protected request proves the authenticated identity is linked to an active domain user with an active membership in the organisation that owns that exact route slug.

`/[tenant]/app` is an authoritative entry resolver: anonymous users go to that tenant's sign-in route, authorised members go to that tenant's dashboard, and authenticated identities without membership go to the tenant-scoped no-access state.

### Connected CRM Party portal

```text
/[tenant]/portal/[crmParty]
/[tenant]/portal/[crmParty]/auth/signin
/[tenant]/portal/[crmParty]/auth/forgot-password
/[tenant]/portal/[crmParty]/auth/reset-password
/[tenant]/portal/[crmParty]/auth/verify-email
/[tenant]/portal/[crmParty]/auth/no-access

/[tenant]/portal/[crmParty]/dashboard
/[tenant]/portal/[crmParty]/projects
/[tenant]/portal/[crmParty]/actions
```

The portal is CRM Party project participation, not a separate external-work application. The full external authorisation chain remains: authenticated identity → CRM contact/person → CRM Party → Party↔tenant relationship → Party↔project association → permitted record/action. A tenant or CRM Party slug never grants authority by itself.

### Technical identity endpoint

Better Auth remains mounted at `/api/auth`. This is a protocol/API boundary, not a user-facing global sign-in route.

There is deliberately no global `/auth`, `/app/[tenant]` or `/portal/[tenant]` compatibility surface in V2.

## Authentication and tenancy rules

Email/password signup exists only for governed provisioning journeys:

- public `/register` creates a new organisation and first Owner;
- `/{tenant}/app/auth/invite/[token]` joins an existing organisation after the invitation is proven to belong to that tenant.

Email verification is mandatory. Verification and password-reset links expire after one hour. Successful password reset revokes existing account sessions. Forgot-password responses do not disclose whether an account exists.

Post-authentication return destinations are context-bound. Internal sign-in accepts only return paths inside the same `/{tenant}/app` boundary, with tenant invitations as the only permitted auth-subtree return. Portal sign-in accepts only paths inside the exact `/{tenant}/portal/{crmParty}` boundary. Cross-tenant, cross-Party and external return URLs are rejected.

## Stable tenant route identity

`tenant_route_contexts` owns the URL slug for an organisation. `organisations.public_id` remains a record identity and must not be substituted for the tenant route slug.

The route-slug lifecycle migration backfills missing contexts, reserves public application prefixes such as `start`, `register`, `verify-email` and `api`, and allocates a stable route context whenever a new organisation is created.

The internal access resolver joins:

```text
authenticated auth user
→ auth_user_links
→ active user
→ active organisation_members
→ active organisation
→ tenant_route_contexts.route_slug
```

Only after that chain succeeds may the protected tenant application render.

## Route implementation structure

SvelteKit route groups separate authentication pages from protected application layouts without changing browser URLs:

```text
/[tenant]/app/(protected)/...
/[tenant]/portal/[crmParty]/(protected)/...
```

This prevents tenant sign-in routes from inheriting the protected app shell and creating an authentication redirect loop.

## Runtime configuration

V2 shares the canonical NuBlox MySQL schema. Local database credentials are machine-specific and are not committed. `appv2/.env` must use the same working `DATABASE_URL` as the canonical local environment.

Non-secret local configuration:

```text
BETTER_AUTH_URL=http://localhost:5173
EMAIL_DELIVERY_MODE=console
```

Set `BETTER_AUTH_SECRET` to a local secret of at least 32 characters. Repository migrations remain under `database/migrations` and are currently executed through the V1 migration tooling:

```sh
pnpm db:migrate
pnpm db:status
```

## Product rules

1. One coherent operating system, not 29 disconnected mini-applications.
2. The tenant slug is the top-level application context for internal and connected portal access.
3. URL context never grants authority; server-side relationships and permissions do.
4. Public registration creates a new tenancy only. Existing organisations are joined by governed invitation.
5. Internal and CRM Party surfaces operate over canonical NuBlox records rather than duplicate application data.
6. Progressive disclosure is mandatory; screens have one primary purpose.
7. A journey is not complete until its route, authorisation boundary and browser behavior are proven together.

## Development gate

From `appv2/`:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm check
pnpm test:unit
pnpm build
```

The permanent V2 validation workflow runs this gate against every V2 change on `main` before the resulting head is treated as a local-development baseline.

The route contract is covered by `src/lib/routing/route-contract.test.ts`. Playwright journeys should be added as tenant-first workflows are completed.
