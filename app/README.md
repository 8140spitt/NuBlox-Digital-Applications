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

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service new-organisation bootstrap.

Invitation controls include random 256-bit tokens with only SHA-256 hashes persisted, seven-day expiry, re-invite revocation, verified-email activation, existing-user acceptance, intended role assignment and audit evidence.

`/start` provides self-service first/additional organisation creation while retaining fail-closed account creation. The bootstrap token is short-lived HMAC-SHA256 pre-sign-up authorisation stored in an HttpOnly cookie; durable state reuses the normalised NuBlox domain model.

New organisations receive seven standard role templates. Stable defaults currently include:

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

A project permission grant does not itself expose a project; active member-level project scope is still required.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral. `EMAIL_DELIVERY_MODE=console` is for local development and integration tests only.

## Application access

The current account/application UI includes:

- `/start` — first/additional organisation creation;
- `/signin` — Better Auth email/password sign-in;
- `/invite/[token]` — organisation invitation acceptance/account creation;
- `/select-organisation` — active organisation membership selector;
- `/dashboard` — protected organisation-scoped entry point;
- `/projects` — member-scoped project portfolio, project creation and project invitation inbox;
- `/projects/[projectPublicId]` — project workspace, participant/team administration and lifecycle controls;
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

## Project workspace and collaboration

`src/lib/server/projects/project-workspace-service.ts` is the permission-aware application layer over the Platform Kernel project service. `project-team-service.ts` and `project-team-repository.ts` add collaboration administration while reusing the existing Package 001 project structures.

Stable project permission keys remain:

```text
project.create
project.view
project.manage
```

The effective in-project access model is conjunctive:

```text
active NuBlox user
AND active organisation membership
AND effective organisation permission
AND active project_organisations participation
AND active project_members membership
AND lifecycle/ownership policy
```

`/projects` lists only projects for which the exact current member has active project membership. A same-organisation user with `project.view` but no `project_members` row sees no project. Direct non-member project lookups are masked as not found.

Project creation requires `project.create` and atomically creates the project, owning-organisation participation, creator project membership and audit evidence. Lifecycle management requires scoped `project.manage` and remains owner-only.

### Project organisation invitations

The owning organisation can invite an active NuBlox organisation using its exact organisation public ID and assign one or more contextual project roles. The workflow intentionally does not provide an unrestricted organisation search directory.

An invited organisation is not yet permitted to open the project. A member who effectively holds organisation-level `project.manage` may accept or decline from the `/projects` invitation inbox **before project scope exists**. This is the deliberate exception to the normal project-scoped `project.manage` evaluation:

```text
pending project invitation
AND active organisation membership
AND organisation-level project.manage
        ↓ accept
active project_organisations participation
AND accepting member project_members scope
```

After acceptance, normal project-scope rules apply. Decline is preserved as explicit `project_organisations.status = declined`, and a later owner re-invitation can reactivate the collaboration request.

Only the owning organisation may invite/re-invite, revoke/remove participant organisations, or change organisation-level project-role assignments. Removal terminates every active `project_members` scope belonging to the removed organisation.

### Project team administration

Each active participating organisation manages only **its own organisation members** within the project. A scoped project manager may:

- add an active member from the same organisation to `project_members`;
- remove that organisation member from the project;
- assign/update contextual member project roles;
- leave the project when the active organisation is not the owner.

Cross-organisation member IDs are rejected by the service/repository boundary and by the underlying composite foreign keys.

Project-role assignments in `project_role_types`, `project_organisation_roles` and `project_member_roles` describe delivery context only. They do **not** grant permissions. Effective authority continues to come from NuBlox organisation roles/overrides plus active project scope.

The service prevents removal of the final active scoped member in an organisation who effectively holds `project.manage`; another scoped project manager must exist first. Leaving a project or owner removal terminates all active member scope for that participant while preserving participation history.

## Permission resolution

`src/lib/server/capabilities/permission-service.ts` implements organisation permission precedence:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

`decideMany()` resolves multiple organisation permissions efficiently. When a `projectId` is supplied, permission resolution additionally verifies active participant and exact-member project scope.

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

The permanent CI gate applies all six current migrations to MySQL 8.4, verifies the **344-table / 749-FK / 429-CHECK** application structure, regenerates Kysely types with zero drift, runs project-team/project-workspace/bootstrap/organisation-administration/provisioning/authentication/permission and Platform Kernel integration tests, and runs the SvelteKit type-check. The project-participants/team executable close-out passed **8 integration files / 35 tests** and `svelte-check` with **0 errors / 0 warnings**; the final documentation-synchronised branch head is validated by the same gate before merge.
