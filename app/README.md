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
- Corrections use additive reversal evidence.

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

Package 004L finance permissions:

```text
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

Owner / Administrator receive all six. Finance/Commercial receives `finance.accounting.view` only by default. Existing-tenant migration grants and future `OrganisationBootstrapService` grants use the same split.

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
/finance/accounting/exports/[exportPublicId]
```

The Finance navigation includes the Accounting workspace.

## Authoritative receivable and cash capacity

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

These positions remain operational finance facts. Package 004L does not replace them with accounting balances.

## Package 004L accounting boundary

Current accounting modules:

```text
src/lib/server/finance/accounting-source-service.ts
src/lib/server/finance/accounting-service.ts
```

The source service resolves deterministic journal candidates from supported immutable operational events. The accounting service owns chart-of-accounts configuration, semantic mappings, posting, reversal, export and export reversal.

### Semantic mappings

```text
accounts_receivable         → asset
sales_revenue               → revenue
vat_control                 → liability
cash_receipts               → asset
customer_unapplied_cash     → liability
bad_debt_expense            → expense
bad_debt_recovery_income    → revenue
```

### Posting invariant

```text
sum(debits) = sum(credits) = source amount
```

The application exposes no ordinary freehand journal-line mutation path.

A posted journal stores the exact source type/public ID, source timestamp, currency, source amount, accounting date, SHA-256 fingerprint, posting member/time and exact account-linked debit/credit lines.

### Concurrency

Posting serialises at the organisation accounting mutex. Active-source and sequence reads use locking/current reads so a transaction that waits behind a competing poster sees the committed result under MySQL `REPEATABLE READ`.

```text
organisation mutex
    ↓
current source candidate
    ↓
current active-journal check
    ↓
current journal-number sequence
    ↓
post once or reject as already posted
```

The dedicated concurrency integration test requires one competing attempt to succeed and the other to reject with a domain validation error.

### Reversal

Journal correction is additive. The original remains immutable; reversal creates a new `journal_reversal` entry with debit/credit sides inverted and links the two journal facts.

### Accounting exports

The first export is provider-neutral `generic_csv`. Each export persists:

- tenant-local `AEX-...` number;
- period start/end;
- exact journal membership;
- row count;
- SHA-256 of generated content;
- creator/time/reason.

Download regenerates the CSV from persisted journal membership and refuses output when the regenerated checksum differs from the stored evidence. Export correction is additive through a reversal record.

See `docs/45-controlled-accounting-posting-export.md`.

## Generated database types

Kysely generation is fully derivative of migrated MySQL and split into three outputs:

```text
src/lib/server/db/generated/database.d.ts
    core schema excluding receivable_* and accounting_*

src/lib/server/db/generated/collections.d.ts
    receivable_* schema

src/lib/server/db/generated/accounting.d.ts
    accounting_* schema
```

`DatabaseSchema` composes all three interfaces so normal database handles and transactions use one type authority.

Configurations:

```text
.kysely-codegenrc.json
.kysely-collections-codegenrc.json
.kysely-accounting-codegenrc.json
```

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

Package 004L executable release contract:

```text
23 production migrations applied / 0 pending
378 tables / 841 foreign keys / 485 CHECK constraints
zero generated drift across database.d.ts + collections.d.ts + accounting.d.ts
35 integration files / 143 real-MySQL tests
accounting core: 5 / 5
accounting concurrency: 1 / 1
accounting bootstrap parity: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The next finance boundary is **Controlled Accounting Periods and Close Governance**.
