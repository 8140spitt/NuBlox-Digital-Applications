# NuBlox Database Baseline Validation

This directory contains the reproducible validation harness for the NuBlox implementation-level relational baseline.

## Target

- MySQL 8.4.x
- InnoDB
- `utf8mb4_0900_ai_ci`
- schema stages `001` through `010`, including the ordered integrity stages for Packages 007 and 008

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

The clean MySQL 8.4 execution pass is also used to correct pre-production DDL defects at their source. Corrections already identified include:

- generated-column uniqueness guards in Packages 001 and 006 require `RESTRICT` rather than cascading delete actions on their generated-column base keys;
- Package 007 object-storage bucket/key locators are ASCII/binary identifiers so their full 255/1000-character unique locator remains within the InnoDB index-width limit while user-facing filenames and document metadata remain Unicode.

## CI

`.github/workflows/database-baseline-validation.yml` runs this validator using the official `mysql:8.4` container on schema/validation pull requests and on relevant changes merged to `main`.

## What this proves

A passing build proves that the numbered pre-production schema packages can be executed, in documented order, against a clean MySQL 8.4 server under current non-standard foreign-key restrictions and produce a structurally complete relational database.

It does **not** by itself prove every application-level lifecycle invariant. Those rules remain subject to domain-service, authorisation, concurrency and integration tests during implementation.
