# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** for businesses and professionals across construction and the built environment.

It combines a shared business-management core, a built-environment project/site/asset core, profession-specific capability packs, controlled cross-organisation collaboration, and structured workflow/automation across the building lifecycle.

## Business and brand foundation

Corporate and brand strategy documentation is maintained separately from the product specification:

- [NuBlox business entity](docs/branding/00-business-entity.md)
- [NuBlox brand strategy](docs/branding/01-brand-strategy.md)
- [NuBlox brand architecture and naming](docs/branding/02-brand-architecture-and-naming.md)
- [NuBlox verbal identity and messaging](docs/branding/03-verbal-identity-and-messaging.md)
- [NuBlox visual identity brief](docs/branding/04-visual-identity-brief.md)
- [NuBlox logo concept directions](docs/branding/05-logo-concept-directions.md)

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Authentication/session boundary:** Better Auth 1.6.25
- **Primary persistence:** MySQL 8.4 / InnoDB
- **Runtime query layer:** Kysely + mysql2
- **Production migrations:** Dbmate plain SQL
- **Database type generation:** kysely-codegen from the migrated MySQL schema
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

Architecture decisions are recorded under [`docs/adr`](docs/adr/README.md).

## Database implementation

The validated 001–010 relational domain baseline contains **337 base tables, 739 foreign keys and 427 `CHECK` constraints** and is consolidated into `database/migrations/20260815140337_baseline_v1.sql`.

The production stream now contains **16 migrations**. The latest activation is:

- `20260817103000_payment_allocation_permissions.sql` — Package 004E payment receipt, allocation and immutable reversal permissions.

The application structure remains **344 tables, 749 foreign keys and 429 `CHECK` constraints** because Packages 004C–004E activate normalised finance structures already present in the baseline.

Implementation-level database material is grouped under `/database`:

- [Database workflow and rules](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database baseline validation](database/validation/README.md)

## Application persistence boundary

```text
SvelteKit action / endpoint
          ↓
     Domain service
          ↓
       Repository / query boundary
          ↓
        Kysely
          ↓
      mysql2 pool
          ↓
      MySQL 8.4
```

Routes/components do not issue SQL directly. Tenant context and authorisation are mandatory server-domain concerns.

## Authentication and tenant trust boundary

```text
Better Auth session
        ↓
Explicit auth_user_links mapping
        ↓
Active NuBlox user
        ↓
Active organisation membership
        ↓
Organisation roles / member overrides
        ↓
Project membership scope where required
        ↓
Record / lifecycle business policy
```

The selected organisation cookie is only a selection hint. The server revalidates membership before constructing trusted tenant context.

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For a granular permission with a same-domain umbrella, the granular key is resolved first and the umbrella is considered only when the granular key has no explicit member/role decision.

## Granular RBAC and same-domain umbrellas

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
    ├─ finance.credit_note.issue
    ├─ finance.payment.create
    ├─ finance.payment.allocate
    ├─ finance.payment.allocation.reverse
    └─ finance.payment.reverse
```

**Umbrellas never cross domains.** Commercial authority does not grant contract authority; contract authority does not grant finance authority; finance authority does not grant commercial or contract mutations.

## Controlled account provisioning and standard roles

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent: an existing-organisation invitation or a self-service organisation bootstrap. Every new organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

### Owner / Administrator

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus all released granular Package 004 operational permissions. Existing organisations receive forward-migration grants and future organisations receive equivalent persisted grants from `OrganisationBootstrapService`.

### Finance/Commercial

Finance/Commercial receives ordinary commercial and operational AR responsibilities, including:

```text
finance.view
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
```

It deliberately does **not** receive `finance.manage` or `finance.invoice.void`. Invoice void remains the stronger exceptional issued-document lifecycle authority.

Manager, Member/Professional, Field Worker and Read Only do not receive automatic finance mutation authority. The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles.

## Implemented business chain

```text
CRM Opportunity
    ↓
Estimate
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Issued + Accepted Quotation
    ↓
Proposed Project
    ↓
Controlled Contract Formation
    ↓
Issued / Executed Contract
    ↓
Controlled Contract Amendments
    ↓
Customer Billing Defaults
    ↓
Draft Invoice
    ↓
Issued Invoice
    ↓
Controlled Credit Note / Exceptional Invoice Void
    ↓
Payment Receipt
    ↓
Controlled Payment Allocation
    ↓
Allocation / Payment Reversal
    ↓
Derived Outstanding Receivable
```

See:

- [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md)
- [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md)
- [`docs/33-contract-formation.md`](docs/33-contract-formation.md)
- [`docs/34-contract-amendments.md`](docs/34-contract-amendments.md)
- [`docs/35-accounts-receivable-invoices.md`](docs/35-accounts-receivable-invoices.md)
- [`docs/36-receivable-corrections.md`](docs/36-receivable-corrections.md)
- [`docs/37-payment-receipt-allocation.md`](docs/37-payment-receipt-allocation.md)

## Operational accounts receivable

### Package 004C — Billing settings and invoices

Protected routes:

- `/finance/billing`
- `/finance/invoices`
- `/finance/invoices/[invoicePublicId]`

Draft invoices are contract-anchored, tenant-scoped and legally unnumbered. Issue finalises due date, refreshes issue-date tax, snapshots customer/contact/address evidence, allocates the tenant invoice number, records issue/recipient/audit evidence and freezes ordinary mutation.

### Package 004D — Receivable corrections

Protected routes:

- `/finance/credit-notes`
- `/finance/credit-notes/[creditNotePublicId]`

Credit notes retain exact source-invoice-line provenance, positive correction magnitudes, original applied tax evidence, issue-time over-credit revalidation and original invoice party/address evidence. Exceptional invoice void is separately authorised and cannot bypass credit-note or active allocation history.

### Package 004E — Payment receipt and controlled allocation

Protected routes:

- `/finance/payments`
- `/finance/payments/[paymentPublicId]`

A payment is recorded as an immutable positive cash receipt with method, received date, currency, optional CRM payer and reference. Receipt creation does **not** imply an allocation.

Cash application is bounded by:

```text
Usable Payment
= Payment Amount
− Active Allocations

Outstanding Receivable
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Allocation locks the payment and invoice before recomputing both limits. It requires same-tenant, same-currency, issued invoice context and rejects either payment over-allocation or invoice over-allocation.

Allocation correction creates a `payment_allocation_reversals` row; the original allocation remains immutable. Payment reversal first creates reversal evidence for every still-active allocation in the same transaction and only then records the `payment_reversals` row.

The invoice detail workspace now displays issued credits, active cash and operational outstanding together. Settlement uses derived `open / part settled / settled` states without changing the legal invoice lifecycle.

### Deliberate finance exclusions

Still not claimed implemented:

- FX conversion / cross-currency allocation;
- refunds / outbound customer payments;
- automated bank-feed or payment-gateway ingestion;
- automated remittance matching;
- bank reconciliation;
- general-ledger posting;
- credit-note void/reversal;
- customer statements;
- aged receivables / dunning;
- configurable settlement/write-off policy;
- PDF rendering or production outbound invoice/credit-note delivery.

## Projects, participants and teams

The protected application exposes `/projects` and `/projects/[projectPublicId]` for member-scoped portfolios, project creation, invitation response, participant organisations, own-organisation team administration and lifecycle controls.

Normal in-project access requires organisation authority **and** active organisation participation **and** an active `project_members` row for the exact member. Project contextual roles never grant application permissions.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults and feature relevance. Reusable capabilities, organisation permissions, project membership scope and workflow state determine actual behaviour.

## Validation

From `app/`:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm test:integration
pnpm check
```

The executable Package 004E head is required to prove:

```text
16 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
19 integration files / 88 real-MySQL tests passed
finance/payment-allocation.integration.test.ts: 6/6 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
