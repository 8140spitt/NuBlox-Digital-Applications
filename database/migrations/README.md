# NuBlox Production Migrations

This directory is the **authoritative production schema-evolution stream** for NuBlox.

Migrations are plain MySQL SQL executed by Dbmate.

## Commands

From `app/` with `DATABASE_URL` configured:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:types
```

## Baseline

`20260815140337_baseline_v1.sql` is the frozen consolidation of the original pre-production 001–010 schema packages. All subsequent schema evolution is represented by timestamped forward migrations in this directory.

The baseline is intentionally irreversible. Disposable/non-production environments rebuild rather than rolling the complete baseline backward.

## Rules

- Released migration contents are immutable.
- New persistent business facts require normalised forward migrations.
- Application-only shadow stores are not substitutes for authoritative relational state.
- A new product surface does not require a migration when existing canonical structures already support it.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Destructive production changes use an appropriate expand/migrate/contract strategy.
- Tenant, candidate-key, lifecycle and referential integrity must be enforced at the strongest practical layer.
- Database-derived Kysely types must be regenerated after structural changes.
- Existing-tenant migration grants and future-organisation bootstrap grants must remain semantically aligned where migrations introduce permissions.
- Every migration change must pass a clean MySQL 8.4 rebuild plus integration, type, build and browser validation.

## Current measured head

Clean rebuild measured on 22 August 2026:

```text
35 migrations applied
0 pending
398 application base tables
904 foreign keys
530 CHECK constraints
```

These values are a regression baseline for the current head. They are updated only when an intentional migration changes the structure.

Historical package names, activation notes and release-by-release counts belong in Git history rather than this governing migration reference.
