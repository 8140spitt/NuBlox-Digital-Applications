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
├── docs/
│   ├── README.md
│   ├── 001-platform-kernel.md
│   ├── 002-crm-parties.md
│   ├── 003-sales-estimates-quotations.md
│   ├── 004-contracts-finance.md
│   ├── 005-procurement.md
│   ├── 006-workforce-time-scheduling.md
│   ├── 007-project-information-documents.md
│   └── 008-site-quality-safety.md
└── schema/
    ├── README.md
    ├── 001-platform-kernel.sql
    ├── 002-crm-parties.sql
    ├── 003-sales-quotes.sql
    ├── 004-contracts-finance.sql
    ├── 005-procurement.sql
    ├── 006-workforce-time-scheduling.sql
    ├── 007-project-information-documents.sql
    ├── 007-project-information-integrity.sql
    ├── 008-site-quality-safety.sql
    └── 008-site-quality-safety-integrity.sql
```

## Schema package order

1. 001 — identity, organisations, careers, capabilities, permissions and projects
2. 002 — normalised parties, contacts, opportunities and CRM activity
3. 003 — units, catalogue, estimates, quotation versions, issue/response and conversion
4. 004 — contracts/appointments, amendments, invoices, credit notes, payments and allocations
5. 005 — procurement packages, RFQs, supplier returns, evaluation, awards, POs and receipts
6. 006 — workers, engagements, competence, credentials, rates, calendars, scheduling, attendance and timesheets
7. 007 — project sites, controlled information, immutable revisions, files, transmittals, RFIs, submittals, instructions, change events and reviews
8. 008 — site diaries, deliveries, visitors, inspections, defects, NCRs, RAMS, briefings, permits and safety events/actions

Package 007 is applied as two ordered SQL stages: `007-project-information-documents.sql` followed by `007-project-information-integrity.sql`. They are one logical package. The second stage captures integrity hardening found during validation and is no longer labelled as a separate `007a` package.

Package 008 is applied as two ordered SQL stages: `008-site-quality-safety.sql` followed by `008-site-quality-safety-integrity.sql`. They are one logical package. The integrity stage strengthens cross-domain candidate keys and removes avoidable transitive duplication identified during validation.

Planned:

9. 009 — Commercial Cost Control
10. 010 — Assets and Maintenance

## Normalisation policy

- 3NF is the default transactional design target.
- Many-to-many relations use junction tables.
- Stable business facts are relational, not hidden in generic JSON/EAV structures.
- Party identity is stored once per tenant and may carry multiple business roles.
- User, CRM person and workforce identities remain separate with controlled links.
- Logical commercial/information records are separated from immutable issue/version facts where history matters.
- Planned schedule, attendance and claimed/approved time remain separate facts.
- Payments allocate many-to-many to invoices; corrections use explicit reversals.
- Procurement stage facts remain separate instead of overwriting earlier-stage records.
- Document identity, document revision and binary file identity remain separate.
- Cross-organisation project participation never automatically grants record visibility.
- Site diary, quality and safety evidence remain separate lifecycle records rather than being collapsed into generic forms.
- Inspection template identity is separate from immutable/published template versions.
- Inspection findings, defects and NCRs are separate records; conversion/linkage preserves the source evidence.
- RAMS approval and briefings reference exact controlled-information revisions.
- Safety incident, near-miss and observation facts use a supertype/subtype design to avoid duplicated nullable columns.
- Historical snapshots are permitted where they represent issue/approval/execution/field evidence.
- Ordinary derived balances/totals/statuses are not duplicated merely for convenience.
- Tenant-scoping keys may be included in composite candidate keys to let MySQL enforce tenant integrity.
- Foreign keys target explicit primary/unique candidate keys.
- Material denormalisation requires measured evidence and an ADR/rationale.

## Migration rules before production

1. Select the MySQL query/ORM/migration tool.
2. Record the decision in an ADR.
3. Adopt/consolidate the numbered pre-production packages into that migration system without losing constraints.
4. Run the full chain against a clean MySQL 8.4 instance in CI.
5. Add same-tenant, candidate-key and lifecycle integrity tests.
6. Test upgrades from the prior released schema.
7. Once migrations are released, never rewrite them in place; add forward migrations.

## Security rule

No application repository/query may retrieve organisation-owned data solely by surrogate ID when tenant context is required. Tenant context and authorisation must be validated before returning records.

Privileged actions—including commercial issue/void, payment allocation/reversal, procurement award/PO issue, workforce rate changes/time approval, controlled-information issue/review/approval, formal instruction, diary approval/lock, inspection close-out, defect/NCR close-out, RAMS approval, permit issue/close and safety-event investigation/closure—must be auditable.

Safety incident/injury data may require stricter application policy than ordinary project records and must not become broadly visible merely because an organisation participates in the project.
