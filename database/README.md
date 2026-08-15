# NuBlox Database

This directory contains the implementation-level MySQL schema baseline for NuBlox.

## Target

- MySQL 8.4
- InnoDB
- `utf8mb4`
- UTC event timestamps
- 3NF by default

## Layout

```text
database/
├── README.md
├── schema/
│   ├── 001-platform-kernel.sql
│   └── 002-crm-parties.sql
└── seeds/
    └── (reference-data seeds added as schema domains are frozen)
```

## Schema package order

Planned packages:

1. `001-platform-kernel.sql` — identity, organisations, careers, capabilities, permissions and projects
2. `002-crm-parties.sql` — normalised people/organisations, roles, contacts, opportunities and CRM activity
3. `003-sales-quotes.sql`
4. `004-contracts-finance.sql`
5. `005-procurement.sql`
6. `006-workforce-time-scheduling.sql`
7. `007-project-information-documents.sql`
8. `008-site-quality-safety.sql`
9. `009-commercial-cost-control.sql`
10. `010-assets-maintenance.sql`

The numbered SQL files currently describe the target schema in dependency order. Once the SvelteKit MySQL access/migration library is selected, these packages must be translated into or adopted by that migration system without losing the documented constraints.

## Current schema documentation

- `docs/21-normalised-database-schema.md` — platform kernel
- `docs/22-crm-party-model.md` — CRM/party model

## Normalisation policy

See:

- `docs/06-data-model.md`
- `docs/21-normalised-database-schema.md`
- `docs/22-crm-party-model.md`

Rules:

- 3NF is the default transactional design target.
- Many-to-many relations use junction tables.
- Stable business data is relational, not hidden in JSON.
- A real-world CRM party is represented once per tenant and may hold multiple business roles.
- Relationship attributes belong on relationship/junction tables rather than being duplicated onto master entities.
- Historical immutable snapshots are allowed where they represent facts at issue/approval time.
- Tenant-scoping keys may form part of composite keys to permit MySQL to enforce tenant integrity.
- Any material denormalisation requires a documented reason and preferably an ADR.

## Migration rules

Before production development:

1. Select the MySQL query/ORM/migration tool.
2. Create the database ADR.
3. Convert/adopt the numbered baseline packages as migrations.
4. Run every migration against a clean MySQL instance in CI.
5. Test upgrade from the previous released schema.
6. Add integrity tests for every critical foreign/candidate-key rule.
7. Never modify an already-released production migration in place; add a new migration.

## Reference data

The canonical career source currently exists in:

- `docs/career-taxonomy-seed.json`
- `docs/career-taxonomy-seed.csv`

SQL/TypeScript seeding should consume an authoritative version-controlled dataset rather than maintaining a second manually edited list.

Package 002 also contains initial controlled reference rows for party roles, identifier types, relationship types, opportunity participant roles and CRM activity types. Before production migrations are frozen, the selected migration system should separate schema creation and idempotent reference-data seeding according to the project's migration convention.

## Security rule

No application repository/query may retrieve an organisation-owned record solely by its surrogate ID when tenant context is required. Tenant context and authorisation must be validated before returning data.

CRM records are tenant-private by default. A later NuBlox Network identity link must not silently turn tenant CRM records into globally shared records.
