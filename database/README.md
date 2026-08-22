# NuBlox Database

The NuBlox production database is MySQL 8.4 / InnoDB. Committed SQL migrations are the implemented relational-schema authority.

## Authority

```text
database/migrations/   authoritative production migration stream
database/docs/         durable schema-design references
app/src/lib/server/db/ runtime persistence boundary and generated Kysely types
```

The original pre-production 001–010 SQL package sources were consolidated into `database/migrations/20260815140337_baseline_v1.sql`. The separate package-source and baseline-validation trees were removed after consolidation; their history remains available in Git.

If a design reference and an applied migration differ, the migration describes the implemented schema.

## Technology and modelling rules

- MySQL 8.4 / InnoDB.
- Dbmate plain-SQL forward migrations.
- Kysely + `mysql2` at the application persistence boundary.
- Kysely types generated from an actually migrated database.
- `utf8mb4` throughout.
- relational and 3NF by default;
- explicit foreign keys, candidate keys and `CHECK` constraints where appropriate;
- fixed-precision decimal values for money;
- explicit tenant ownership for organisation-owned records;
- immutable or additive correction for material historical evidence;
- no stable business concepts hidden in generic JSON/EAV structures.

Governing data semantics are defined by the bottom-up architecture in `docs/architecture/bottom-up/`, especially Layers 0–4.

## Local database workflow

From `app/`, with `DATABASE_URL` configured:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:types
```

Generated files under `app/src/lib/server/db/generated/` are derivative of the migrated schema and must not be edited manually.

## Migration rules

1. Add a timestamped forward migration for persistent schema changes.
2. Never rewrite a released migration.
3. Keep migrations deterministic and reviewable as MySQL SQL.
4. Use expand/migrate/contract sequencing for destructive live-data changes where necessary.
5. Regenerate database-derived Kysely types after structural changes.
6. Add integration tests for material ownership, lifecycle, concurrency and permission invariants.
7. Every migration change must pass the clean MySQL 8.4 CI rebuild.

## Current measured baseline

A clean consolidated rebuild measured on 22 August 2026:

| Measure | Baseline |
| --- | ---: |
| Dbmate migrations applied | 35 |
| Pending migrations | 0 |
| Application base tables | 398 |
| Foreign keys | 904 |
| CHECK constraints | 530 |

These counts are regression observations for the current migration head, not permanent architecture invariants. When an intentional migration changes them, update the CI structural expectation in the same change.

## Security boundary

A surrogate/public identifier is never authority. Tenant context, project/record scope, permissions, lifecycle policy and delegated authority are enforced by server-domain services before organisation-owned records are returned or mutated.
