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

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Authentication/session boundary:** Better Auth 1.6.25
- **Primary persistence:** MySQL 8.4 / InnoDB
- **Runtime query layer:** Kysely + mysql2
- **Production migrations:** Dbmate plain SQL
- **Database type generation:** kysely-codegen from the migrated MySQL schema
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

Architecture decisions are recorded under [`docs/adr`](docs/adr/README.md), including persistence tooling (ADR-0001) and the authentication/session boundary (ADR-0002).

## Database implementation

The planned **001–010 relational domain baseline is complete and has passed repeatable clean-build validation on MySQL 8.4.11**. Baseline v1 contains **337 base tables, 739 foreign keys and 427 `CHECK` constraints** and is consolidated into `database/migrations/20260815140337_baseline_v1.sql`.

Forward migration `20260815145430_authentication_boundary.sql` adds Better Auth infrastructure plus the explicit auth-to-domain user link. The current migrated application schema is therefore **342 tables, 743 foreign keys and 427 `CHECK` constraints**.

Implementation-level database material is grouped under `/database`:

- [Database workflow and rules](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database baseline validation](database/validation/README.md)

## Application persistence boundary

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

Routes/components do not issue SQL directly. Tenant context and authorisation remain mandatory domain/repository concerns.

## Implemented Platform Kernel foundation

The first database-backed application slice implements:

- active membership verification by **organisation + user + member** tuple;
- participant-scoped project reads;
- transactional project creation with owning-organisation participation and creator project membership;
- owner-scoped project lifecycle mutation;
- optimistic lifecycle concurrency guards;
- append-only project audit evidence;
- MySQL integration tests for tenant isolation.

## Implemented authentication, tenant and permission boundary

Authentication now follows:

```text
Better Auth session
        ↓
Explicit auth_user_links mapping
        ↓
NuBlox users
        ↓
Active organisation membership
        ↓
Organisation roles / member overrides
        ↓
Project membership scope
        ↓
Lifecycle / business policy
```

The selected organisation cookie is only a selection hint. The server revalidates active membership before constructing trusted tenant context. Effective organisation permission precedence is:

```text
explicit deny > explicit allow > active role grant > default deny
```

Project-scoped operations additionally require active project membership/participation. Better Auth handles authentication/session mechanics only; NuBlox remains authoritative for tenancy and business permissions.

The permanent MySQL CI gate now verifies credential sign-in and session resolution, explicit auth-to-domain identity linking, forged organisation-selection denial, role/override precedence, project scope, the existing Platform Kernel invariants, Kysely type drift and the SvelteKit type-check together.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Early application implementation with the MySQL schema/migration baseline validated, typed persistence established, Platform Kernel tenant isolation integration-tested, and the authentication/trusted-tenant/effective-permission boundary implemented and integration-tested against MySQL 8.4.**
