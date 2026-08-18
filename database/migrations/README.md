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

```text
337 base tables
739 foreign keys
427 CHECK constraints
```

The baseline is intentionally irreversible. Non-production environments rebuild rather than rolling the whole baseline backward.

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
20260817180500_default_uk_tax_categories.sql
20260817190000_bad_debt_writeoff_recovery.sql
20260818080000_vat_bad_debt_relief.sql
20260818100000_accounting_posting_export.sql
20260818120000_accounting_period_close_governance.sql
```

Including Baseline v1, the production stream contains **24 migrations**.

## Migration-free reporting activations

### Package 004F — customer statements and aged receivables

Package 004F derives historical customer positions from immutable finance-event evidence and adds no duplicate balance tables.

### Package 004N — trial balance and financial reporting

Package 004N adds no persistent business fact and therefore no migration.

It derives:

```text
opening trial-balance position
period debit / credit movement
closing trial-balance position
period + YTD profit and loss
closing asset / liability / equity presentation
unclosed earnings
```

from existing Package 004L/004M accounting evidence:

```text
accounting_accounts
accounting_journal_entries
accounting_journal_lines
accounting_financial_years
accounting_periods
```

Reports are tenant-, period- and currency-specific. Reversal journals affect reporting at their own accounting date; no historical journal is deleted or suppressed. No report balance is persisted.

See `docs/47-controlled-trial-balance-financial-reporting.md`.

## Packages 004G–004I

- `20260817124500_controlled_collections.sql` — collection cases/actions/promises/disputes.
- `20260817144000_collections_automation_policy.sql` — versioned dunning policy/reminder/delivery evidence.
- `20260817150000_credit_control_limits_holds.sql` — credit-limit versions, holds and projected-exposure override evidence.

## Invoice tax configuration

`20260817180500_default_uk_tax_categories.sql` is a data-only migration that provisions the starter UK tax catalogue for existing organisations while preserving matching tenant categories and existing rate history.

See `docs/42-invoice-tax-settings.md`.

## Package 004J — bad debt

`20260817190000_bad_debt_writeoff_recovery.sql` adds additive evidence for bad-debt assessment, recommendation, write-off/reversal and payment-linked recovery/reversal.

## Package 004K — VAT bad-debt relief

`20260818080000_vat_bad_debt_relief.sql` adds additive VAT-relief claim, repayment and VAT-return posting evidence. It does not submit VAT returns or create a general ledger.

## Package 004L — accounting posting and export

`20260818100000_accounting_posting_export.sql` adds the source-derived accounting journal and generic export evidence model. No ordinary route accepts freehand debit/credit lines.

## Package 004M — accounting period and close governance

`20260818120000_accounting_period_close_governance.sql` adds:

```text
accounting_financial_years
accounting_periods
accounting_period_status_events
```

Posting/reversal requires an open period. Export requires an exact soft/hard-closed period. Hard close requires every journal in the period to have active export evidence, and hard-closed export evidence cannot be reversed until reasoned reopen.

See `docs/46-controlled-accounting-period-close.md`.

## Current structure

Because Package 004N is migration-free, the current clean MySQL 8.4.11 structure remains:

```text
24 migrations applied
0 pending
381 base tables
848 foreign keys
492 CHECK constraints
```

## Current validation target

```text
24 production migrations applied / 0 pending
381 base tables / 848 foreign keys / 492 CHECK constraints
zero drift across core + collections + accounting generated Kysely outputs
38 integration files / 154 real-MySQL tests
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

These totals become release authority only after the exact documentation-synchronised Package 004N head reproduces the complete gate.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- Production changes use forward migrations.
- A new product surface does not require a migration when existing normalised structures already support it.
- A new persistent business fact requires a normalised forward migration rather than an application-only shadow store.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed SQL remains schema authority.
- Destructive changes use expand/migrate/contract sequencing where required.
- Every migration change must pass a clean MySQL 8.4 build.
- Database-derived Kysely types must be regenerated after structural changes.
- Existing-tenant migration grants and future-organisation bootstrap grants must remain aligned and integration-tested.
