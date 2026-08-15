# 16 — Glossary

## Product/software

**Capability** — reusable functional entitlement such as `inspection.perform` or `commercial.variation.approve`.

**Career** — professional/trade taxonomy label. It supplies defaults but is not itself an authorisation role.

**Professional pack** — composition of capabilities, navigation, templates and workflows for a professional domain/career.

**Organisation** — tenant/business account owning private data.

**Membership** — relationship between a user and an organisation.

**Project participant** — person or organisation granted a role/access in a project.

**Tenant isolation** — guarantee that one organisation cannot access another organisation's private records except through explicit sharing rules.

**Modular monolith** — one deployable application with enforced internal module/domain boundaries.

**Application service** — use-case orchestration layer between request routes and domain/persistence logic.

**Audit event** — append-oriented record of a material action or security event.

**Outbox** — persisted record of an external/asynchronous event to be delivered after a transaction commits.

## Built environment

**RFI** — Request for Information.

**NCR** — Non-Conformance Report.

**ITP** — Inspection and Test Plan.

**RAMS** — Risk Assessments and Method Statements.

**Variation** — controlled change with potential scope/cost/time impact.

**Valuation** — assessment of value/work for payment or commercial reporting.

**Final account** — agreed/finalised project contract value after adjustments.

**Submittal** — information/product/material submitted for review/approval.

**Transmittal** — formal issue of information/documents.

**Snag/defect** — incomplete or non-compliant work requiring correction.

**Commissioning** — testing/verification that systems perform as intended before/around handover.

**Handover** — transfer of completed project information/assets to client/operator.

**PPM** — Planned Preventive Maintenance.

**Reactive maintenance** — maintenance initiated by a failure/request rather than a planned schedule.

**Asset** — maintainable physical item/equipment tracked through its lifecycle.

**Golden thread** — digital building information required for specified higher-risk building duties in England; exact legal applicability depends on project/building/dutyholder context.

**CDM** — Construction (Design and Management) Regulations 2015.

## Data

**System of record** — authoritative source for a data set.

**Opaque identifier** — public-facing identifier that does not reveal sequence/business information.

**Soft delete** — marking a record deleted without physical removal; not appropriate as a universal retention strategy.

**Supersede** — replace a record/version as current while preserving the prior version.

**Idempotent** — repeated execution of the same request/event does not create unintended duplicate effects.

**RPO** — Recovery Point Objective.

**RTO** — Recovery Time Objective.
