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
│   ├── 008-site-quality-safety.md
│   ├── 009-commercial-cost-control.md
│   └── 010-assets-maintenance.md
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
    ├── 008-site-quality-safety-integrity.sql
    ├── 009-commercial-cost-control.sql
    └── 010-assets-maintenance.sql
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
9. 009 — cost codes, budgets, source-cost/value allocations, direct costs, variations, valuations and commercial forecasts
10. 010 — facilities, buildings, spaces, systems, assets, handover, maintenance, service history and operational compliance

Package 007 is applied as two ordered SQL stages: `007-project-information-documents.sql` followed by `007-project-information-integrity.sql`. They are one logical package. The second stage captures integrity hardening found during validation and is no longer labelled as a separate `007a` package.

Package 008 is applied as two ordered SQL stages: `008-site-quality-safety.sql` followed by `008-site-quality-safety-integrity.sql`. They are one logical package. The integrity stage strengthens cross-domain candidate keys and removes avoidable transitive duplication identified during validation.

Package 009 is one SQL stage: `009-commercial-cost-control.sql`. It adds two prerequisite tenant-safe candidate keys to earlier estimate/timesheet cost-source tables and then establishes the commercial-control domain.

Package 010 is one SQL stage: `010-assets-maintenance.sql`. Facilities/assets are long-lived tenant operational records; projects contribute through explicit links rather than owning the asset lifecycle.

The planned 001–010 domain baseline is complete. Before production, the full chain must be executed against clean MySQL 8.4 in CI and adopted into the selected migration/query tool without losing constraints.

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
- Cost codes classify commercial facts; they do not store editable budget/commitment/actual balances.
- PO commitments, approved labour costs and customer financial-document values remain authoritative in their source domains and are classified through allocation tables.
- Approved budget/variation versions are historical facts; normal change does not rewrite prior approved versions.
- Forecast line values are intentional point-in-time snapshots for reproducible approved reporting, not competing live balances.
- Facilities and assets are long-lived operational identities and are not permanently subordinated to one construction project.
- Buildings, levels, spaces, systems and assets use explicit relational structures; Package 010 does not introduce a generic EAV asset master.
- Asset components use parent assets rather than a competing component table.
- Maintenance requests, work orders, service events and compliance events remain separate lifecycle facts.
- Work-order labour and procurement links reference Package 006/005 source facts instead of copying their cost/quantity/value.
- Warranty validity, maintenance due-state and compliance overdue-state are normally derived from dates/rules/events rather than duplicated editable booleans.
- Historical snapshots are permitted where they represent issue/approval/execution/field/reporting/operational evidence.
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

Privileged actions—including commercial issue/void, payment allocation/reversal, procurement award/PO issue, workforce rate changes/time approval, controlled-information issue/review/approval, formal instruction, diary approval/lock, inspection close-out, defect/NCR close-out, RAMS approval, permit issue/close, safety-event investigation/closure, budget approval/adjustment, variation issue/decision, valuation assessment/certification, direct-cost posting/reversal, forecast approval, asset lifecycle change, handover acceptance, work-order completion and compliance-event result—must be auditable.

Safety incident/injury data, commercial budget/rate/margin/forecast data, security-system asset details and other sensitive operational asset data may require stricter application policy than ordinary project records and must not become broadly visible merely because an organisation participates in a project.
