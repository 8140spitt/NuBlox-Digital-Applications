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
- Collections, credit control, bad-debt and VAT-relief processing react to authoritative facts but never create a second receivable ledger.
- Accounting corrections are additive evidence; original commercial/payment/tax facts are not silently rewritten.

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

Package 004K adds under `finance.manage`:

```text
finance.tax_relief.view
finance.tax_relief.prepare
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
```

Tax settings continue to reuse released finance authority:

```text
finance.view                  → read tax settings
finance.billing.manage        → create tax categories / append effective rates
finance.invoice.draft.manage  → select tax and add invoice lines
```

Umbrellas never cross domains.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are maintained with equivalent persisted grants.

For Package 004K Finance/Commercial receives VAT-relief view + preparation authority only. It deliberately does not receive authorisation/reversal, VAT repayment, VAT-return posting or `finance.manage` authority by default.

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
/finance/tax-relief
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
src/lib/server/finance/tax-relief-service.ts
src/lib/server/finance/tax-relief-control-service.ts
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

`BadDebtQueryService` and `BadDebtMutationService` implement invoice-specific assessment, immutable recommendation, separate write-off authorisation, additive write-off reversal, payment-linked recovery and additive recovery reversal.

A recommendation does not change receivable. Active write-off does. Write-off reversal restores receivable. Recovery consumes payment capacity without reopening customer receivable.

Package 004K adds dependency guards so a write-off cannot be reversed while an authorised VAT relief claim remains active, and a recovery cannot be reversed while active VAT repayment evidence still depends on it.

See `docs/43-controlled-bad-debt-writeoff-recovery.md`.

### Package 004K VAT bad-debt relief

`TaxReliefService` owns the transactional source-linked evidence workflow. `ControlledTaxReliefService` is the public application boundary used by `/finance/tax-relief` and adds authoritative statutory-date guards.

```text
active separate-tax-adjustment write-off
        ↓
prepared claim + source tax lines
        ↓
separate authorisation
        ↓
Box 4 VAT-return posting evidence
        ↓
later Package 004J recovery
        ↓
proportional VAT repayment
        ↓
Box 1 VAT-return posting evidence
```

Preparation stores the later-of-supply/due-date eligibility basis and explicit external-condition attestations. Where the issued invoice has a due date, that stored due date is authoritative and cannot be replaced with an earlier operator date.

VAT relief values are calculated from immutable `financial_document_item_taxes` source evidence rather than current tax settings or user-entered VAT amounts.

Authorisation revalidates eligibility, active write-off capacity and exact source-tax capacity under current/locking reads.

Later VAT repayment is derived proportionally from an exact active bad-debt recovery. The controlled posting boundary requires the repayment VAT period to contain the operational recovery's actual `recovered_at` date.

Claim, repayment and VAT-return posting corrections are all additive reversal records.

This application records VAT-return posting evidence only. It does not submit a VAT Return, maintain a complete statutory VAT account or create double-entry general-ledger journals.

See `docs/44-controlled-vat-bad-debt-relief.md`.

## Generated database types

Kysely generation remains fully derivative of migrated MySQL and is split into:

```text
src/lib/server/db/generated/database.d.ts
    core schema, excluding receivable_*

src/lib/server/db/generated/collections.d.ts
    receivable_* collections, credit-control, bad-debt and VAT-relief schema
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

Package 004K release contract:

```text
22 production migrations applied / 0 pending
370 tables / 824 foreign keys / 473 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
32 integration files / 136 real-MySQL tests
tax-relief: 6 tests
tax-relief bootstrap parity: 1 test
tax settings: 4 tests
bad-debt core: 6 tests
bad-debt concurrency: 1 test
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass this complete gate before merge.
