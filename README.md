# NuBlox: Digital Applications

NuBlox is a proposed **Built Environment Business Operating System** for businesses and professionals across construction and the built environment.

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

Architecture decisions are recorded under [`docs/adr`](docs/adr/README.md).

## Database implementation

The validated 001–010 relational domain baseline contains **337 base tables, 739 foreign keys and 427 `CHECK` constraints** and is consolidated into `database/migrations/20260815140337_baseline_v1.sql`.

The production migration stream then adds:

- `20260815145430_authentication_boundary.sql` — Better Auth infrastructure and explicit auth-to-domain user linking;
- `20260815151500_account_provisioning.sql` — controlled organisation invitations and intended invitation role assignments;
- `20260815161900_organisation_administration_permissions.sql` — organisation-administration permissions;
- `20260815203700_project_workspace_permissions.sql` — project create/view/manage catalogue and initial standard-role grants;
- `20260815211600_project_participants_team.sql` — project-participation decline semantics and contextual project-role catalogue;
- `20260815214500_crm_contacts_permissions.sql` — CRM view/manage catalogue and initial standard-role grants;
- `20260815222500_permission_granularity.sql` — granular project and CRM management permissions and revised Manager defaults.

The current application schema remains **344 tables, 749 foreign keys and 429 `CHECK` constraints**. The latest permission migration is data-only.

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

Routes/components do not issue SQL directly. Tenant context and authorisation are mandatory domain/repository concerns.

## Authentication and tenant trust boundary

```text
Better Auth session
        ↓
Explicit auth_user_links mapping
        ↓
Active NuBlox user
        ↓
Active organisation membership
        ↓
Organisation roles / member overrides
        ↓
Project membership scope where required
        ↓
Record / lifecycle business policy
```

The selected organisation cookie is only a selection hint. The server revalidates membership before constructing trusted tenant context.

Within one permission key, effective organisation permission precedence is:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

## Granular RBAC and umbrella compatibility

NuBlox now separates broad management authority into delegable responsibilities while retaining the original broad permissions for compatibility:

```text
project.manage
    ├─ project.lifecycle.manage
    ├─ project.participant.manage
    ├─ project.team.manage
    └─ project.participation.manage

crm.manage
    ├─ crm.party.manage
    └─ crm.contact.manage
```

The granular key is resolved first. The broad umbrella is used only when the granular key has no explicit member/role decision. Therefore a granular member deny cannot be bypassed by `project.manage` or `crm.manage`.

This means existing custom roles with broad management grants keep working, while new roles can delegate responsibilities independently.

## Controlled account provisioning and onboarding

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent:

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

The `/start` flow creates the first or an additional organisation using the existing normalised user/organisation/member/role model. Pending identities cannot enter the protected application because trusted session resolution requires an active NuBlox domain user.

Every new organisation receives seven standard role templates:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

### Current standard role defaults

**Owner and Administrator** receive the full currently implemented catalogue:

```text
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
```

**Manager** receives granular operational authority without the broad project/CRM umbrellas:

```text
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
```

Other defaults are:

```text
Finance/Commercial  → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles.

## Organisation administration

The protected `/organisation` workspace provides member lifecycle, member-to-role assignment, invitation management, role management and permission grants.

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full organisation admin
```

Delegation ceilings, organisation-manager protection, self-mutation restrictions, cross-tenant rejection and final-manager lockout prevention are enforced in the domain layer.

## CRM parties and contacts

The protected `/crm` surface is a **private tenant CRM**, not a platform-global directory.

```text
NuBlox organisation / tenant
        ↓
      parties
      ├─ party_persons
      └─ party_organisations
        ↓
roles + primary contact methods
        ↓
person ↔ organisation contact relationships
```

CRM permissions are:

```text
crm.view
crm.manage              # umbrella
crm.party.manage
crm.contact.manage
```

`crm.party.manage` controls party creation/update/lifecycle, business-role classification and primary contact methods. `crm.contact.manage` controls organisation-contact relationships. `crm.manage` remains umbrella fallback.

Every repository query remains explicitly tenant-scoped. CRM party identity is separate from NuBlox platform organisations, auth users, workforce records and project participants.

The CRM UI currently supports organisation/person records, search/filtering, multi-role classification, primary email/phone, lifecycle state, new/existing organisation contacts, primary contact changes, dated relationship ending, affiliations and append-only audit evidence.

Opportunities, pipelines and CRM activity timelines remain subsequent application slices.

## Projects, participants and teams

The protected application exposes:

- `/projects` — member-scoped project portfolio, creation and pending invitation inbox;
- `/projects/[projectPublicId]` — project workspace, participant organisations, own-organisation team administration and lifecycle controls.

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

Normal in-project access requires organisation authority **and** active organisation participation **and** an active `project_members` row for the exact member.

Responsibilities are separated as follows:

- `project.lifecycle.manage` — owning-organisation lifecycle transitions;
- `project.participant.manage` — invite/remove participant organisations and maintain organisation-level contextual project roles;
- `project.team.manage` — maintain the active organisation's project members and member project roles;
- `project.participation.manage` — accept/decline invitations and non-owner voluntary leave;
- `project.manage` — umbrella fallback for all four.

Invitation response is a deliberate pre-project-scope boundary: the invited organisation can accept or decline with organisation-level `project.participation.manage` or umbrella fallback before a `project_members` row exists. Acceptance atomically establishes participation and the accepting member's first project scope.

Project roles such as Client, Project manager, Engineer, Quantity surveyor/commercial, Main contractor and Inspector are contextual metadata. They never grant application permissions.

The service prevents removal of the final active scoped member with effective `project.team.manage` authority until another scoped team manager exists.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults and feature relevance. Reusable capabilities, organisation permissions, project membership scope and workflow state determine actual behaviour.

## Validation

From `app/`:

```bash
pnpm db:migrate
pnpm check
pnpm test:integration
```

The permanent CI gate applies the full migration stream to MySQL 8.4, verifies the **344 / 749 / 429** structural contract, checks generated Kysely types for drift, runs the real-MySQL integration suite and runs `svelte-check`.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
