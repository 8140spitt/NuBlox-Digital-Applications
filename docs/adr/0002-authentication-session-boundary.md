# ADR-0002 — Authentication and Session Boundary

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decision owners:** NuBlox architecture
- **Scope:** User authentication, browser sessions and the boundary between authentication identity and NuBlox domain authorisation

## Context

NuBlox already owns a normalised domain identity and authorisation model:

- `users` are platform/domain users;
- `organisation_members` bind a user to an organisation;
- organisation roles and permission overrides determine organisation permissions;
- project membership/participation determines project scope;
- careers/capabilities are not security roles.

The authentication subsystem must therefore prove who is making the request without becoming a second source of truth for organisation tenancy, project access or NuBlox permissions.

The application is SvelteKit on Node with MySQL 8.4 and mysql2/Kysely persistence.

## Decision

NuBlox will use **Better Auth 1.6.25** for authentication and session mechanics.

Better Auth is an authentication boundary only. NuBlox remains authoritative for tenant membership and business authorisation.

```text
Better Auth session
       ↓ proves authentication identity
Auth identity link
       ↓ resolves NuBlox platform user
NuBlox users
       ↓
Active organisation_members
       ↓
Organisation roles + permission overrides
       ↓
Project participation/membership
       ↓
Record state / business policy
       ↓
Effective authorisation decision
```

## Authentication-owned tables

Better Auth core tables use an explicit `auth_` prefix so they cannot be confused with NuBlox domain tables:

- `auth_users`
- `auth_sessions`
- `auth_accounts`
- `auth_verifications`

NuBlox maintains an explicit link from Better Auth identity to the existing platform `users` identity. Authentication records do not replace `users`, `user_emails` or `organisation_members`.

## Initial authentication policy

- Database-backed sessions.
- Session cookies remain HttpOnly and production-secure through Better Auth defaults/configuration.
- Session cookie caching is disabled initially so revocation is checked against the session store on every authenticated request.
- Session refresh is disabled initially; sessions have an explicit finite lifetime.
- Email/password support is enabled as an authentication mechanism, but public self-sign-up is disabled until invitation, email-delivery, recovery and operational-support workflows are implemented.
- Email verification is required for email/password identities before normal sign-in is enabled through production provisioning flows.
- OAuth/social providers are not enabled by this ADR.
- OAuth token encryption is enabled for future provider use.
- MFA/step-up and enterprise SSO remain later security increments; the request authorisation API is designed so these can add assurance context without replacing NuBlox permissions.

## Trusted tenant selection

A requested organisation identifier is only a **selection hint**. It never grants access.

For every authenticated request that needs tenant context, the server must prove:

1. the Better Auth session is valid;
2. the auth identity is linked to an active NuBlox `users` row;
3. the selected organisation exists and is active;
4. the user has an active `organisation_members` row in that organisation.

Only then is a `TenantActorContext` produced.

A tampered organisation-selection cookie therefore fails closed because membership is revalidated server-side.

## Effective permission policy

Organisation permission resolution uses this precedence for a permission key:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

A positive organisation permission is still insufficient for a project-owned operation. Project participation/member scope and record-state policy are evaluated separately and conjunctively.

```text
authenticated
AND active tenant membership
AND organisation permission
AND project/record scope (when applicable)
AND lifecycle/business policy
```

## SvelteKit request boundary

`hooks.server.ts` resolves authentication before tenant context. Routes receive only already-resolved request locals; routes do not derive trust from browser headers or raw organisation IDs.

The Better Auth handler remains mounted at `/api/auth` through the SvelteKit integration.

## Alternatives considered

### Clerk

Not selected for the initial SvelteKit baseline. Clerk is a strong managed identity service, but its Svelte integration is currently community-maintained. NuBlox also wants its existing MySQL domain identity/tenant model to remain authoritative and provider-portable.

### First-party credentials/sessions

Rejected as the default. Building password hashing, recovery, verification, session rotation/revocation and future MFA/SSO plumbing ourselves would create security-sensitive commodity infrastructure without differentiating NuBlox.

### Auth library as tenancy/permission authority

Rejected. NuBlox project participation, cross-organisation sharing, professional capabilities and record-state rules are domain concepts already represented relationally. They remain in NuBlox.

## Consequences

- Better Auth schema changes are committed as ordinary forward Dbmate migrations; Better Auth's CLI may generate candidate SQL, but released NuBlox migrations remain the migration authority.
- Authentication tables are provider/boundary infrastructure and may use implementation-specific structures distinct from NuBlox domain normalisation.
- Auth-to-domain identity linking is explicit and integration-tested.
- Permission checks are implemented in NuBlox services/repositories, not delegated to Better Auth.
- Changing authentication providers later does not require replacing organisation/project permission data.
