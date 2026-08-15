# 01 — Product Requirements Document

## 1. Purpose

This document defines the baseline product scope for NuBlox. It is intended to be specific enough for solution design, estimation, backlog creation and delivery planning while preserving identified product decisions for discovery.

## 2. Product proposition

NuBlox is a **Built Environment Business Operating System**.

A common business layer is combined with a construction/property lifecycle layer. Professional workspaces are composed from reusable capabilities. Users can belong to multiple organisations, hold multiple careers and participate in multiple projects.

## 3. Product actors

### Internal organisation actors

- Organisation owner
- Organisation administrator
- Finance/commercial administrator
- Manager
- Professional/technical worker
- Trade/field worker
- Read-only/auditor

### External actors

- Client
- Consultant
- Contractor/subcontractor
- Supplier
- Inspector/regulator-facing participant
- Customer/end client
- Portal-only participant

## 4. Platform layers

### 4.1 Identity and organisation kernel

Must provide:

- account registration and secure authentication;
- organisations and organisation profiles;
- memberships and invitations;
- offices/locations/teams;
- careers and professional profiles;
- capabilities and permissions;
- project memberships;
- audit event infrastructure;
- configurable reference data.

### 4.2 Business OS

Core business modules:

- CRM and contacts;
- leads/opportunities;
- quotations/proposals;
- customer and supplier records;
- contracts/appointments;
- invoices and payment status;
- expenses/cost records;
- purchasing and purchase orders;
- workforce records;
- qualifications/competencies;
- timesheets;
- scheduling;
- business documents;
- notifications;
- business reporting;
- client/customer portal.

Accounting scope should initially be operational/sub-ledger level unless full ledger accounting is explicitly commissioned.

### 4.3 Built Environment OS

Shared project modules:

- project setup and participants;
- site/location hierarchy;
- programme/milestones/tasks;
- design/information management;
- document registers and revisions;
- RFIs;
- submittals/approvals;
- instructions;
- change/variations;
- commercial records;
- procurement packages;
- site diary;
- labour, plant and deliveries;
- safety records and RAMS references;
- permits/checks;
- inspections;
- ITP/checklist support;
- NCRs;
- defects/snags;
- photographs/evidence;
- commissioning;
- handover;
- asset register;
- planned/reactive maintenance.

### 4.4 Professional capability packs

A capability pack changes:

- navigation;
- dashboards;
- available record types;
- forms and templates;
- calculations;
- workflow states;
- reports;
- default permissions.

Career membership supplies defaults but must not replace access control.

### 4.5 Collaboration / NuBlox Network

A project may contain participants from several organisations. NuBlox must preserve each organisation's ownership and confidentiality boundaries while permitting explicitly shared project records.

The design must support:

- invitations between organisations;
- project roles;
- scoped sharing;
- external portal users;
- record visibility rules;
- audit of sharing and access changes.

## 5. Built-environment lifecycle

The conceptual lifecycle is:

**Lead → Brief/Survey → Design → Estimate → Tender → Contract → Construction → Inspection/Testing → Commissioning → Handover → Operation → Maintenance**

Not every profession participates in every stage.

## 6. Canonical location/asset hierarchy

The data model should support, where applicable:

**Development → Project → Site → Building/Structure → Level → Space/Zone → System → Asset → Component**

This hierarchy must not be mandatory for simple trade jobs.

## 7. Core user journeys

### Journey A — Sole-trade job

1. Create customer.
2. Create opportunity/request.
3. Survey site.
4. Produce quotation.
5. Customer accepts.
6. Schedule job.
7. Allocate worker/materials.
8. Complete work and capture evidence.
9. Perform tests/issue applicable records.
10. Invoice.
11. Retain asset/service history.

### Journey B — Consultant project

1. Create client and opportunity.
2. Create fee proposal.
3. Create project and appointment.
4. Assign internal team.
5. Invite external project participants.
6. Produce/review design information.
7. Manage RFIs/instructions/change.
8. Record time and fees.
9. Issue reports/certificates.
10. Close and archive project.

### Journey C — Contractor project

1. Set up contract project.
2. Create work packages.
3. Procure suppliers/subcontractors.
4. Manage programme and daily records.
5. Record labour, plant, deliveries and progress.
6. Manage RFIs, quality and safety records.
7. Manage variations and applications.
8. Commission and hand over.

### Journey D — Facilities operation

1. Register property/building.
2. Import or create asset register.
3. Configure statutory/PPM schedules.
4. Raise planned or reactive work order.
5. Assign internal/external operative.
6. Capture service/inspection evidence.
7. Close work order.
8. Update asset history and next due date.

## 8. Product scope prioritisation

### Must — platform foundation

- identity/authentication;
- organisations and memberships;
- tenant isolation;
- careers/capabilities/permissions;
- CRM;
- projects;
- project participants;
- tasks and scheduling;
- documents and versions;
- audit log;
- notifications;
- responsive UI;
- search/filter/export basics.

### Must — first commercial release

- quotes;
- invoices/payment status;
- purchasing;
- timesheets;
- project commercial/change records;
- inspections/issues/defects;
- asset/work-order basics;
- client/external portal;
- three pilot professional packs.

### Should

- reusable forms/checklists;
- configurable workflows;
- dashboards;
- report templates;
- email/calendar integrations;
- accounting integrations;
- e-sign integration;
- bulk import/export;
- API/webhooks.

### Could / later

- offline-first field mode;
- native mobile shell;
- BIM/CDE integrations;
- advanced forecasting;
- AI-assisted extraction, drafting and analysis;
- marketplace/network discovery;
- configurable no-code workflow designer.

## 9. Professional pilot packs

The first architecture validation should include:

1. **Quantity Surveyor** — commercial/project consultancy.
2. **Electrician** — field/trade job management and testing.
3. **Facilities Manager** — operational asset and maintenance management.

The platform design passes the pilot if all three can operate without parallel bespoke application structures.

## 10. Product constraints

- Svelte 5 and SvelteKit are fixed.
- MySQL is the system-of-record relational database.
- Server-side authorisation is mandatory.
- Binary files should be stored in object/file storage with metadata and integrity references in MySQL; storing large documents directly in MySQL is not the default design.
- Public/external identifiers must not expose sequential business-sensitive information without review.
- All tenant-owned records must have explicit tenancy ownership or be explicitly global/reference data.

## 11. AI scope principle

AI must be a horizontal assisted capability, not a separate product silo.

Examples include:

- summarising project correspondence;
- extracting structured data from approved documents;
- drafting quotations/reports from structured data;
- comparing tender returns;
- identifying overdue actions or anomalous data.

AI outputs must preserve source references, permissions and human approval for consequential actions.

## 12. Product acceptance at programme level

The solution is acceptable only when:

- tenant isolation is independently tested;
- permissions cannot be bypassed through direct endpoint access;
- audit records capture material actions;
- the three pilot professional packs run on shared platform primitives;
- the full 84-career taxonomy can be represented without schema changes;
- the product can add careers/capabilities through data/configuration;
- automated tests cover critical business and security paths.
