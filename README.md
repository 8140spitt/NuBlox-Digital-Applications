# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** for businesses and professionals across construction and the built environment.

It combines a shared business-management core, a built-environment project/site/asset core, profession-specific capability packs, controlled cross-organisation collaboration, and structured workflow/automation across the building lifecycle.

## Business and brand foundation

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
- **Database type generation:** kysely-codegen from migrated MySQL
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

Architecture decisions are recorded under [`docs/adr`](docs/adr/README.md).

## Database implementation

The validated 001–010 relational baseline contains **337 base tables, 739 foreign keys and 427 `CHECK` constraints** and is consolidated into `database/migrations/20260815140337_baseline_v1.sql`.

The production stream now contains **19 migrations**. The latest migration is:

- `20260817150000_credit_control_limits_holds.sql` — Package 004I controlled customer credit limits, credit-hold lifecycle, projected-exposure enforcement and reasoned override evidence.

The current validated Package 004I target is:

```text
356 base tables
789 foreign keys
459 CHECK constraints
```

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

Routes/components do not issue SQL directly. Tenant context, authorisation, record lifecycle and cross-domain policy are mandatory server-domain concerns.

## Authentication and tenant trust boundary

```text
Better Auth session
        ↓
auth_user_links
        ↓
Active NuBlox user
        ↓
Active organisation membership
        ↓
Organisation roles / member overrides
        ↓
Project membership scope where required
        ↓
Record / lifecycle / cross-domain policy
```

The selected organisation cookie is a selection hint only. The server revalidates active membership before trusted tenant context is constructed.

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For a granular permission with a same-domain umbrella, the granular key is resolved first and the umbrella applies only when the granular key has no explicit member/role decision. An explicit granular deny therefore cannot be bypassed.

## Same-domain permission umbrellas

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

**Umbrellas never cross domains.** Commercial authority does not grant contract or finance authority; contract authority does not grant finance authority; finance authority does not grant commercial or contract mutations.

The Package 004 operational finance family now includes billing, invoice, receivable correction, payment/allocation, collections automation and credit-control permissions. Package 004I adds:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
```

All four use `finance.manage` only as same-domain fallback.

## Standard organisation roles

Every organisation receives:

```text
Owner
Administrator
Manager
Finance/Commercial
Member/Professional
Field Worker
Read Only
```

The founding member receives **Owner only**. Careers/job titles remain separate from security roles.

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions.

Finance/Commercial receives ordinary operational AR, collections and credit-control responsibilities but does not receive `finance.manage`, `finance.invoice.void` or `finance.credit_control.override` by default.

For Package 004I its defaults are:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
```

The exceptional override remains Owner/Administrator/custom delegation by default. Existing-tenant migration grants and future `OrganisationBootstrapService` grants are persisted and integration-tested for parity.

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
Credit-Control Commitment Gate
    ↓
Proposed Project
    ↓
Controlled Contract Formation
    ↓
Issued Contract
    ↓
Credit-Control Commitment Gate
    ↓
Executed Contract
    ↓
Controlled Contract Amendments
    ↓
Customer Billing Defaults
    ↓
Draft / Issued Invoice
    ↓
Controlled Credit Note / Exceptional Invoice Void
    ↓
Payment Receipt + Controlled Allocation/Reversal
    ↓
Derived Customer Receivable
    ↓
Customer Statement + Aged Receivables
    ↓
Controlled Collections Case
    ↓
Versioned Dunning Policy + Reminder Evidence
```

Detailed business specifications:

- [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md)
- [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md)
- [`docs/33-contract-formation.md`](docs/33-contract-formation.md)
- [`docs/34-contract-amendments.md`](docs/34-contract-amendments.md)
- [`docs/35-accounts-receivable-invoices.md`](docs/35-accounts-receivable-invoices.md)
- [`docs/36-receivable-corrections.md`](docs/36-receivable-corrections.md)
- [`docs/37-payment-receipt-allocation.md`](docs/37-payment-receipt-allocation.md)
- [`docs/38-customer-statements-aged-receivables.md`](docs/38-customer-statements-aged-receivables.md)
- [`docs/39-controlled-collections-dunning.md`](docs/39-controlled-collections-dunning.md)
- [`docs/40-collections-automation-policy.md`](docs/40-collections-automation-policy.md)
- [`docs/41-controlled-credit-limits-holds.md`](docs/41-controlled-credit-limits-holds.md)

## Operational accounts receivable

The authoritative receivable is derived from immutable/controlled finance facts:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Package 004F statements/aging and Packages 004G–004I reuse that finance authority rather than creating parallel editable balances.

### Package 004G — controlled collections

Collection cases persist operational evidence only:

```text
Collection Case
    ├── immutable reminder/call/note actions
    ├── promise to pay
    └── receivable dispute
```

Promises do not create cash. Disputes do not alter invoice balances. Any financial correction still uses payment allocation, credit note or exceptional invoice-void authority.

### Package 004H — collections automation policy

The protected `/finance/collections/automation` workspace provides versioned dunning policy, derived due-reminder candidates, explicit reminder generation, separately authorised dispatch, immutable delivery-attempt evidence and promise-due review.

It does not claim a background scheduler or production provider adapter.

### Package 004I — controlled credit limits and holds

Protected route:

```text
/finance/credit-control
```

Credit policy is evidence, not a second ledger:

```text
Current Receivable
= authoritative issued finance facts

Projected Exposure
= Current Receivable
+ Proposed Commitment
```

An enabled currency-specific limit blocks only when:

```text
Projected Exposure > Credit Limit
```

Exact equality is permitted by the limit. A customer-wide active credit hold blocks regardless of amount.

Commitment values are derived from the transaction itself:

```text
Accepted quotation conversion
→ non-optional accepted quotation gross including stored tax evidence

Contract execution
→ sum of issued contract-version value components
```

Named enforcement boundaries:

```text
Quotation issue                 allowed — offer/pre-commitment
Accepted quotation conversion   CREDIT GATE
Contract draft/issue            allowed — preparation/pre-execution
Contract execution               CREDIT GATE
Invoice issue                    allowed — bill existing work
Credit/payment/collections       allowed — reduce/manage exposure
```

Exceptional continuation requires `finance.credit_control.override` (or `finance.manage` fallback) **and an explicit reason**. The override snapshots current receivable, proposed commitment, projected exposure, applicable limit/hold, actor and time, and is inserted in the same transaction as the project conversion or contract execution.

Credit checks serialize on the customer and all invoice documents for the same customer/currency before re-deriving the issued receivable. This prevents a concurrent draft→issued invoice transition from racing past the commitment check.

## Deliberate finance exclusions

Still not claimed implemented:

- FX conversion / cross-currency allocation or credit aggregation;
- refunds / outbound customer payments;
- bank-feed/payment-gateway ingestion and bank reconciliation;
- automated remittance matching;
- general-ledger posting;
- credit-note void/reversal;
- persisted/issued statement documents and automatic statement delivery;
- durable background scheduler/worker-driven collections execution;
- production outbound email/SMS/postal/portal reminder providers;
- automatic promise-breaking decisions;
- automatic credit-scoring/bureau integration or automatic limit changes;
- parent/group/guarantee/insurance credit limits;
- automatic hold placement/release;
- late-fee / interest calculation;
- legal/agency escalation;
- bad-debt/write-off processing.

## Projects, participants and teams

Normal in-project access requires organisation authority **and** active organisation participation **and** an active `project_members` row for the exact member. Project contextual roles classify context and never grant application permissions.

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

Package 004I release target:

```text
19 production migrations applied / 0 pending
356 base tables / 789 foreign keys / 459 CHECK constraints
zero generated Kysely drift across core + collections outputs
26 integration files / 117 real-MySQL tests
credit-control suite: 6 tests
credit-control concurrency suite: 1 test
credit-control projected-exposure suite: 1 test
credit-control bootstrap parity suite: 1 test
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the complete gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
