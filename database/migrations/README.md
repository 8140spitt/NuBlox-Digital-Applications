# NuBlox Database Migrations

This directory is the production migration source after Database Baseline v1 is frozen.

## Tool

Migrations are executed with **Dbmate** and remain plain MySQL SQL.

From `app/` with `DATABASE_URL` configured:

```bash
pnpm db:migrate
pnpm db:status
```

## Baseline v1

`20260815140337_baseline_v1.sql` consolidates the validated pre-production domain packages 001–010 in their documented order.

The domain baseline is intentionally **irreversible**. Non-production environments are rebuilt rather than rolling the entire application schema backward.

Validated Baseline v1 structure:

- **337 domain/base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**

The numbered files under `database/schema/` remain the design/provenance packages for Baseline v1. They are not rewritten after the production migration baseline is frozen.

## Forward migrations after Baseline v1

### `20260815145430_authentication_boundary.sql`

Adds the authentication/session infrastructure selected in ADR-0002:

- `auth_users`
- `auth_sessions`
- `auth_accounts`
- `auth_verifications`
- `auth_user_links`

The first four tables are Better Auth infrastructure. `auth_user_links` is the explicit one-to-one bridge from an authentication identity to the existing NuBlox domain `users` row; authentication does not replace the NuBlox tenant/member/permission model.

After this migration the application schema contains **342 tables, 743 foreign keys and 427 `CHECK` constraints**.

### `20260815151500_account_provisioning.sql`

Adds controlled NuBlox organisation-account provisioning:

- `organisation_invitations`
- `organisation_invitation_roles`

Invitation identity and lifecycle remain NuBlox domain concerns. Better Auth supplies the login identity/session, while invitation acceptance creates or reuses the authoritative NuBlox `users` identity, `organisation_members` tenancy and `member_roles` assignments.

The migration enforces tenant-safe invitation/role references, unique pending invitations per organisation/email, hashed-token identity, invitation terminal-state checks and explicit links to the accepting auth/domain users.

After this migration the current application schema contains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

These application counts are deliberately reported separately from the frozen 337/739/427 domain Baseline v1 counts.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All changes are forward migrations.
- MySQL-specific DDL is written explicitly rather than inferred from an ORM schema.
- External-library schema generators may produce candidate DDL, but committed Dbmate SQL remains the released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass MySQL 8.4 clean-build validation.
- Database-derived Kysely types must be regenerated after schema changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
