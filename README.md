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
- `20260815161900_organisation_administration_permissions.sql` — stable organisation-administration permission catalogue entries;
- `20260815203700_project_workspace_permissions.sql` — stable project permission catalogue entries and standard-role project defaults;
- `20260815211600_project_participants_team.sql` — explicit project-participation decline semantics and the controlled project-role catalogue;
- `20260815214500_crm_contacts_permissions.sql` — stable CRM view/manage permission entries and standard-role CRM defaults.

The current migrated application schema remains **344 tables, 749 foreign keys and 429 `CHECK` constraints**. The project-participant migration replaces an existing lifecycle check and adds reference data; the CRM migration is data-only. No parallel CRM or project-team table set has been introduced.

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
Project membership scope where required
        ↓
Record / lifecycle business policy
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

Current stable defaults are:

```text
Owner         → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Administrator → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Manager       → member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Finance/Commercial → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

Project permission grants do not create project visibility on their own. A user must also have active `project_members` scope for the project. CRM grants remain bounded by the selected active organisation. The initial organisation member is assigned **Owner only**.

Existing active NuBlox users can also use `/start` to create an additional organisation without creating another auth or domain identity; the new tenant is selected immediately after the transactional bootstrap completes.

## Implemented organisation administration and membership management

The protected `/organisation` workspace provides tenant-scoped administration for organisation members, member-to-role assignments, invitation lifecycle, organisation roles and role-to-permission grants.

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

`organisation.manage` is the explicit higher administrative authority. Delegation ceilings, organisation-manager protection, self-mutation restrictions, cross-tenant rejection and final-manager lockout prevention are enforced in the domain layer.

## Implemented CRM parties and contacts

The protected `/crm` workspace activates the existing Package 002 party model as a **private tenant CRM**, not a global NuBlox directory.

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

A real-world organisation or person is stored once within the active tenant and may hold several business roles such as Client, Supplier, Subcontractor, Consultant or Developer. Those roles classify the party; they do not create duplicate customer/supplier/person master records.

Stable CRM permissions are:

```text
crm.view   → search/open tenant-owned CRM parties and contact relationships
crm.manage → create and maintain parties, roles, contact methods and organisation contacts
```

Every repository query is explicitly scoped by the active `organisation_id`. Direct cross-tenant party public IDs are masked as not found. CRM party identity is deliberately separate from NuBlox platform `organisations`, authentication `users`, workforce records and project participation.

The CRM UI supports:

- organisation and person records;
- search by name, primary email or primary phone;
- party type and lifecycle filters;
- multi-role business classification;
- primary email and E.164 phone maintenance;
- active/inactive/archived lifecycle state;
- creating a new person directly as an organisation contact;
- linking an existing tenant CRM person to an organisation without identity duplication;
- job title, department and primary-contact context on the relationship;
- ending a contact relationship while retaining dated history;
- person-side organisation affiliations;
- append-only CRM audit evidence.

The Package 002 subtype invariant—exactly one matching person or organisation subtype for each `parties` row—is enforced transactionally by the application service and integration tests. Archived parties cannot silently acquire new contact relationships.

Opportunities, pipelines and CRM activity timelines already exist in the relational baseline but are **not claimed implemented in this slice**.

## Implemented project creation and project workspace

The protected application exposes:

- `/projects` — permission-aware project portfolio, project creation and pending project invitations;
- `/projects/[projectPublicId]` — member-scoped project workspace, participant organisations, project team and lifecycle controls.

Stable project permissions are:

```text
project.create → create an organisation-owned project
project.view   → enter/list projects where the member also has active project scope
project.manage → administer projects where scope and contextual policy permit
```

The security boundary intentionally requires both organisation authority and project scope. `project.view` does not expose every project in an organisation: portfolio and workspace reads require active `project_organisations` participation and an active `project_members` row for the exact member. Non-member project lookups are masked as not found.

Project creation atomically creates the project, owning-organisation participation, creator project membership and `project.created` audit evidence. Lifecycle mutation requires scoped `project.manage` and remains restricted to the owning organisation.

## Implemented project participants and project-team administration

The project collaboration layer now uses the existing Package 001 relational model rather than a second sharing subsystem:

```text
Project
  ├─ project_organisations
  │    └─ project_organisation_roles
  └─ project_members
       └─ project_member_roles
```

The owning organisation may invite another active NuBlox organisation by its exact public ID, assign contextual organisation project roles, update those roles, revoke an invitation, or remove an existing participant. NuBlox deliberately does not expose an unrestricted organisation directory in this workflow.

An invited organisation can accept or decline using organisation-level `project.manage` before it has project membership. Acceptance atomically activates the organisation's project participation and establishes the accepting member's first active `project_members` scope. Only after that scope exists can the project be discovered/opened normally.

Once participating, an organisation with scoped `project.manage` may manage **only its own organisation members** on the project, including adding/removing active members and assigning contextual member project roles. A participating non-owner organisation may leave the project; leaving or owner removal terminates all of that organisation's active project-member scope.

Project roles such as Client, Project manager, Engineer, Main contractor and Inspector are **contextual metadata, not permission grants**. They never manufacture `project.view` or `project.manage`. Removing the final scoped member who effectively holds `project.manage` for an organisation is blocked until another scoped project manager exists.

## Validation gate

The permanent MySQL CI gate verifies the **344 / 749 / 429** application structure, Kysely type drift, CRM party/contact behavior, project participant/team administration, project workspace behavior, account provisioning, organisation bootstrap/default-role parity, organisation administration, authentication/tenant/permission behavior, Platform Kernel invariants and the SvelteKit type-check together.

The CRM executable close-out applied all seven migrations and passed **9 integration files / 41 real-MySQL tests**, retained zero Kysely generated-type drift, and passed `svelte-check` with **0 errors / 0 warnings** before documentation synchronisation. The final documentation-synchronised head is validated by the same gate before merge.

## Governing product rule

> **NuBlox models what people and organisations do, not only what their job title is.**

Career titles configure defaults. Reusable capabilities, organisation permissions, project membership scope and workflow state determine actual behaviour.

## Current status

**Usable multi-tenant application foundation with the relational baseline validated, SQL-first migrations and typed persistence established, hardened authentication/trusted-tenant/effective-permission resolution, controlled account and organisation provisioning, organisation administration, private CRM party/contact management, project creation/workspaces, and multi-organisation project participant/team administration validated against MySQL 8.4.**