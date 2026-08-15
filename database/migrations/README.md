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

Seeds `organisation.manage`, `member.invite` and `member.manage`. This migration is data-only.

### `20260815203700_project_workspace_permissions.sql`

Seeds `project.create`, `project.view` and the broad `project.manage` umbrella. Organisation grants never replace `project_organisations` participation or exact-member `project_members` scope.

### `20260815211600_project_participants_team.sql`

Adds explicit declined project-participation state and seeds the contextual global `project_role_types` catalogue. Project roles classify context and never grant application permissions. Structural counts remain **344 / 749 / 429**.

### `20260815214500_crm_contacts_permissions.sql`

Seeds the original CRM `crm.view` and `crm.manage` umbrella identifiers. Package 002 tenancy remains bounded by `organisation_id` and composite tenant keys.

### `20260815222500_permission_granularity.sql`

Adds:

```text
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
crm.party.manage
crm.contact.manage
```

`project.manage` and `crm.manage` remain umbrellas. A granular decision is resolved first; umbrella fallback occurs only on granular default-deny. Explicit granular member deny therefore cannot be bypassed by an umbrella grant.

Standard Manager loses the broad project/CRM umbrellas but receives the established granular project and party/contact keys. Owner/Administrator retain umbrellas. `OrganisationBootstrapService` creates the same role matrix for new organisations.

### `20260815223800_crm_opportunities_activities.sql`

Activates Package 002 opportunities/activities without adding duplicate business tables.

It seeds:

```text
crm.opportunity.manage
crm.activity.manage
```

Both use `crm.manage` as umbrella fallback. They are deliberately not auto-granted to generic Manager, Finance/Commercial or other non-administrative templates.

The migration also seeds one default Sales pipeline only for organisations that had **zero pipeline configuration before the migration**. A temporary working set protects existing/custom pipelines, including an empty custom default named `Sales`.

Standard stages are:

```text
Lead         → sort 10 → 10%
Qualified    → sort 20 → 30%
Proposal     → sort 30 → 60%
Negotiation  → sort 40 → 80%
```

Stage is sales maturity; terminal result remains on `opportunities.status`. Future organisations use audited/idempotent first-use `CrmPipelineProvisioningService` provisioning under an organisation-row lock.

### `20260815231500_estimates_quotations_permissions.sql`

Activates the first Package 003 estimate/quotation application slice through stable commercial permission identifiers:

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

`commercial.manage` is the broad commercial sales-management umbrella. Runtime mutations resolve the granular permission first and use `commercial.manage` only as umbrella fallback.

Existing standard roles are aligned as follows:

```text
Owner / Administrator
    commercial.view
    commercial.manage
    commercial.estimate.manage
    commercial.quotation.manage
    commercial.quotation.issue
    commercial.quotation.response.record

Finance/Commercial
    commercial.view
    commercial.estimate.manage
    commercial.quotation.manage
    commercial.quotation.issue
    commercial.quotation.response.record
    # deliberately no commercial.manage umbrella

Manager / Member/Professional / Field Worker / Read Only
    no automatic Package 003 commercial grants in this increment
```

`OrganisationBootstrapService` applies the same matrix to future organisations and its exact-grant integration test prevents migrated/bootstrap standard-role drift.

The migration is data-only: Package 003 already contains the normalised estimate, version, line, cost-component, quotation, tax-snapshot, issue, party-snapshot and response tables. No duplicate commercial ledger is introduced.

After all **10** current production migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The latest executable Package 003 candidate applies all **10** production migrations cleanly on MySQL 8.4.11, preserves the **344 / 749 / 429** structural contract, produces zero generated Kysely type drift, passes **13 integration files / 57 real-MySQL tests**, and passes `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised head must pass the same permanent gate before merge.

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
