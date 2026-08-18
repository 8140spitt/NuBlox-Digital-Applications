# NuBlox SvelteKit App

This application is a Svelte 5 / SvelteKit modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Business rules live in server-domain services, not UI components.
- Route handlers authenticate, establish trusted tenant context, validate input and orchestrate services.
- SQL remains behind server services/query boundaries through Kysely + mysql2.
- MySQL migrations are authoritative; generated Kysely types are derivative.
- Authentication identity never implies tenant or domain authority.
- Tenant-owned records are resolved through active membership and same-tenant scope.
- Reporting and accounting derive from immutable domain facts instead of mutable shadow balances.
- Corrections and governance transitions use additive evidence.

## Permission resolution

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

A same-domain umbrella is used only when the granular key has no explicit member/role decision. Umbrellas never cross domains.

Current umbrella families:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

Accounting permissions released through Package 004M include:

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
```

Package 004N introduces no additional permission. Reports use the existing accounting read boundary:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
```

Owner / Administrator receive the complete accounting family. Finance/Commercial receives `finance.accounting.view` only by default. Explicit granular member deny remains stronger than `finance.manage`.

## Key protected finance routes

```text
/finance/billing
/finance/tax
/finance/invoices
/finance/credit-notes
/finance/payments
/finance/receivables
/finance/collections
/finance/collections/automation
/finance/credit-control
/finance/bad-debt
/finance/tax-relief
/finance/accounting
/finance/accounting/periods
/finance/accounting/reports
/finance/accounting/exports/[exportPublicId]
```

## Operational finance authority

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

Operational finance remains authoritative. Accounting journals and reports never replace source facts.

## Package 004L — accounting evidence

Core modules:

```text
src/lib/server/finance/accounting-source-service.ts
src/lib/server/finance/accounting-service.ts
```

Source-derived journals are balanced:

```text
sum(debits) = sum(credits) = source amount
```

There is no ordinary freehand journal-line mutation path. Correction creates an additive reversal journal. Generic CSV export records exact journal membership and a SHA-256 content checksum; export correction is additive.

See `docs/45-controlled-accounting-posting-export.md`.

## Package 004M — accounting period governance

Core module:

```text
src/lib/server/finance/accounting-period-service.ts
```

Protected workspace:

```text
/finance/accounting/periods
```

Period lifecycle:

```text
open -> soft_closed -> hard_closed
 ^                         |
 +------- reasoned reopen--+
```

Server-side enforcement requires open periods for posting/reversal, exact soft/hard-closed periods for export, export completeness before hard close and explicit reopen before reversing hard-closed export evidence.

See `docs/46-controlled-accounting-period-close.md`.

## Package 004N — trial balance and financial reporting

Core module:

```text
src/lib/server/finance/accounting-reporting-service.ts
```

Protected workspace:

```text
/finance/accounting/reports
```

Package 004N is migration-free. It derives reports from `accounting_journal_entries`, `accounting_journal_lines`, account metadata and the governed period calendar.

Each report is scoped to one tenant, one accounting period and one currency.

### Trial balance

```text
opening = journal net before period start
period  = debit / credit movement inside selected period
closing = journal net through period end
```

The service derives opening, period and closing debit/credit equality flags independently.

### Profit and loss

Revenue and expense accounts provide:

```text
period revenue
period expenses
period profit / loss
financial-year-to-date revenue
financial-year-to-date expenses
financial-year-to-date profit / loss
```

### Balance-sheet view

Asset, liability and equity accounts are presented at closing balance. Until a later year-end closing-journal boundary exists, cumulative revenue less expenses is shown explicitly as **unclosed earnings** and included in the balance-sheet equality control.

### Historical reversal semantics

An additive reversal journal changes reporting from its own accounting date onward. The original journal remains included in earlier periods, so historical prior-period reporting is not rewritten.

### Currency policy

GBP, EUR and other currencies remain separate. Package 004N does not translate or aggregate currencies.

An open-period report is labelled provisional because later journals/reversals can still affect it.

See `docs/47-controlled-trial-balance-financial-reporting.md`.

## Generated database types

Kysely generation remains fully derivative of migrated MySQL and split into:

```text
src/lib/server/db/generated/database.d.ts
src/lib/server/db/generated/collections.d.ts
src/lib/server/db/generated/accounting.d.ts
```

`DatabaseSchema` composes all three interfaces so normal handles and transactions use one type authority.

## Run

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Required server environment includes:

```text
DATABASE_URL
DB_POOL_MAX
BETTER_AUTH_URL
BETTER_AUTH_SECRET
EMAIL_DELIVERY_MODE
```

## Validate

```sh
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm test:integration
pnpm check
```

Package 004N release target:

```text
24 production migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero generated drift across database.d.ts + collections.d.ts + accounting.d.ts
38 integration files / 154 real-MySQL tests
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The next accounting boundary is **Controlled Year-End Close and Retained Earnings**.
