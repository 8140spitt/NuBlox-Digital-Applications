# NuBlox SvelteKit App

This app is a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Svelte 5 + SvelteKit with explicit server-side domain boundaries.
- Business rules live in domain/application modules, not components.
- Route handlers authenticate, establish tenant context, validate input and orchestrate services.
- SQL remains behind services/repositories through Kysely + mysql2.
- MySQL SQL migrations are authoritative; generated Kysely types are derivative.
- Authentication identity never implies organisation, CRM, commercial, contract, finance or project authority.
- Tenant-owned records are always resolved through active tenant context rather than public/surrogate ID alone.

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

Within one key:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

Same-domain umbrella families include:

```text
project.manage
    ├─ project.lifecycle.manage
    ├─ project.participant.manage
    ├─ project.team.manage
    └─ project.participation.manage

crm.manage
    ├─ crm.party.manage
    ├─ crm.contact.manage
    ├─ crm.opportunity.manage
    └─ crm.activity.manage

commercial.manage
    ├─ commercial.estimate.manage
    ├─ commercial.quotation.manage
    ├─ commercial.quotation.issue
    ├─ commercial.quotation.response.record
    └─ commercial.quotation.convert

contract.manage
    ├─ contract.create
    ├─ contract.draft.manage
    ├─ contract.issue
    ├─ contract.execute
    ├─ contract.amendment.create
    ├─ contract.amendment.draft.manage
    ├─ contract.amendment.issue
    └─ contract.amendment.decide

finance.manage
    ├─ finance.billing.manage
    ├─ finance.invoice.create
    ├─ finance.invoice.draft.manage
    ├─ finance.invoice.issue
    ├─ finance.invoice.void
    ├─ finance.credit_note.create
    ├─ finance.credit_note.draft.manage
    └─ finance.credit_note.issue
```

`decideWithUmbrella()` resolves the granular permission first and uses its umbrella only when the granular key has no explicit member/role decision. An explicit granular deny cannot be bypassed. Umbrellas never cross domains.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing-tenant migrations and future `OrganisationBootstrapService` defaults are integration-tested for persisted grant parity.

Manager keeps delegated project and CRM party/contact authority without automatic commercial/contract/finance authority.

Finance/Commercial receives:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
contract.view
finance.view
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
```

Finance/Commercial deliberately does not receive `commercial.manage`, `commercial.quotation.convert`, `project.create`, `contract.manage`, `finance.manage` or `finance.invoice.void`.

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
- `/organisation`

The `(app)` server layout rejects unauthenticated requests and redirects authenticated users without a verified tenant to organisation selection.

## Commercial sales boundary

`src/lib/server/commercial` owns estimates, quotations, responses and accepted-quotation project conversion.

Authoritative quantity/rate/money/tax arithmetic uses fixed-precision scaled `BigInt` rather than JavaScript binary floating point:

```text
quantity    scale 6
money/rate  scale 4
percentage  scale 4
result      scale 4
```

Quotation issue locks/snapshots customer evidence. Accepted conversion requires commercial conversion authority **and** `project.create`; `quotation_project_conversions` is the idempotency/provenance ledger.

See `docs/32-estimates-quotations.md`.

## Controlled contracts

`src/lib/server/contracts` owns Package 004 contract formation, issue, execution and amendments.

Formation retains accepted-quotation/project provenance and creates version 1 in draft. Issue locks the version and records recipient evidence. Execution records signatory evidence and makes the logical contract active without changing project lifecycle.

Post-execution amendments use `contract_amendments` plus normalised signed value/key-date children. An effective date and substantive change evidence are required before issue. Issued amendments are immutable through draft APIs; only agreed amendments affect derived current contract value.

See `docs/33-contract-formation.md` and `docs/34-contract-amendments.md`.

## Operational accounts receivable

The finance implementation lives in:

```text
src/lib/server/finance/finance-common.ts
src/lib/server/finance/billing-settings-service.ts
src/lib/server/finance/invoice-service.ts
src/lib/server/finance/credit-note-service.ts
```

The normal finance read/mutation boundary is:

```text
active NuBlox user
AND active organisation membership
AND finance.view for reads
AND granular finance permission OR finance.manage for mutations
AND same-tenant record scope
AND finance document lifecycle policy
```

### Billing settings

`BillingSettingsService` activates existing `payment_terms` and `party_billing_settings` structures.

```text
invoice_date  → issue date + offset
end_of_month  → issue month end + offset
manual        → explicit due date
```

Customer defaults include payment term, currency reference, customer account reference and PO/reference-required policy.

### Contract → draft invoice

`InvoiceService.createFromContract()` requires:

```text
finance.invoice.create OR finance.manage
AND contract.view
AND same-tenant active contract
AND executed contract-version baseline
AND executed client contract party
```

The draft inherits customer, optional primary billing contact, project, contract and contract currency. Its legal identity remains:

```text
document_kind = invoice
lifecycle_status = draft
document_number = NULL
```

### Invoice lines, tax and issue

Invoice lines reuse `financial_document_items` and `financial_document_item_taxes`. Draft tax is provisional. Invoice issue re-resolves the effective tenant tax rate at the actual issue time, finalises due date and customer policy, snapshots customer/contact/address evidence, allocates `INV-000001…`, records issue/recipient/audit evidence and freezes ordinary mutation.

See `docs/35-accounts-receivable-invoices.md`.

## Receivable corrections

`CreditNoteService` activates the existing Package 004 credit-note/source model without introducing a parallel correction ledger.

### Issued invoice → draft credit note

Creation requires:

```text
finance.credit_note.create OR finance.manage
AND same-tenant source invoice
AND source invoice lifecycle = issued
AND source invoice has legal number
AND positive remaining creditable value
```

The correction is invoice-anchored, so it does not require a fresh `contract.view` traversal.

A draft credit note is:

```text
document_kind = credit_note
lifecycle_status = draft
document_number = NULL
```

### Exact source-line provenance

Every credit line is linked to exactly one original invoice line through `credit_note_item_sources`. The service copies source description, classification, unit rate, optional unit/catalogue/quotation provenance; the user supplies only the partial/full quantity to credit.

Credit quantities and amounts are positive magnitudes. `document_kind = credit_note` supplies correction semantics.

### Original tax evidence

Credit tax uses the original invoice line's persisted `applied_rate_percent`, not the tenant tax rate current on the credit-note date.

At issue the service rebuilds credit tax from the original invoice tax rows again, so the immutable correction reproduces the historic transaction being reversed.

### Over-credit safety

Draft composition checks the currently remaining source quantity. Issue is authoritative: it locks the original invoice, re-resolves all issued credit quantities and rejects any cumulative source quantity greater than the original invoice quantity.

### Credit-note issue

Issue requires `finance.credit_note.issue OR finance.manage` and atomically:

1. locks/revalidates the original invoice;
2. revalidates source quantities;
3. rebuilds tax from original invoice applied-rate evidence;
4. copies original invoice party/address snapshots;
5. allocates `CN-000001…`;
6. sets the credit note to `issued`;
7. records recipient/issue evidence;
8. appends audit evidence.

Issued credit notes reject ordinary draft mutation.

### Exceptional invoice void

`CreditNoteService.voidInvoice()` requires `finance.invoice.void OR finance.manage`, an issued invoice and explicit reason.

Void is blocked if:

- any non-void credit note references the invoice; or
- an unreversed payment allocation exists.

A successful void preserves the invoice number and issued evidence and records the standard Package 004 void fields.

Finance/Commercial does not receive `finance.invoice.void` by default.

See `docs/36-receivable-corrections.md`.

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

The executable Package 004D head on MySQL 8.4.11 proved:

```text
15 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
18 integration files / 82 real-MySQL tests passed
finance/credit-notes.integration.test.ts: 5/5 passed
finance/invoices.integration.test.ts: 5/5 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass the same gate before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, production document rendering/delivery, contract version 2+, automatic project activation, credit-note void/reversal, payment receipt/allocation application services, payment/allocation reversal application services, final outstanding balances, customer statements/aged receivables, general-ledger posting or bank reconciliation.
