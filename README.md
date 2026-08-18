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

Package 004M advances the production stream to:

```text
24 production migrations
381 base tables
848 foreign keys
492 CHECK constraints
```

Latest migration:

```text
20260818120000_accounting_period_close_governance.sql
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

Server-side accounting controls now require:

- journal posting accounting date → exactly one configured `open` period;
- journal reversal date → `open` period;
- export range → exact configured `soft_closed` or `hard_closed` period;
- hard close → every journal in the period has active export evidence;
- export reversal in a hard-closed period → explicit reopen first.

Period state constrains new accounting evidence and **never rewrites operational source events or already-posted journal history**.

New permissions:

```text
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
```

Owner / Administrator receive all three. Finance/Commercial remains `finance.accounting.view` only by default. Existing and future organisations use equivalent persisted grants, and integration coverage proves an explicit granular deny still overrides `finance.manage`.

See [`docs/46-controlled-accounting-period-close.md`](docs/46-controlled-accounting-period-close.md).

## Database-derived types

Kysely generation is partitioned across:

```text
app/src/lib/server/db/generated/database.d.ts
app/src/lib/server/db/generated/collections.d.ts
app/src/lib/server/db/generated/accounting.d.ts
```

All remain derivative of the migrated MySQL schema.

## Deliberate finance exclusions

Still not claimed implemented:

- automatic accounting-period generation;
- year-end closing journals / retained-earnings transfer;
- trial balance / P&L / balance-sheet presentation;
- statutory financial statements and consolidation;
- provider-specific Sage/Xero/QuickBooks integration;
- bank feeds and bank reconciliation;
- purchase-ledger/AP expansion beyond current operational sources;
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

Package 004M release target:

```text
24 migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero Kysely drift across core + collections + accounting outputs
37 integration files / 150 real-MySQL tests
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact documentation-synchronised PR head must reproduce this gate before merge.

The next accounting boundary is **Controlled Trial Balance and Financial Reporting**.

For detailed authorization rules see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
