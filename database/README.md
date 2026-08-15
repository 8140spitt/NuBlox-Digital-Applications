# NuBlox Database

This directory contains the implementation-level MySQL schema baseline for NuBlox.

## Target

- MySQL 8.4
- InnoDB
- `utf8mb4`
- UTC event timestamps
- 3NF by default

## Layout

```text
database/
├── README.md
├── schema/
│   ├── 001-platform-kernel.sql
│   ├── 001a-platform-kernel-integrity.sql
│   ├── 002-crm-parties.sql
│   ├── 003-sales-quotes.sql
│   ├── 004-contracts-finance.sql
│   ├── 005-procurement.sql
│   └── 006-workforce-time-scheduling.sql
└── seeds/
    └── (reference-data seeds added as schema domains are frozen)
```

`001a-platform-kernel-integrity.sql` is currently a no-op checkpoint retained during pre-development schema validation. The project tenant candidate key required by commercial tables is created at the beginning of Package 003 before dependent foreign keys are defined. This checkpoint may be consolidated away when the final migration baseline is frozen.

## Schema package order

Planned packages:

1. `001-platform-kernel.sql` — identity, organisations, careers, capabilities, permissions and projects
2. `001a-platform-kernel-integrity.sql` — reserved pre-development integrity checkpoint
3. `002-crm-parties.sql` — normalised people/organisations, roles, contacts, opportunities and CRM activity
4. `003-sales-quotes.sql` — units, tax reference, catalogue, estimates, quotation versions, issue/response and project conversion
5. `004-contracts-finance.sql` — contracts/appointments, contract amendments, invoices, credit notes, payments and allocations
6. `005-procurement.sql` — procurement packages, RFQs, supplier returns, evaluation, awards, purchase orders and receipts
7. `006-workforce-time-scheduling.sql` — workers, engagements, careers, competencies, credentials, cost rates, calendars, scheduling, attendance and timesheets
8. `007-project-information-documents.sql`
9. `008-site-quality-safety.sql`
10. `009-commercial-cost-control.sql`
11. `010-assets-maintenance.sql`

The numbered SQL files currently describe the target schema in dependency order. Once the SvelteKit MySQL access/migration library is selected, these packages must be translated into or adopted by that migration system without losing the documented constraints.

## Current schema documentation

- `docs/21-normalised-database-schema.md` — platform kernel
- `docs/22-crm-party-model.md` — CRM/party model
- `docs/23-sales-estimates-quotations.md` — sales, estimate and quotation model
- `docs/24-contracts-finance.md` — contracts, invoicing, credit notes, payments and allocations
- `docs/25-procurement.md` — procurement, supplier enquiry, evaluation, award, purchase ordering and receipts
- `docs/26-workforce-time-scheduling.md` — workforce identity, engagements, competence, scheduling, attendance and time approval

## Normalisation policy

See:

- `docs/06-data-model.md`
- `docs/21-normalised-database-schema.md`
- `docs/22-crm-party-model.md`
- `docs/23-sales-estimates-quotations.md`
- `docs/24-contracts-finance.md`
- `docs/25-procurement.md`
- `docs/26-workforce-time-scheduling.md`

Rules:

- 3NF is the default transactional design target.
- Many-to-many relations use junction tables.
- Stable business data is relational, not hidden in JSON.
- A real-world CRM party is represented once per tenant and may hold multiple business roles.
- Relationship attributes belong on relationship/junction tables rather than being duplicated onto master entities.
- Logical commercial documents are separated from their versions where version identity is materially required.
- Invoices and credit notes use a financial-document supertype with explicit subtypes rather than duplicated common header structures.
- Payment-to-invoice is many-to-many through allocation rows.
- Payment/allocation corrections use reversal records rather than deleting history.
- Procurement supplier identity remains in the Party model; procurement stages reference the same party rather than duplicating supplier master data.
- RFQ, supplier-return, award and purchase-order facts remain separate records rather than overwriting one another as a procurement process progresses.
- Split awards use associative rows rather than one-winner assumptions.
- Purchase-order receipts are separate facts; ordered, received and remaining quantities are not maintained as competing editable balances.
- User identity, CRM person identity and workforce identity remain separate entities with controlled links.
- Employment/engagement facts are effective/historical relationship records rather than mutable attributes on a global user.
- Workforce careers are many-to-many and remain descriptive/configurational rather than authorisation grants.
- Competency definitions, worker assessments, credential definitions and worker credentials remain separate facts.
- Worker cost rates and work-calendar assignments are effective-dated rather than overwritten in place.
- Planned schedule, actual attendance and claimed/approved timesheet time remain separate facts.
- Approved timesheet labour-cost snapshots are allowed as historical approval-time facts and must not silently recalculate from changed current rates.
- Reusable catalogue/reference data does not overwrite historical issued-document facts.
- Historical immutable snapshots are allowed where they represent facts at issue/approval/execution time.
- Ordinary derived quotation, invoice, credit-note, payment-status, PO-total, commitment, utilisation and expiry-state values are not stored merely for convenience; materialisation requires a documented performance reason.
- Tenant-scoping keys may form part of composite keys to permit MySQL to enforce tenant integrity.
- Foreign keys target explicit `PRIMARY`/`UNIQUE` candidate keys; do not rely on deprecated MySQL non-standard partial/non-unique FK behaviour.
- Any material denormalisation requires a documented reason and preferably an ADR.

## Migration rules

Before production development:

1. Select the MySQL query/ORM/migration tool.
2. Create the database ADR.
3. Consolidate/remove any temporary pre-development checkpoint files that are unnecessary in the final baseline.
4. Convert/adopt the numbered baseline packages as migrations.
5. Run every migration against a clean MySQL 8.4 instance in CI with default foreign-key restrictions enabled.
6. Test upgrade from the previous released schema.
7. Add integrity tests for every critical foreign/candidate-key rule.
8. Never modify an already-released production migration in place; add a new migration.

The current numbered files are a pre-production target-schema baseline. They may be corrected while design is still being validated; once the migration baseline is formally released, normal forward-only migration rules apply.

## Reference data

The canonical career source currently exists in:

- `docs/career-taxonomy-seed.json`
- `docs/career-taxonomy-seed.csv`

SQL/TypeScript seeding should consume an authoritative version-controlled dataset rather than maintaining a second manually edited list.

Package 002 contains initial controlled reference rows for party roles, identifier types, relationship types, opportunity participant roles and CRM activity types.

Package 003 contains initial global reference rows for units of measure and sales item types. Tenant-specific tax categories/rates are deliberately not globally hard-coded and should be created/configured through controlled onboarding/reference-data workflows.

Package 004 contains initial controlled reference rows for contract types, contract-party roles, contract value/key-date/amendment types and payment methods. Payment terms remain tenant-defined configuration.

Package 005 contains initial controlled reference rows for procurement package types and purchase-order types. Supplier identity and supplier-side roles continue to use Package 002 party data.

Package 006 contains initial controlled reference rows for workforce engagement types, worker cost-rate types and schedule-event types. Competency, credential and time-activity definitions remain tenant-configurable.

Before production migrations are frozen, the selected migration system should separate schema creation and idempotent reference-data seeding according to the project's migration convention.

## Security rule

No application repository/query may retrieve an organisation-owned record solely by its surrogate ID when tenant context is required. Tenant context and authorisation must be validated before returning data.

CRM records are tenant-private by default. A later NuBlox Network identity link must not silently turn tenant CRM records into globally shared records.

Issued commercial and finance records must not be recomputed from mutable current catalogue prices, CRM addresses, current tax-rate reference rows or changed payment defaults.

Contract execution, contract amendment agreement/rejection, financial-document issue/void, payment allocation and reversal are all privileged auditable actions.

RFQ issue, supplier-return submission, tender evaluation, award approval, PO approval/issue and receipt reversal are privileged auditable procurement actions.

Workforce cost rates are restricted commercial data and require a dedicated permission. Credential verification, workforce engagement changes, timesheet submission/approval/reopen, attendance correction and cost-rate changes are privileged auditable actions.
