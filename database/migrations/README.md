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

`20260815140337_baseline_v1.sql` consolidates validated pre-production domain packages 001–010 in their documented order.

The domain baseline is intentionally **irreversible**. Non-production environments rebuild rather than rolling the whole baseline backward.

Validated Baseline v1 structure:

- **337 domain/base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**

The numbered files under `database/schema/` remain the design/provenance packages and are not rewritten after the production baseline is frozen.

## Forward migrations after Baseline v1

### `20260815145430_authentication_boundary.sql`

Adds Better Auth infrastructure plus the explicit `auth_user_links` bridge to NuBlox domain `users`. Structure becomes **342 / 743 / 427**.

### `20260815151500_account_provisioning.sql`

Adds controlled organisation invitations and intended invitation role assignments. Structure becomes **344 / 749 / 429**.

### `20260815161900_organisation_administration_permissions.sql`

Seeds `organisation.manage`, `member.invite` and `member.manage`.

### `20260815203700_project_workspace_permissions.sql`

Seeds `project.create`, `project.view` and broad `project.manage`. Organisation permission never substitutes for project participation/member scope.

### `20260815211600_project_participants_team.sql`

Adds declined project-participation state and contextual `project_role_types`. Project roles classify context and never grant application permissions.

### `20260815214500_crm_contacts_permissions.sql`

Seeds original CRM `crm.view` and `crm.manage` identifiers.

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

`project.manage` and `crm.manage` remain umbrella fallbacks. An explicit granular member deny cannot be bypassed by an umbrella grant.

### `20260815223800_crm_opportunities_activities.sql`

Seeds:

```text
crm.opportunity.manage
crm.activity.manage
```

and a non-destructive default Sales pipeline for existing tenants with no pipeline configuration. Future tenants receive equivalent audited/idempotent first-use provisioning.

### `20260815231500_estimates_quotations_permissions.sql`

Activates the first Package 003 estimate/quotation application slice through:

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

`commercial.manage` is umbrella fallback for granular commercial mutations.

Standard defaults:

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
    # no commercial.manage

Manager / Member/Professional / Field Worker / Read Only
    no automatic Package 003 commercial grants
```

The migration is data-only because Baseline v1 already contains the normalised Package 003 estimate, quotation, issue, response and conversion structures.

### `20260816001000_accepted_quotation_project_conversion.sql`

Activates the existing Package 003 accepted-quotation conversion boundary by adding one stable granular permission:

```text
commercial.quotation.convert
```

The migration deliberately adds **no standard-role grant**.

Runtime conversion requires both:

```text
commercial.quotation.convert
    OR commercial.manage umbrella fallback
AND project.create
```

This preserves separation between commercial conversion authority and project-creation authority. Owner/Administrator already satisfy the commercial side through `commercial.manage` and the project side through `project.create`. Finance/Commercial, Manager and custom roles require deliberate delegation where an organisation wants them to perform this cross-domain action.

No conversion table is added: Baseline v1 already contains `quotation_project_conversions`, with unique response/project keys and same-tenant foreign keys. The application uses it as the authoritative idempotency/provenance ledger while also setting existing `quotations.project_id` and source `estimates.project_id` links.

### `20260816005000_contract_formation_permissions.sql`

Activates the first Package 004 contract-formation application slice through:

```text
contract.view
contract.manage
contract.create
contract.draft.manage
contract.issue
contract.execute
```

`contract.manage` is the umbrella fallback for the four granular Package 004 mutations. Package 004 authority is deliberately independent from `commercial.manage`; an older/custom commercial role does not silently receive contract mutation rights.

Standard defaults for existing organisations are seeded explicitly:

```text
Owner / Administrator
    contract.view
    contract.manage
    contract.create
    contract.draft.manage
    contract.issue
    contract.execute

Finance/Commercial
    contract.view
    # no contract mutation permissions

Manager / Member/Professional / Field Worker / Read Only
    no automatic Package 004 contract grants
```

`OrganisationBootstrapService` carries the same defaults for future organisations, and integration tests enforce migration/bootstrap parity.

No Package 004 business table is added: Baseline v1 already contains `contracts`, `contract_versions`, version parties/addresses, value components, key dates, issue evidence, execution evidence and later finance structures. The application activates those normalised records without a parallel contract ledger.

The formation service retains exact accepted-quotation provenance through existing `project_id`, `opportunity_id` and `source_quotation_response_id` columns. The first `base_scope` value is derived from accepted quotation lines using the Package 003 fixed-precision decimal module. Project activation and finance records remain separate transactions.

This migration is data-only, so after all **12** current production migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The first executable controlled-contract candidate applied all **12** production migrations on MySQL 8.4.11 while preserving **344 / 749 / 429** and zero generated Kysely drift. The complete real-MySQL suite passed **15 integration files / 66 tests**, including Package 004 source provenance, idempotency, permission separation, immutable issue state, execution evidence and tenant masking, and `svelte-check` passed with **0 errors / 0 warnings**. The final documentation-synchronised head must pass the same gate before merge.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All changes are forward migrations.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed Dbmate SQL remains released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass MySQL 8.4 clean-build validation.
- Database-derived Kysely types must be regenerated after schema changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations must pass the full application migration and integration gate.
