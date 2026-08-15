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

`locals.actor` identifies the authenticated NuBlox platform user. `locals.tenant` is populated only when the selected organisation has been revalidated against that user’s active membership. A Better Auth identity linked to a pending NuBlox user is therefore not a trusted application actor.

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service new-organisation bootstrap.

If both provisioning cookies are present, sign-up is rejected as ambiguous. Entering either flow clears the other flow’s cookie.

### Organisation invitation

```text
organisation invitation
        ↓
controlled Better Auth sign-up
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

Invitation controls include random 256-bit tokens with only SHA-256 hashes persisted, seven-day expiry, re-invite revocation, verified-email activation, existing-user acceptance, intended role assignment and audit evidence.

The invitation API is `POST /api/organisations/invitations`. Invitation lifecycle requires `member.invite` or `organisation.manage`. Attaching roles additionally requires member-management authority and is subject to the delegation ceiling.

### Organisation bootstrap

`/start` provides self-service first-organisation creation while retaining fail-closed account creation.

For a new customer:

```text
/start details
   ↓
HMAC-SHA256 signed bootstrap token
   ↓
Better Auth sign-up
   ↓
pending users row + unverified user_email
auth_user_links
pending organisation
invited owner membership
standard roles + Owner role assignment
   ↓
verified email
   ↓
active user + verified email
active organisation + active Owner membership
```

The bootstrap token is short-lived and stored in an HttpOnly cookie. It is only pre-sign-up authorisation; there is no bootstrap-intent table. Durable pre-verification state uses existing Package 001 lifecycle values, and `getSessionActor()` resolves only an active NuBlox user.

New organisations receive seven standard role templates:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

Stable defaults currently include:

```text
Owner         → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
Administrator → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
Manager       → member.invite + member.manage
                + project.create + project.view + project.manage
Finance/Commercial, Member/Professional, Field Worker, Read Only
              → project.view
```

A project permission grant does not itself expose a project; active member-level project scope is still required. The founding member is assigned only the Owner role.

An already active NuBlox user can also visit `/start` to create another organisation without duplicating identity.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral.

`EMAIL_DELIVERY_MODE=console` is for local development and integration tests only. A production provider adapter remains a separate integration decision.

## Application access

The current account/application UI includes:

- `/start` — first/additional organisation creation;
- `/signin` — Better Auth email/password sign-in;
- `/invite/[token]` — invitation acceptance/account creation;
- `/select-organisation` — active organisation membership selector;
- `/dashboard` — protected organisation-scoped entry point;
- `/projects` — member-scoped project portfolio and project creation;
- `/projects/[projectPublicId]` — project workspace and lifecycle controls;
- `/organisation` — permission-aware organisation administration workspace.

The `(app)` route-group server layout rejects unauthenticated users and redirects authenticated users without a verified tenant to organisation selection.

## Organisation administration

`/organisation` is backed by `organisation-admin-service.ts` and `organisation-admin-repository.ts` and provides member lifecycle, member role assignment, invitation management, role management and permission grants.

Administrative authority remains split:

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full admin authority
```

The domain layer enforces delegation ceilings, manager protection, self-mutation restrictions, cross-tenant rejection and last-manager lockout protection.

## Project workspace

`src/lib/server/projects/project-workspace-service.ts` is the permission-aware application layer over the Platform Kernel project service.

Stable project permission keys are:

```text
project.create
project.view
project.manage
```

The effective project access model is intentionally conjunctive:

```text
active NuBlox user
AND active organisation membership
AND effective organisation permission
AND active project_organisations participation
AND active project_members membership
AND lifecycle/ownership policy
```

`/projects` lists only projects for which the current member has active project membership. A same-organisation user with `project.view` but no `project_members` row sees no project. `/projects/[projectPublicId]` likewise masks a non-member project as not found.

Project creation requires `project.create` and delegates to the existing `ProjectService.createProject()` transaction, which creates:

- the project in `proposed` state;
- owning-organisation project participation;
- creator project membership;
- append-only `project.created` audit evidence.

Lifecycle management requires `project.manage` plus active member-level project scope. It remains owner-only even if an external participating organisation holds `project.manage`. The existing lifecycle state machine and optimistic concurrency guard remain authoritative.

The current workspace displays participant organisations but deliberately does not yet expose participant-administration writes. Controlled information, commercial, site and asset areas are shown as subsequent application-module entry points rather than being claimed implemented.

## Permission resolution

`src/lib/server/capabilities/permission-service.ts` implements organisation permission precedence:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

`decideMany()` resolves multiple organisation permissions efficiently. When a `projectId` is supplied, permission resolution additionally verifies project participation and member scope.

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

The permanent CI gate applies the migration stream to MySQL 8.4, verifies the **344-table / 749-FK / 429-CHECK** application structure, regenerates Kysely types with zero drift, runs project-workspace/bootstrap/organisation-administration/provisioning/authentication/permission and Platform Kernel integration tests, and runs the SvelteKit type-check. The project-workspace executable close-out passed **7 integration files / 28 tests** and `svelte-check` with **0 errors / 0 warnings**; the final documentation-synchronised branch head is validated by the same gate before merge.
