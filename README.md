# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** for businesses and professionals across construction and the built environment.

It combines a shared business-management core, a built-environment project/site/asset core, profession-specific capability packs, controlled cross-organisation collaboration and structured workflow/automation across the building lifecycle.

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Authentication:** Better Auth 1.6.25
- **Primary persistence:** MySQL 8.4 / InnoDB
- **Runtime query layer:** Kysely 0.29.5 + mysql2
- **Production migrations:** Dbmate plain SQL
- **Database type generation:** kysely-codegen from migrated MySQL
- **Architecture:** modular monolith with explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative

Architecture decisions are under [`docs/adr`](docs/adr/README.md).

## Governing security rule

> **Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

A granular key is resolved before its same-domain umbrella. The umbrella applies only on granular default-deny, so an explicit granular deny cannot be bypassed.

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

Umbrellas never cross domains.

## Current production database

The validated 001–010 baseline contains:

```text
337 base tables
739 foreign keys
427 CHECK constraints
```

Package 004O candidate stream:

```text
25 production migrations
384 base tables
857 foreign keys
495 CHECK constraints
```

Latest migration:

```text
20260818170000_year_end_close_retained_earnings.sql
```

Database material:

- [Database workflow](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database validation](database/validation/README.md)

## Implemented business chain

```text
CRM Opportunity
    ↓
Estimate
    ↓
Quotation
    ↓
Accepted Quotation
    ↓
Credit-Control Commitment Gate
    ↓
Project Conversion
    ↓
Controlled Contract Formation / Execution
    ↓
Contract Amendments
    ↓
Billing Settings + Tenant Tax Configuration
    ↓
Draft / Issued Invoice
    ↓
Credit Note / Exceptional Invoice Void
    ↓
Payment Receipt + Allocation / Reversal
    ↓
Derived Receivable + Statements / Aging
    ↓
Collections + Dunning + Credit Control
    ↓
Bad-Debt Assessment / Write-off / Recovery
    ↓
VAT Bad-Debt Relief Evidence
    ↓
Controlled Accounting Journal Posting / Reversal
    ↓
Checksum-backed Accounting Export Evidence
    ↓
Controlled Accounting Period / Close Governance
    ↓
Trial Balance + P&L + Balance-Sheet Reporting
    ↓
Controlled Year-End Close + Retained Earnings
```

Detailed finance specifications:

- [`docs/35-accounts-receivable-invoices.md`](docs/35-accounts-receivable-invoices.md)
- [`docs/36-receivable-corrections.md`](docs/36-receivable-corrections.md)
- [`docs/37-payment-receipt-allocation.md`](docs/37-payment-receipt-allocation.md)
- [`docs/38-customer-statements-aged-receivables.md`](docs/38-customer-statements-aged-receivables.md)
- [`docs/39-controlled-collections-dunning.md`](docs/39-controlled-collections-dunning.md)
- [`docs/40-collections-automation-policy.md`](docs/40-collections-automation-policy.md)
- [`docs/41-controlled-credit-limits-holds.md`](docs/41-controlled-credit-limits-holds.md)
- [`docs/42-invoice-tax-settings.md`](docs/42-invoice-tax-settings.md)
- [`docs/43-controlled-bad-debt-writeoff-recovery.md`](docs/43-controlled-bad-debt-writeoff-recovery.md)
- [`docs/44-controlled-vat-bad-debt-relief.md`](docs/44-controlled-vat-bad-debt-relief.md)
- [`docs/45-controlled-accounting-posting-export.md`](docs/45-controlled-accounting-posting-export.md)
- [`docs/46-controlled-accounting-period-close.md`](docs/46-controlled-accounting-period-close.md)
- [`docs/47-controlled-trial-balance-financial-reporting.md`](docs/47-controlled-trial-balance-financial-reporting.md)
- [`docs/48-controlled-year-end-close-retained-earnings.md`](docs/48-controlled-year-end-close-retained-earnings.md)

## Authoritative accounts receivable

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

No reporting, collections, credit-control, bad-debt, VAT-relief or accounting package stores a mutable duplicate receivable balance.

## Package 004L — controlled accounting evidence

Protected routes:

```text
/finance/accounting
/finance/accounting/exports/[exportPublicId]
```

Package 004L derives balanced journals from immutable operational finance events and supports additive journal reversal plus checksum-backed generic CSV export/reversal evidence. There is no ordinary freehand journal UI.

## Package 004M — controlled accounting periods and close governance

Protected route:

```text
/finance/accounting/periods
```

Package 004M adds tenant financial years, non-overlapping accounting periods and additive period-status evidence.

```text
open -> soft_closed -> hard_closed
 ^                         |
 +------- reasoned reopen--+
```

Server-side accounting controls require open periods for journal posting/reversal, exact closed-period ranges for export, export completeness before hard close, and explicit reopen before reversing hard-closed export evidence.

## Package 004N — controlled trial balance and financial reporting

Protected route:

```text
/finance/accounting/reports
```

Package 004N is a migration-free reporting activation under the existing `finance.view` + `finance.accounting.view` boundary.

Every report is tenant-, period- and currency-specific and derives only from immutable accounting journal lines. Trial balance and balance sheet include controlled year-end close/reversal journals; operating P&L excludes those close mechanics so historical operating performance remains visible after retained-earnings transfer.

Open-period reporting is explicitly provisional because later journals dated in the period can still change the result.

See [`docs/47-controlled-trial-balance-financial-reporting.md`](docs/47-controlled-trial-balance-financial-reporting.md).

## Package 004O — controlled year-end close and retained earnings

Protected route:

```text
/finance/accounting/year-end
```

Package 004O requires complete financial-year coverage by accounting periods and requires every period to be `hard_closed` before preparation. An active `retained_earnings` mapping must point to an equity account.

The close flow is additive and authority-separated:

```text
Hard-closed financial year
    ↓
Fingerprint immutable journal evidence
    ↓
Prepare close evidence
    ↓
Different member authorises
    ↓
Balanced year_end_close journal
    ↓
Revenue / expense balances -> retained earnings
```

The source fingerprint is re-derived under the organisation accounting mutex before authorisation. Concurrent authorisations serialize so only one active close can win. Corrections use an additive reversal journal and reversal provenance; prior journals, period history and close evidence are never rewritten.

Permissions:

```text
finance.accounting.year_end.prepare
finance.accounting.year_end.authorise
finance.accounting.year_end.reverse
```

Owner and Administrator receive all three for existing and future organisations. Finance/Commercial remains accounting-view only by default. Explicit granular deny continues to override `finance.manage` fallback.

See [`docs/48-controlled-year-end-close-retained-earnings.md`](docs/48-controlled-year-end-close-retained-earnings.md).

## Database-derived types

Kysely generation remains partitioned across:

```text
app/src/lib/server/db/generated/database.d.ts
app/src/lib/server/db/generated/collections.d.ts
app/src/lib/server/db/generated/accounting.d.ts
```

All are derivative of migrated MySQL.

## Deliberate finance exclusions

Still not claimed implemented:

- statutory financial statements and Companies House filing;
- consolidated/group reporting;
- cash-flow statement, budgets and forecasts;
- provider-specific Sage/Xero/QuickBooks integration;
- bank feeds and bank reconciliation;
- purchase-ledger/AP expansion beyond current operational sources;
- FX revaluation/translation or reporting-currency consolidation;
- direct HMRC VAT Return / MTD submission;
- construction domestic reverse-charge invoice workflow;
- expected-credit-loss/provisioning accounting;
- credit-note void/reversal.

## Validation

From `app/`:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm test:integration
pnpm check
```

Package 004O release target:

```text
25 migrations applied / 0 pending
384 tables / 857 foreign keys / 495 CHECK constraints
zero Kysely drift across core + collections + accounting outputs
40 integration files / 158 real-MySQL tests
accounting year-end: 3 / 3
accounting year-end bootstrap + explicit deny: 1 / 1
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact documentation-synchronised PR head must reproduce this gate before merge.

The next accounting boundary is **Controlled Statutory Financial Statements**.

For detailed authorization rules see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
