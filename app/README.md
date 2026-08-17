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
- Collections and credit control react to authoritative receivables but cannot become a second receivable ledger.
- Tax rates are effective-dated reference facts; later rate changes never rewrite issued-document tax evidence.

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

Package 004I adds under `finance.manage`:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
```

Umbrellas never cross domains.

Tax settings reuse released finance authority:

```text
finance.view             → read tax settings
finance.billing.manage   → create tax categories / append effective rates
finance.invoice.draft.manage → select tax and add invoice lines
```

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are maintained with equivalent persisted grants.

Finance/Commercial receives ordinary AR, collections and credit-control responsibilities. For Package 004I it receives view + limit management + hold management, but deliberately not `finance.credit_control.override` or `finance.manage`.

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
/organisation
```

The `(app)` server layout rejects unauthenticated requests and redirects authenticated users without verified tenant context to organisation selection.

## Operational accounts receivable

Current server-domain modules include:

```text
src/lib/server/finance/finance-common.ts
src/lib/server/finance/billing-settings-service.ts
src/lib/server/finance/tax-settings-service.ts
src/lib/server/finance/invoice-service.ts
src/lib/server/finance/credit-note-service.ts
src/lib/server/finance/payment-service.ts
src/lib/server/finance/receivable-ledger.ts
src/lib/server/finance/receivable-position-service.ts
src/lib/server/finance/receivables-reporting-service.ts
src/lib/server/finance/collections-service.ts
src/lib/server/finance/collections-automation-service.ts
src/lib/server/finance/credit-control-service.ts
src/lib/server/finance/credit-control-context.ts
```

Starter tax provisioning is isolated in:

```text
src/lib/server/tax/tax-defaults.ts
```

### Invoice tax configuration

`/finance/tax` lists organisation-owned tax categories and their effective-dated percentage-rate history.

The starter UK catalogue contains standard 20%, reduced 5%, zero 0%, exempt and outside-scope categories. The helper is idempotent: a matching tenant category is preserved, and any existing rate history prevents a starter rate from being added over it.

Invoice draft line entry requires the user to choose a tax explicitly. If no active categories are available, the invoice workspace presents a Tax settings recovery path instead of an unusable required selector.

At invoice issue, `InvoiceService` refreshes the selected category against the rate effective at the issue date and persists the applied rate/tax evidence with the financial-document line. Later rate changes therefore do not rewrite an issued invoice.

Construction domestic reverse-charge treatment is not represented as a normal 0% category and remains a separate future workflow.

See `docs/42-invoice-tax-settings.md`.

### Authoritative receivable

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

`receivable-ledger.ts` is the shared calculation boundary for invoice position and Package 004I credit utilisation. No editable used-credit balance exists.

### Collections

Package 004G stores case/action/promise/dispute evidence. Package 004H adds versioned dunning policy, due-reminder derivation, immutable generated reminder snapshots, separately authorised dispatch/retry evidence and promise-due review.

Collections automation still does not claim a background scheduler or production provider adapter.

### Package 004I credit control

`CreditControlService` implements:

```text
append-only currency-specific credit-limit revisions
customer-wide active/released credit holds
live customer utilisation
projected-exposure commitment checks
reasoned exceptional override evidence
```

Projected exposure is:

```text
Current Receivable + Proposed Commitment
```

The enabled limit blocks only when projected exposure is **greater than** the limit. Exact equality is allowed. A customer-wide active hold blocks regardless of amount.

Commitment adapters are explicit:

```text
commercial/quotation-credit-exposure.ts
    → accepted non-optional quotation gross including stored tax evidence

contracts/contract-credit-exposure.ts
    → issued contract-version value components
```

Enforcement is deliberately placed at:

```text
accepted quotation → proposed project conversion
contract execution
```

Quotation issue and contract issue remain pre-commitment. Invoice issue, credits, payments and collections remain available so existing work can be billed and exposure can be reduced/managed.

At enforcement, the service locks the customer plus all invoice documents for that customer/currency, then re-derives issued receivable exposure. This serializes a new commitment against a concurrent draft→issued invoice transition.

An override requires `finance.credit_control.override` or `finance.manage` fallback plus a non-empty reason. Override evidence includes current receivable, proposed commitment, projected exposure, limit/hold references, actor and time and is committed in the same transaction as the business commitment.

Commercial/contract pages may show that credit control blocks a transaction, but finance amounts are masked unless the actor also passes `finance.view` plus the credit-control read permission/fallback.

See `docs/41-controlled-credit-limits-holds.md`.

## Generated database types

Kysely generation remains fully derivative of migrated MySQL and is split into:

```text
src/lib/server/db/generated/database.d.ts
    core schema, excluding receivable_*

src/lib/server/db/generated/collections.d.ts
    receivable_* collections + credit-control schema
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

Current invoice-tax hotfix target:

```text
20 production migrations applied / 0 pending
356 tables / 789 foreign keys / 459 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
27 integration files / 121 real-MySQL tests
tax-settings: 4 tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass this complete gate before merge.
