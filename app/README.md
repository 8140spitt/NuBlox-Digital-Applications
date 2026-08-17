# NuBlox SvelteKit App

This app is a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Svelte 5 + SvelteKit with explicit server-side domain boundaries.
- Business rules live in domain/application services, not components.
- Route handlers authenticate, establish tenant context, validate input and orchestrate services.
- SQL remains behind server services/repositories through Kysely + mysql2.
- MySQL SQL migrations are authoritative; generated Kysely types are derivative.
- Authentication identity never implies organisation, CRM, commercial, contract, finance or project authority.
- Tenant-owned records are resolved through active tenant context rather than public/surrogate ID alone.
- Reporting derives from authoritative domain facts rather than parallel editable balance stores.
- Tax rates are effective-dated reference facts; later changes never rewrite issued-document tax evidence.
- Collections, credit control and bad-debt processing react to authoritative receivables but never create a second receivable ledger.

## Stack

- MySQL 8.4 / InnoDB
- Kysely 0.29.5 + mysql2 3.23.2
- Dbmate 2.34.1
- kysely-codegen 0.20.0
- Better Auth 1.6.25
- Svelte 5 / SvelteKit

## Request trust flow

```text
request
  ↓
correlation ID
  ↓
Better Auth session
  ↓
auth_user_links → active NuBlox user
  ↓
selected organisation cookie (hint only)
  ↓
active organisation + active membership proof
  ↓
trusted request locals
```

## Permission resolution

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

For granular permissions, `decideWithUmbrella()` resolves the granular key first and uses the same-domain umbrella only when the granular key has no explicit member/role decision. Explicit granular deny therefore cannot be bypassed.

Current umbrella families:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

Package 004J adds under `finance.manage`:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

Tax settings reuse released finance authority:

```text
finance.view                  → read tax settings
finance.billing.manage        → create tax categories / append effective rates
finance.invoice.draft.manage  → select tax and add invoice lines
```

Umbrellas never cross domains.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are maintained with equivalent persisted grants.

For Package 004J Finance/Commercial receives bad-debt view, case management, recommendation and recovery/recovery-reversal authority, but deliberately not write-off authorisation/reversal or `finance.manage`.

## Protected application surfaces

Key protected routes include:

```text
/dashboard
/crm
/commercial/estimates
/commercial/quotations
/commercial/quotations/[quotationPublicId]/convert
/projects
/contracts
/contracts/[contractPublicId]
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
/finance/bad-debt/[casePublicId]
/organisation
```

The `(app)` server layout rejects unauthenticated requests and redirects authenticated users without verified tenant context to organisation selection.

## Operational accounts receivable

Current server-domain modules include:

```text
src/lib/server/finance/finance-common.ts
src/lib/server/finance/billing-settings-service.ts
src/lib/server/finance/tax-settings-service.ts
src/lib/server/tax/tax-defaults.ts
src/lib/server/finance/invoice-service.ts
src/lib/server/finance/credit-note-service.ts
src/lib/server/finance/payment-service.ts
src/lib/server/finance/payment-control-service.ts
src/lib/server/finance/receivable-ledger.ts
src/lib/server/finance/receivable-position-service.ts
src/lib/server/finance/receivables-reporting-service.ts
src/lib/server/finance/receivables-control-reporting-service.ts
src/lib/server/finance/collections-service.ts
src/lib/server/finance/collections-automation-service.ts
src/lib/server/finance/credit-control-service.ts
src/lib/server/finance/credit-control-context.ts
src/lib/server/finance/bad-debt-common.ts
src/lib/server/finance/bad-debt-query-service.ts
src/lib/server/finance/bad-debt-mutation-service.ts
```

### Invoice tax configuration

`/finance/tax` lists organisation-owned tax categories and effective-dated rate history. The starter UK catalogue contains standard 20%, reduced 5%, zero 0%, exempt and outside-scope categories.

Provisioning is idempotent: matching tenant categories are preserved and existing rate history prevents a starter rate from being overlaid. Invoice draft line entry requires an explicit tax selection. At issue, the selected category is refreshed against the effective issue-date rate and the applied rate/tax evidence remains on the issued document.

Construction domestic reverse-charge treatment is not represented as a normal 0% category and remains a separate future workflow.

See `docs/42-invoice-tax-settings.md`.

### Authoritative receivable

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

`receivable-ledger.ts` is the shared calculation boundary for invoice position, customer reporting and credit utilisation. No editable outstanding or used-credit balance exists.

### Payment capacity

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

`PaymentControlService` integrates bad-debt recovery with the existing payment workflow so the same cash cannot be allocated and recovered twice. Ordinary payment reversal is blocked while active recovery evidence exists.

### Collections and credit control

Package 004G stores case/action/promise/dispute evidence. Package 004H adds versioned dunning policy, reminder generation/dispatch evidence and promise-due review. Package 004I adds projected-exposure credit limits/holds and commitment gates at accepted-quotation conversion and contract execution.

The Package 004I concurrency contract remains customer-first invoice locking plus current/locking issued-invoice reads, preventing concurrent invoice issue from racing past the commitment gate.

See `docs/39-controlled-collections-dunning.md`, `docs/40-collections-automation-policy.md` and `docs/41-controlled-credit-limits-holds.md`.

### Package 004J bad debt

`BadDebtQueryService` and `BadDebtMutationService` implement:

```text
invoice-specific assessment case
immutable recommendation
separate write-off authorisation
partial/full active write-off
additive write-off reversal
payment-linked bad-debt recovery
additive recovery reversal
```

A recommendation does not change receivable. Active write-off does. Write-off reversal restores receivable.

Recovery consumes existing payment capacity but does not reopen the customer debt. Active recovery must be reversed before either the source payment or write-off can be reversed.

Write-off authorisation always revalidates the recommendation against the **current** invoice outstanding balance under customer → invoice locking.

`ReceivablesControlReportingService` preserves historical statement/aging semantics while adding:

```text
write-off authorisation → statement credit
write-off reversal      → statement debit
```

Aging subtracts write-offs active as of the selected period end. Recovery is not shown as a customer receivable movement because the debt was already removed by the write-off.

See `docs/43-controlled-bad-debt-writeoff-recovery.md`.

## Generated database types

Kysely generation remains fully derivative of migrated MySQL and is split into:

```text
src/lib/server/db/generated/database.d.ts
    core schema, excluding receivable_*

src/lib/server/db/generated/collections.d.ts
    receivable_* collections, credit-control and bad-debt schema
```

`DatabaseSchema` composes the two generated `DB` interfaces so normal handles and transactions share one type authority.

## Transactional delivery boundary

`src/lib/server/email/email-delivery.ts` remains provider-neutral. Development/integration uses `EMAIL_DELIVERY_MODE=console`. A communication record never claims provider delivery unless a provider boundary actually performs and records that outcome.

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

Package 004J release contract:

```text
21 production migrations applied / 0 pending
362 tables / 804 foreign keys / 465 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
30 integration files / 129 real-MySQL tests
bad-debt core: 6 tests
bad-debt concurrency: 1 test
bad-debt bootstrap parity: 1 test
tax settings: 4 tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass this complete gate before merge.
