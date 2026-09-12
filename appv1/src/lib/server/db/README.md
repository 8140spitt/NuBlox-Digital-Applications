# SvelteKit Database Boundary

NuBlox uses **Kysely + mysql2** for server-side database access.

## Source of truth

The MySQL schema and committed SQL migrations are authoritative. `generated/database.d.ts` is produced by `kysely-codegen` from a migrated MySQL database and must not be edited manually.

## Runtime usage

Repositories/domain services obtain the shared process-local connection pool via:

```ts
import { getDatabase } from '$lib/server/db';

const db = getDatabase();
```

Do not call `getDatabase()` from client-side code. The `$lib/server` location is intentional and lets SvelteKit enforce the server-only boundary.

## Layering

```text
Route / server action / endpoint
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

Routes should orchestrate HTTP/form concerns; business rules belong in domain services and SQL belongs in repositories.

## Tenant isolation

A type-correct query is not automatically an authorised query.

For organisation-owned/project-owned records, repository APIs must take explicit tenant/project context and use it in predicates or tenant-safe joins. Do not retrieve a tenant-owned row solely by surrogate `id` when organisation context is required.

## Numeric values

The generated type configuration preserves `DECIMAL` values as strings and the mysql2 runtime is configured to return large integer values as strings where required to avoid JavaScript precision loss. Domain code must convert monetary/quantity values deliberately rather than relying on floating-point coercion.

## UTC

The pool configures the client timezone as UTC and issues `SET time_zone = '+00:00'` for each physical MySQL session. All event timestamps remain UTC; display/localisation belongs at the application edge.

## Commands

From `app/`:

```bash
pnpm db:migrate
pnpm db:status
pnpm db:types
```

`DATABASE_URL` is required. See `app/.env.example`.
