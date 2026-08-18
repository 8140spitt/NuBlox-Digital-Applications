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

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

A granular key is resolved before its same-domain umbrella. The umbrella applies only on granular default-deny, so an explicit granular deny cannot be bypassed.

Current same-domain umbrellas:

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

Package 004L advances the production stream to:

```text
23 production migrations
378 base tables
841 foreign keys
485 CHECK constraints
```

Latest migration:

```text
20260818100000_accounting_posting_export.sql
```

Database material:

- [Database workflow](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database validation](database/validation/README.md)

## Application persistence boundary

```text
SvelteKit action / endpoint
          ↓
     Domain service
          ↓
       Query boundary
          ↓
        Kysely
          ↓
      mysql2 pool
          ↓
      MySQL 8.4
```

Routes and components do not issue SQL directly. Tenant context, authorisation, lifecycle state and cross-domain policy are server-domain concerns.

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
Controlled Accounting Journal Posting
    ↓
Checksum-backed Accounting Export Evidence
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

## Authoritative accounts receivable

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

No reporting, collections, credit-control, bad-debt, VAT-relief or accounting package stores a mutable duplicate receivable balance.

## Package 004L — controlled accounting posting and export

Protected routes:

```text
/finance/accounting
/finance/accounting/exports/[exportPublicId]
```

Package 004L introduces tenant chart-of-accounts records and semantic account mappings, then derives balanced journals from immutable operational finance events.

Supported source families include invoice/credit/void, payment/allocation/reversal, bad-debt write-off/recovery/reversal and Package 004K VAT-relief posting evidence.

```text
immutable source event
        ↓
deterministic debit / credit candidate
        ↓
controlled journal posting
        ↓
immutable journal + source fingerprint
        ↓
optional additive reversal journal
        ↓
generic CSV export + SHA-256 evidence
        ↓
optional additive export reversal
```

There is no freehand journal UI. Existing operational finance facts are never rewritten to make accounting history fit.

### Semantic account mappings

```text
accounts_receivable
sales_revenue
vat_control
cash_receipts
customer_unapplied_cash
bad_debt_expense
bad_debt_recovery_income
```

### Permissions

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

Owner / Administrator receive all six. Finance/Commercial receives `finance.accounting.view` only by default. Explicit granular deny still overrides `finance.manage` fallback.

Concurrent posting uses an organisation accounting mutex plus locking/current source and sequence reads. Under MySQL `REPEATABLE READ`, this ensures a transaction that waited for another poster sees the newly committed journal rather than an older snapshot.

Kysely generation is now partitioned across:

```text
app/src/lib/server/db/generated/database.d.ts
app/src/lib/server/db/generated/collections.d.ts
app/src/lib/server/db/generated/accounting.d.ts
```

See [`docs/45-controlled-accounting-posting-export.md`](docs/45-controlled-accounting-posting-export.md).

## Deliberate finance exclusions

Still not claimed implemented:

- freehand/manual journals;
- accounting-period open/close locks and year-end close;
- statutory trial balance / P&L / balance-sheet presentation;
- provider-specific Sage/Xero/QuickBooks integration;
- bank feeds and bank reconciliation;
- purchase-ledger/AP accounting beyond currently operational source events;
- FX revaluation/translation;
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

Package 004L executable release contract, validated by GitHub Actions run 402:

```text
23 migrations applied / 0 pending
378 tables / 841 foreign keys / 485 CHECK constraints
zero Kysely drift across core + collections + accounting outputs
35 integration files / 143 real-MySQL tests
accounting core: 5 / 5
accounting concurrency: 1 / 1
accounting bootstrap parity: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must reproduce this gate before merge.

The next finance boundary is **Controlled Accounting Periods and Close Governance**.

For detailed authorization rules see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
