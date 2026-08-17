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

The production stream now contains **20 migrations**. The latest migration is:

- `20260817161500_bad_debt_writeoff_recovery.sql` — Package 004J invoice-specific bad-debt assessment, write-off/reversal evidence and payment-linked recovery/reversal evidence.

The Package 004J application structure is:

```text
362 base tables
804 foreign keys
465 CHECK constraints
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

Finance/Commercial receives ordinary operational AR, collections and credit-control responsibilities but does not receive `finance.manage`, `finance.invoice.void` or exceptional credit/write-off authority by default.

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
    ↓
Controlled Bad-Debt Assessment
    ↓
Recommendation → Write-off / Reversal
    ↓
Optional Payment-linked Recovery / Reversal
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
- [`docs/42-controlled-bad-debt-writeoff-recovery.md`](docs/42-controlled-bad-debt-writeoff-recovery.md)

## Operational accounts receivable

The authoritative invoice receivable is derived from controlled finance facts:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

No Package 004 workflow stores a mutable duplicate outstanding-balance field.

### Package 004G — controlled collections

Collection cases persist operational evidence only. Promises do not create cash and disputes do not alter invoice balances.

### Package 004H — collections automation policy

The protected `/finance/collections/automation` workspace provides versioned dunning policy, derived due-reminder candidates, explicit reminder generation, separately authorised dispatch, immutable delivery-attempt evidence and promise-due review. It does not claim a durable background scheduler or production provider adapter.

### Package 004I — controlled credit limits and holds

Protected route:

```text
/finance/credit-control
```

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

An enabled currency-specific limit blocks when projected exposure exceeds the limit. An active customer-wide credit hold blocks regardless of amount. Accepted-quotation project conversion and contract execution are the named commitment gates. Invoice issue remains available to bill existing work.

Exceptional continuation requires `finance.credit_control.override` or its `finance.manage` fallback plus a reason. Override evidence commits in the same transaction as the business transition.

Credit checks and invoice mutations use a canonical customer-first locking hierarchy plus current/locking receivable reads so a concurrent invoice issue cannot race past the commitment gate.

### Package 004J — controlled bad debt, write-off and recovery

Protected routes:

```text
/finance/bad-debt
/finance/bad-debt/[casePublicId]
```

Package 004J separates doubtful-debt assessment from loss recognition:

```text
Open invoice receivable
    ↓
Bad-debt case
    ↓
Immutable recommendation
    ↓
Separate write-off authorisation
    ↓
Active partial/full write-off
    ├── additive reversal
    └── later recovery from an existing payment receipt
            └── additive recovery reversal
```

A recommendation never changes the receivable. An active write-off does. A write-off reversal restores the receivable.

Recovery consumes existing payment capacity but **does not reopen customer receivable**:

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

A payment with active recovery evidence cannot be reversed until that recovery is explicitly reversed. Likewise an active write-off with active recovery cannot be reversed first.

Write-off tax treatment is captured explicitly as either `no_tax_adjustment` or `separate_tax_adjustment_required`; Package 004J does not silently post VAT/tax or general-ledger entries.

New permissions:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

Owner / Administrator receive all seven. Finance/Commercial receives view, case management, recommendation and recovery/recovery-reversal authority, but not write-off authorisation/reversal by default. All granular keys use `finance.manage` only as same-domain fallback and explicit granular deny still wins.

Current and historical receivable reporting is write-off aware: customer statements show write-off credits and reversal debits at their actual event times, aged receivables subtract write-offs active at the selected cutoff, and later recovery is not misrepresented as a customer receivable movement.

## Deliberate finance exclusions

Still not claimed implemented:

- FX conversion / cross-currency allocation, recovery or credit aggregation;
- refunds / outbound customer payments;
- bank-feed/payment-gateway ingestion and bank reconciliation;
- automated remittance matching;
- statutory general-ledger posting;
- VAT/tax bad-debt relief posting;
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
- expected-credit-loss/provisioning accounting or debt-sale assignment.

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

Package 004J release contract:

```text
20 production migrations applied / 0 pending
362 base tables / 804 foreign keys / 465 CHECK constraints
zero generated Kysely drift across core + collections outputs
full real-MySQL integration suite
svelte-check: 0 errors / 0 warnings
```

The exact test-file/test totals are recorded after the final documentation-synchronised PR head proves the complete gate.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
