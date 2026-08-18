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
- Corrections, period governance and year-end close use additive evidence.

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

Accounting permission family through Package 004O:

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
finance.accounting.year_end.prepare
finance.accounting.year_end.authorise
finance.accounting.year_end.reverse
```

Package 004N reporting adds no permission. Accounting read authority remains:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
```

Owner / Administrator receive the complete accounting family for existing and future organisations. Finance/Commercial receives `finance.accounting.view` only by default. Explicit granular member deny remains stronger than `finance.manage`.

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
/finance/accounting/year-end
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

Source-derived journals are balanced. There is no ordinary freehand journal-line mutation path. Correction creates an additive reversal journal. Generic CSV export records exact journal membership and a SHA-256 content checksum; export correction is additive.

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

Core modules:

```text
src/lib/server/finance/accounting-reporting-service.ts
src/lib/server/finance/accounting-year-end-reporting-service.ts
```

Protected workspace:

```text
/finance/accounting/reports
```

Package 004N derives tenant-, accounting-period- and currency-specific trial balance, P&L and balance-sheet reporting from immutable journal lines. Controlled year-end close/reversal journals remain in trial-balance and balance-sheet evidence, while operating P&L excludes those closing mechanics so historical operating performance remains visible after retained-earnings transfer.

See `docs/47-controlled-trial-balance-financial-reporting.md`.

## Package 004O — year-end close and retained earnings

Core modules:

```text
src/lib/server/finance/accounting-year-end-service.ts
src/lib/server/finance/accounting-year-end-configuration-service.ts
src/lib/server/finance/accounting-year-end-reporting-service.ts
```

Protected workspace:

```text
/finance/accounting/year-end
```

A year-end preparation requires complete financial-year period coverage, every period `hard_closed`, an active retained-earnings mapping to an equity account and revenue/expense journal movement for the selected currency.

The service fingerprints the governed source journals and periods, persists immutable preparation evidence and re-derives the fingerprint under the organisation accounting mutex before authorisation. The authorising member must differ from the preparer.

The generated `year_end_close` journal closes revenue and expense balances into retained earnings on the financial-year end date. Correction creates an additive reversal journal and year-end reversal provenance; prior journals, periods and close evidence are never rewritten.

Concurrent authorisations serialize on the organisation accounting mutex so only one active close can win.

See `docs/48-controlled-year-end-close-retained-earnings.md`.

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

Package 004O release target:

```text
25 production migrations applied / 0 pending
384 tables / 857 foreign keys / 495 CHECK constraints
zero generated drift across database.d.ts + collections.d.ts + accounting.d.ts
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

The next accounting boundary is **Controlled Statutory Financial Statements**.
