# Package 004N — Controlled Trial Balance and Financial Reporting

Status: executable migration-free reporting boundary pending final documentation-synchronised release gate.

## Purpose

Package 004N derives governed accounting reports from the immutable journal and accounting-period evidence introduced by Packages 004L and 004M.

The reporting layer never creates an editable reporting ledger and never becomes the source of truth for operational finance.

## Persistence model

Package 004N adds **no database tables and no migration**.

It derives from existing Package 004L/004M structures:

```text
accounting_accounts
accounting_journal_entries
accounting_journal_lines
accounting_journal_entry_reversals
accounting_financial_years
accounting_periods
```

The production stream therefore remains:

```text
24 migrations
381 base tables
848 foreign keys
492 CHECK constraints
```

## Read authority

Package 004N introduces no new permission.

Reporting requires the existing accounting read boundary:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

An explicit granular deny on `finance.accounting.view` remains stronger than `finance.manage`.

Finance/Commercial already receives `finance.accounting.view`, so it can inspect reports without gaining accounting configuration, posting, reversal, export or period-close authority.

## Reporting dimensions

Every report is:

- scoped to one tenant;
- scoped to one configured accounting period;
- scoped to one currency;
- derived through the selected period end date;
- based on immutable posted journal lines.

Currencies are never combined implicitly. GBP and EUR balances, for example, remain separate report views until a later explicit FX/reporting-currency boundary exists.

## Trial balance

For each accounting account, Package 004N derives:

```text
Opening balance
= journal debit/credit net before selected period start

Period movement
= debits and credits dated inside selected period

Closing balance
= journal debit/credit net through selected period end
```

The report presents debit and credit columns separately for opening and closing positions and raw debit/credit movement for the selected period.

Double-entry controls are shown independently for:

```text
opening debit  = opening credit
period debit   = period credit
closing debit  = closing credit
```

These equality checks are derived controls, not stored flags.

## Reversal semantics

A journal reversal remains a separate balanced journal dated at the reversal accounting date.

Package 004N therefore does **not** hide the original journal when a reversal exists. Both journal and reversal are included according to their accounting dates.

```text
Original journal in January
        ↓
January report includes original
        ↓
Reversal journal dated February
        ↓
January remains historically unchanged
February/later reports include both and therefore net the reversal
```

This preserves temporal accounting evidence without rewriting earlier reports.

## Profit and loss

P&L presentation derives from account types:

```text
revenue accounts
expense accounts
```

For the selected currency Package 004N shows:

- period revenue;
- period expenses;
- period profit / loss;
- financial-year-to-date revenue;
- financial-year-to-date expenses;
- financial-year-to-date profit / loss.

Financial-year-to-date is bounded by the selected period's financial-year start and period end.

## Balance-sheet view

Closing balances are classified from account types:

```text
asset
liability
equity
```

Until a later controlled year-end closing-journal boundary exists, cumulative revenue less cumulative expenses is displayed separately as:

```text
unclosed earnings
```

The report therefore checks:

```text
assets
=
liabilities
+ configured equity balances
+ unclosed earnings
```

Package 004N does not silently transfer current or prior-year earnings into retained earnings.

## Period status

Reports can be derived for open, soft-closed or hard-closed periods because the underlying journal evidence remains queryable.

An `open` period report is explicitly presented as **live / provisional** because later journals or reversals dated in that period can change the result.

Soft-closed and hard-closed reports use the same derivation; period status is governance context rather than an alternate balance store.

## Application surface

```text
/finance/accounting/reports
```

The workspace provides:

- accounting-period selection;
- currency selection;
- period status and date context;
- opening / movement / closing trial balance;
- trial-balance equality indicators;
- period and YTD P&L;
- closing balance-sheet presentation;
- explicit unclosed-earnings presentation.

## Deliberate exclusions

Package 004N does not implement:

- persisted report snapshots;
- statutory financial statements;
- Companies House filing;
- consolidated/group reporting;
- comparative prior-period columns;
- budgets or forecasts;
- cash-flow statement;
- FX translation/revaluation;
- automatic retained-earnings transfer;
- year-end closing journals;
- management-report distribution/export formatting beyond the current UI;
- purchase-ledger/AP expansion;
- bank reconciliation.

These later boundaries must continue to derive from governed journal evidence rather than introduce editable duplicate balances.

## Validation target

```text
24 production migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero generated Kysely drift across core + collections + accounting outputs
38 integration files / 154 real-MySQL tests
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting-period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact final release SHA becomes authoritative only after the documentation-synchronised PR head reproduces this full gate.
