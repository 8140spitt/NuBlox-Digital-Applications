# 13 — Delivery Roadmap

This is a dependency roadmap, not a calendar estimate. The development company must attach team assumptions, durations and costs.

## Phase 0 — Discovery and architecture validation

Deliverables:

- confirmed product scope;
- user/persona interviews;
- pilot workflow maps;
- system context diagram;
- threat model;
- tenancy/auth decision;
- object storage/hosting decision;
- MySQL access-layer/ORM decision;
- UX wireframes;
- prioritised backlog;
- delivery estimate;
- Definition of Done.

Exit: no unresolved blocker prevents platform-kernel implementation.

## Phase 1 — Platform kernel

Build:

- SvelteKit app shell;
- authentication;
- organisations;
- memberships/invitations;
- tenant context;
- careers;
- capabilities;
- roles/permissions;
- audit service;
- base design system;
- CI/CD;
- MySQL migrations;
- logging/monitoring foundation.

Exit: tenant-isolation automated tests pass.

## Phase 2 — Shared Business OS

Build:

- CRM/contacts;
- opportunities;
- quotes;
- contracts;
- invoices/status;
- supplier/procurement basics;
- people/competencies;
- time;
- scheduling;
- notifications;
- documents/versioning.

Exit: a small business can complete lead → quote → job/project → invoice.

## Phase 3 — Shared Built Environment OS

Build:

- projects/jobs;
- project participants;
- sites/locations;
- tasks/milestones;
- RFIs/instructions;
- variations/change;
- inspections;
- defects/issues;
- site records/photos;
- basic commercial controls;
- asset register/work orders.

Exit: multi-party project workflow can operate with scoped access.

## Phase 4 — Three pilot professional packs

### Quantity Surveyor
- measurement/cost-plan baseline;
- tender comparison;
- variations;
- valuation/cost reporting.

### Electrician
- survey/quote/job;
- installation/equipment/circuit records;
- tests;
- certificates/templates;
- maintenance/service history.

### Facilities Manager
- property/assets;
- PPM/reactive work;
- inspections;
- contractors;
- service/compliance history.

Exit: three packs reuse shared modules and capability engine without bespoke parallel architectures.

## Phase 5 — Production hardening / pilot

- accessibility review;
- penetration test;
- performance/load testing;
- backups/restore test;
- support/incident processes;
- privacy documentation;
- onboarding/import tools;
- production monitoring;
- UAT.

Exit: agreed launch gates met.

## Phase 6 — Career expansion

Expand the professional capability library across all 84 careers by domain.

Order expansion by customer demand and capability reuse, not alphabetical career order.

## Phase 7 — Ecosystem/integrations

Candidates:

- accounting;
- payment;
- e-sign;
- email/calendar;
- document/storage enhancements;
- BIM/CDE;
- geospatial;
- supplier/catalogue;
- SSO.

## Phase 8 — Automation and AI

Add only after permissions, provenance, audit and structured-data foundations are mature.

Potential capabilities:

- document classification/extraction;
- report drafting;
- tender comparison;
- risk/action summaries;
- project query assistant;
- asset/service forecasting.

## Workstreams throughout

- product management;
- UX/research;
- architecture;
- security/privacy;
- data migration/import;
- QA/accessibility;
- DevOps/operations;
- documentation/training.
