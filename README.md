# NuBlox: Digital Applications

NuBlox is a natively engineered **construction and built-environment operating system**: a world-class ERP and operational platform connecting the commercial, project, design, field, financial, workforce, asset, property and service lifecycle in one governed system.

The product is designed around canonical business records, explicit organisation/project context, server-authoritative permissions, controlled workflows, durable evidence and end-to-end process integrity.

## Governing Construction and Built Environment model

The single governing sector and product model is:

**[`docs/construction-and-built-environment.md`](docs/construction-and-built-environment.md)**

It defines:

- the complete built-asset and organisation boundary;
- the whole-life lifecycle from market and feasibility through design, construction, operation, refurbishment and disposal;
- canonical enterprise, project, information, commercial, asset and financial records;
- the 19 stable NuBlox native capability domains;
- specialist overlays for design, engineering, surveying, contracting, trades, infrastructure, manufacturing, property, FM, service and regulation;
- cross-domain process chains and completion criteria;
- BIM/CDE, project controls, QHSE, building safety, workforce, supply chain, carbon and asset-management semantics;
- standards and interoperability treatment;
- the capability completeness gate for world-class delivery.

The canonical lifecycle is:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

## Current platform foundation

The current `main` line includes native foundations across:

- multi-tenant identity, authentication, organisation membership, roles and granular permissions;
- CRM organisations, contacts, opportunities and activity history;
- estimating, quotations, contract formation and amendments;
- projects, project participants and invite-first cross-organisation collaboration;
- project information/document controls and portal collaboration;
- procurement, purchasing and project commercial control;
- workforce, time and scheduling foundations;
- site, quality and safety controls;
- assets, facilities and maintenance foundations;
- receivables, collections, credit control, tax-relief workflows, accounting, period close, reporting and year-end close;
- native Accounts Payable matching and approval foundations;
- a horizontal Work Kernel for actions, assignments, approvals, decisions, lifecycle evidence and durable outbox events;
- a permission-aware construction command centre and contextual application shell.

Capability presence is not treated as product completeness. A world-class capability also requires canonical records, lifecycle controls, permissions and segregation of duties, audit/correction semantics, reporting, integration boundaries and validated end-to-end behaviour.

## Database baseline

A clean MySQL 8.4 rebuild of the consolidated migration stream on **22 August 2026** measured:

| Measure | Current baseline |
| --- | ---: |
| Dbmate migrations | 35 |
| Pending migrations | 0 |
| Application tables | 398 |
| Foreign keys | 904 |
| CHECK constraints | 530 |

Committed MySQL migrations in [`database/migrations/`](database/migrations/) are the implemented schema authority. Generated Kysely types are derivative application artefacts.

## Technology

- **Application:** Svelte 5 / SvelteKit
- **Authentication:** Better Auth
- **Database:** MySQL 8.4 / InnoDB
- **SQL access:** Kysely + `mysql2`
- **Migrations:** Dbmate
- **Validation:** Vitest, Svelte Check, ESLint/Prettier and Playwright
- **Architecture:** modular monolith with explicit domain boundaries and a normalised relational model by default

## Core security model

The governing separation is:

**Career ≠ Organisation Role ≠ Project Role ≠ Permission**

Effective permission precedence is:

**explicit member deny → explicit member allow → active role grant → default deny**

Umbrella permissions do not cross capability domains. Tenant and project boundaries are enforced server-side; UI visibility is never the authority for access control.

## Repository structure

```text
app/                 SvelteKit application and server domain code
database/
  migrations/        Authoritative MySQL migration stream
  docs/              Durable schema-package design references
  seeds/             Controlled seed/reference data
docs/
  construction-and-built-environment.md
                      Governing sector and product model
  adr/               Architecture Decision Records
  architecture/      Enterprise architecture and taxonomy
  branding/          NuBlox brand system
  README.md          Documentation authority and index
```

## Documentation

Start with [`docs/README.md`](docs/README.md). It defines documentation precedence and the active reference set.

Key references:

- [`docs/construction-and-built-environment.md`](docs/construction-and-built-environment.md) — governing Construction and Built Environment model.
- [`docs/architecture/taxonomy/README.md`](docs/architecture/taxonomy/README.md) — enterprise function taxonomy.
- [`docs/work-kernel-foundation.md`](docs/work-kernel-foundation.md) — horizontal work execution model.
- [`docs/01-product-requirements-document.md`](docs/01-product-requirements-document.md) — product requirements.
- [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md) — tenancy and authorisation model.
- [`docs/11-security-privacy-compliance.md`](docs/11-security-privacy-compliance.md) — security and compliance controls.
- [`docs/17-sources-and-standards.md`](docs/17-sources-and-standards.md) — current source and standards register.
- [`database/docs/`](database/docs/) — schema design references.

Implementation history, delivery sequencing and superseded plans belong in Git history and GitHub issues rather than the active architecture documentation set.

## Local validation

From `app/`:

```bash
pnpm install
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm lint
pnpm test:integration
pnpm check
pnpm test:unit -- --run
pnpm build
```

Browser acceptance requires Playwright/Chromium and the repository test environment configuration.

## Engineering rule

A NuBlox domain is not complete because a screen exists. It is complete only when the system owns its canonical records and invariants, authoritative permissions, controlled lifecycle, audit/correction evidence, usable workflow, reporting and integration semantics, and validated end-to-end process behaviour.