# NuBlox Database Baseline Validation

This directory contains the reproducible validation harness for the NuBlox implementation-level relational baseline.

## Target

- MySQL 8.4.x
- InnoDB
- `utf8mb4_0900_ai_ci`
- schema stages `001` through `010`, including the ordered integrity stages for Packages 007 and 008

## Baseline v1 result

**PASSED on 2026-08-15 using MySQL 8.4.11.**

GitHub Actions validation run `#18` validated the complete ordered schema twice against separate clean databases.

Each clean build produced:

- **337 base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**
- all tables using InnoDB
- all tables using `utf8mb4_0900_ai_ci`
- a primary key on every base table
- `restrict_fk_on_non_standard_key = ON`

The second independent clean rebuild produced the same structural counts and completed successfully.

## Validation command

```bash
bash database/validation/validate-baseline.sh
```

The script supports either:

1. `MYSQL_CONTAINER_ID` — a running MySQL container, used by GitHub Actions; or
2. `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` — a directly reachable MySQL server.

## Current validation gates

The baseline fails validation if any of the following occurs:

- the server is not MySQL 8.4.x;
- `restrict_fk_on_non_standard_key` is disabled;
- any required schema stage is missing;
- any SQL stage fails on a clean database;
- the number of created base tables differs from the number of `CREATE TABLE` statements in the ordered schema chain;
- any created table is not InnoDB;
- any created table does not use `utf8mb4_0900_ai_ci` as its table collation;
- any created base table lacks a primary key;
- a second clean rebuild of the complete chain fails.

The workflow also reports the resulting foreign-key and `CHECK`-constraint counts for traceability.

## Validation corrections discovered

The clean MySQL 8.4 execution pass corrected pre-production DDL defects at their source. Corrections include:

- generated-column uniqueness guards in Packages 001 and 006 use `RESTRICT` rather than cascading delete actions on generated-column base keys;
- Package 007 object-storage bucket/key locators use ASCII/binary identifiers so the full 255/1000-character unique locator remains within the InnoDB index-width limit while user-facing filenames and document metadata remain Unicode;
- Package 007 review assignments use a stable surrogate identity with null-normalised uniqueness, and review decisions reference that assignment directly in 3NF;
- Package 007 integrity-stage foreign-key replacements are applied in MySQL-safe ordered `ALTER TABLE` statements;
- Package 008 integrity-stage foreign-key replacements explicitly retire obsolete supporting indexes before stronger composite foreign keys are created;
- Package 008 inspection-template nullability hardening temporarily removes dependent foreign keys, tightens the parent column, then restores the same referential graph;
- Package 009 cost-code self-parent prevention is enforced in the domain layer because MySQL 8.4 does not permit a `CHECK` constraint to reference the table's `AUTO_INCREMENT` identity column;
- Package 010 space, building-system and asset self-parent prevention follows the same domain-layer rule while retaining tenant/context-safe self-referencing foreign keys.

## CI

`.github/workflows/database-baseline-validation.yml` runs this validator using the official `mysql:8.4` container on schema/validation pull requests and on relevant changes merged to `main`.

## What this proves

A passing build proves that the numbered pre-production schema packages execute, in documented order, against a clean MySQL 8.4 server under current non-standard foreign-key restrictions and produce a structurally complete relational database.

It does **not** by itself prove every application-level lifecycle invariant. Those rules remain subject to domain-service, authorisation, tenant-isolation, concurrency and integration tests during implementation.

## Next database phase

1. Select the MySQL query/ORM/migration tooling.
2. Record the tooling decision in an ADR.
3. Consolidate/adopt the validated pre-production package chain into the migration system without losing constraints.
4. Add tenant-isolation and lifecycle/invariant integration tests.
5. Freeze the first production migration baseline only after those gates pass.
