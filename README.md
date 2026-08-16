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

The production migration stream then adds authentication/provisioning and application permission activation through CRM, sales, accepted-quotation project conversion and Package 004 contract workflows. The latest forward migration is:

- `20260816015500_contract_amendment_permissions.sql` — granular controlled-amendment delegation under the existing Package 004 `contract.manage` umbrella.

The current application schema remains **344 tables, 749 foreign keys and 429 `CHECK` constraints**. The CRM/commercial/contract migrations are data/reference-only where the required normalised business structures already exist in Packages 002–004.

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

NuBlox separates broad management authority into delegable responsibilities while retaining broad permissions inside each domain family:

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

commercial.manage
    ├─ commercial.estimate.manage
    ├─ commercial.quotation.manage
    ├─ commercial.quotation.issue
    ├─ commercial.quotation.response.record
    └─ commercial.quotation.convert

contract.manage
    ├─ contract.create
    ├─ contract.draft.manage
    ├─ contract.issue
    ├─ contract.execute
    ├─ contract.amendment.create
    ├─ contract.amendment.draft.manage
    ├─ contract.amendment.issue
    └─ contract.amendment.decide
```

The granular key is resolved first. Its domain umbrella is used only when the granular key has no explicit member/role decision. A granular member deny therefore cannot be bypassed by an umbrella grant. **Permission umbrellas do not cross domain families:** `commercial.manage` does not grant Package 004 contract or amendment authority.

## Controlled account provisioning and standard roles

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent: an existing-organisation invitation or a self-service organisation bootstrap. The `/start` flow creates the first or an additional organisation through the normalised user/organisation/member/role model; pending identities cannot enter the protected application.

Every new organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

**Owner and Administrator** receive the broad project/CRM/commercial/contract umbrellas plus established granular permissions. `contract.manage` supplies broad Package 004 amendment authority; granular amendment keys support narrower future/custom delegation and explicit member exceptions.

**Manager** receives granular project and CRM party/contact authority without broad project/CRM umbrellas. Manager may have `project.create`, but does not automatically receive sales, commercial conversion or contract authority.

**Finance/Commercial** receives:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
contract.view
```

Finance/Commercial deliberately does **not** receive `commercial.manage`, `commercial.quotation.convert`, `project.create` or `contract.manage`. Cross-domain conversion and Package 004 mutations must be deliberately delegated.

Member/Professional receives `project.view + crm.view`, Field Worker receives `project.view`, and Read Only receives `project.view + crm.view`.

The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles.

## Organisation administration

The protected `/organisation` workspace provides member lifecycle, member-to-role assignment, invitation management, role management and permission grants.

```text
member.invite       → invitation lifecycle
member.manage       → member status + member role assignment
organisation.manage → role definitions + permission grants + full organisation admin
```

Delegation ceilings, organisation-manager protection, self-mutation restrictions, cross-tenant rejection and final-manager lockout prevention are enforced in the domain layer.

## CRM parties, contacts, opportunities and activities

The protected `/crm` surface is a **private tenant CRM**, not a platform-global directory. CRM party identity is separate from NuBlox platform organisations, auth users, workforce records and project participants.

CRM permissions are:

```text
crm.view
crm.manage
crm.party.manage
crm.contact.manage
crm.opportunity.manage
crm.activity.manage
```

The application includes `/crm`, party workspaces, opportunities and activity timelines. Pipeline **stage** represents sales maturity while opportunity `status` represents terminal outcome (`open`, `won`, `lost`, `cancelled`).

See [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md).

## Estimates, quotations and project conversion

Package 003 is activated through pricing, issue/response evidence and accepted-quotation conversion:

```text
CRM Opportunity
    ↓
Estimate
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Issued + accepted Quotation Version
    ↓
Idempotent conversion
    ↓
Proposed Project / Job
```

Protected routes include:

- `/commercial/estimates`
- `/commercial/estimates/[estimatePublicId]`
- `/commercial/quotations`
- `/commercial/quotations/[quotationPublicId]`
- `/commercial/quotations/[quotationPublicId]/convert`

Authoritative calculation uses scaled `BigInt` decimal arithmetic rather than JavaScript binary floating point. `quotation_project_conversions` is the authoritative conversion idempotency/provenance ledger.

The conversion deliberately does **not** infer the CRM customer as a NuBlox participant, create a project site, activate the project, form a contract or create finance records.

See [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md).

## Controlled contract formation and execution

Package 004 formation is implemented as:

```text
Accepted Quotation Version
        ↓
Proposed Project
        ↓
Explicit Contract Formation
        ↓
Contract Version 1 (draft)
        ↓
Value components + key dates
        ↓
Issue lock + recipient evidence
        ↓
Execution + signatory evidence
        ↓
Active Contract
```

Protected routes are:

- `/contracts` — contract portfolio plus accepted-quotation/project formation queues;
- `/contracts/new?project=[projectPublicId]` — controlled quotation-derived formation;
- `/contracts/[contractPublicId]` — contract version, party, value, date, issue, execution and amendment history workspace.

Formation retains exact `project_id`, `opportunity_id` and `source_quotation_response_id` provenance. Version 1 snapshots accepted customer evidence, derives initial `base_scope` from non-optional quotation net lines using fixed-precision arithmetic, and becomes immutable after issue. Execution records one execution event/signatory set and makes the logical contract active without changing project lifecycle.

See [`docs/33-contract-formation.md`](docs/33-contract-formation.md).

## Controlled contract amendments

Package 004 post-execution change is now implemented using the existing normalised amendment model:

```text
Active + Executed Contract Baseline
        ↓
Draft Amendment
        ├── scope / terms narrative
        ├── signed value adjustment(s)
        └── key-date change(s)
        ↓
Issue / freeze
        ↓
Agreed | Rejected | Withdrawn
```

The dedicated amendment workspace is:

- `/contracts/[contractPublicId]/amendments/[amendmentPublicId]`

Creation requires an active contract with an executed contract-version baseline. Draft amendments support controlled details, positive/negative fixed-precision value adjustments and replacement key dates. The domain service requires an effective date and substantive change evidence before issue; issued amendments reject ordinary draft mutation.

Only **agreed** amendments affect the derived contractual position:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Draft, issued, rejected and withdrawn adjustments do not alter current value. Rejected/withdrawn records remain historical evidence. All amendment lifecycle/mutation actions are tenant-scoped and audited; foreign-tenant public IDs are masked.

See [`docs/34-contract-amendments.md`](docs/34-contract-amendments.md).

**Still not claimed implemented in Package 004:** contract version 2+ revision/supersession, PDF/document rendering, production outbound contract/amendment/e-sign delivery, customer portal amendment decisions, automatic project activation, operational invoices, credit notes, payments or allocations.

## Projects, participants and teams

The protected application exposes `/projects` and `/projects/[projectPublicId]` for member-scoped portfolios, project creation, invitation response, participant organisations, own-organisation team administration and lifecycle controls.

Project permissions remain:

```text
project.create
project.view
project.manage
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
```

Normal in-project access requires organisation authority **and** active organisation participation **and** an active `project_members` row for the exact member. Project contextual roles never grant application permissions.

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

The Package 004 amendment release candidate applies **13 production migrations** on MySQL 8.4.11, preserves the **344 / 749 / 429** structural contract, produces zero generated Kysely drift, passes **16 integration files / 72 real-MySQL tests**, and passes `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised PR head must prove these exact results before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
