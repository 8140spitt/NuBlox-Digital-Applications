# NuBlox SvelteKit App

This app is structured as a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Single deployable SvelteKit app with explicit domain boundaries.
- Business rules belong in server-side domain/application modules, not in Svelte components.
- Route handlers act as request boundaries: authentication, tenant context, validation, policy checks and service orchestration.
- Correlation IDs are attached to every request for observability.
- SQL belongs behind domain repositories; routes/components do not query the database directly.
- MySQL SQL migrations are the schema source of truth; generated Kysely types are derivative.
- Tenant-owned records are queried with explicit verified tenant context rather than by surrogate ID alone.
- Authentication identity does not imply organisation or project access.

## Persistence and authentication stack

- **MySQL 8.4 / InnoDB**
- **Kysely** typed SQL query builder
- **mysql2** pooled Node driver
- **Dbmate** plain-SQL production migrations
- **kysely-codegen** database-derived TypeScript interfaces
- **Better Auth 1.6.25** authentication/session boundary

Architecture decisions are recorded in:

- `docs/adr/0001-database-query-and-migration-tooling.md`
- `docs/adr/0002-authentication-session-boundary.md`

## Request trust flow

```text
request
  ↓
correlation ID
  ↓
Better Auth session
  ↓
auth_user_links → active NuBlox users row
  ↓
selected organisation cookie (hint only)
  ↓
active organisation + active organisation_members proof
  ↓
trusted request locals
```

`locals.actor` identifies the authenticated NuBlox platform user. `locals.tenant` is populated only when the selected organisation has been revalidated against that user’s active membership.

## Account provisioning

NuBlox account creation is invitation-controlled. Better Auth does not own organisation membership.

```text
organisation invitation
        ↓
invite-only Better Auth sign-up
        ↓
email verification
        ↓
auth_user_links
        ↓
NuBlox user + verified user email
        ↓
active organisation membership
        ↓
invitation role assignments
```

Key controls:

- invitation tokens are random 256-bit values; only SHA-256 hashes are persisted;
- pending invitations expire after seven days;
- re-inviting the same organisation/email revokes the earlier pending invitation;
- Better Auth `/sign-up/email` fails closed without the matching invitation cookie and email;
- brand-new NuBlox membership activation occurs only from the verified-email path;
- persisted `auth_users.email_verified` is checked before callback-driven activation;
- existing signed-in NuBlox users can accept an invitation without creating a duplicate auth/domain identity;
- intended organisation roles are stored before acceptance and assigned when membership activates;
- an email already belonging to an active member cannot be invited again;
- creation and acceptance produce audit evidence.

The provisioning API is `POST /api/organisations/invitations`. Invitation lifecycle requires `member.invite` or `organisation.manage`. Attaching organisation roles additionally requires member-management authority and is subject to the delegation ceiling: a non-organisation-manager may delegate only permissions they effectively hold themselves.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral.

`EMAIL_DELIVERY_MODE=console` is for local development and integration tests only. An unconfigured production delivery mode fails before an invitation service is constructed, preventing an invitation from being committed when delivery is unavailable. A production provider adapter remains a separate integration decision.

## Application access

The current account/application UI includes:

- `/signin` — Better Auth email/password sign-in;
- `/invite/[token]` — invitation acceptance/account creation;
- `/select-organisation` — active organisation membership selector;
- `/dashboard` — protected organisation-scoped application entry point;
- `/organisation` — permission-aware organisation administration workspace.

The `(app)` route-group server layout rejects unauthenticated users and redirects authenticated users without a verified tenant to organisation selection. Its Svelte layout provides the NuBlox application shell, organisation switcher, primary navigation and sign-out boundary.

## Organisation administration

`/organisation` is backed by `organisation-admin-service.ts` and `organisation-admin-repository.ts`. It provides:

- tenant-scoped member listing;
- membership status transitions;
- member role assignment;
- invitation history, resend and revoke;
- organisation-role creation/update/activation;
- role-to-permission grant management.

Administrative authority is split deliberately:

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full admin authority
```

Security invariants include:

- request payloads use public IDs rather than internal database IDs;
- users cannot change their own membership status or role assignments from the administration workspace;
- cross-tenant/inactive role assignment is rejected;
- `member.manage` cannot delegate role permissions the actor does not effectively hold;
- a lower-level member administrator cannot alter an existing organisation manager;
- role/member mutations cannot remove the final active `organisation.manage` authority;
- administrative mutations append audit evidence.

## Permission resolution

`src/lib/server/capabilities/permission-service.ts` implements organisation permission precedence:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

`decideMany()` resolves multiple organisation permissions in a bounded pair of queries and is used by the administration boundary to avoid repeated per-permission lookups.

Project-scoped operations additionally require active project participation and active project membership. Record-state/business-policy checks remain with the relevant domain service.

## Implemented Platform Kernel foundation

The database-backed kernel includes active organisation/user/member tuple verification, participant-scoped project reads, transactional project creation, owner-scoped project lifecycle mutation, optimistic lifecycle guards and append-only audit evidence.

## Run

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Required server environment includes:

```text
DATABASE_URL
DB_POOL_MAX
BETTER_AUTH_URL
BETTER_AUTH_SECRET
EMAIL_DELIVERY_MODE
```

## Database commands

```sh
pnpm db:migrate
pnpm db:status
pnpm db:types
```

## Validate

```sh
pnpm check
pnpm test:integration
```

The permanent CI gate applies the migration stream to MySQL 8.4, verifies the **344-table / 749-FK / 429-CHECK** application structure, regenerates Kysely types with zero drift, runs organisation-administration/provisioning/authentication/permission and Platform Kernel integration tests, and runs the SvelteKit type-check. The organisation-administration close-out passed **5 integration files / 20 tests** and `svelte-check` with zero errors and zero warnings.
