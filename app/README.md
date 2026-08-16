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

Same-domain umbrella families are:

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
    └─ finance.invoice.issue
```

`decideWithUmbrella()` resolves the granular key first and uses its umbrella only when the granular key has no explicit member/role decision. An explicit granular deny cannot be bypassed. Umbrellas never cross domains.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Package 004 amendment granular grants are also persisted explicitly so future bootstrap rows match existing-tenant forward migration grants.

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
```

Finance/Commercial deliberately does not receive `commercial.manage`, `commercial.quotation.convert`, `project.create`, `contract.manage` or `finance.manage`. Later finance capabilities therefore remain deliberate delegations.

Migration grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations are integration-tested for persisted-row parity.

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

Payment-term bases:

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
AND same-tenant contract
AND contract.lifecycle_status = active
AND executed contract-version baseline
AND executed client contract party
```

The draft inherits customer, optional primary billing contact, project, contract and contract currency.

Draft financial document identity is deliberately:

```text
document_kind = invoice
lifecycle_status = draft
document_number = NULL
```

No legal number is consumed until issue.

### Draft lines and tax

Invoice lines reuse `financial_document_items` and `financial_document_item_taxes`. Quantity/rate/tax calculations use the same fixed-precision commercial decimal module.

Tax selected on the draft is provisional. At issue the current effective tenant tax rate is resolved again and the line tax facts are refreshed before the document is frozen.

### Controlled issue

Issue requires `finance.invoice.issue OR finance.manage` and at least one line. If the customer billing profile requires a PO/reference, issue is blocked until it is present.

Issue atomically:

1. validates invoice policy;
2. finalises due date from issue date/payment term;
3. refreshes issue-date tax;
4. snapshots customer and billing-contact facts;
5. copies billing-address evidence;
6. serialises tenant invoice-number allocation;
7. sets the financial document to `issued`;
8. records issue/recipient evidence;
9. appends audit history.

The initial legal number format is tenant-local `INV-000001`, `INV-000002`, … . Draft numbers are never allocated.

Issued invoices reject ordinary header/line mutation. Delivery channel values are evidence only; production outbound invoice delivery is not claimed.

The invoice workspace derives:

```text
Current Contract Value
= executed baseline + agreed contract amendments

Previously Issued Contract Net
= net of other issued invoices for the same contract
```

These are controls, not ledger balances and not an automatic over-invoicing cap.

See `docs/35-accounts-receivable-invoices.md`.

## Project collaboration

Normal project access requires effective organisation permission plus active `project_organisations` participation and exact active `project_members` scope. Project contextual roles classify context and never grant application authority.

## Transactional delivery boundary

`src/lib/server/email/email-delivery.ts` remains provider-neutral. Development/integration uses `EMAIL_DELIVERY_MODE=console`. Quotation/contract/invoice issue records delivery evidence but does not claim production outbound delivery unless a provider workflow is implemented separately.

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

The first executable Package 004C AR head on MySQL 8.4.11 proved:

```text
14 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
17 integration files / 77 real-MySQL tests passed
finance/invoices.integration.test.ts: 5/5 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must pass the same gate before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, production document rendering/delivery, contract version 2+, automatic project activation, credit notes, invoice void/reversal workflow, payments, payment allocations, statements/aged receivables, general-ledger posting or bank reconciliation.
