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

Package 004L accounting permissions:

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

Package 004M adds:

```text
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
```

Owner / Administrator receive the complete accounting and period-governance families. Finance/Commercial receives `finance.accounting.view` only by default. Existing-tenant migration grants and future `OrganisationBootstrapService` grants use the same split, and explicit granular member deny remains stronger than `finance.manage`.

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

Operational finance remains authoritative. Accounting journals/reporting never replace those source facts.

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

Server-side enforcement:

- source posting requires an accounting date in exactly one configured `open` period;
- journal reversal requires its reversal date in an `open` period;
- accounting export must exactly match one configured `soft_closed` or `hard_closed` period;
- hard close is blocked until every journal in the period has active export evidence;
- export reversal from a `hard_closed` period is blocked until a reasoned reopen;
- every period status change is retained in `accounting_period_status_events`.

Financial years and accounting periods are tenant scoped, non-overlapping, and periods must be fully contained in their financial year.

The organisation row is the accounting governance mutex for period mutations and posting/export decisions. Locking/current reads preserve visibility after waits under MySQL `REPEATABLE READ`.

Period governance constrains creation of **new accounting evidence**. It never rewrites operational source events or already-posted journals.

See `docs/46-controlled-accounting-period-close.md`.

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

Package 004M release target:

```text
24 production migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero generated drift across database.d.ts + collections.d.ts + accounting.d.ts
37 integration files / 150 real-MySQL tests
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The next accounting boundary is **Controlled Trial Balance and Financial Reporting**.
