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
│   ├── 006-workforce-time-scheduling.sql
│   ├── 007-project-information-documents.sql
│   └── 007a-project-information-integrity.sql
└── seeds/
    └── (reference-data seeds added as schema domains are frozen)
```

`001a-platform-kernel-integrity.sql` is currently a no-op checkpoint retained during pre-development schema validation. `007a-project-information-integrity.sql` contains active pre-development hardening identified during Package 007 validation. Companion/checkpoint files should be consolidated into the final migration baseline before production migration history is frozen.

## Schema package order

Planned packages:

1. `001-platform-kernel.sql` — identity, organisations, careers, capabilities, permissions and projects
2. `001a-platform-kernel-integrity.sql` — reserved pre-development integrity checkpoint
3. `002-crm-parties.sql` — normalised people/organisations, roles, contacts, opportunities and CRM activity
4. `003-sales-quotes.sql` — units, tax reference, catalogue, estimates, quotation versions, issue/response and project conversion
5. `004-contracts-finance.sql` — contracts/appointments, contract amendments, invoices, credit notes, payments and allocations
6. `005-procurement.sql` — procurement packages, RFQs, supplier returns, evaluation, awards, purchase orders and receipts
7. `006-workforce-time-scheduling.sql` — workers, engagements, careers, competencies, credentials, cost rates, calendars, scheduling, attendance and timesheets
8. `007-project-information-documents.sql` — project sites, information containers/revisions, files, issue evidence, transmittals, RFIs, submittals, instructions, change events and reviews
9. `007a-project-information-integrity.sql` — Package 007 shared-site, reviewer-assignment and recipient-tenant integrity hardening
10. `008-site-quality-safety.sql`
11. `009-commercial-cost-control.sql`
12. `010-assets-maintenance.sql`

The numbered SQL files currently describe the target schema in dependency order. Once the SvelteKit MySQL access/migration library is selected, these packages must be translated into or adopted by that migration system without losing the documented constraints.

## Current schema documentation

- `docs/21-normalised-database-schema.md` — platform kernel
- `docs/22-crm-party-model.md` — CRM/party model
- `docs/23-sales-estimates-quotations.md` — sales, estimate and quotation model
- `docs/24-contracts-finance.md` — contracts, invoicing, credit notes, payments and allocations
- `docs/25-procurement.md` — procurement, supplier enquiry, evaluation, award, purchase ordering and receipts
- `docs/26-workforce-time-scheduling.md` — workforce identity, engagements, competence, scheduling, attendance and time approval
- `docs/27-project-information-documents.md` — project information, revisions, transmittals, RFIs, submittals, instructions, change events and review evidence

## Normalisation policy

See the domain documentation above and `docs/06-data-model.md`.

Rules:

- 3NF is the default transactional design target.
- Many-to-many relations use junction tables.
- Stable business data is relational, not hidden in JSON.
- A real-world CRM party is represented once per tenant and may hold multiple business roles.
- Relationship attributes belong on relationship/junction tables rather than being duplicated onto master entities.
- Logical commercial documents are separated from their versions where version identity is materially required.
- Invoices and credit notes use a financial-document supertype with explicit subtypes rather than duplicated common header structures.
- Payment-to-invoice is many-to-many through allocation rows; corrections use reversals rather than deletion.
- Procurement stages remain separate facts; supplier identity stays in the Party model and split awards use associative rows.
- User identity, CRM person identity and workforce identity remain separate entities with controlled links.
- Employment/engagement, cost rates and calendars are effective-dated rather than overwritten in place.
- Planned schedule, attendance and claimed/approved time remain separate facts; approved labour-cost snapshots preserve historical cost.
- Project information identity is separate from revision/version history; issued revisions are immutable through normal application writes.
- Binary project files are stored outside MySQL; MySQL stores controlled metadata, checksum, object key, revision and workflow evidence.
- Cross-organisation project information ownership is valid only for organisations participating in the project; visibility remains separately permission-controlled.
- Transmittal items, reviewers, RFI addressees, submittal reviewers and instruction recipients use relational associations rather than delimited lists.
- RFI responses, submittal reviews and formal instructions remain historical facts and do not overwrite their source records.
- Reusable reference/current data never rewrites issued historical document facts.
- Historical immutable snapshots are allowed where they represent facts at issue/approval/execution time.
- Ordinary derived totals, status projections, latest-version indicators, utilisation, expiry states and similar values are not stored merely for convenience; materialisation requires a documented performance reason.
- Tenant/project context may be carried in composite candidate/foreign keys where required to strengthen database-enforced integrity.
- Foreign keys target explicit `PRIMARY`/`UNIQUE` candidate keys; deprecated non-standard partial/non-unique FK behaviour is not relied upon.
- Any material denormalisation requires a documented reason and preferably an ADR.

## Migration rules

Before production development:

1. Select the MySQL query/ORM/migration tool.
2. Create the database ADR.
3. Consolidate/remove temporary pre-development checkpoint/companion files into a coherent initial migration baseline where appropriate.
4. Convert/adopt the numbered baseline packages as migrations.
5. Run every migration against a clean MySQL 8.4 instance in CI with default foreign-key restrictions enabled.
6. Test upgrade from the previous released schema.
7. Add integrity tests for every critical foreign/candidate-key and cross-domain business rule.
8. Never modify an already-released production migration in place; add a new migration.

The current numbered files are a pre-production target-schema baseline. They may be corrected while design is still being validated; once the migration baseline is formally released, normal forward-only migration rules apply.

## Reference data

The canonical career source currently exists in:

- `docs/career-taxonomy-seed.json`
- `docs/career-taxonomy-seed.csv`

SQL/TypeScript seeding should consume authoritative version-controlled datasets rather than maintaining duplicate hand-edited lists.

Package 002 contains controlled party/CRM reference rows. Package 003 contains units of measure and sales item types. Package 004 contains contract/payment reference rows. Package 005 contains procurement/PO reference rows. Package 006 contains workforce engagement/cost-rate/schedule-event reference rows. Package 007 contains baseline information-container, issue-purpose, submittal, instruction and project-change-event reference rows.

Tenant-specific tax, competency, credential, workflow/classification and other configurable business reference data should remain tenant-configurable unless a later standards decision establishes a governed global catalogue.

Before production migrations are frozen, the selected migration system should separate schema creation and idempotent reference-data seeding according to the project's migration convention.

## Security rule

No application repository/query may retrieve an organisation-owned record solely by its surrogate ID when tenant context is required. Tenant context and authorisation must be validated before returning data.

CRM records are tenant-private by default. A later NuBlox Network identity link must not silently turn tenant CRM records into globally shared records.

Issued commercial/finance records must not be recomputed from mutable current catalogue, CRM, tax or payment defaults.

Contract execution/amendment, financial-document issue/void, payment allocation/reversal, procurement issue/evaluation/award/receipt, workforce credential/rate/time approval, and project-information issue/review/approval/supersession are privileged auditable actions.

Workforce cost rates are restricted commercial data. Project binary files use private object storage and authorised access; object keys are not public security boundaries. Issued project information and authoritative file metadata must not be silently altered or replaced.
