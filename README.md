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
- `20260815151500_account_provisioning.sql` — controlled organisation invitations and intended invitation role assignments;
- `20260815161900_organisation_administration_permissions.sql` — stable organisation-administration permission catalogue entries.

The administration-permission migration is data-only, so the current migrated application schema remains **344 tables, 749 foreign keys and 429 `CHECK` constraints**. Organisation bootstrap deliberately reuses existing Package 001 lifecycle states and does not add another persistence table.

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

## Implemented controlled account provisioning

NuBlox sign-up is not globally open. Better Auth accepts exactly one validated provisioning intent:

```text
existing organisation invitation
              OR
self-service organisation bootstrap
              ↓
       Better Auth sign-up
              ↓
        verified email
              ↓
     trusted NuBlox identity
```

Invitation controls include hashed random tokens, seven-day expiry, re-invite revocation, verified-email activation, existing-user invite acceptance, role assignment and audit evidence. Invitation lifecycle requires `member.invite` or `organisation.manage`; attaching organisation roles additionally requires member-management authority and is subject to the role-delegation ceiling described below.

Transactional email is behind a provider-neutral application interface. `EMAIL_DELIVERY_MODE=console` is for development/integration testing only; production email-provider selection remains an explicit integration decision.

## Implemented organisation bootstrap and onboarding

The `/start` flow lets a new customer create a NuBlox account and first organisation without weakening the invitation boundary.

```text
/start
  ↓
short-lived HMAC-signed bootstrap intent
  ↓
Better Auth account creation
  ↓
pending NuBlox user
pending organisation
invited owner membership
standard organisation roles + Owner assignment
  ↓
verified email
  ↓
active NuBlox user
active organisation
active Owner membership
  ↓
sign in → organisation selection → protected workspace
```

The bootstrap token is an HttpOnly, time-limited pre-sign-up authorisation envelope signed with HMAC-SHA256. It is not a second persistence model. Once Better Auth creates the auth identity, durable pre-verification state is stored in the existing normalised `users`, `user_emails`, `auth_user_links`, `organisations`, `organisation_members`, `organisation_roles`, `role_permissions`, `member_roles` and `audit_events` tables.

A pending bootstrap identity cannot enter the application: trusted session resolution requires an **active** NuBlox domain user. Email verification transactionally activates the domain user, verified email, organisation and owner membership.

Every new organisation receives seven standard role templates:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

The current administration catalogue gives Owner and Administrator `organisation.manage`, `member.invite` and `member.manage`; Manager receives `member.invite` and `member.manage`. The other role templates intentionally start without domain permission grants until their permission catalogues are implemented. The initial member is assigned **Owner only**.

Existing active NuBlox users can also use `/start` to create an additional organisation without creating another auth or domain identity; the new tenant is selected immediately after the transactional bootstrap completes.

## Implemented organisation administration and membership management

The protected `/organisation` workspace provides tenant-scoped administration for:

- organisation members and membership status;
- member-to-role assignments;
- invitation history, resend and revoke;
- organisation-role creation, editing and activation;
- role-to-permission grants.

Administrative authority is intentionally split:

```text
member.invite
    → create / resend / revoke invitations

member.manage
    → member status and member role assignment

organisation.manage
    → role definitions and permission grants
    → full organisation-administration authority
```

`organisation.manage` is the explicit higher administrative authority. A normal member administrator may delegate only role permissions they effectively hold themselves. Lower-level administrators cannot suspend or rewrite the roles of an organisation manager, users cannot demote or rewrite their own organisation membership from this workspace, cross-tenant roles are rejected, and mutations cannot leave the organisation without an active organisation manager.

Administration mutations use public IDs at the request boundary and append audit evidence server-side.

## Validation gate

The permanent MySQL CI gate verifies the **344 / 749 / 429** application structure, Kysely type drift, account provisioning, organisation bootstrap, organisation administration, authentication/tenant/permission behaviour, Platform Kernel invariants and the SvelteKit type-check together.

The organisation-bootstrap close-out passed **6 integration files / 24 real-MySQL tests**, retained zero Kysely generated-type drift, and passed `svelte-check` with **0 errors / 0 warnings**.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project permissions and workflow state determine actual behaviour.

## Current status

**Early usable application foundation with the relational baseline validated, SQL-first production migrations and typed persistence established, tenant-isolated Platform Kernel services implemented, authentication/trusted-tenant/effective-permission resolution integration-tested, controlled invitation and self-service organisation provisioning implemented, organisation selection and protected application access working, and permission-aware organisation administration validated against MySQL 8.4.**
