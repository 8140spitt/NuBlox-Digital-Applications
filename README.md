# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** serving businesses and professionals across construction and the built environment.

It combines:

- a shared business-management core;
- a built-environment project, site and asset-management core;
- profession-specific capability packs;
- controlled collaboration across organisations; and
- structured data, workflow automation and future AI assistance across the building lifecycle.

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Primary persistence:** MySQL using InnoDB
- **Architecture:** modular monolith first, with explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Market assumption:** UK-first, with regionalisation designed in rather than hard-coded

## Documentation index

The `/docs` directory is the software-development-company handoff pack:

1. [Executive Summary](docs/00-executive-summary.md)
2. [Product Requirements Document](docs/01-product-requirements-document.md)
3. [Functional Requirements](docs/02-functional-requirements.md)
4. [Career Taxonomy](docs/03-career-taxonomy.md)
5. [Career Capability Matrix](docs/04-career-capability-matrix.md)
6. [System Architecture](docs/05-system-architecture.md)
7. [Data Model](docs/06-data-model.md)
8. [Authentication, Permissions and Multi-tenancy](docs/07-auth-permissions-multitenancy.md)
9. [API and Integrations](docs/08-api-integrations.md)
10. [UX and Information Architecture](docs/09-ux-information-architecture.md)
11. [Non-functional Requirements](docs/10-non-functional-requirements.md)
12. [Security, Privacy and Compliance](docs/11-security-privacy-compliance.md)
13. [DevOps, Environments and Testing](docs/12-devops-environments-testing.md)
14. [Delivery Roadmap](docs/13-delivery-roadmap.md)
15. [Backlog and Acceptance Criteria](docs/14-backlog-acceptance-criteria.md)
16. [Open Decisions and Assumptions](docs/15-open-decisions-assumptions.md)
17. [Glossary](docs/16-glossary.md)
18. [Sources and Standards](docs/17-sources-and-standards.md)
19. [Development Company Brief](docs/18-development-company-brief.md)
20. [Risks and Dependencies](docs/19-risks-and-dependencies.md)
21. [Record Lifecycles and State Machines](docs/20-record-lifecycles.md)
22. [Normalised Database Schema — Platform Kernel](docs/21-normalised-database-schema.md)
23. [CRM and Party Domain Model](docs/22-crm-party-model.md)
24. [Sales, Estimates, Quotations and Proposals](docs/23-sales-estimates-quotations.md)

## Database implementation

The `/database` directory contains the implementation-level MySQL schema baseline:

- [Database workflow and migration rules](database/README.md)
- [001 — Platform Kernel DDL](database/schema/001-platform-kernel.sql)
- [002 — CRM and Party Model DDL](database/schema/002-crm-parties.sql)
- [003 — Sales, Estimates and Quotations DDL](database/schema/003-sales-quotes.sql)

Planned schema packages continue through contracts/finance, procurement, workforce, project information/documents, site/quality/safety, commercial cost control and assets/maintenance.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Product definition / pre-development with implementation-level schema design in progress.**

This repository defines the intended product, baseline architecture and acceptance expectations for discovery, estimation and implementation planning. Items explicitly marked as open decisions must be agreed before contractual scope is frozen.
