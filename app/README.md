# NuBlox SvelteKit App

This app is structured as a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Single deployable SvelteKit app with explicit domain boundaries.
- Business rules belong in server-side domain/application modules, not in Svelte components.
- Route handlers act as request boundaries: auth, tenant context, validation, policy checks, service orchestration.
- Correlation IDs are attached to every request for observability.
- SQL belongs behind domain repositories; routes/components do not query the database directly.
- MySQL SQL migrations are the schema source of truth; generated Kysely types are derivative.

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
