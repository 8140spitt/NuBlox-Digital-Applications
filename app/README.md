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
- Reporting derives from authoritative domain facts rather than creating parallel editable balance stores.
- Collections evidence can react to receivables but cannot mutate the receivable ledger.

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

For granular permissions, `decideWithUmbrella()` resolves the granular key first and uses the same-domain umbrella only if the granular key has no explicit member/role decision. Explicit granular deny therefore cannot be bypassed.

Current umbrella families:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

The active finance family includes:

```text
finance.manage
    ├─ finance.billing.manage
    ├─ finance.invoice.create
    ├─ finance.invoice.draft.manage
    ├─ finance.invoice.issue
    ├─ finance.invoice.void
    ├─ finance.credit_note.create
    ├─ finance.credit_note.draft.manage
    ├─ finance.credit_note.issue
    ├─ finance.payment.create
    ├─ finance.payment.allocate
    ├─ finance.payment.allocation.reverse
    ├─ finance.payment.reverse
    ├─ finance.collections.view
    ├─ finance.collections.case.manage
    ├─ finance.collections.action.record
    ├─ finance.collections.promise.manage
    └─ finance.collections.dispute.manage
```

Umbrellas never cross domains.

Package 004F statement/aging reads use `finance.view`. Package 004G collections reads require `finance.view` **and** `finance.collections.view` (with `finance.manage` available only as same-domain fallback for the collections key).

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are maintained with equivalent persisted grants.

Finance/Commercial receives ordinary operational AR and collections responsibilities, including all four payment permissions and all five collections permissions, but deliberately does not receive `finance.manage` or the stronger `finance.invoice.void` capability.

## Protected application surfaces

Current protected routes include:

- `/dashboard`
- `/crm`
- `/crm/[partyPublicId]`
- `/crm/opportunities`
- `/crm/opportunities/[opportunityPublicId]`
- `/commercial/estimates`
- `/commercial/estimates/[estimatePublicId]`
- `/commercial/quotations`
- `/commercial/quotations/[quotationPublicId]`
- `/commercial/quotations/[quotationPublicId]/convert`
- `/projects`
- `/projects/[projectPublicId]`
- `/contracts`
- `/contracts/new?project=[projectPublicId]`
- `/contracts/[contractPublicId]`
- `/contracts/[contractPublicId]/amendments/[amendmentPublicId]`
- `/finance/billing`
- `/finance/invoices`
- `/finance/invoices/[invoicePublicId]`
- `/finance/credit-notes`
- `/finance/credit-notes/[creditNotePublicId]`
- `/finance/payments`
- `/finance/payments/[paymentPublicId]`
- `/finance/receivables`
- `/finance/receivables/[customerPartyPublicId]`
- `/finance/collections`
- `/finance/collections/[customerPartyPublicId]`
- `/organisation`

The `(app)` server layout rejects unauthenticated requests and redirects authenticated users without a verified tenant to organisation selection.

## Operational accounts receivable

The finance implementation includes:

```text
src/lib/server/finance/finance-common.ts
src/lib/server/finance/billing-settings-service.ts
src/lib/server/finance/invoice-service.ts
src/lib/server/finance/credit-note-service.ts
src/lib/server/finance/payment-service.ts
src/lib/server/finance/receivable-position-service.ts
src/lib/server/finance/receivables-reporting-service.ts
src/lib/server/finance/collections-service.ts
```

### Invoice / credit / cash authority

The legal receivable remains derived from issued-document and cash-application facts:

```text
Outstanding Receivable
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Payment receipts, allocations and reversals are immutable/corrective facts. A fully credited invoice may be operationally `settled` without being described as paid.

See:

- `docs/35-accounts-receivable-invoices.md`
- `docs/36-receivable-corrections.md`
- `docs/37-payment-receipt-allocation.md`

### Customer statements and aging

`ReceivablesReportingService` derives customer account movements from immutable event timestamps:

```text
invoice issue       → debit
credit-note issue   → credit
payment allocation  → credit
allocation reversal → debit
invoice void        → credit
```

It provides currency-separated current aging, tenant-timezone-aware statement periods, opening/running/closing balances and historical as-of reconstruction. Unallocated cash does not enter a customer receivable statement until invoice allocation occurs.

See `docs/38-customer-statements-aged-receivables.md`.

### Controlled collections

`CollectionsService` is an operational workflow over the live 004F position.

```text
Overdue customer account
        ↓
Collection Case
    ├── immutable action evidence
    ├── promise to pay
    └── receivable dispute
```

Case creation requires a currently overdue positive receivable. The customer party is locked before checking for an existing `open`/`paused` case, making concurrent starts serialize on one customer record and normal retries idempotent.

A collection case does **not** store outstanding, overdue or settlement balances.

Normal direct actions are:

```text
reminder
phone_call
note
```

Promise-to-pay policy:

- positive fixed-precision amount;
- exact currency;
- due date;
- optional invoice link restricted to the same tenant and customer;
- invoice-linked promise currency must match invoice currency;
- `open → kept | broken | cancelled`;
- no cash or allocation is created by the promise.

Dispute policy:

- required reason;
- optional positive amount + currency pair;
- optional invoice link restricted to the same tenant and customer;
- `open → resolved | withdrawn`;
- no invoice, credit or outstanding balance is changed by dispute status.

Case lifecycle:

```text
open ↔ paused → closed
```

Closing requires an explicit reason and is blocked while any promise or dispute remains open. Closed cases reject ordinary mutation.

See `docs/39-controlled-collections-dunning.md`.

## Generated database types

Package 004G adds persistent `receivable_*` business facts. Kysely generation remains fully derivative of migrated MySQL and is split into two generated outputs:

```text
src/lib/server/db/generated/database.d.ts
    core schema, excluding receivable_*

src/lib/server/db/generated/collections.d.ts
    receivable_* collections schema
```

`DatabaseSchema` composes the two generated `DB` interfaces and both `Database` and `DatabaseExecutor` use that same composed schema. This keeps normal handles and Kysely transactions type-equivalent.

## Project collaboration

Normal project access requires effective organisation permission plus active `project_organisations` participation and exact active `project_members` scope. Project contextual roles classify context and never grant application authority.

## Transactional delivery boundary

`src/lib/server/email/email-delivery.ts` remains provider-neutral. Development/integration uses `EMAIL_DELIVERY_MODE=console`. Recorded collection reminder evidence does not claim actual outbound delivery unless a later provider workflow performs and proves that delivery.

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

The Package 004G release gate is:

```text
17 production migrations applied / 0 pending
348 tables / 767 foreign keys / 439 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
21 integration files / 100 real-MySQL tests passed
finance/collections.integration.test.ts: 7/7 passed
finance/receivables-reporting.integration.test.ts: 5/5 passed
finance/payment-allocation.integration.test.ts: 6/6 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass this complete gate before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, production document rendering/delivery, contract version 2+, automatic project activation, credit-note void/reversal, FX allocation/reporting translation, refunds, bank-feed/payment-gateway ingestion, automated remittance matching, persisted/issued customer statements, automatic statement delivery, automatic reminder delivery/scheduling, dunning-stage escalation, credit limits/holds, late fees/interest, legal/agency escalation, bad-debt/write-off processing, general-ledger posting or bank reconciliation.
