# NuBlox: Digital Applications

NuBlox is a natively engineered **construction and built-environment operating system**: a world-class ERP and operational platform intended to connect the commercial, project, field, financial, workforce, asset and property lifecycle in one governed system.

The product is designed around canonical business records, explicit organisational and project context, server-authoritative permissions, controlled workflows, durable evidence and end-to-end process integrity. External ERP products are benchmarks for coverage and control quality, not runtime dependencies.

## Product direction

NuBlox targets the built-environment lifecycle:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

The governing architecture defines 19 native capability domains spanning enterprise master data, CRM, estimating, commercial management, projects, BIM/information management, finance, procurement, materials, production, workforce, field operations, QHSE, plant, property/facilities, service, sustainability and platform intelligence.

See [`docs/57-world-class-native-erp-architecture.md`](docs/57-world-class-native-erp-architecture.md) for the governing product architecture and [`docs/built-environment-erp-capability-blueprint.md`](docs/built-environment-erp-capability-blueprint.md) for the capability model.

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

Capability presence is not treated as proof of product completeness. A world-class capability also requires canonical records, workflow and state controls, permissions and segregation of duties, audit/correction semantics, reporting, integration boundaries and end-to-end validation.

## Database baseline

A clean MySQL 8.4 rebuild of the consolidated migration stream on **22 August 2026** measured:

| Measure | Current baseline |
| --- | ---: |
| Dbmate migrations | 35 |
| Pending migrations | 0 |
| Application tables | 398 |
| Foreign keys | 904 |
| CHECK constraints | 530 |

Committed MySQL migrations in [`database/migrations/`](database/migrations/) are the schema authority. Generated Kysely types are derivative application artefacts.

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
  adr/               Architecture Decision Records
  architecture/      Enterprise architecture and taxonomy
  branding/          NuBlox brand system
  README.md          Documentation authority and index
```

## Documentation

Start with [`docs/README.md`](docs/README.md). It defines documentation precedence and the active reference set.

Key documents:

- [`docs/57-world-class-native-erp-architecture.md`](docs/57-world-class-native-erp-architecture.md) — governing product architecture.
- [`docs/built-environment-erp-capability-blueprint.md`](docs/built-environment-erp-capability-blueprint.md) — native ERP capability blueprint.
- [`docs/architecture/taxonomy/README.md`](docs/architecture/taxonomy/README.md) — enterprise function taxonomy.
- [`docs/work-kernel-foundation.md`](docs/work-kernel-foundation.md) — horizontal work execution model.
- [`docs/01-product-requirements-document.md`](docs/01-product-requirements-document.md) — product requirements.
- [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md) — tenancy and authorisation model.
- [`docs/11-security-privacy-compliance.md`](docs/11-security-privacy-compliance.md) — security and compliance controls.
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

Browser acceptance requires Playwright/Chromium and the repository's test environment configuration.

## Engineering rule

A NuBlox domain is not complete because a screen exists. It is complete only when the system owns its canonical records and invariants, authoritative permissions, controlled lifecycle, audit/correction evidence, usable workflow, reporting and integration semantics, and validated end-to-end process behaviour.
