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

The production stream now contains **15 migrations**. The latest application activation is:

- `20260817090000_receivable_correction_permissions.sql` — Package 004D controlled credit-note and exceptional invoice-void permissions.

The current application structure remains **344 tables, 749 foreign keys and 429 `CHECK` constraints** because Package 004D activates normalised finance structures already present in the baseline.

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
       Repository
          ↓
        Kysely
          ↓
      mysql2 pool
          ↓
      MySQL 8.4
```

Routes/components do not issue SQL directly. Tenant context and authorisation are mandatory domain/repository concerns.

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

Within one permission key, effective organisation permission precedence is:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

## Granular RBAC and same-domain umbrellas

NuBlox resolves a granular permission first and uses its umbrella only when the granular key has no explicit member/role decision. Explicit granular deny therefore cannot be bypassed.

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

**Umbrellas never cross domains.** `commercial.manage` does not grant contract authority; `contract.manage` does not grant finance authority; `finance.manage` does not grant commercial or contract authority.

## Controlled account provisioning and standard roles

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent: an existing-organisation invitation or a self-service organisation bootstrap. The `/start` flow creates the first or an additional organisation through the normalised user/organisation/member/role model; pending identities cannot enter the protected application.

Every new organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

### Owner / Administrator

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. Existing organisations receive forward-migration grants and future organisations receive equivalent persisted grants from `OrganisationBootstrapService`.

### Manager

Manager receives granular project and CRM party/contact authority without broad project/CRM umbrellas. Manager may have `project.create`, but does not automatically receive commercial, contract or finance authority.

### Finance/Commercial

Finance/Commercial currently receives:

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

Finance/Commercial deliberately does **not** receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
finance.manage
finance.invoice.void
```

This permits ordinary commercial AR work while keeping the stronger issued-invoice void capability and future payment/reversal authority deliberate.

Member/Professional receives `project.view + crm.view`, Field Worker receives `project.view`, and Read Only receives `project.view + crm.view`.

The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles.

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
```

See:

- [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md)
- [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md)
- [`docs/33-contract-formation.md`](docs/33-contract-formation.md)
- [`docs/34-contract-amendments.md`](docs/34-contract-amendments.md)
- [`docs/35-accounts-receivable-invoices.md`](docs/35-accounts-receivable-invoices.md)
- [`docs/36-receivable-corrections.md`](docs/36-receivable-corrections.md)

## Operational accounts receivable

### Billing settings and invoices — Package 004C

Protected routes:

- `/finance/billing`
- `/finance/invoices`
- `/finance/invoices/[invoicePublicId]`

Draft invoices are contract-anchored, tenant-scoped and legally unnumbered. Issue finalises due date, refreshes tax using the rate effective at the actual invoice issue date, snapshots customer/contact/address evidence, allocates `INV-000001…`, records issue/recipient/audit evidence and freezes ordinary mutation.

### Receivable corrections — Package 004D

Protected routes:

- `/finance/credit-notes`
- `/finance/credit-notes/[creditNotePublicId]`

The normal correction path is a **source-linked credit note**, not editing the invoice:

```text
Issued Invoice
    ↓
Draft Credit Note
    ├─ exact original invoice line
    ├─ partial/full original quantity
    ├─ original unit rate
    └─ original applied tax rate
    ↓
Issue-time source-quantity revalidation
    ↓
CN-000001… allocation
    ↓
Original invoice customer/address evidence copied
    ↓
Immutable Issued Credit Note
```

Credit-note values remain positive magnitudes; `document_kind = credit_note` supplies correction semantics. Issue locks the original invoice and rejects cumulative credits greater than the original line quantity.

A credit note uses the **original invoice's applied tax evidence**, not today's tax rate. This is intentionally different from invoice issue, which refreshes a draft using the tax rate effective when the invoice itself is issued.

### Exceptional invoice void

`finance.invoice.void` is stronger authority and is not granted to Finance/Commercial by default.

Void is reserved for an invalid issued document such as a duplicate. It requires an explicit reason and is blocked when:

- a draft or issued credit note already references the invoice; or
- an unreversed payment allocation exists.

A successful void preserves the invoice number, lines, tax, customer snapshots and issue evidence while recording `voided_by_member_id`, `voided_at` and `void_reason`.

**Still not claimed implemented:** credit-note void/reversal, payment receipt/application UI, payment allocation/application UI, payment/allocation reversal UI, authoritative post-cash outstanding balances, statements/aged receivables, general-ledger posting, bank reconciliation, PDF rendering or production outbound invoice/credit-note delivery.

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

The executable Package 004D head on MySQL 8.4.11 proved:

```text
15 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
18 integration files / 82 real-MySQL tests passed
finance/credit-notes.integration.test.ts: 5/5 passed
finance/invoices.integration.test.ts: 5/5 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
