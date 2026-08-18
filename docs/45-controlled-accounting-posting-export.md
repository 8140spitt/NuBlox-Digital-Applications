# Package 004L — Controlled General-Ledger Posting and Accounting Export Evidence

Status: implemented release candidate; executable head validated on MySQL 8.4.11 before documentation freeze.

## Purpose

Package 004L introduces NuBlox's first controlled double-entry accounting-posting boundary while preserving the operational finance ledger as the source of truth.

> **Accounting evidence is derived from immutable operational source events. Posting never rewrites the invoice, credit note, payment, allocation, bad-debt or VAT-relief fact that created the accounting consequence.**

```text
tenant chart of accounts
        ↓
semantic account mappings
        ↓
immutable operational source event
        ↓
deterministic balanced journal candidate
        ↓
controlled posting
        ↓
optional additive reversal journal
        ↓
provider-neutral CSV export evidence
        ↓
optional additive export reversal
```

There is deliberately no freehand journal-entry UI in this package.

## Persistence model

Package 004L adds eight tenant-scoped tables:

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

### Accounts and mappings

Tenant chart-of-accounts records use tenant-local account codes and one of:

```text
asset
liability
equity
revenue
expense
```

Operational source transformations use semantic mappings instead of hard-coded nominal codes:

```text
accounts_receivable         → asset
sales_revenue               → revenue
vat_control                 → liability
cash_receipts               → asset
customer_unapplied_cash     → liability
bad_debt_expense            → expense
bad_debt_recovery_income    → revenue
```

Changing a mapping never rewrites historical journal lines because each posted line retains the exact accounting-account foreign key used when it was posted.

## Journal evidence

Every source-derived journal records:

- tenant-local `JRN-000001...` number;
- exact source type and source public ID;
- source event timestamp;
- source amount and currency;
- SHA-256 source fingerprint;
- accounting date;
- memo;
- posting member and timestamp.

Each journal line records one exact account and exactly one positive debit or credit amount. The application validates:

```text
sum(debits) = sum(credits) = source amount
```

Correction is additive. A reversal creates a new `journal_reversal` journal with debit/credit sides inverted and links it to the original through `accounting_journal_entry_reversals`.

A reversed source journal no longer counts as active, allowing controlled repost under current mappings while preserving the original/reversal history.

## Supported source events

```text
invoice_issue
invoice_void
credit_note_issue
payment_receipt
payment_allocation
payment_allocation_reversal
payment_reversal
bad_debt_write_off
bad_debt_write_off_reversal
bad_debt_recovery
bad_debt_recovery_reversal
vat_relief_posting
vat_relief_posting_reversal
```

Internal reversal journals use `journal_reversal`.

## Posting transformations

### Issued invoice

```text
Dr accounts_receivable    gross
Cr sales_revenue          net
Cr vat_control            VAT, when non-zero
```

### Issued credit note / invoice void

```text
Dr sales_revenue          net
Dr vat_control            VAT, when non-zero
Cr accounts_receivable    gross
```

### Payment receipt

```text
Dr cash_receipts
Cr customer_unapplied_cash
```

### Payment allocation

```text
Dr customer_unapplied_cash
Cr accounts_receivable
```

Allocation reversal inverts that entry. Payment reversal debits unapplied cash and credits cash receipts.

### Bad debt

```text
write-off:
Dr bad_debt_expense
Cr accounts_receivable

write-off reversal:
Dr accounts_receivable
Cr bad_debt_expense

recovery:
Dr customer_unapplied_cash
Cr bad_debt_recovery_income

recovery reversal:
Dr bad_debt_recovery_income
Cr customer_unapplied_cash
```

### VAT bad-debt relief posting evidence

```text
relief claim / Box 4 evidence:
Dr vat_control
Cr bad_debt_expense

recovery VAT repayment / Box 1 evidence:
Dr bad_debt_expense
Cr vat_control
```

Package 004K remains the tax-domain source fact. Package 004L records only its accounting consequence.

## Idempotency and concurrency

The active-source invariant is:

```text
one source type + source public ID
    → at most one active non-reversed journal
```

Posting acquires the organisation accounting mutex and then performs active-source and number-allocation reads as **locking/current reads**. This is required under MySQL `REPEATABLE READ`: a transaction that waited for a competing poster must see the journal committed while it was waiting rather than falling back to an older consistent snapshot.

The competing duplicate-source attempt therefore rejects with a domain `FinanceValidationError`; it does not leak a raw duplicate journal-number error.

Source fingerprints cover source type, source public ID, source event timestamp, currency, source amount and derived debit/credit lines.

## Accounting date and backfill

The operational event timestamp remains immutable. Accounting date defaults to the source-event date but may be supplied explicitly by an authorised accounting operator.

Package 004L does **not** yet implement accounting-period locks or year-end close. Period governance is the next package boundary.

## Accounting exports

The first export format is provider-neutral `generic_csv`.

`accounting_export_batches` records tenant-local `AEX-000001...` number, period, row count, content SHA-256, creator/time and reason. `accounting_export_batch_entries` records the exact journals included.

CSV columns:

```text
journal_number
accounting_date
source_type
source_public_id
currency_code
account_code
account_name
description
debit
credit
memo
```

The download endpoint regenerates content from persisted batch/journal links and refuses delivery if the regenerated SHA-256 differs from persisted export evidence.

Export correction is additive through `accounting_export_reversals`; the original export evidence is not deleted.

## Permissions

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

All granular permissions use `finance.manage` only as same-domain fallback. Explicit granular deny still wins.

Viewing requires:

```text
finance.view
AND (finance.accounting.view OR finance.manage)
```

Default persisted authority:

```text
Owner / Administrator
    ✓ view
    ✓ configure
    ✓ post
    ✓ reverse
    ✓ export
    ✓ export reverse

Finance/Commercial
    ✓ view
    ✕ configure
    ✕ post
    ✕ reverse
    ✕ export
    ✕ export reverse
    ✕ finance.manage
```

The forward migration applies this split to existing organisations. `OrganisationBootstrapService` persists the same split for future organisations and real-MySQL integration coverage asserts parity.

## Application surface

```text
/finance/accounting
/finance/accounting/exports/[exportPublicId]
```

The Finance navigation exposes the Accounting workspace.

The workspace provides chart-of-accounts configuration, semantic mapping status, source-event candidates, missing-mapping diagnostics, debit/credit preview, posting, immutable journal history, reversal, export creation/history, checksum-backed CSV download and export reversal.

## Audit actions

```text
finance.accounting.account.created
finance.accounting.mapping.assigned
finance.accounting.journal.posted
finance.accounting.journal.reversed
finance.accounting.export.created
finance.accounting.export.reversed
```

## Kysely schema partition

Package 004L adds a third generated schema partition:

```text
core         → generated/database.d.ts
receivable_* → generated/collections.d.ts
accounting_* → generated/accounting.d.ts
```

`DatabaseSchema` composes all three. MySQL migrations remain authoritative and CI rejects drift in any generated output.

## Deliberate exclusions

Package 004L does not implement:

- freehand/manual journals;
- accounting-period open/close locks;
- financial-year close or retained-earnings transfer;
- trial balance, profit-and-loss or statutory balance-sheet presentation;
- provider-specific Sage/Xero/QuickBooks adapters or API sync;
- bank feeds or bank reconciliation;
- chart-of-accounts import;
- purchase-ledger/AP accounting beyond currently operational source facts;
- payroll accounting;
- fixed-asset depreciation;
- FX revaluation/translation;
- cash-flow statement logic;
- complete statutory VAT account;
- direct HMRC/MTD submission;
- deletion or mutation of operational finance source facts.

## Validated executable release contract

GitHub Actions run 402 validated the executable Package 004L head on MySQL 8.4.11:

```text
23 production migrations applied
0 pending

378 base tables
841 foreign keys
485 CHECK constraints

zero generated Kysely drift across:
- database.d.ts
- collections.d.ts
- accounting.d.ts

35 integration files
143 real-MySQL tests
143 passed

accounting core:             5 / 5
accounting concurrency:      1 / 1
accounting bootstrap parity: 1 / 1

svelte-check:
0 errors
0 warnings
```

The documentation-synchronised final PR head must reproduce this complete gate before merge.
