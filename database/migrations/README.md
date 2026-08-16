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

### `20260816001000_accepted_quotation_project_conversion.sql`

Adds the granular cross-domain conversion permission:

```text
commercial.quotation.convert
```

Runtime conversion requires:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
```

No conversion table is added: Baseline v1 already contains `quotation_project_conversions`, which remains the authoritative idempotency/provenance ledger.

### `20260816005000_contract_formation_permissions.sql`

Activates Package 004 controlled contract formation through:

```text
contract.view
contract.manage
contract.create
contract.draft.manage
contract.issue
contract.execute
```

`contract.manage` is the Package 004 umbrella fallback. Package 004 authority is deliberately independent from `commercial.manage`.

Existing Owner/Administrator roles receive broad and granular first-slice contract authority. Finance/Commercial receives `contract.view` only. Future organisation bootstrap uses equivalent standard-role defaults.

No Package 004 business table is added: Baseline v1 already contains the normalised contract, version, party, value, date, issue, execution, amendment and finance structures.

### `20260816015500_contract_amendment_permissions.sql`

Activates controlled post-execution amendments by adding the granular delegation catalogue:

```text
contract.amendment.create
contract.amendment.draft.manage
contract.amendment.issue
contract.amendment.decide
```

The existing `contract.manage` permission remains the Package 004 umbrella fallback. The migration therefore does not add duplicate standard-role grants: Owner/Administrator already carry `contract.manage`, while narrower custom roles can be delegated individual amendment permissions. An explicit granular member deny still cannot be bypassed by the umbrella.

The migration adds no amendment tables because Package 004 already contains:

```text
contract_amendments
contract_amendment_value_adjustments
contract_amendment_key_date_changes
```

The application enforces active executed-baseline eligibility, signed fixed-precision value adjustments, key-date changes, immutable issued amendments, effective-date-before-issue, controlled agreement/rejection/withdrawal, audit evidence and tenant isolation.

After all **13** current production migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The Package 004 amendment candidate is validated through the same MySQL 8.4 gate as every production migration:

```text
13 production migrations
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
16 integration files / 72 real-MySQL tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove these exact results before merge; earlier executable amendment heads already proved the same structural contract and 16-file suite before the effective-date regression test was added.

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
