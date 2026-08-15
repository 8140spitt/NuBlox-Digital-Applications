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

`src/hooks.server.ts` resolves requests in this order:

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

Browser-controlled organisation values never become trusted tenant context merely because they were supplied by the client.

## Tenant selection

`POST /api/tenant/select` accepts an organisation public ID and sets the `nublox_organisation` HttpOnly preference cookie only after active membership is proven. `DELETE /api/tenant/select` clears that selection.

The cookie is a preference/selection hint, not an authorisation token. Membership is checked again when tenant context is resolved.

## Permission resolution

`src/lib/server/capabilities/permission-service.ts` implements organisation permission precedence:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

When a project ID is supplied, an allowed organisation permission is additionally intersected with active project participation and active project membership. Record-state/business-policy checks remain the responsibility of the relevant domain service.

## Implemented Platform Kernel foundation

The database-backed kernel currently includes:

- active organisation/user/member tuple verification;
- active organisation access;
- participant-scoped project reads;
- transactional project creation with owner participation and creator membership;
- owning-organisation project lifecycle mutation;
- server-side state-machine validation;
- optimistic current-status guards;
- append-only project audit evidence.

## Authentication boundary

Better Auth owns authentication/session mechanics in the `auth_*` tables. NuBlox retains the authoritative domain records for `users`, organisation membership, roles, permissions and project scope.

The explicit `auth_user_links` relation connects those two identities. Public self-sign-up is currently disabled; production invitation/provisioning, email delivery/recovery, MFA and enterprise SSO are subsequent increments rather than hidden assumptions in the request boundary.

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

CI applies the production migration stream to MySQL 8.4, verifies the migrated structural counts, regenerates Kysely types with zero drift, runs the authentication/tenant/permission and Platform Kernel integration tests, and finally runs the SvelteKit type-check.
