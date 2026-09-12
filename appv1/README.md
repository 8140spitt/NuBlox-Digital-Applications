# NuBlox Application

This directory contains the Svelte 5 / SvelteKit NuBlox application.

## Architecture

NuBlox is a modular monolith. Business semantics are defined bottom up rather than from routes or screens.

Read `../docs/architecture/bottom-up/README.md` before introducing a new domain concept. In particular:

- routes establish authenticated/trusted context and orchestrate application/domain services;
- business rules and state transitions live in server-domain services;
- Kysely repositories/query boundaries isolate persistence;
- committed MySQL migrations are schema authority;
- authentication does not imply tenant or domain authority;
- tenant, project, record, permission and lifecycle scope are enforced server-side;
- material corrections preserve historical evidence rather than silently rewriting it.

The governing security distinction is:

```text
Career != Organisation Role != Project Role != Permission
```

Permission precedence is:

```text
explicit member deny
> explicit member allow
> active role grant
> default deny
```

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:types
pnpm dev
```

Required server configuration includes `DATABASE_URL`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`; see `.env.example` for the current development contract.

## Validation

```bash
pnpm lint
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm test:integration
pnpm check
pnpm test:unit -- --run
pnpm build
pnpm exec playwright test
```

The GitHub system-validation workflow performs a clean MySQL 8.4 rebuild and the consolidated quality gate.

## Repository boundaries

```text
src/lib/server/       server/domain/application code
src/lib/components/   reusable UI components
src/routes/           SvelteKit application routes
e2e/                  NuBlox browser acceptance tests
static/               public static assets
```

Generated Kysely definitions live under `src/lib/server/db/generated/`. They are derived artefacts and should only change as the result of schema migration/type generation.

Delivery package history and obsolete release-count narratives belong in Git history, not this README.
