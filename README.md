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

The production stream now contains **14 migrations**. The latest application activation is:

- `20260816113000_accounts_receivable_invoice_permissions.sql` — Package 004 operational accounts-receivable permissions for billing settings and controlled invoices.

The current application structure remains **344 tables, 749 foreign keys and 429 `CHECK` constraints** because the Package 004B/004C permission migrations activate normalised contract/amendment/finance structures already present in the baseline.

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

NuBlox separates broad management authority into delegable responsibilities while retaining explicit same-domain umbrella compatibility:

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

The granular key is resolved first. Its umbrella is used only when the granular key has no explicit member/role decision. An explicit granular member deny therefore cannot be bypassed by an umbrella grant.

**Umbrellas never cross domains.** `commercial.manage` does not grant contract authority; `contract.manage` does not grant finance authority; `finance.manage` does not grant commercial or contract authority.

## Controlled account provisioning and standard roles

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent: an existing-organisation invitation or a self-service organisation bootstrap. The `/start` flow creates the first or an additional organisation through the normalised user/organisation/member/role model; pending identities cannot enter the protected application.

Every new organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

### Owner / Administrator

Owner and Administrator receive the broad project, CRM, commercial, contract and finance umbrellas plus the currently established granular permissions. Existing organisations receive the same released grants from forward migrations and future organisations receive them from `OrganisationBootstrapService`.

Package 004B amendment granular grants are persisted for Owner/Administrator as well as covered by `contract.manage`; this keeps migration and future-bootstrap role rows aligned rather than merely behaviorally equivalent.

### Manager

Manager receives granular project and CRM party/contact authority without broad project/CRM umbrellas. Manager may have `project.create`, but does not automatically receive commercial, contract or finance authority.

### Finance/Commercial

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

Finance/Commercial deliberately does **not** receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
finance.manage
```

That design permits the activated operational AR work without silently granting later payment, credit-note, reversal or wider finance capabilities.

Member/Professional receives `project.view + crm.view`, Field Worker receives `project.view`, and Read Only receives `project.view + crm.view`.

The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles.

## Organisation administration

The protected `/organisation` workspace provides member lifecycle, member-to-role assignment, invitation management, role management and permission grants.

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full organisation admin
```

Delegation ceilings, organisation-manager protection, self-mutation restrictions, cross-tenant rejection and final-manager lockout prevention are enforced in the domain layer.

## CRM parties, contacts, opportunities and activities

The protected `/crm` surface is a **private tenant CRM**, not a platform-global directory. CRM party identity is separate from NuBlox platform organisations, auth users, workforce records and project participants.

The implemented CRM includes party/contact administration, opportunities and activity timelines. Pipeline **stage** represents sales maturity while opportunity `status` represents terminal outcome (`open`, `won`, `lost`, `cancelled`).

See [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md).

## Estimates, quotations and project conversion

Package 003 is activated through pricing, issue/response evidence and accepted-quotation conversion:

```text
CRM Opportunity
    ↓
Estimate
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Issued + accepted Quotation Version
    ↓
Idempotent conversion
    ↓
Proposed Project / Job
```

Protected routes include:

- `/commercial/estimates`
- `/commercial/estimates/[estimatePublicId]`
- `/commercial/quotations`
- `/commercial/quotations/[quotationPublicId]`
- `/commercial/quotations/[quotationPublicId]/convert`

Authoritative calculation uses scaled `BigInt` decimal arithmetic rather than JavaScript binary floating point. `quotation_project_conversions` is the authoritative conversion idempotency/provenance ledger.

The conversion deliberately does **not** infer the CRM customer as a NuBlox participant, create a project site, activate the project, form a contract or create finance records.

See [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md).

## Controlled contract formation and execution

Package 004 formation is implemented as:

```text
Accepted Quotation Version
        ↓
Proposed Project
        ↓
Explicit Contract Formation
        ↓
Contract Version 1 (draft)
        ↓
Value components + key dates
        ↓
Issue lock + recipient evidence
        ↓
Execution + signatory evidence
        ↓
Active Contract
```

Protected routes are:

- `/contracts`
- `/contracts/new?project=[projectPublicId]`
- `/contracts/[contractPublicId]`

Formation retains exact `project_id`, `opportunity_id` and `source_quotation_response_id` provenance. Version 1 snapshots accepted customer evidence, derives initial `base_scope` from accepted quotation net lines using fixed-precision arithmetic, and becomes immutable after issue. Execution records one execution/signatory event and makes the logical contract active without changing project lifecycle.

See [`docs/33-contract-formation.md`](docs/33-contract-formation.md).

## Controlled contract amendments

Package 004 post-execution change is implemented using the existing normalised amendment model:

```text
Active + Executed Contract Baseline
        ↓
Draft Amendment
        ├── scope / terms narrative
        ├── signed value adjustment(s)
        └── key-date change(s)
        ↓
Issue / freeze
        ↓
Agreed | Rejected | Withdrawn
```

The amendment workspace is:

- `/contracts/[contractPublicId]/amendments/[amendmentPublicId]`

Creation requires an active contract with an executed baseline. The domain service requires an effective date and substantive change evidence before issue; issued amendments reject ordinary draft mutation.

Only **agreed** amendments affect the derived contractual position:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Rejected and withdrawn records remain historical evidence.

See [`docs/34-contract-amendments.md`](docs/34-contract-amendments.md).

## Operational accounts receivable

Package 004C now activates customer billing settings and controlled invoice preparation/issue:

```text
Active Executed Contract
        ↓
Customer Billing Defaults
        ↓
Draft Invoice
        ├── payment term / due-date policy
        ├── customer PO/reference
        └── fixed-precision lines + provisional tax
        ↓
Controlled Issue
        ├── issue-date tax refresh
        ├── tenant invoice-number allocation
        ├── customer/contact/address snapshots
        ├── issue/recipient evidence
        └── immutable issued invoice
```

Protected finance routes are:

- `/finance/billing` — tenant payment terms and customer billing defaults;
- `/finance/invoices` — invoice portfolio and executed-contract draft creation;
- `/finance/invoices/[invoicePublicId]` — invoice header, lines/tax, contract-value context, issue controls and immutable evidence.

### Contract-anchored creation

The first invoice slice intentionally creates invoices only from an active contract with an executed contract-version baseline and `client` party. Creation requires `finance.invoice.create OR finance.manage` **and** `contract.view` because the contract is the source context.

The draft inherits customer, billing contact where available, project, contract and contract currency. It does not independently select a different customer or infer platform identity from CRM.

### Drafts are legally unnumbered

A new financial document remains:

```text
document_kind = invoice
lifecycle_status = draft
document_number = NULL
```

No legal invoice number is consumed when a draft is created. The first tenant-local issue format is `INV-000001`, `INV-000002`, … and allocation occurs only inside the controlled issue transaction. The existing unique document key remains the database guard against duplicate issued identity.

### Fixed-precision line and tax policy

Invoice lines reuse Package 004 `financial_document_items` and tax child rows. Quantity is six-decimal fixed precision; rates/money/tax are four-decimal fixed precision; authoritative arithmetic reuses the Package 003 scaled-`BigInt` module.

Tax selected during draft preparation is provisional. Immediately before issue, each tax fact is recalculated using the tenant tax-category rate effective at the actual issue date/time. The issued rate, taxable amount and tax amount then remain immutable evidence.

### Billing policy and due date

Payment terms support:

```text
invoice_date  → issue date + days offset
end_of_month  → end of issue month + days offset
manual        → explicit due date
```

If a customer billing profile requires a purchase-order/reference, issue is blocked until the draft carries it.

### Issue evidence and immutability

Issue validates policy, finalises the due date, refreshes tax, snapshots customer/billing-contact/address facts, assigns the document number, records issue/recipient evidence and changes the document to `issued`.

Issued invoices reject ordinary header and line mutation. The issue channel records evidence only; production outbound invoice email/API/portal delivery is not claimed.

The invoice workspace also derives current contract value and previously issued net for the same contract as controls. These are contextual facts rather than a simplistic automatic over-invoicing cap.

See [`docs/35-accounts-receivable-invoices.md`](docs/35-accounts-receivable-invoices.md).

**Still not claimed implemented in Package 004 finance:** credit notes, controlled invoice void/reversal UI, payments, payment allocations, customer statements, aged receivables/dunning, valuation/application-to-invoice automation, configurable statutory number formats, PDF rendering, production outbound invoice delivery, general-ledger posting or bank reconciliation.

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
pnpm check
pnpm test:integration
```

The first executable Package 004C AR head on MySQL 8.4.11 proved:

```text
14 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
17 integration files / 77 real-MySQL tests passed
finance/invoices.integration.test.ts: 5/5 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
