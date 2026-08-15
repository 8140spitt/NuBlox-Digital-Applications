# NuBlox Database Migrations

This directory is the production migration source after Database Baseline v1 is frozen.

## Tool

Migrations are executed with **Dbmate** and remain plain MySQL SQL.

From `app/` with `DATABASE_URL` configured:

```bash
pnpm db:migrate
pnpm db:status
```

## Baseline v1

`20260815140337_baseline_v1.sql` consolidates the validated pre-production domain packages 001–010 in their documented order.

The domain baseline is intentionally **irreversible**. Non-production environments are rebuilt rather than rolling the entire application schema backward.

Validated Baseline v1 structure:

- **337 domain/base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**

The numbered files under `database/schema/` remain the design/provenance packages for Baseline v1. They are not rewritten after the production migration baseline is frozen.

## Forward migrations after Baseline v1

### `20260815145430_authentication_boundary.sql`

Adds Better Auth infrastructure (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`) plus the explicit `auth_user_links` bridge to the NuBlox domain `users` identity.

After this migration the application schema contains **342 tables, 743 foreign keys and 427 `CHECK` constraints**.

### `20260815151500_account_provisioning.sql`

Adds controlled organisation-account provisioning through `organisation_invitations` and `organisation_invitation_roles`, including tenant-safe role intent and invitation terminal-state rules.

After this migration the application schema contains **344 base tables, 749 foreign keys and 429 `CHECK` constraints**.

### `20260815161900_organisation_administration_permissions.sql`

Seeds stable organisation-administration policy identifiers:

- `organisation.manage`
- `member.invite`
- `member.manage`

This migration is data-only and does not change structural counts.

### `20260815203700_project_workspace_permissions.sql`

Seeds the first stable project application policy identifiers:

- `project.create` — create a project owned by the active organisation;
- `project.view` — organisation-level authority to view explicitly scoped projects;
- `project.manage` — organisation-level authority to manage projects where project scope and owner policy permit.

The migration also applies current standard-role defaults to existing organisations:

```text
Owner         → project.create + project.view + project.manage
Administrator → project.create + project.view + project.manage
Manager       → project.create + project.view + project.manage
Finance/Commercial → project.view
Member/Professional → project.view
Field Worker        → project.view
Read Only           → project.view
```

The same defaults are seeded by `OrganisationBootstrapService` for future organisations.

These are organisation permission grants only. They do not replace `project_organisations` participation or the exact member's active `project_members` scope.

### `20260815211600_project_participants_team.sql`

Completes the first cross-organisation project collaboration lifecycle without creating a parallel team model:

- extends `project_organisations.status` with explicit `declined` state;
- preserves the existing `project_organisations`, `project_members`, `project_organisation_roles` and `project_member_roles` structures;
- seeds the controlled global `project_role_types` catalogue for client, project administration/management, designer, engineer, quantity surveying/commercial, contractor, supplier, inspector, facilities/operations and read-only participant contexts.

Project-role rows are contextual classification only. They do not grant `project.view`, `project.manage`, or any other permission.

The migration replaces one existing `CHECK` constraint with the broadened lifecycle check and adds reference data only. It therefore leaves the application structure at:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

### `20260815214500_crm_contacts_permissions.sql`

Seeds stable application policy identifiers for the Package 002 CRM surface:

- `crm.view` — view tenant-owned CRM organisations, people, primary contact methods and contact relationships;
- `crm.manage` — create and maintain tenant-owned parties, business-role assignments, primary contact methods and organisation contacts.

Existing standard organisation roles receive:

```text
Owner, Administrator, Manager
    → crm.view + crm.manage

Finance/Commercial, Member/Professional, Read Only
    → crm.view

Field Worker
    → no CRM grant by default
```

`OrganisationBootstrapService` applies the same defaults to future organisations, and the bootstrap integration suite verifies that parity. CRM grants never broaden tenancy: Package 002 records remain explicitly scoped by `parties.organisation_id` and related composite tenant keys.

This migration is data-only. After all seven current migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The CRM executable close-out applied all **seven** production migrations cleanly to MySQL 8.4.11, retained the **344 / 749 / 429** application structure, produced zero Kysely type drift, passed **9 integration files / 41 real-MySQL tests**, and passed `svelte-check` with **0 errors / 0 warnings** before documentation synchronisation. The final documentation-synchronised head is required to pass the same gate before merge.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All changes are forward migrations.
- MySQL-specific DDL is written explicitly rather than inferred from an ORM schema.
- External-library schema generators may produce candidate DDL, but committed Dbmate SQL remains the released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass MySQL 8.4 clean-build validation.
- Database-derived Kysely types must be regenerated after schema changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations must also pass the full application migration and integration gate.