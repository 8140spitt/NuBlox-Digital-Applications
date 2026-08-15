# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** serving businesses and professionals across construction and the built environment.

It combines a shared business-management core, a built-environment project/site/asset core, profession-specific capability packs, controlled cross-organisation collaboration, and structured workflow/automation across the building lifecycle.

## Business and brand foundation

Corporate and brand strategy documentation is maintained separately from the product specification:

- [NuBlox business entity](docs/branding/00-business-entity.md)
- [NuBlox brand strategy](docs/branding/01-brand-strategy.md)
- [NuBlox brand architecture and naming](docs/branding/02-brand-architecture-and-naming.md)
- [NuBlox verbal identity and messaging](docs/branding/03-verbal-identity-and-messaging.md)
- [NuBlox visual identity brief](docs/branding/04-visual-identity-brief.md)
- [NuBlox logo concept directions](docs/branding/05-logo-concept-directions.md)

## Fixed technology direction

- **Frontend:** Svelte 5
- **Application framework:** SvelteKit
- **Authentication/session boundary:** Better Auth 1.6.25
- **Primary persistence:** MySQL 8.4 / InnoDB
- **Runtime query layer:** Kysely + mysql2
- **Production migrations:** Dbmate plain SQL
- **Database type generation:** kysely-codegen from the migrated MySQL schema
- **Architecture:** modular monolith first, explicit domain boundaries
- **Database design:** normalised relational model, targeting 3NF by default
- **Schema authority:** committed MySQL SQL migrations; generated TypeScript types are derivative
- **Market assumption:** UK-first, regionalisation designed in rather than hard-coded

Architecture decisions are recorded under [`docs/adr`](docs/adr/README.md), including persistence tooling (ADR-0001) and the authentication/session boundary (ADR-0002).

## Database implementation

The planned **001–010 relational domain baseline is complete and has passed repeatable clean-build validation on MySQL 8.4.11**. Baseline v1 contains **337 base tables, 739 foreign keys and 427 `CHECK` constraints** and is consolidated into `database/migrations/20260815140337_baseline_v1.sql`.

The production migration stream then adds:

- `20260815145430_authentication_boundary.sql` — Better Auth infrastructure and explicit auth-to-domain user linking;
- `20260815151500_account_provisioning.sql` — controlled organisation invitations and intended invitation role assignments.

The current migrated application schema is **344 tables, 749 foreign keys and 429 `CHECK` constraints**.

Implementation-level database material is grouped under `/database`:

- [Database workflow and rules](database/README.md)
- [Database package documentation](database/docs/README.md)
- [SQL package index](database/schema/README.md)
- [Production migration stream](database/migrations/README.md)
- [Database baseline validation](database/validation/README.md)

## Application persistence boundary

```text
SvelteKit action / endpoint
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

Routes/components do not issue SQL directly. Tenant context and authorisation remain mandatory domain/repository concerns.

## Implemented Platform Kernel foundation

The database-backed kernel includes active membership verification by **organisation + user + member**, participant-scoped project reads, transactional project creation, owner-scoped project lifecycle mutation, optimistic lifecycle concurrency guards and append-only project audit evidence.

## Implemented authentication, tenant and permission boundary

```text
Better Auth session
        ↓
Explicit auth_user_links mapping
        ↓
NuBlox users
        ↓
Active organisation membership
        ↓
Organisation roles / member overrides
        ↓
Project membership scope
        ↓
Lifecycle / business policy
```

The selected organisation cookie is only a selection hint. The server revalidates active membership before constructing trusted tenant context. Effective organisation permission precedence is:

```text
explicit deny > explicit allow > active role grant > default deny
```

Project-scoped operations additionally require active project membership/participation. Better Auth handles authentication/session mechanics only; NuBlox remains authoritative for tenancy and business permissions.

## Implemented account provisioning and application access

NuBlox now has its first usable end-to-end account path:

```text
Authorised member invitation
        ↓
Invite-only account creation
        ↓
Verified email
        ↓
Auth identity ↔ NuBlox user link
        ↓
Active organisation membership
        ↓
Assigned organisation roles
        ↓
Sign in
        ↓
Organisation selection
        ↓
Protected application shell
```

Controls include hashed invitation tokens, seven-day invitation expiry, re-invite revocation, fail-closed Better Auth sign-up gating, verified-email activation, existing-user invite acceptance, role assignment and audit evidence. The dashboard exposes member invitations only when the current actor has `member.invite`.

Transactional email is behind a provider-neutral application interface. `EMAIL_DELIVERY_MODE=console` is for development/integration testing only; production email-provider selection remains an explicit integration decision.

The permanent MySQL CI gate verifies the **344 / 749 / 429** application structure, Kysely type drift, account provisioning, authentication/tenant/permission behaviour, Platform Kernel invariants and the SvelteKit type-check together.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Early usable application foundation with the relational baseline validated, SQL-first production migrations and typed persistence established, tenant-isolated Platform Kernel services implemented, authentication/trusted-tenant/effective-permission resolution integration-tested, and controlled account provisioning plus a protected organisation-scoped SvelteKit application shell implemented and integration-tested against MySQL 8.4.**
