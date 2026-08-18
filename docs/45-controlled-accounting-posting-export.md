# Package 004L — Controlled General-Ledger Posting and Accounting Export Evidence

Status: executable application boundary under PR validation.

## Purpose

Package 004L introduces the first NuBlox accounting-posting boundary without turning operational finance records into an editable general ledger.

The governing rule is:

> Accounting evidence is derived from immutable operational source events. Posting never rewrites the invoice, credit note, payment, allocation, bad-debt or VAT-relief fact that created the accounting consequence.

The package provides:

```text
tenant chart of accounts
        ↓
semantic account-role mappings
        ↓
immutable NuBlox finance event
        ↓
deterministic balanced journal candidate
        ↓
controlled journal posting
        ↓
optional additive reversal journal
        ↓
provider-neutral CSV export evidence
        ↓
optional additive export reversal
```

There is deliberately no freehand journal-entry UI in this slice.

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

### `accounting_accounts`

Tenant-owned chart-of-accounts records contain:

- tenant-local account code;
- account name;
- account type (`asset`, `liability`, `equity`, `revenue`, `expense`);
- derived normal balance (`debit` or `credit`);
- active flag;
- creator and timestamps.

NuBlox does not impose one nominal-code numbering scheme across tenants.

### `accounting_account_mappings`

Operational source logic uses semantic roles rather than hard-coded account numbers:

```text
accounts_receivable
sales_revenue
vat_control
cash_receipts
customer_unapplied_cash
bad_debt_expense
bad_debt_recovery_income
```

Expected account-type policy is enforced by the service:

```text
accounts_receivable         → asset
sales_revenue               → revenue
vat_control                 → liability
cash_receipts               → asset
customer_unapplied_cash     → liability
bad_debt_expense            → expense
bad_debt_recovery_income    → revenue
```

Mapping changes are configuration facts. Existing posted journal lines retain their exact accounting-account foreign keys, so later remapping does not rewrite historical journals.

### `accounting_journal_entries`

Each journal records:

- tenant-local `JRN-000001...` number;
- exact source type and source public identifier;
- source event timestamp;
- source amount and currency;
- deterministic SHA-256 source fingerprint;
- accounting date;
- memo;
- posting member and timestamp.

### `accounting_journal_lines`

Every line records one exact tenant accounting account and exactly one positive debit or credit amount.

The application derives all journal lines from a supported source event and verifies:

```text
sum(debits) = sum(credits) = source_amount
```

The package does not expose an ordinary route that can create arbitrary unbalanced lines.

### `accounting_journal_entry_reversals`

Journal correction is additive. The original journal is never updated into a different accounting fact.

A reversal creates a new `journal_reversal` journal with the exact debit/credit sides inverted, then links original and reversal through `accounting_journal_entry_reversals`.

After an original source journal has been reversed, that immutable operational source may be posted again under the current account mappings. This supports controlled correction/reposting while preserving the full journal history.

### Accounting export tables

`accounting_export_batches` records:

- tenant-local `AEX-000001...` number;
- format (`generic_csv` in this slice);
- accounting period start/end;
- exported row count;
- SHA-256 checksum of the exact generated content;
- creator, timestamp and reason.

`accounting_export_batch_entries` records exactly which journals formed the export.

`accounting_export_reversals` records additive withdrawal/correction evidence. Reversing an export does not delete its batch or journal links; it makes those journals eligible for a later replacement export.

## Source types

The first 004L release derives candidates from:

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

Internal reversal journals use:

```text
journal_reversal
```

The journal source is the existing operational event. 004L does not create a parallel invoice/payment/write-off state machine.

## Posting transformations

### Issued invoice

```text
Dr accounts_receivable    invoice gross
Cr sales_revenue          invoice net
Cr vat_control            invoice VAT, when non-zero
```

Net and VAT are re-derived from immutable financial-document item/tax evidence.

### Issued credit note

```text
Dr sales_revenue          credit-note net
Dr vat_control            credit-note VAT, when non-zero
Cr accounts_receivable    credit-note gross
```

### Exceptional invoice void

```text
Dr sales_revenue          voided invoice net
Dr vat_control            voided invoice VAT, when non-zero
Cr accounts_receivable    voided invoice gross
```

The operational invoice remains voided through Package 004D; 004L records the accounting consequence only.

### Payment receipt

```text
Dr cash_receipts
Cr customer_unapplied_cash
```

Receipt and allocation are intentionally separate accounting events, mirroring Package 004E's separation of cash receipt from receivable application.

### Payment allocation

```text
Dr customer_unapplied_cash
Cr accounts_receivable
```

### Payment allocation reversal

```text
Dr accounts_receivable
Cr customer_unapplied_cash
```

### Payment reversal

```text
Dr customer_unapplied_cash
Cr cash_receipts
```

Operational payment/allocation reversal guards remain authoritative. Accounting posting does not bypass them.

### Bad-debt write-off

```text
Dr bad_debt_expense
Cr accounts_receivable
```

### Bad-debt write-off reversal

```text
Dr accounts_receivable
Cr bad_debt_expense
```

### Bad-debt recovery

The source payment receipt has already recognised the cash and unapplied-cash liability. Applying that cash as post-write-off recovery therefore records:

```text
Dr customer_unapplied_cash
Cr bad_debt_recovery_income
```

### Bad-debt recovery reversal

```text
Dr bad_debt_recovery_income
Cr customer_unapplied_cash
```

### Package 004K VAT-relief posting evidence

Relief claim / Box 4 evidence:

```text
Dr vat_control
Cr bad_debt_expense
```

Later recovery VAT repayment / Box 1 evidence:

```text
Dr bad_debt_expense
Cr vat_control
```

The 004K VAT-return posting/reversal evidence remains the tax-domain source fact; 004L records its accounting consequence.

## Source fingerprints and idempotency

Every source-derived candidate receives a SHA-256 fingerprint over:

```text
source type
source public ID
source event timestamp
currency
source amount
derived debit/credit lines
```

The fingerprint is stored on the journal as evidence of the exact transformation that was posted.

The active-source invariant is:

```text
one source type + source public ID
    → at most one active non-reversed journal
```

Concurrent posting attempts are serialised through tenant/source locking. A dedicated integration test requires one attempt to succeed and the competing attempt to reject.

A reversed source journal no longer counts as active, allowing controlled repost without deleting the original/reversal evidence.

## Accounting date and backfill policy

The operational event timestamp is immutable source evidence.

The accounting date defaults to the source-event date but may be supplied explicitly by an authorised accounting operator. This supports controlled backfill/correction into the intended accounting period.

Package 004L does **not** yet implement:

- accounting-period open/close locks;
- year-end close;
- automatic posting in chronological source order;
- mandatory dependency sequencing between every historical source event during initial backfill.

Those controls belong to a later period-close/accounting-governance boundary. An authorised operator can therefore backfill supported source events in an explicit accounting order; 004L preserves source timestamps and fingerprints so the distinction remains auditable.

## Permissions

Package 004L adds:

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

All granular keys use `finance.manage` only as the same-domain fallback. Explicit granular deny still wins.

Viewing requires:

```text
finance.view
AND
(finance.accounting.view OR finance.manage)
```

### Standard role defaults

Owner / Administrator:

```text
✓ view
✓ configure accounts/mappings
✓ post source-derived journals
✓ reverse journals
✓ create accounting exports
✓ reverse export evidence
```

Finance/Commercial:

```text
✓ view
✕ configure
✕ post
✕ journal reverse
✕ export
✕ export reverse
✕ finance.manage
```

The migration applies these grants to existing organisations. `OrganisationBootstrapService` is maintained with the same persisted split for future organisations and a dedicated integration test verifies parity.

## Application surface

```text
/finance/accounting
/finance/accounting/exports/[exportPublicId]
```

The workspace exposes:

- chart-of-accounts records;
- semantic mapping status;
- unposted source-event candidates;
- missing-mapping diagnostics;
- exact derived debit/credit preview;
- controlled journal posting;
- immutable journal history;
- additive reversal controls;
- accounting export creation/history;
- checksum-backed CSV download;
- additive export reversal.

The CSV download endpoint regenerates content from the persisted export-to-journal links and refuses delivery if the regenerated SHA-256 no longer matches the stored export evidence.

## Generic CSV format

The first provider-neutral export contains:

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

This is intentionally not labelled as a Sage, Xero, QuickBooks or other provider-specific import format.

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

Package 004L introduces a third generated database type partition:

```text
core         → generated/database.d.ts
receivable_* → generated/collections.d.ts
accounting_* → generated/accounting.d.ts
```

`DatabaseSchema` composes all three generated `DB` interfaces. MySQL migrations remain authoritative; the TypeScript files are derivative and the CI gate rejects generated drift.

## Deliberate exclusions

Package 004L does not implement:

- freehand/manual journals;
- provider-specific accounting adapters;
- direct Sage/Xero/QuickBooks API sync;
- bank reconciliation;
- bank-feed ingestion;
- chart-of-accounts import;
- accounting period close/lock;
- financial year close;
- trial balance, profit-and-loss or statutory balance-sheet presentation;
- retained earnings/year-end transfer;
- payroll accounting;
- fixed-asset depreciation journals;
- purchase-ledger/AP accounting beyond currently operational NuBlox source facts;
- FX revaluation/translation;
- cash-flow statement logic;
- complete statutory VAT account;
- direct HMRC/MTD submission;
- deletion or mutation of operational finance source facts.

## Candidate validation target

The migration predicts:

```text
23 production migrations / 0 pending
378 base tables
841 foreign keys
485 CHECK constraints
```

Focused release coverage is expected to include:

- Finance/Commercial view-only authority;
- Owner/Admin configuration/post/reversal/export authority;
- explicit granular accounting-post deny precedence over `finance.manage`;
- typed semantic mappings;
- issued-invoice net/VAT/gross journal derivation;
- exact balanced debit/credit persistence;
- one active journal per source event;
- concurrent duplicate-source rejection;
- additive reversal/repost;
- generic CSV checksum regeneration;
- active-export duplicate prevention and additive export reversal;
- future-organisation bootstrap parity;
- foreign-tenant journal/export masking;
- zero generated Kysely drift across all three outputs;
- Svelte/TypeScript diagnostics.

The schema counts and exact integration totals are release facts only after the exact documentation-synchronised PR head passes the complete MySQL 8.4 CI gate.
