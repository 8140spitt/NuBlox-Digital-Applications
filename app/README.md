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

For granular mutations, `decideWithUmbrella()` resolves the granular key first and uses the same-domain umbrella only if the granular key has no explicit member/role decision. Explicit granular deny therefore cannot be bypassed.

Current umbrella families include:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

The activated finance mutation family is:

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
    └─ finance.payment.reverse
```

Umbrellas never cross domains. Package 004F reporting uses the established `finance.view` read boundary and adds no duplicate reporting permission.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are integration-tested for persisted grant parity.

Finance/Commercial receives ordinary operational AR responsibilities including invoice, credit-note and payment receipt/allocation/reversal permissions, but deliberately does not receive `finance.manage` or the stronger `finance.invoice.void` capability.

Any active member with `finance.view` can use the derived statement/aging surfaces; Package 004F does not change standard role templates.

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
- `/organisation`

The `(app)` server layout rejects unauthenticated requests and redirects authenticated users without a verified tenant to organisation selection.

## Commercial and contract boundaries

`src/lib/server/commercial` owns estimates, quotations, responses and accepted-quotation project conversion. Authoritative quantity/rate/money/tax arithmetic uses fixed-precision scaled integers rather than JavaScript binary floating point.

`src/lib/server/contracts` owns contract formation, issue/execution and controlled post-execution amendments. Issued/executed terms remain immutable through ordinary draft APIs.

See `docs/32-estimates-quotations.md`, `docs/33-contract-formation.md` and `docs/34-contract-amendments.md`.

## Operational accounts receivable

The finance implementation now includes:

```text
src/lib/server/finance/finance-common.ts
src/lib/server/finance/billing-settings-service.ts
src/lib/server/finance/invoice-service.ts
src/lib/server/finance/credit-note-service.ts
src/lib/server/finance/payment-service.ts
src/lib/server/finance/receivable-position-service.ts
src/lib/server/finance/receivables-reporting-service.ts
```

Normal finance access is:

```text
active NuBlox user
AND active organisation membership
AND finance.view for reads/reporting
AND granular finance permission OR finance.manage for mutations
AND same-tenant record scope
AND document/cash lifecycle policy
```

### Billing and invoices

`BillingSettingsService` owns payment-term/customer billing defaults. `InvoiceService` creates contract-anchored draft invoices, maintains fixed-precision lines/tax and performs controlled issue.

A draft invoice remains legally unnumbered. Issue finalises due-date/customer policy, refreshes issue-date tax, snapshots customer/contact/address evidence, allocates `INV-000001…`, records issue/recipient/audit evidence and freezes ordinary mutation.

See `docs/35-accounts-receivable-invoices.md`.

### Credit notes and invoice void

`CreditNoteService` creates source-linked credit notes against issued invoices. Every credit line retains exact source-invoice-line provenance, uses positive correction magnitude and preserves the original invoice's applied tax evidence. Issue locks the original invoice and prevents cumulative over-crediting.

Exceptional invoice void uses `finance.invoice.void`, requires an explicit reason, and is blocked by credit-note history or an unreversed payment allocation.

See `docs/36-receivable-corrections.md`.

### Payment receipt

`PaymentService.recordPayment()` requires:

```text
finance.payment.create OR finance.manage
AND active payment method
AND positive fixed-precision amount
AND valid currency
```

The receipt stores an optional same-tenant CRM payer, method, received date, amount, currency and reference. Recording cash does not imply allocation.

Selecting a payer requires `crm.view`; an unidentified receipt may be stored with no payer rather than fabricating identity.

### Controlled allocation

Cash application derives:

```text
Usable Payment
= Payment Amount
− Active Allocations

Outstanding Receivable
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

`PaymentService.allocate()` requires `finance.payment.allocate OR finance.manage` and:

- same tenant payment and invoice;
- non-reversed payment;
- issued invoice;
- exact currency match;
- positive allocation;
- allocation no greater than usable payment;
- allocation no greater than invoice outstanding.

The allocation transaction locks the payment first and target invoice second, then recomputes both balances before inserting the allocation. The first payment slice deliberately does no FX conversion.

A payer/customer mismatch is surfaced for review but not automatically rejected because valid third-party payments are possible.

### Allocation and payment reversal

An allocation is immutable. `finance.payment.allocation.reverse OR finance.manage` creates one `payment_allocation_reversals` record with actor, timestamp and explicit reason. The original allocation remains visible and the amount becomes usable on the payment and outstanding on the invoice again.

A payment receipt is immutable. `finance.payment.reverse OR finance.manage` creates a `payment_reversals` record only after the same transaction has created reversal evidence for every still-active allocation.

### Derived invoice position

`ReceivablePositionService` exposes the operational invoice position independently from the legal invoice lifecycle:

```text
open
part_settled
settled
```

The invoice detail UI displays issued credits, active cash and outstanding receivable together. A fully credited invoice may therefore be `settled` without being incorrectly described as paid.

See `docs/37-payment-receipt-allocation.md`.

### Customer statements and aged receivables

`ReceivablesReportingService` creates no new balance ledger. It derives customer account movements from immutable event timestamps:

```text
invoice issue       → debit
credit-note issue   → credit
payment allocation  → credit
allocation reversal → debit
invoice void        → credit
```

The service provides:

- current tenant receivable totals grouped by currency;
- customer account positions grouped by currency;
- Current / 1–30 / 31–60 / 61–90 / 91+ aging;
- tenant-timezone-aware statement periods;
- opening, running and closing balances;
- historical as-of aging that honours when later reversals actually occurred;
- foreign-tenant customer masking.

A raw payment receipt does not enter the customer statement until it is allocated to an invoice. This keeps the account balance reconciled to invoice receivable rather than treating unidentified/unallocated cash as customer credit.

Package 004F does not persist statement totals or perform FX aggregation. GBP/EUR positions remain separate.

See `docs/38-customer-statements-aged-receivables.md`.

## Project collaboration

Normal project access requires effective organisation permission plus active `project_organisations` participation and exact active `project_members` scope. Project contextual roles classify context and never grant application authority.

## Transactional delivery boundary

`src/lib/server/email/email-delivery.ts` remains provider-neutral. Development/integration uses `EMAIL_DELIVERY_MODE=console`. Quotation/contract/invoice/credit-note issue records delivery evidence but does not claim production outbound delivery unless a provider workflow is implemented separately.

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

The executable Package 004F code head on MySQL 8.4.11 proved:

```text
16 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
20 integration files / 93 real-MySQL tests passed
finance/receivables-reporting.integration.test.ts: 5/5 passed
finance/payment-allocation.integration.test.ts: 6/6 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass the same complete gate before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, production document rendering/delivery, contract version 2+, automatic project activation, credit-note void/reversal, FX allocation/reporting translation, refunds, bank-feed/payment-gateway ingestion, automated remittance matching, persisted/issued customer statements, automatic statement delivery, dunning/collections policy, bad-debt/write-off processing, general-ledger posting or bank reconciliation.
