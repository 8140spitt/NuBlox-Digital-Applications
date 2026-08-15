# 02 — Functional Requirements

Requirement keywords: **MUST**, **SHOULD**, **MAY** are normative for estimation.

## Identity and authentication

- **FR-ID-001 — MUST:** users can register or be invited and establish a unique account.
- **FR-ID-002 — MUST:** authentication is server-validated and sessions can be revoked.
- **FR-ID-003 — MUST:** password-based authentication, if used, follows current secure password-storage practice.
- **FR-ID-004 — MUST:** MFA is supported for privileged users and can be enforced per organisation.
- **FR-ID-005 — MUST:** email verification and secure account-recovery flows exist.
- **FR-ID-006 — MUST:** administrators can disable a member without deleting historical attribution.
- **FR-ID-007 — SHOULD:** support pluggable enterprise identity/SSO later without redesigning user identity.

## Organisations and tenancy

- **FR-ORG-001 — MUST:** users can create or join one or more organisations.
- **FR-ORG-002 — MUST:** an organisation contains profile, trading/contact details and configurable settings.
- **FR-ORG-003 — MUST:** organisation-owned records are tenant-scoped.
- **FR-ORG-004 — MUST:** users can switch organisations without data leakage.
- **FR-ORG-005 — MUST:** invitations have expiry, revocation and audit.
- **FR-ORG-006 — MUST:** organisations can define teams/offices/locations.
- **FR-ORG-007 — SHOULD:** support organisation groups/parent-child structures later.

## Careers, capabilities and professional profiles

- **FR-CAP-001 — MUST:** the system stores the canonical 84-career taxonomy.
- **FR-CAP-002 — MUST:** a user may hold multiple careers.
- **FR-CAP-003 — MUST:** careers map to reusable capabilities.
- **FR-CAP-004 — MUST:** capabilities are keyed by stable machine-readable identifiers.
- **FR-CAP-005 — MUST:** organisation administrators can grant/revoke permitted capabilities subject to policy.
- **FR-CAP-006 — MUST:** effective authorisation is distinct from career labels.
- **FR-CAP-007 — SHOULD:** capability packs can configure navigation, templates and dashboards.

## CRM and contacts

- **FR-CRM-001 — MUST:** create people and organisation contacts.
- **FR-CRM-002 — MUST:** distinguish client, prospect, supplier and other relationship types without duplicating the entity.
- **FR-CRM-003 — MUST:** store addresses, communication details, notes and relationship history.
- **FR-CRM-004 — MUST:** create leads/opportunities with stage, value, owner and next action.
- **FR-CRM-005 — SHOULD:** activity timeline for calls, emails, meetings and notes.
- **FR-CRM-006 — SHOULD:** duplicate detection and merge with audit.

## Quotes, proposals and sales

- **FR-SAL-001 — MUST:** create versioned quotations/proposals.
- **FR-SAL-002 — MUST:** quotation lines support quantity, unit, description, tax category, rate and amount.
- **FR-SAL-003 — MUST:** support labour, material, plant, subcontract and free-text components.
- **FR-SAL-004 — MUST:** quotation statuses include draft, issued, accepted, rejected, expired and superseded.
- **FR-SAL-005 — MUST:** accepted quotations can create a project/job and preserve source version.
- **FR-SAL-006 — SHOULD:** templated terms and scope/exclusions.
- **FR-SAL-007 — SHOULD:** customer acceptance via portal/e-sign integration.

## Contracts and appointments

- **FR-CON-001 — MUST:** maintain a contract/appointment register.
- **FR-CON-002 — MUST:** record parties, dates, value, scope, status and linked project.
- **FR-CON-003 — MUST:** preserve contract document versions and notices.
- **FR-CON-004 — SHOULD:** obligations/key dates register with reminders.
- **FR-CON-005 — SHOULD:** configurable contract-specific workflows.

## Invoicing and operational finance

- **FR-FIN-001 — MUST:** create invoices and credit adjustments with immutable issued numbering rules.
- **FR-FIN-002 — MUST:** invoices may reference client, project/job, contract and source quotation/valuation.
- **FR-FIN-003 — MUST:** track draft, issued, part-paid, paid, overdue, void/credited states as applicable.
- **FR-FIN-004 — MUST:** represent tax values without floating-point arithmetic.
- **FR-FIN-005 — MUST:** preserve issued invoice snapshots.
- **FR-FIN-006 — SHOULD:** payment-provider/accounting-package integration.
- **FR-FIN-007 — SHOULD:** project cost/revenue summary and cashflow view.
- **FR-FIN-008 — MAY:** full general-ledger accounting only if separately scoped.

## Procurement

- **FR-PRO-001 — MUST:** supplier register.
- **FR-PRO-002 — MUST:** RFQ/enquiry records and supplier responses.
- **FR-PRO-003 — MUST:** purchase orders with approval status.
- **FR-PRO-004 — MUST:** goods/service receipt or delivery evidence.
- **FR-PRO-005 — SHOULD:** procurement packages linked to project/commercial budgets.
- **FR-PRO-006 — SHOULD:** compare tender/supplier returns.

## People, competencies and time

- **FR-PEO-001 — MUST:** workforce profile distinct from authentication account.
- **FR-PEO-002 — MUST:** employment/engagement status and team membership.
- **FR-PEO-003 — MUST:** qualifications/competencies with issue/expiry dates and evidence.
- **FR-PEO-004 — MUST:** timesheets by date, project/job and activity.
- **FR-PEO-005 — SHOULD:** approval workflow for time.
- **FR-PEO-006 — SHOULD:** alerts for expiring competencies.
- **FR-PEO-007 — SHOULD:** resource/utilisation reporting.

## Scheduling and tasks

- **FR-SCH-001 — MUST:** tasks have assignee, status, priority, due date and context.
- **FR-SCH-002 — MUST:** schedule jobs/appointments against people/teams.
- **FR-SCH-003 — SHOULD:** schedule plant/assets where relevant.
- **FR-SCH-004 — SHOULD:** calendar views and external calendar synchronisation.
- **FR-SCH-005 — SHOULD:** dependencies/milestones for project tasks.

## Projects, jobs and participants

- **FR-PRJ-001 — MUST:** create project/job with organisation, client, status and reference.
- **FR-PRJ-002 — MUST:** simple jobs and complex projects share a common core but do not require identical fields.
- **FR-PRJ-003 — MUST:** add internal and external participants with project roles.
- **FR-PRJ-004 — MUST:** project access is explicitly scoped.
- **FR-PRJ-005 — MUST:** record project sites/addresses and optional building hierarchy.
- **FR-PRJ-006 — SHOULD:** project stages/milestones and key dates.
- **FR-PRJ-007 — SHOULD:** configurable project templates.
- **FR-PRJ-008 — MUST:** project closure/archive preserves records and audit history.

## Documents and information management

- **FR-DOC-001 — MUST:** a document is a logical record with one or more versions.
- **FR-DOC-002 — MUST:** versions record revision, status, uploader, timestamp and file integrity metadata.
- **FR-DOC-003 — MUST:** superseded versions remain retrievable to authorised users.
- **FR-DOC-004 — MUST:** document access obeys tenant/project visibility.
- **FR-DOC-005 — MUST:** metadata and full record history are auditable.
- **FR-DOC-006 — SHOULD:** document numbering and configurable classifications.
- **FR-DOC-007 — SHOULD:** transmittal/issue sets and acknowledgement.
- **FR-DOC-008 — SHOULD:** virus/malware scanning before files become generally available.
- **FR-DOC-009 — SHOULD:** previews for common safe file types.

## Project information workflows

- **FR-INF-001 — MUST:** RFI register with originator, recipient, due date, responses and status.
- **FR-INF-002 — SHOULD:** submittal/approval register.
- **FR-INF-003 — MUST:** instruction/change records with traceable origin.
- **FR-INF-004 — MUST:** variation/change statuses are controlled and auditable.
- **FR-INF-005 — SHOULD:** link records to documents, drawings, locations, assets and other records.
- **FR-INF-006 — SHOULD:** correspondence/decision log.

## Site and field operations

- **FR-SITE-001 — MUST:** daily site/job diary capability.
- **FR-SITE-002 — MUST:** photographs include capture time, uploader and contextual links.
- **FR-SITE-003 — SHOULD:** labour, plant and delivery logs.
- **FR-SITE-004 — SHOULD:** field-friendly checklists.
- **FR-SITE-005 — SHOULD:** poor-connectivity resilience; offline-first is a separately prioritised capability.
- **FR-SITE-006 — MUST:** completion evidence cannot silently overwrite prior evidence.

## Health and safety

- **FR-HSE-001 — MUST:** safety-related records can be stored with controlled access and audit.
- **FR-HSE-002 — SHOULD:** RAMS/document acknowledgement workflow.
- **FR-HSE-003 — SHOULD:** toolbox talk/briefing attendance.
- **FR-HSE-004 — SHOULD:** permit/checklist workflows.
- **FR-HSE-005 — SHOULD:** incident/near-miss reporting with restricted visibility.
- **FR-HSE-006 — MUST:** the system must not imply regulatory approval merely because a workflow is completed.

## Quality, inspections and defects

- **FR-QA-001 — MUST:** configurable inspection/checklist templates.
- **FR-QA-002 — MUST:** inspection records preserve answers, evidence, inspector and time.
- **FR-QA-003 — MUST:** raise issue/NCR/defect from an inspection or independently.
- **FR-QA-004 — MUST:** defects have owner, target date, status and evidence of closure.
- **FR-QA-005 — MUST:** closed quality records preserve immutable history of key decisions.
- **FR-QA-006 — SHOULD:** signatures/attestations where workflow requires them.

## Commercial/project cost

- **FR-COM-001 — MUST:** project budget/cost-code structure.
- **FR-COM-002 — MUST:** variations/change events with value, status and source.
- **FR-COM-003 — SHOULD:** valuations/applications for payment.
- **FR-COM-004 — SHOULD:** commitments, actuals and forecast.
- **FR-COM-005 — SHOULD:** cost plan/estimate versioning.
- **FR-COM-006 — SHOULD:** final-account tracking.
- **FR-COM-007 — MUST:** financial permissions may be more restrictive than general project access.

## Assets, handover and facilities

- **FR-AST-001 — MUST:** asset register with type, location, status and identifiers.
- **FR-AST-002 — MUST:** asset service/inspection history.
- **FR-AST-003 — MUST:** work orders support planned and reactive work.
- **FR-AST-004 — SHOULD:** maintenance plans and recurrence.
- **FR-AST-005 — SHOULD:** warranties, manuals and certificate links.
- **FR-AST-006 — SHOULD:** commissioning/handover records.
- **FR-AST-007 — SHOULD:** asset import/export.
- **FR-AST-008 — SHOULD:** building → space → system → asset relationships where applicable.

## Portal and cross-organisation collaboration

- **FR-POR-001 — MUST:** external users receive only explicitly authorised data.
- **FR-POR-002 — MUST:** portal invitations and access changes are audited.
- **FR-POR-003 — MUST:** organisations can share selected project records without exposing unrelated tenant data.
- **FR-POR-004 — SHOULD:** customers can review quotes, documents, invoices and approvals appropriate to their context.
- **FR-POR-005 — SHOULD:** external participants can respond to assigned RFIs/actions without full internal access.

## Notifications

- **FR-NOT-001 — MUST:** in-app notifications.
- **FR-NOT-002 — SHOULD:** email notifications with configurable preferences.
- **FR-NOT-003 — MUST:** reminders must be deduplicated/idempotent.
- **FR-NOT-004 — SHOULD:** escalation rules for overdue items.
- **FR-NOT-005 — SHOULD:** digest mode.

## Search, reporting and export

- **FR-REP-001 — MUST:** filter/sort/search core registers.
- **FR-REP-002 — MUST:** CSV export for authorised structured registers.
- **FR-REP-003 — MUST:** reports respect the same authorisation rules as source records.
- **FR-REP-004 — SHOULD:** configurable dashboard widgets.
- **FR-REP-005 — SHOULD:** scheduled reports.
- **FR-REP-006 — SHOULD:** cross-project business reporting.
- **FR-REP-007 — MUST:** exports containing personal/commercially sensitive data are auditable where practical.

## Audit

- **FR-AUD-001 — MUST:** material create/update/delete/archive/status/share/approval actions generate audit events.
- **FR-AUD-002 — MUST:** audit events include actor, tenant, action, entity, time and request/correlation context where available.
- **FR-AUD-003 — MUST:** ordinary application users cannot alter audit history.
- **FR-AUD-004 — SHOULD:** old/new values or a structured change summary are recorded for material fields.
- **FR-AUD-005 — MUST:** security events are logged separately as appropriate.

## Administration and configuration

- **FR-ADM-001 — MUST:** tenant administrators manage members, roles, settings and templates within authority.
- **FR-ADM-002 — MUST:** platform administrators cannot accidentally operate as tenant users without explicit privileged workflow.
- **FR-ADM-003 — SHOULD:** configurable numbering sequences.
- **FR-ADM-004 — SHOULD:** configurable tax, units, terminology and regional settings.
- **FR-ADM-005 — SHOULD:** configurable record statuses only where they do not undermine fixed system invariants.

## AI assistance

- **FR-AI-001 — MAY:** AI can summarise, classify, extract or draft using authorised NuBlox data.
- **FR-AI-002 — MUST if AI enabled:** AI access is permission-scoped to the invoking user/service.
- **FR-AI-003 — MUST if AI enabled:** consequential actions require explicit human confirmation unless a separately approved automation policy exists.
- **FR-AI-004 — MUST if AI enabled:** generated output is visibly distinguishable from authoritative source records.
- **FR-AI-005 — SHOULD if AI enabled:** retain provenance/source links sufficient to review generated conclusions.
