# NuBlox SvelteKit App

This app is structured as a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Single deployable SvelteKit app with explicit domain boundaries.
- Business rules belong in server-side domain/application modules, not Svelte components.
- Route handlers are request boundaries for authentication, tenant context, validation, policy checks and service orchestration.
- Correlation IDs are attached to requests for observability.
- SQL belongs behind domain repositories; routes/components do not query the database directly.
- MySQL SQL migrations are the schema source of truth; generated Kysely types are derivative.
- Tenant-owned records use explicit verified tenant context rather than surrogate ID alone.
- Authentication identity does not imply organisation, CRM or project access.

## Persistence and authentication stack

- **MySQL 8.4 / InnoDB**
- **Kysely** typed SQL query builder
- **mysql2** pooled Node driver
- **Dbmate** plain-SQL production migrations
- **kysely-codegen** database-derived TypeScript interfaces
- **Better Auth 1.6.25** authentication/session boundary

Architecture decisions are recorded under `docs/adr/`.

## Request trust flow

```text
request
  ↓
correlation ID
  ↓
Better Auth session
  ↓
auth_user_links → active NuBlox users row
  ↓
selected organisation cookie (hint only)
  ↓
active organisation + active organisation_members proof
  ↓
trusted request locals
```

`locals.actor` identifies the authenticated NuBlox platform user. `locals.tenant` exists only after selected-organisation membership is revalidated.

## Permission resolution

`src/lib/server/capabilities/permission-service.ts` resolves each permission key with:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

Project operations additionally require active project participation and exact-member `project_members` scope when a project ID is supplied.

### Granular management and umbrella compatibility

NuBlox supports granular delegation beneath broad compatibility permissions:

```text
project.manage
    ├─ project.lifecycle.manage
    ├─ project.participant.manage
    ├─ project.team.manage
    └─ project.participation.manage

crm.manage
    ├─ crm.party.manage
    ├─ crm.contact.manage
    ├─ crm.opportunity.manage
    └─ crm.activity.manage
```

`decideWithUmbrella()` resolves the granular permission first and uses the umbrella only when the granular key has no explicit member/role decision. An explicit granular member deny therefore cannot be bypassed by the umbrella.

This lets existing custom roles with `project.manage` or `crm.manage` remain compatible while new roles can delegate narrower responsibilities.

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service new-organisation bootstrap.

`/start` provides first/additional organisation creation while retaining fail-closed account creation. The bootstrap token is a short-lived HMAC-SHA256 pre-sign-up authorisation envelope in an HttpOnly cookie; durable state reuses the normalised NuBlox domain model.

## Standard organisation roles

New organisations receive:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

Current stable defaults are:

```text
Owner / Administrator
    organisation.manage
    member.invite
    member.manage
    project.create
    project.view
    project.manage
    project.lifecycle.manage
    project.participant.manage
    project.team.manage
    project.participation.manage
    crm.view
    crm.manage
    crm.party.manage
    crm.contact.manage

Manager
    member.invite
    member.manage
    project.create
    project.view
    project.lifecycle.manage
    project.participant.manage
    project.team.manage
    project.participation.manage
    crm.view
    crm.party.manage
    crm.contact.manage

Finance/Commercial  → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

Manager deliberately does not receive the broad `project.manage` or `crm.manage` umbrellas. `crm.opportunity.manage` and `crm.activity.manage` are also not auto-granted to generic Manager or Finance/Commercial templates; they are explicit delegation points. Owner/Administrator can use those workflows through their `crm.manage` umbrella unless a granular deny is present.

A project permission grant never exposes a project by itself; active project-member scope is still required. CRM grants remain tenant-bounded by the active organisation.

## Application access

The current UI includes:

- `/start` — first/additional organisation creation;
- `/signin` — Better Auth email/password sign-in;
- `/invite/[token]` — organisation invitation acceptance/account creation;
- `/select-organisation` — active organisation membership selector;
- `/dashboard` — protected tenant-scoped entry point;
- `/crm` — private tenant CRM directory and party creation;
- `/crm/[partyPublicId]` — CRM party maintenance, contacts and affiliations;
- `/crm/opportunities` — opportunity portfolio, filtering and opportunity creation;
- `/crm/opportunities/[opportunityPublicId]` — opportunity maintenance, participant relationships and activity timeline;
- `/projects` — member-scoped project portfolio, project creation and project invitation inbox;
- `/projects/[projectPublicId]` — project workspace, participant/team administration and lifecycle controls;
- `/organisation` — permission-aware organisation administration.

The `(app)` route-group server layout rejects unauthenticated users and redirects authenticated users without a verified tenant to organisation selection.

## Organisation administration

Administrative authority remains split:

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full admin authority
```

The domain layer enforces delegation ceilings, manager protection, self-mutation restrictions, cross-tenant rejection and final `organisation.manage` lockout protection.

## CRM parties and contacts

`src/lib/server/crm/crm-service.ts` and `crm-repository.ts` activate the existing Package 002 relational party/contact model as a private tenant CRM.

Stable CRM permissions are:

```text
crm.view
crm.manage              # umbrella
crm.party.manage
crm.contact.manage
crm.opportunity.manage
crm.activity.manage
```

The effective CRM boundary is:

```text
active NuBlox user
AND active organisation membership
AND effective CRM permission
AND record.organisation_id = active organisation
AND record-state business policy
```

`crm.party.manage` controls party master data, lifecycle, business classifications and primary email/phone. `crm.contact.manage` controls person↔organisation contact relationships. A contact manager may create a new person only as part of the contact-creation transaction without gaining general party-maintenance authority. `crm.manage` remains umbrella fallback.

CRM identity remains independent from NuBlox platform organisations, authenticated users, organisation memberships, workforce identity and project participation. Cross-tenant public IDs are masked as not found.

## CRM opportunities and activity timeline

`src/lib/server/crm/crm-opportunity-service.ts` and `crm-opportunity-repository.ts` activate the Package 002 opportunity/activity structures. `crm-pipeline-provisioning.ts` supplies an audited first-use default pipeline for future tenants when no pipeline configuration exists.

The opportunity application boundary is:

```text
active NuBlox user
AND active organisation membership
AND crm.view for reads
AND crm.opportunity.manage OR crm.manage umbrella for opportunity mutations
AND crm.activity.manage OR crm.manage umbrella for activity creation
AND record.organisation_id = active organisation
```

Opportunity request URLs use `opportunity.public_id`. Pipeline-stage mutation input uses **pipeline public ID + stage name**, because Package 002 stage rows deliberately have no external public ID; the service resolves the actual composite tenant/pipeline/stage identity server-side.

A new opportunity must have one primary non-archived CRM party as the prospective customer. Additional parties use `opportunity_parties` with controlled role types. The database guarantees one primary assignment, while the service blocks direct removal of that primary until another primary customer is selected.

Pipeline stage and opportunity outcome are separate concepts:

```text
stage  → sales maturity: Lead / Qualified / Proposal / Negotiation
status → outcome: open / won / lost / cancelled
```

Closing a won/lost/cancelled opportunity records `closed_at`; reopening clears it. Changing primary customer preserves the old assignment as non-primary context rather than duplicating the CRM party.

Activities are opportunity-linked timeline entries. The acting member is stored through `crm_activity_members`; external CRM parties are linked through `crm_activity_parties`. The first slice supports controlled activity type, direction, subject, notes, participants and append-only audit evidence.

Existing organisations without a pipeline are seeded by migration. For organisations created after that migration, the first suitably authorised visit to `/crm/opportunities` transactionally creates exactly one `Sales` pipeline with `Lead`, `Qualified`, `Proposal` and `Negotiation`, protected by an organisation-row lock and evidenced by `crm.pipeline.initialized` audit history.

Not yet implemented: custom pipeline administration, standalone non-opportunity activities, estimates/quotations or automatic opportunity-to-estimate conversion.

## Project workspace and collaboration

Project permissions are:

```text
project.create
project.view
project.manage                    # umbrella
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
```

The normal project boundary is conjunctive:

```text
active NuBlox user
AND active organisation membership
AND effective project permission
AND active project_organisations participation
AND active exact-member project_members membership
AND ownership/lifecycle policy
```

`project.lifecycle.manage` controls owner lifecycle state changes. `project.participant.manage` controls participant organisations and organisation-level contextual project roles. `project.team.manage` controls the active organisation's project members and member project roles. `project.participation.manage` controls invitation response and non-owner voluntary leave. `project.manage` remains umbrella fallback.

The invitation-response path is a deliberate pre-project-scope exception: the invited organisation may accept/decline with organisation-level `project.participation.manage` or its `project.manage` umbrella before the accepting member has a `project_members` row. Acceptance creates the first active member scope atomically.

Project-role assignments are contextual metadata and never grant permissions.

The service prevents removal of the final active scoped member with effective `project.team.manage` (including umbrella fallback) until another scoped team manager exists.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral. `EMAIL_DELIVERY_MODE=console` is for development and integration tests only.

## Run

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Required server environment includes:

```text
DATABASE_URL
DB_POOL_MAX
BETTER_AUTH_URL
BETTER_AUTH_SECRET
EMAIL_DELIVERY_MODE
```

## Database commands

```sh
pnpm db:migrate
pnpm db:status
pnpm db:types
```

## Validate

```sh
pnpm check
pnpm test:integration
```

The CRM opportunities/activity executable close-out applies **9 production migrations** on MySQL 8.4.11, verifies the **344-table / 749-FK / 429-CHECK** structural contract, produces zero generated Kysely drift, passes **12 integration files / 50 real-MySQL tests**, and runs `svelte-check` with **0 errors / 0 warnings**. The documentation-synchronised head is validated by the same gate before merge.
