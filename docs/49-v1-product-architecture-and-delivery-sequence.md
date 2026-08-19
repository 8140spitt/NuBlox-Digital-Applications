# 49 — V1 Product Architecture and Delivery Sequence

**Status:** Implementation contract  
**Workstream:** Product platform  
**Baseline:** `main` after full UI acceptance validation PR #41  
**Purpose:** Rebalance NuBlox from a deep finance-led implementation into the complete V1 Business OS + Built Environment OS defined by the PRD.

## 1. Decision

NuBlox will now prioritise **platform experience and V1 operational breadth** before deepening advanced finance.

The accounting roadmap remains valid. Controlled statutory financial statements are the next accounting boundary, but they are **not the next product-platform boundary**.

The immediate product priority is to complete the shared platform layers that every later module and professional pack depends on:

1. capability-driven application shell and design-system foundation;
2. people, competencies, tasks, time and scheduling;
3. documents, versioning and project information;
4. procurement and project commercial controls;
5. site, quality and safety operations;
6. assets, facilities and maintenance;
7. portal and controlled cross-organisation collaboration;
8. pilot professional capability packs;
9. reporting, automation and integrations;
10. advanced finance expansion, including statutory statements, when the V1 operating surface is complete enough to justify it.

This sequence follows the dependency roadmap in `13-delivery-roadmap.md` and the V1 requirements in `01-product-requirements-document.md` and `02-functional-requirements.md`.

## 2. Current-state assessment

### 2.1 Runtime strengths already present

The production runtime already provides a strong vertical business chain:

- Better Auth identity and tenant selection;
- organisation membership, roles and permissions;
- CRM parties, contacts, opportunities and activities;
- estimates and quotations;
- accepted-quotation project conversion;
- project workspace and team administration;
- contract formation, issue, execution and amendment controls;
- invoicing, credit notes, payments and allocation;
- receivables, collections and credit control;
- bad debt and VAT bad-debt relief;
- accounting posting, reversal and export evidence;
- accounting periods, reporting and year-end close;
- audit trails and real-MySQL integration coverage;
- authenticated browser acceptance across the main implemented workflow.

### 2.2 Runtime gaps relative to the V1 PRD

The following PRD areas are not yet activated as complete production modules:

- people/workforce and competency management;
- tasks, time and scheduling;
- purchasing and procurement;
- documents, revisions and project information workflows;
- RFIs, submittals and instructions;
- site/field records, inspections and photos;
- quality, defects/issues and safety workflows;
- project cost control and richer change/commercial management;
- asset register, facilities and maintenance/work orders;
- customer/contractor portal and shared-project collaboration;
- global search;
- in-product notifications;
- global create/command surface;
- capability-pack-driven navigation and dashboards;
- the three pilot professional packs: Quantity Surveyor, Electrician and Facilities Manager.

### 2.3 Important leverage already in the database

The baseline database already contains schema packages for domains that are not yet activated in the runtime:

- `005-procurement.sql`;
- `006-workforce-time-scheduling.sql`;
- `007-project-information-documents.sql`;
- `008-site-quality-safety.sql`;
- `009-commercial-cost-control.sql`;
- `010-assets-maintenance.sql`.

Therefore these product slices should normally begin by **activating existing relational primitives** through permissions, repositories, services, routes, UI and tests. New schema must be added only where a concrete runtime invariant is missing; existing baseline tables must not be duplicated under new names.

## 3. Target V1 product architecture

NuBlox V1 is organised into seven product layers.

### A. Global Experience Layer

Always available after authentication and tenant selection:

- NuBlox product identity;
- organisation context and switcher;
- capability-driven primary navigation;
- global search;
- notifications/action centre;
- global create action;
- user/account controls;
- responsive desktop/mobile shell;
- common page headers, cards, forms, tables/registers, status badges, empty states and feedback patterns.

The shell is a **projection of effective access**, not an authorisation boundary. Routes and actions remain server-authorised.

### B. Identity and Organisation Kernel

- users and authentication;
- organisations, offices and teams;
- memberships and invitations;
- careers and capabilities;
- roles, permission grants and member overrides;
- tenant and project scope;
- audit and outbox/job foundations.

### C. Shared Business OS

- CRM and opportunities;
- estimating, quotations and sales commercial;
- contracts;
- procurement and purchasing;
- people, competencies and workforce;
- tasks, time and scheduling;
- finance and receivables.

### D. Built Environment OS

- projects/jobs and participants;
- sites and location hierarchies;
- documents and information management;
- RFIs, submittals and instructions;
- project commercial/cost control and change;
- site/field operations;
- quality and defects;
- health and safety;
- assets, facilities and maintenance;
- commissioning and handover primitives.

### E. Collaboration Layer

- customer/contractor portal;
- controlled project participation;
- scoped sharing and external responses;
- organisation-bound data ownership;
- explicit cross-organisation evidence and access grants.

### F. Professional Capability Packs

The first three packs are:

1. Quantity Surveyor;
2. Electrician;
3. Facilities Manager.

A pack configures shared capabilities; it must not create a parallel application architecture. Packs may change navigation, dashboards, templates, workflows, calculations, reports and default permissions while reusing shared domain primitives.

### G. Reporting, Automation and Intelligence

- cross-module operational reporting;
- workflow/reminder automation;
- integration adapters;
- AI assistance only where permissions, provenance, audit and structured data are mature.

## 4. Cross-cutting invariants

Every product slice must preserve these rules:

1. **Tenant isolation:** browser-supplied organisation identifiers are never trusted without server context validation.
2. **Server-side authorisation:** menu visibility and disabled controls are UX only; every read/write boundary re-checks permissions.
3. **Project scope:** project-scoped records respect active project participation where applicable.
4. **Public identifiers:** browser URLs and external references use controlled public IDs rather than internal database IDs.
5. **Auditability:** material business mutations emit attributable audit evidence.
6. **Versioning/immutability:** issued, approved, executed or closed evidence is changed through controlled revisions, reversals or supersession rather than silent overwrite.
7. **Relational integrity:** MySQL/InnoDB remains authoritative; business-critical fields remain relational.
8. **Concurrency:** transitions and financial/approval invariants use transactions and locking where races would create invalid state.
9. **Responsive operation:** primary work surfaces must remain usable at mobile and desktop widths.
10. **Accessibility:** semantic structure, keyboard operation, focus visibility and WCAG 2.2 AA contrast are product requirements.
11. **No duplicate domain models:** existing baseline schema primitives are reused before adding tables.
12. **Green release gate:** each merge must preserve migrations, codegen, integration tests, Svelte diagnostics, build and browser acceptance.

## 5. Product navigation model

The target top-level information architecture is:

- Dashboard
- CRM
- Projects / Jobs
- Schedule
- Commercial
- Purchasing
- People
- Documents
- Assets / Facilities
- Reports
- Professional Tools
- Administration

Finance remains a first-class operational workspace inside the Business OS and may appear as its own top-level module for organisations with finance capability. Contracts remain directly accessible while contract administration is a major active workflow.

Navigation rules:

- render only destinations that are both implemented and available to the current actor;
- derive visibility from effective permission/capability namespaces;
- do not render placeholder links to unimplemented routes;
- keep the registry structured so modules can be activated without rewriting the shell;
- surface frequently used child destinations within module groups rather than one long flat list;
- keep mobile navigation compact and task-oriented.

## 6. Delivery sequence

### Slice 1 — V1 Platform Experience Foundation

**Objective:** establish the application structure every later slice lands into.

Deliver:

- central navigation registry;
- effective-permission-driven module visibility;
- branded NuBlox shell using the selected identity assets and working palette;
- grouped navigation instead of the current flat link list;
- active-route treatment;
- clear organisation/account context;
- reserved shell actions for Search, Create and Notifications without fake routes;
- reusable global design tokens and accessibility/focus defaults;
- responsive shell that supports later mobile field workflows;
- browser coverage for owner and read-only navigation visibility.

Exit criteria:

- no current route is lost;
- owner can reach every implemented workspace;
- read-only actor sees only applicable implemented modules/controls;
- shell renders without horizontal overflow at supported browser widths;
- all existing 19 browser acceptance scenarios remain green;
- complete system validation is green on the exact final head.

### Slice 2 — People, Tasks, Time and Schedule

Activate the workforce/time/scheduling schema.

Deliver:

- people/workforce directory linked to organisation members where appropriate;
- teams and competencies;
- task and assignment primitives;
- time entries/timesheets;
- schedule/calendar views;
- project/job assignment context;
- permission namespaces and audit coverage;
- mobile-first assigned-work and time-entry flows.

Exit: a project can be staffed, scheduled, actioned and time-recorded by authorised members.

### Slice 3 — Documents and Project Information

Activate the document/information schema.

Deliver:

- document metadata and revision control;
- document register;
- classifications/statuses;
- storage-adapter boundary;
- project information permissions;
- RFIs, submittals and instructions where baseline primitives exist;
- immutable issue/revision evidence;
- search-ready metadata.

Exit: controlled project information can be created, revised, issued and retrieved with audit evidence.

### Slice 4 — Procurement and Project Commercial Control

Activate procurement and cost-control schemas.

Deliver:

- supplier workflows reusing CRM parties;
- enquiries and purchase orders;
- commitments and project cost structure;
- change/variation controls;
- valuations/cost reporting primitives needed by the QS pack;
- links to contracts, projects and finance without duplicate supplier/customer models.

Exit: authorised users can procure work/materials and see controlled project commercial position.

### Slice 5 — Site, Quality and Safety

Activate site/quality/safety schemas.

Deliver:

- sites/locations;
- site diary/records;
- inspections/checklists;
- defects/issues/NCR flows;
- photos/evidence links;
- safety observations/actions;
- mobile capture patterns.

Exit: field teams can record and close controlled site/quality/safety workflows from mobile and desktop.

### Slice 6 — Assets, Facilities and Maintenance

Activate asset/maintenance schemas.

Deliver:

- asset register and hierarchy;
- asset documents/history;
- planned/reactive work orders;
- maintenance schedule generation;
- contractor assignment;
- inspections/service/compliance history;
- foundations required by the Facilities Manager and Electrician packs.

Exit: an asset can be registered, inspected, maintained and evidenced through its lifecycle.

### Slice 7 — Portal and Cross-Organisation Collaboration

Deliver:

- usable customer/contractor portal;
- scoped invitations/access;
- controlled document/information responses;
- project participation views;
- explicit ownership and audit of shared actions.

Exit: external participants can complete agreed workflows without gaining organisation-internal access.

### Slice 8 — Pilot Professional Packs

Deliver the Quantity Surveyor, Electrician and Facilities Manager packs by composing shared capabilities.

Exit: each pack changes experience and workflow meaningfully without forking the underlying architecture.

### Slice 9 — Reporting, Integrations and Advanced Finance

Deliver according to customer value and dependency readiness:

- richer operational reporting;
- email/calendar/e-sign/accounting/payment adapters;
- workflow automation;
- controlled statutory financial statements;
- later finance/integration boundaries such as bank reconciliation, AP expansion and statutory submissions only when separately prioritised.

## 7. Definition of Done for every slice

A slice is not complete because screens exist. It is complete only when:

- domain invariants are explicit;
- permissions are seeded and server-enforced;
- repositories/services preserve tenancy and transactions;
- routes use safe public identifiers;
- material writes are audited;
- migrations are forward-only and codegen-clean;
- real-MySQL integration tests cover positive, denial and lifecycle paths;
- Svelte diagnostics, lint and production build are clean;
- browser tests prove the principal user workflow and relevant read-only/denial behavior;
- responsive behavior is checked;
- documentation states included and deliberately excluded scope.

## 8. Immediate implementation boundary

The active branch `product/v1-platform-experience-foundation` implements **Slice 1 only**.

It must not introduce speculative runtime routes for People, Schedule, Purchasing, Documents, Assets or Professional Tools. Instead it establishes the shell and registry so those modules can be activated cleanly in later slices.

This keeps the first product-platform change narrow, testable and reversible while correcting the application structure before more domain code is added.
