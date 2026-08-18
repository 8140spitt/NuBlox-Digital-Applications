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
```

Including Baseline v1, Package 004L contains **23 production migrations**.

## Package 004F — migration-free reporting activation

Customer statements and aged receivables derive historical customer positions from immutable finance-event evidence and therefore add no duplicate balance tables.

## Packages 004G–004I

- `20260817124500_controlled_collections.sql` — collection cases/actions/promises/disputes.
- `20260817144000_collections_automation_policy.sql` — versioned dunning policy/reminder/delivery evidence.
- `20260817150000_credit_control_limits_holds.sql` — credit-limit versions, holds and projected-exposure override evidence.

## Invoice tax configuration

`20260817180500_default_uk_tax_categories.sql` is a data-only migration that provisions the starter UK tax catalogue for existing organisations while preserving matching tenant categories and existing rate history.

See `docs/42-invoice-tax-settings.md`.

## Package 004J — bad debt

`20260817190000_bad_debt_writeoff_recovery.sql` adds six additive evidence tables for invoice-specific bad-debt assessment, immutable recommendation, write-off/reversal and payment-linked recovery/reversal.

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

Package 004J does not itself post tax relief or general-ledger entries.

See `docs/43-controlled-bad-debt-writeoff-recovery.md`.

## Package 004K — VAT bad-debt relief

`20260818080000_vat_bad_debt_relief.sql` adds eight additive VAT-relief evidence tables covering source-tax-linked claim preparation, separate authorisation/reversal, recovery-linked VAT repayment/reversal and VAT-return Box 4/Box 1 posting evidence/reversal.

Package 004K records tax-domain evidence only. It does not submit VAT returns or create a general ledger.

See `docs/44-controlled-vat-bad-debt-relief.md`.

## Package 004L — controlled accounting posting and export

`20260818100000_accounting_posting_export.sql` adds eight tenant-scoped accounting tables:

```text
accounting_accounts
accounting_account_mappings
accounting_journal_entries
accounting_journal_lines
accounting_journal_entry_reversals
accounting_export_batches
accounting_export_batch_entries
accounting_export_reversals
```

### Chart of accounts and mappings

Tenant-owned accounts are mapped to semantic finance roles:

```text
accounts_receivable
sales_revenue
vat_control
cash_receipts
customer_unapplied_cash
bad_debt_expense
bad_debt_recovery_income
```

Historical journal lines retain exact account foreign keys, so later remapping cannot rewrite posted history.

### Journal facts

A journal is derived from a supported immutable source event and stores:

- tenant-local `JRN-...` number;
- source type/public ID/timestamp;
- source amount/currency;
- SHA-256 source fingerprint;
- accounting date;
- posting member/time;
- exact balanced debit/credit lines.

```text
sum(debits) = sum(credits) = source amount
```

There is no freehand journal creation path in this package.

Correction creates an additive reversal journal and reversal-link fact. The source journal is not edited or deleted.

### Concurrency

Posting uses an organisation accounting mutex plus locking/current reads for active-source detection and sequence allocation. This prevents MySQL `REPEATABLE READ` from using a stale pre-wait snapshot after a competing poster commits.

At most one active non-reversed journal may exist for one source type/public ID.

### Export facts

`generic_csv` export batches retain exact journal membership, period, row count, SHA-256 content checksum, creator/time/reason and optional additive reversal evidence.

The application regenerates exported content from the persisted links and rejects download if the checksum no longer matches.

### Permission family

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

All use `finance.manage` only as same-domain fallback.

Default persisted grants:

```text
Owner / Administrator → all six
Finance/Commercial    → finance.accounting.view only
```

The migration and `OrganisationBootstrapService` persist the same split for existing and future organisations.

See `docs/45-controlled-accounting-posting-export.md`.

## Current structure

The clean MySQL 8.4.11 gate for Package 004L is authoritative:

```text
23 migrations applied
0 pending
378 base tables
841 foreign keys
485 CHECK constraints
```

## Current validation target

```text
23 production migrations applied / 0 pending
378 base tables / 841 foreign keys / 485 CHECK constraints
zero generated Kysely drift across core + collections + accounting outputs
35 integration files / 143 real-MySQL tests
accounting core: 5 / 5
accounting concurrency: 1 / 1
accounting bootstrap parity: 1 / 1
svelte-check: 0 errors / 0 warnings
```

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
