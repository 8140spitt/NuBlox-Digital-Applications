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
- `20260815222500_permission_granularity.sql` — granular project and CRM management permissions and revised Manager defaults;
- `20260815223800_crm_opportunities_activities.sql` — opportunity/activity permissions plus non-destructive default Sales pipeline provisioning;
- `20260815231500_estimates_quotations_permissions.sql` — commercial estimate/quotation permissions and aligned standard-role grants.

The current application schema remains **344 tables, 749 foreign keys and 429 `CHECK` constraints**. The newest CRM/commercial migrations are data/reference-only and activate normalised relational structures already present in Packages 002 and 003.

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

NuBlox separates broad management authority into delegable responsibilities while retaining broad permissions for compatibility:

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
    └─ commercial.quotation.response.record
```

The granular key is resolved first. The umbrella is used only when the granular key has no explicit member/role decision. A granular member deny therefore cannot be bypassed by an umbrella grant.

## Controlled account provisioning and standard roles

NuBlox sign-up is fail-closed. Better Auth accepts exactly one validated provisioning intent: an existing-organisation invitation or a self-service organisation bootstrap. The `/start` flow creates the first or an additional organisation through the normalised user/organisation/member/role model; pending identities cannot enter the protected application.

Every new organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

**Owner and Administrator** receive the broad project/CRM/commercial umbrellas plus the implemented granular permissions appropriate to those domains.

**Manager** receives granular project and CRM party/contact operational authority without the broad project/CRM umbrellas. Manager does not automatically receive the newer opportunity/activity or commercial permissions.

**Finance/Commercial** now receives:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial deliberately does **not** receive `commercial.manage`. This preserves granular delegation and ensures later commercial permission families do not silently expand that role.

Member/Professional receives `project.view + crm.view`, Field Worker receives `project.view`, and Read Only receives `project.view + crm.view`.

The founding member is assigned **Owner only**. Careers/job titles remain separate from security roles. Forward migrations for existing organisations and `OrganisationBootstrapService` defaults for future organisations are kept in parity by integration tests.

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

The application includes:

- `/crm` — tenant CRM party directory and party creation;
- `/crm/[partyPublicId]` — party maintenance, contacts and affiliations;
- `/crm/opportunities` — opportunity portfolio, filtering and creation;
- `/crm/opportunities/[opportunityPublicId]` — stage/value/outcome, participants and chronological activity timeline.

Pipeline **stage** represents sales maturity while opportunity `status` represents the terminal outcome (`open`, `won`, `lost`, `cancelled`). Existing/future tenants without pipeline configuration receive an audited default Sales pipeline without overwriting custom configuration.

See [`docs/31-crm-opportunities-activity-timeline.md`](docs/31-crm-opportunities-activity-timeline.md).

## Estimates and quotations

Package 003 is now activated as the first customer-pricing application slice:

```text
CRM Opportunity
    ↓
Estimate
    ↓
Estimate Version 1 (draft)
    ↓
Internal cost build-up + explicit sell rates
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Quotation Version 1 (draft)
    ↓
Tax + narrative
    ↓
Issue lock + customer/contact/address snapshots
    ↓
Customer response
```

Protected routes are:

- `/commercial/estimates` — estimate portfolio and opportunity-to-estimate creation;
- `/commercial/estimates/[estimatePublicId]` — internal estimate lines, cost components, totals and finalisation;
- `/commercial/quotations` — quotation portfolio and effective status;
- `/commercial/quotations/[quotationPublicId]` — customer-facing lines, tax snapshots, narrative, issue evidence and response history.

The implementation reuses Package 003's existing normalised `estimates`, `estimate_versions`, `estimate_items`, `estimate_item_cost_components`, `quotations`, `quotation_versions`, `quotation_items`, tax, snapshot, issue and response tables. No second customer/estimate/quotation ledger is introduced.

### Commercial calculation boundary

Authoritative calculation uses scaled `BigInt` decimal arithmetic rather than JavaScript binary floating point:

```text
quantity       → scale 6
money/rate     → scale 4
percentage     → scale 4
money result   → scale 4
rounding       → half-up when reducing scale
```

Estimate sell/cost/margin and quotation net/tax/gross totals exclude optional lines until an explicit customer option-selection model is implemented. Cost-component `markup_percent` remains visible internal metadata and does not silently rewrite the explicit estimate sell rate.

### Version and issue integrity

Estimate version 1 supports `draft → final`; final/superseded versions are immutable through the service. A quotation can be created only from a final estimate version, and the exact source version is retained.

Quotation version 1 supports `draft → issued`. Issue atomically snapshots current CRM customer/contact facts and primary addresses, records recipient/channel evidence, and locks the version. Subsequent CRM edits cannot rewrite what was actually issued.

Tenant tax configuration is resolved while drafting and snapshotted per quotation line as applied rate, taxable amount and tax amount. Customer responses are recorded only against issued/locked versions. Effective quotation status is derived from immutable version state, response evidence and validity date rather than maintained as another editable status ledger.

See [`docs/32-estimates-quotations.md`](docs/32-estimates-quotations.md).

**Deliberately not claimed implemented:** estimate version-2 revision UI, quotation version-2/supersession/withdrawal workflow, customer option selection, sales-catalogue/tax administration UI, PDF quotation rendering, production outbound quotation email delivery, accepted-quotation-to-project conversion or contract formation.

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

The latest executable Package 003 candidate applies **10 production migrations** on MySQL 8.4.11, preserves the **344 / 749 / 429** structural contract, produces zero generated Kysely drift, passes **13 integration files / 57 real-MySQL tests**, and passes `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised head must pass the same gate before merge.

For the detailed authorization specification see [`docs/07-auth-permissions-multitenancy.md`](docs/07-auth-permissions-multitenancy.md).
