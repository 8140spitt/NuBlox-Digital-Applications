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

This layer defines the business, master brand, audiences, positioning, value proposition, naming architecture, verbal identity, visual direction and commercial identity that sit above the NuBlox software platform.

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Primary persistence:** MySQL / InnoDB
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

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

The planned **001–010 relational domain baseline is now complete**. The next database phase is to select the migration/query tooling, run the complete chain against clean MySQL 8.4 in CI, resolve any executable-chain defects as forward pre-production changes, and add tenant/lifecycle integrity tests before production migrations are frozen.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Product definition / pre-development with the planned 001–010 implementation-level relational schema baseline complete.**
