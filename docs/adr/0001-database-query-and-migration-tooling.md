# ADR-0001 — Database Query and Migration Tooling

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** NuBlox architecture
- **Scope:** SvelteKit server persistence, schema migrations and generated database types

## Context

NuBlox has a validated MySQL 8.4 relational baseline spanning Packages 001–010. The current baseline contains 337 base tables, 739 foreign keys and 427 `CHECK` constraints and intentionally uses composite tenant-safe candidate keys, generated columns, explicit relational integrity and hand-authored MySQL DDL.

The application therefore needs tooling that does not replace the database with a second schema authority or silently simplify database features that NuBlox relies on.

## Decision

NuBlox will use the following SQL-first stack:

| Concern | Tool | Role |
|---|---|---|
| Runtime query layer | **Kysely** | Type-safe SQL query builder used by SvelteKit server/domain repositories |
| MySQL driver | **mysql2** | Node.js MySQL connection pooling and driver used by Kysely's MySQL dialect |
| Database type generation | **kysely-codegen** | Generate TypeScript database interfaces from the actual MySQL schema |
| Migration execution | **Dbmate** | Apply timestamped, plain-SQL forward migrations |
| Structural database validation | **Existing NuBlox MySQL 8.4 validator** | Rebuild and verify the full schema/migration chain in CI |

The **MySQL database and committed SQL migrations remain the schema source of truth**. Generated TypeScript types are derivative build/development artefacts and must be regenerated when the schema changes.

## Why Kysely

Kysely stays close to SQL rather than introducing an ORM relation/schema DSL. It provides compile-time table/column/result typing while retaining raw-SQL escape hatches and an official MySQL dialect.

This is important for NuBlox because many queries will be project/tenant scoped, commercial and reporting queries will be join-heavy, and database constraints are deliberately richer than a typical CRUD schema.

## Why mysql2

`mysql2` is the Node.js driver used for the Kysely MySQL connection pool. Runtime application connections will use a bounded pool, UTC sessions and explicit environment-based configuration.

## Why database-derived types

NuBlox will not manually duplicate 337 table definitions into TypeScript. `kysely-codegen` will introspect the built MySQL schema and generate the Kysely `DB` interface.

Generated types must never be edited by hand.

## Why Dbmate

Dbmate uses timestamp-versioned **plain SQL** migration files. This lets NuBlox preserve MySQL-specific DDL exactly as designed and validated, including composite foreign keys, generated columns, `CHECK` constraints and explicit indexes.

The current numbered Packages 001–010 are pre-production design packages. They will be consolidated into an irreversible **Baseline v1** migration. After that baseline is frozen, released migrations are forward-only and must never be rewritten in place.

## Rejected alternatives

### Prisma as schema/migration authority

Rejected for the NuBlox baseline. Prisma can query MySQL, but its schema language/migration model does not represent every database feature NuBlox already uses. In particular, MySQL `CHECK` constraints are surfaced during introspection as unsupported schema features and require customized migrations. That would create an unnecessary second source of truth and increase schema-drift risk.

### Drizzle as schema authority

Not selected. Drizzle is capable and remains a viable option for less SQL-centric projects, but NuBlox already has an extensive SQL-first schema. Re-declaring the database in a TypeScript schema would add duplication with little benefit over Kysely's database-derived type model.

### Full raw SQL without a typed query layer

Rejected for routine application queries. Raw SQL remains available for specialised reporting/administrative work, but Kysely provides valuable compiler feedback for tenant-scoped repository code.

## Runtime architecture

```text
SvelteKit server action / endpoint
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

Routes and Svelte components must not directly issue database queries.

## Tenant safety

Kysely type safety does **not** replace authorisation or tenant isolation.

Repositories handling tenant-owned records must accept explicit organisation/project scope and include it in the SQL predicate or join path. A lookup by surrogate `id` alone is not sufficient where tenant context is required.

## Migration policy

1. `database/migrations/` is the production migration source after Baseline v1 is frozen.
2. Migration filenames use timestamp versions.
3. Production/released migrations are immutable.
4. New changes use forward migrations; do not edit an already released migration.
5. MySQL DDL migrations are explicit about transaction behaviour.
6. Every migration change must pass clean MySQL 8.4 CI validation.
7. Destructive changes require an explicit expand/migrate/contract plan where live data may exist.
8. Baseline v1 rollback is intentionally unsupported; development/test databases are rebuilt from clean state instead.

## Type-generation policy

- Generated output lives under `app/src/lib/server/db/generated/`.
- The generator introspects a database built from the current migrations.
- Generated files are committed so TypeScript checks do not require a live database.
- CI verifies that regeneration does not produce an uncommitted diff.
- `BIGINT`/`DECIMAL` mappings must be treated conservatively to avoid JavaScript precision loss; application/domain conversion is explicit where required.

## Consequences

### Positive

- SQL remains authoritative.
- Existing MySQL integrity is preserved.
- Application queries receive strong TypeScript feedback.
- Complex joins/reporting remain natural SQL rather than ORM-specific relation APIs.
- Migrations are reviewable as ordinary SQL.
- Tooling does not force the schema to fit a narrower abstraction.

### Costs

- Developers must understand SQL and relational design.
- Repository boundaries and tenant predicates require discipline.
- Generated types must be refreshed after schema changes.
- Kysely is a query builder, not an active-record/data-mapper ORM; domain services/repositories remain NuBlox code.

## Follow-up

1. Add Kysely, mysql2, kysely-codegen and Dbmate to the SvelteKit package.
2. Consolidate Packages 001–010 into the pre-production Baseline v1 Dbmate migration.
3. Generate and commit database types from a clean MySQL 8.4 build.
4. Add `src/lib/server/db` connection/configuration infrastructure.
5. Add CI checks for migration execution and generated-type drift.
6. Begin repository/domain implementation with the Platform Kernel and tenant boundary first.
