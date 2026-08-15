# NuBlox SvelteKit App

This app is structured as a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Single deployable SvelteKit app with explicit domain boundaries.
- Business rules belong in server-side domain/application modules, not in Svelte components.
- Route handlers act as request boundaries: auth, tenant context, validation, policy checks, service orchestration.
- Correlation IDs are attached to every request for observability.
- SQL belongs behind domain repositories; routes/components do not query the database directly.
- MySQL SQL migrations are the schema source of truth; generated Kysely types are derivative.
- Tenant-owned records are queried with explicit tenant context rather than by surrogate ID alone.

## Persistence stack

- **MySQL 8.4 / InnoDB**
- **Kysely** typed SQL query builder
- **mysql2** pooled Node driver
- **Dbmate** plain-SQL production migrations
- **kysely-codegen** database-derived TypeScript interfaces

The decision rationale is recorded in `docs/adr/0001-database-query-and-migration-tooling.md`.

The server database boundary is documented in `src/lib/server/db/README.md`.

## Layout

```text
src/
├── lib/
│   ├── components/
│   │   ├── ui/
│   │   ├── data/
│   │   ├── forms/
│   │   └── domain/
│   ├── server/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── audit/
│   │   ├── kernel/
│   │   ├── jobs/
│   │   ├── organisations/
│   │   ├── capabilities/
│   │   ├── crm/
│   │   ├── sales/
│   │   ├── contracts/
│   │   ├── finance/
│   │   ├── procurement/
│   │   ├── people/
│   │   ├── projects/
│   │   ├── documents/
│   │   ├── commercial/
│   │   ├── site/
│   │   ├── safety/
│   │   ├── quality/
│   │   ├── assets/
│   │   ├── maintenance/
│   │   ├── reporting/
│   │   └── integrations/
│   └── types/
└── routes/
    ├── (auth)/
    ├── (app)/
    ├── portal/
    └── api/
```

## Implemented request flow baseline

`src/hooks.server.ts` currently initializes:

- `locals.correlationId`
- `locals.actor`
- `locals.tenant`

And returns the correlation ID in `x-correlation-id` response headers.

Authentication/session and trusted tenant-selection resolution remain a separate implementation step; browser-supplied organisation IDs are not trusted for write access.

## Implemented Platform Kernel foundation

The first database-backed application slice now exists under `src/lib/server`:

- `organisations/organisation-repository.ts` — active organisation reads;
- `organisations/membership-repository.ts` — active organisation/user/member tuple verification;
- `organisations/organisation-service.ts` — tenant-gated current organisation access;
- `projects/project-repository.ts` — owner- and participant-scoped project persistence;
- `projects/project-service.ts` — transactional project creation and lifecycle transitions;
- `audit/audit-repository.ts` — append-only material action evidence;
- `kernel/errors.ts` — explicit tenant/lifecycle/concurrency domain errors.

Project creation atomically creates the owning organisation participation and creator project membership. Project lifecycle changes follow the baseline state machine, use an optimistic current-status predicate, and append audit evidence.

## Run

```sh
pnpm install
cp .env.example .env
pnpm dev
```

## Database commands

With `DATABASE_URL` configured:

```sh
pnpm db:migrate
pnpm db:status
pnpm db:types
```

## Validate

```sh
pnpm check
pnpm test
```

Database-backed kernel integration tests require a migrated MySQL database:

```sh
pnpm test:integration
```

CI runs these integration tests against MySQL 8.4 after applying the production Dbmate migration stream. The tests cover tenant tuple isolation, project participant visibility, composite-FK tenant protection, atomic project creation/audit evidence, lifecycle transitions, and cross-tenant mutation rejection.
