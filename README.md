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

The production stream now contains **22 migrations**. The latest migration is:

- `20260818080000_vat_bad_debt_relief.sql` — Package 004K source-linked VAT bad-debt-relief preparation/authorisation/reversal, recovery repayment and VAT-return posting/reversal evidence.

The current Package 004K application structure is:

```text
370 base tables
824 foreign keys
473 CHECK constraints
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

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

A granular permission is resolved before its same-domain umbrella. The umbrella applies only on granular default-deny, so an explicit granular member deny cannot be bypassed.

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

Finance/Commercial receives ordinary operational AR, collections and credit-control responsibilities. For Package 004K it can view and prepare VAT bad-debt-relief evidence, but does not receive `finance.manage`, VAT-relief authorisation/reversal, VAT recovery-repayment authority or VAT-return posting authority by default.

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
Customer Billing Defaults + Tenant Tax Configuration
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
Controlled Collections + Credit Control
    ↓
Bad-Debt Assessment Case
    ↓
Immutable Recommendation
    ↓
Separate Write-off Authorisation / Reversal
    ↓
Optional Payment-linked Recovery / Reversal
    ↓
Controlled VAT Bad-Debt Relief
    ├─ Prepared source-tax evidence
    ├─ Separate relief authorisation / reversal
    ├─ VAT-return Box 4 posting evidence
    └─ Recovery-linked proportional VAT repayment
         └─ VAT-return Box 1 posting evidence
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
- [`docs/42-invoice-tax-settings.md`](docs/42-invoice-tax-settings.md)
- [`docs/43-controlled-bad-debt-writeoff-recovery.md`](docs/43-controlled-bad-debt-writeoff-recovery.md)
- [`docs/44-controlled-vat-bad-debt-relief.md`](docs/44-controlled-vat-bad-debt-relief.md)

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

### Invoice tax configuration

Protected route:

```text
/finance/tax
```

Tax categories are organisation-owned reference data with effective-dated rates. Existing organisations receive a starter UK catalogue through the data migration, while the application can idempotently provision the same starter set for a tenant that reaches invoice/tax settings without categories. Matching tenant-owned categories and existing rate history are preserved.

Starter categories are standard 20%, reduced 5%, zero 0%, exempt and outside-scope. Invoice lines require an explicit tax selection. Issue refreshes the selected category against the rate effective at the issue date and persists applied tax evidence. Construction domestic reverse-charge treatment remains a separate, unimplemented workflow rather than being represented as ordinary 0% tax.

See [`docs/42-invoice-tax-settings.md`](docs/42-invoice-tax-settings.md).

### Package 004J — controlled bad debt, write-off and recovery

Protected routes:

```text
/finance/bad-debt
/finance/bad-debt/[casePublicId]
```

Package 004J separates doubtful-debt assessment from loss recognition. A recommendation never changes receivable; an active write-off does; reversal restores receivable. Later recovery consumes payment capacity but does not reopen or reduce receivable again.

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

Write-off tax treatment is explicit as `no_tax_adjustment` or `separate_tax_adjustment_required` and Package 004J itself does not post VAT/tax relief or general-ledger facts.

See [`docs/43-controlled-bad-debt-writeoff-recovery.md`](docs/43-controlled-bad-debt-writeoff-recovery.md).

### Package 004K — controlled VAT bad-debt relief

Protected route:

```text
/finance/tax-relief
```

Package 004K starts only from an active 004J write-off marked `separate_tax_adjustment_required`.

```text
Active Write-off
    ↓
Prepared relief evidence
    ↓
Separate authorisation
    ↓
VAT Return Box 4 posting evidence
    ↓
Later recovery, if any
    ↓
Proportional VAT repayment
    ↓
VAT Return Box 1 posting evidence
```

The operator selects consideration against exact immutable invoice tax-snapshot lines. NuBlox calculates the VAT relief amount; a VAT rate or relief amount is never manually typed into the claim.

The issued invoice due date is authoritative for the six-month eligibility calculation when present. Authorisation revalidates the current eligibility window and remaining write-off/source-tax capacity.

Later repayment is tied to the exact bad-debt recovery. Its VAT-return posting period must contain the actual recovery receipt date.

All corrections use additive reversal records. Package 004J also blocks write-off/recovery reversals while dependent 004K VAT evidence remains active.

Package 004K records evidence that amounts were included in a VAT Return; it does not submit a VAT Return to HMRC and does not create a statutory general ledger.

New permissions:

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

Owner / Administrator receive all eight. Finance/Commercial receives view + prepare only by default. All granular keys use `finance.manage` only as same-domain fallback and explicit granular deny still wins.

See [`docs/44-controlled-vat-bad-debt-relief.md`](docs/44-controlled-vat-bad-debt-relief.md).

## Deliberate finance exclusions

Still not claimed implemented:

- construction domestic reverse-charge invoice treatment;
- FX conversion / cross-currency allocation, recovery or credit aggregation;
- refunds / outbound customer payments;
- bank-feed/payment-gateway ingestion and bank reconciliation;
- automated remittance matching;
- statutory general-ledger posting / double-entry journal engine;
- direct HMRC VAT Return / Making Tax Digital submission;
- complete VAT account / VAT control account;
- automatic proof of external VAT/legal eligibility facts;
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

Package 004K release contract:

```text
22 production migrations applied / 0 pending
370 base tables / 824 foreign keys / 473 CHECK constraints
zero generated Kysely drift across core + collections outputs
32 integration files / 136 real-MySQL tests
tax-relief: 6 tests
tax-relief bootstrap parity: 1 test
tax settings: 4 tests
bad-debt core: 6 tests
bad-debt concurrency: 1 test
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
