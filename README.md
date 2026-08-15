# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** serving businesses and professionals across construction and the built environment.

It combines a shared business-management core, a built-environment project/site/asset core, profession-specific capability packs, controlled cross-organisation collaboration, and structured workflow/automation across the building lifecycle.

## Business and brand foundation

Corporate and brand strategy documentation is maintained separately from the product specification:

- [NuBlox business entity](docs/branding/00-business-entity.md)
- [NuBlox brand strategy](docs/branding/01-brand-strategy.md)
- [NuBlox brand architecture and naming](docs/branding/02-brand-architecture-and-naming.md)
- [NuBlox verbal identity and messaging](docs/branding/03-verbal-identity-and-messaging.md)
- [NuBlox visual identity brief](docs/branding/04-visual-identity-brief.md)
- [NuBlox logo concept directions](docs/branding/05-logo-concept-directions.md)

This layer defines the business, master brand, audiences, positioning, value proposition, naming architecture, verbal identity, visual direction, logo-concept territories and commercial identity that sit above the NuBlox software platform.

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Primary persistence:** MySQL 8.4 / InnoDB
- **Runtime query layer:** Kysely + mysql2
- **Production migrations:** Dbmate plain SQL
- **Database type generation:** kysely-codegen from the migrated MySQL schema
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

The persistence-tooling decision and rationale are recorded in [ADR-0001 — Database Query and Migration Tooling](docs/adr/0001-database-query-and-migration-tooling.md).

## Developer handoff documentation

The original product and delivery handoff remains under `/docs`:

- `docs/00-executive-summary.md` through `docs/20-record-lifecycles.md`
- `docs/career-taxonomy-seed.csv`
- `docs/career-taxonomy-seed.json`

The historical `docs/21` through `docs/30` paths are retained as compatibility pointers.

## Database implementation packages

Implementation-level schema work is grouped under `/database`:

- [Database workflow and rules](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database baseline validation](database/validation/README.md)

### Completed baseline packages

| Package | Domain | Specification | SQL |
|---|---|---|---|
| 001 | Platform Kernel | `database/docs/001-platform-kernel.md` | `database/schema/001-platform-kernel.sql` |
| 002 | CRM & Parties | `database/docs/002-crm-parties.md` | `database/schema/002-crm-parties.sql` |
| 003 | Sales, Estimates & Quotations | `database/docs/003-sales-estimates-quotations.md` | `database/schema/003-sales-quotes.sql` |
| 004 | Contracts & Finance | `database/docs/004-contracts-finance.md` | `database/schema/004-contracts-finance.sql` |
| 005 | Procurement | `database/docs/005-procurement.md` | `database/schema/005-procurement.sql` |
| 006 | Workforce, Time & Scheduling | `database/docs/006-workforce-time-scheduling.md` | `database/schema/006-workforce-time-scheduling.sql` |
| 007 | Project Information & Documents | `database/docs/007-project-information-documents.md` | `database/schema/007-project-information-documents.sql` + integrity stage |
| 008 | Site Operations, Quality & Safety | `database/docs/008-site-quality-safety.md` | `database/schema/008-site-quality-safety.sql` + integrity stage |
| 009 | Commercial Cost Control | `database/docs/009-commercial-cost-control.md` | `database/schema/009-commercial-cost-control.sql` |
| 010 | Assets & Maintenance | `database/docs/010-assets-maintenance.md` | `database/schema/010-assets-maintenance.sql` |

Package 007's integrity stage is `database/schema/007-project-information-integrity.sql`; it is part of Package 007, not Package 007a.

Package 008's integrity stage is `database/schema/008-site-quality-safety-integrity.sql`; it is part of Package 008 and hardens attendance/inspection/RAMS/action integrity found during validation.

The planned **001–010 relational domain baseline is complete and has passed repeatable clean-build validation on MySQL 8.4.11**. The validated chain creates **337 base tables, 739 foreign keys and 427 `CHECK` constraints** on each clean build.

The same validated chain is consolidated into `database/migrations/20260815140337_baseline_v1.sql` for Dbmate. The production migration path is SQL-first; released migrations become immutable and subsequent changes are forward migrations.

## Application database boundary

Server-side persistence is rooted at `app/src/lib/server/db/`:

```text
SvelteKit action / endpoint
          ↓
     Domain service
          ↓
       Repository
          ↓
        Kysely
          ↓
      mysql2 pool
          ↓
      MySQL 8.4
```

The generated Kysely database interface is derived from a migrated MySQL database and committed for compile-time checking. Tenant context and authorisation remain mandatory domain/repository concerns; query-builder typing does not replace access control.

## Implemented Platform Kernel foundation

The first real database-backed application slice is implemented for organisations, memberships, projects and audit evidence.

Current kernel rules include:

- active membership verification by **organisation + user + member** tuple;
- active organisation access through a tenant-gated service;
- participant-scoped project reads;
- transactional project creation with owning-organisation participation and creator project membership;
- owning-organisation project lifecycle mutation;
- server-side project state-machine validation;
- optimistic current-status guards for lifecycle writes;
- append-only audit evidence for project creation and status transitions;
- MySQL integration tests proving application and composite-FK tenant isolation.

These tests run in CI against the actual Dbmate-migrated MySQL 8.4 database before the SvelteKit type-check.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Early application implementation with the 001–010 relational baseline MySQL-validated, Baseline v1 in the SQL migration stream, the typed SvelteKit persistence boundary established, and the first tenant-isolated Platform Kernel repositories/services integration-tested against MySQL 8.4.**
