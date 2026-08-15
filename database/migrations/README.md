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
- `project.manage` — umbrella authority for project-management responsibilities where project scope and contextual policy permit.

The migration applies the original standard-role project defaults to existing organisations. Later granular permissions refine the management surface without invalidating `project.manage` as an umbrella authority.

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

Seeds the original Package 002 CRM umbrella policy identifiers:

- `crm.view` — view tenant-owned CRM organisations, people, primary contact methods and contact relationships;
- `crm.manage` — umbrella authority for CRM maintenance responsibilities.

The later granular permission migration separates party/master-data management from organisation-contact relationship management while retaining `crm.manage` for compatibility and higher-authority roles.

CRM grants never broaden tenancy: Package 002 records remain explicitly scoped by `parties.organisation_id` and related composite tenant keys.

### `20260815222500_permission_granularity.sql`

Refines project and CRM delegation with six stable policy identifiers:

- `project.lifecycle.manage` — change project lifecycle state where owner and scope policy permit;
- `project.participant.manage` — invite/remove participant organisations and maintain organisation-level project roles;
- `project.team.manage` — maintain the active organisation's scoped project members and member project roles;
- `project.participation.manage` — accept/decline project invitations and leave participation where contextual policy permits;
- `crm.party.manage` — create and maintain tenant-owned CRM party master data, classifications and contact methods;
- `crm.contact.manage` — create, link, promote and end tenant-owned organisation-contact relationships.

`project.manage` and `crm.manage` remain umbrella permissions. Runtime permission resolution uses a granular permission first and falls back to its umbrella only when the granular key has no explicit member/role decision. An explicit granular member deny therefore cannot be bypassed by an umbrella grant.

Existing and future standard-role defaults are aligned as follows:

```text
Owner / Administrator
    → retain project.manage + crm.manage umbrellas
    → receive all six granular management permissions

Manager
    → project.lifecycle.manage
    → project.participant.manage
    → project.team.manage
    → project.participation.manage
    → crm.party.manage
    → crm.contact.manage
    → does not retain project.manage or crm.manage

Finance/Commercial
    → project.view + crm.view

Member/Professional
    → project.view + crm.view

Field Worker
    → project.view

Read Only
    → project.view + crm.view
```

The migration grants the granular keys to existing Owner, Administrator and Manager roles, then removes the two broad management umbrella grants from the standard Manager role. `OrganisationBootstrapService` creates the same role matrix for new organisations.

This migration is data-only. After all current migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The permanent validation gate applies the full migration stream to MySQL 8.4, verifies the **344 / 749 / 429** structural contract, checks generated Kysely types for drift, runs the real-MySQL integration suite, and runs `svelte-check`. Permission/catalogue migrations are subject to the same gate even when they do not alter structural counts.

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
