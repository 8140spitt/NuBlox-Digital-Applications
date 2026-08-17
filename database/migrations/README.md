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

`20260815140337_baseline_v1.sql` consolidates validated pre-production domain packages 001–010.

Validated baseline structure:

```text
337 base tables
739 foreign keys
427 CHECK constraints
```

The baseline is intentionally irreversible. Non-production environments rebuild rather than rolling the entire baseline backward. Numbered design/provenance files under `database/schema/` remain frozen source material.

## Forward migration stream

```text
20260815145430_authentication_boundary.sql
20260815151500_account_provisioning.sql
20260815161900_organisation_administration_permissions.sql
20260815203700_project_workspace_permissions.sql
20260815211600_project_participants_team.sql
20260815214500_crm_contacts_permissions.sql
20260815222500_permission_granularity.sql
20260815223800_crm_opportunities_activities.sql
20260815231500_estimates_quotations_permissions.sql
20260816001000_accepted_quotation_project_conversion.sql
20260816005000_contract_formation_permissions.sql
20260816015500_contract_amendment_permissions.sql
20260816113000_accounts_receivable_invoice_permissions.sql
20260817090000_receivable_correction_permissions.sql
20260817103000_payment_allocation_permissions.sql
20260817124500_controlled_collections.sql
20260817144000_collections_automation_policy.sql
20260817150000_credit_control_limits_holds.sql
20260817161500_bad_debt_writeoff_recovery.sql
```

Including Baseline v1, the production stream contains **20 migrations**.

## Package 004F — migration-free reporting activation

Customer statements and aged receivables require no new persistent balance tables. Package 004F derives historical customer positions from immutable finance-event evidence.

## Packages 004G–004I

- `20260817124500_controlled_collections.sql` adds collection cases/actions/promises/disputes.
- `20260817144000_collections_automation_policy.sql` adds versioned dunning policy/reminder/delivery evidence.
- `20260817150000_credit_control_limits_holds.sql` adds versioned credit limits, customer holds and projected-exposure override evidence.

None of those packages creates a mutable receivable balance.

## Package 004J — `20260817161500_bad_debt_writeoff_recovery.sql`

Package 004J adds six additive evidence tables:

```text
receivable_bad_debt_cases
receivable_bad_debt_recommendations
receivable_write_offs
receivable_write_off_reversals
receivable_write_off_recoveries
receivable_write_off_recovery_reversals
```

### Bad-debt assessment

A bad-debt case is tenant/customer/invoice scoped and stores no receivable amount. One open case is enforced per tenant/invoice. Recommendations are immutable positive assessment facts and do not change the receivable.

### Write-off evidence

A write-off references one exact recommendation, case and invoice. It records a positive amount, authorising member/time/reason and explicit tax-treatment policy:

```text
no_tax_adjustment
separate_tax_adjustment_required
```

The migration does not post tax or general-ledger entries. A write-off reversal is additive one-to-one evidence; the original write-off remains immutable.

### Recovery evidence

A recovery references one exact write-off and one existing payment receipt. It consumes available payment capacity but does not reopen the already-written-off customer receivable. A recovery reversal restores payment capacity only.

### Receivable and payment rules

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

An active recovery must be reversed before either its write-off or source payment can be reversed.

### Permission family

The migration adds:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

All granular keys use `finance.manage` only as same-domain fallback.

Default persisted delegation:

```text
Owner / Administrator
    → all seven keys

Finance/Commercial
    → view
    → case manage
    → recommend
    → recovery record
    → recovery reverse
    ✕ write-off authorise
    ✕ write-off reverse
```

`OrganisationBootstrapService` persists the equivalent split for future organisations and a dedicated integration suite verifies those stored role-permission rows.

## Current structure

After all **20** production migrations the Package 004J target application structure is:

```text
362 base tables
804 foreign keys
465 CHECK constraints
```

The clean MySQL gate is authoritative for these counts.

## Current migration validation target

```text
20 production migrations applied / 0 pending
362 base tables / 804 foreign keys / 465 CHECK constraints
zero drift across core + collections generated Kysely outputs
full real-MySQL integration suite
svelte-check: 0 errors / 0 warnings
```

The exact final test-file/test totals are recorded after the documentation-synchronised release head passes the complete gate.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All production changes are forward migrations.
- A new product surface does not require a migration when existing normalised structures and authority already support it.
- A new persistent business fact requires a normalised forward migration rather than an application-only shadow store.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed Dbmate SQL remains released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass a clean MySQL 8.4 build.
- Database-derived Kysely types must be regenerated after structural changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations pass the full application migration/integration gate.
- Existing-tenant migration grants and future-organisation bootstrap grants remain aligned and integration-tested.
