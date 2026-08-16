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
- Authentication identity does not imply organisation, CRM, commercial or project access.

## Persistence and authentication stack

- **MySQL 8.4 / InnoDB**
- **Kysely** typed SQL query builder
- **mysql2** pooled Node driver
- **Dbmate** plain-SQL production migrations
- **kysely-codegen** database-derived TypeScript interfaces
- **Better Auth 1.6.25** authentication/session boundary

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

Granular/umbrella families include:

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
```

`decideWithUmbrella()` resolves the granular permission first and uses the umbrella only when the granular key has no explicit member/role decision. An explicit granular member deny cannot be bypassed by its umbrella.

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate: an existing-organisation invitation or a self-service new-organisation bootstrap.

`/start` provides first/additional organisation creation while retaining fail-closed account creation. Durable state reuses the normalised NuBlox identity/organisation/member/role model.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive current broad project, CRM and commercial umbrella authority plus established granular permissions. Their existing `commercial.manage` + `project.create` authority satisfies the accepted-quotation conversion boundary unless a member-level exception overrides it.

Manager retains granular project and CRM party/contact operational permissions, including `project.create`, but receives no automatic commercial conversion authority.

Finance/Commercial receives:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial deliberately does not receive `commercial.manage`, `commercial.quotation.convert` or `project.create`. Conversion is a cross-domain delegation and requires deliberate authority if that role should perform it.

## Application access

The current UI includes:

- `/start` — first/additional organisation creation;
- `/signin` — Better Auth email/password sign-in;
- `/invite/[token]` — organisation invitation acceptance/account creation;
- `/select-organisation` — active organisation membership selector;
- `/dashboard` — protected tenant-scoped entry point;
- `/crm` — private tenant CRM directory and party creation;
- `/crm/[partyPublicId]` — CRM party maintenance, contacts and affiliations;
- `/crm/opportunities` — opportunity portfolio, filtering and creation;
- `/crm/opportunities/[opportunityPublicId]` — opportunity maintenance, participants and activity timeline;
- `/commercial/estimates` — estimate portfolio and opportunity-to-estimate creation;
- `/commercial/estimates/[estimatePublicId]` — estimate output lines, cost build-up, totals and finalisation;
- `/commercial/quotations` — quotation portfolio and effective status;
- `/commercial/quotations/[quotationPublicId]` — quotation draft, tax, narrative, issue and response evidence;
- `/commercial/quotations/[quotationPublicId]/convert` — accepted-version project conversion and provenance status;
- `/projects` — member-scoped project portfolio, creation and invitation inbox;
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

## CRM application boundary

`src/lib/server/crm/crm-service.ts` / `crm-repository.ts` activate Package 002 party/contact records. `crm-opportunity-service.ts` / `crm-opportunity-repository.ts` activate opportunities and activities. `crm-pipeline-provisioning.ts` supplies an audited first-use default Sales pipeline where a tenant has no pipeline configuration.

All CRM repository access is tenant-bounded. CRM identity remains independent from platform organisations, users, organisation memberships, workforce identity and project participation. Cross-tenant public IDs are masked as not found.

## Commercial estimates and quotations

`src/lib/server/commercial/commercial-service.ts` and `commercial-repository.ts` activate Package 003 estimate/quotation structures without creating another sales ledger.

The normal commercial boundary is:

```text
active NuBlox user
AND active organisation membership
AND commercial.view for reads
AND granular commercial permission OR commercial.manage umbrella for mutations
AND record.organisation_id = active organisation
AND document/version lifecycle policy
```

### Opportunity → estimate

A new estimate must reference a same-tenant CRM opportunity that is not lost/cancelled and has a primary CRM customer. Estimate creation creates version 1 in `draft` state.

Estimate lines carry explicit sell quantity/rate. Internal cost components retain quantity, unit cost, waste percentage and markup metadata. Sell/cost/margin calculations use scaled `BigInt` arithmetic in `commercial-decimal.ts`.

```text
quantity        6 decimals
money/rate      4 decimals
percentage      4 decimals
money result    4 decimals
rounding        half-up when reducing scale
```

Optional lines are excluded from base totals until explicit option selection exists. Finalisation changes draft estimate version 1 to `final`; final/superseded versions are immutable through normal application writes.

### Final estimate → quotation

A quotation can currently be created only from a final estimate version. The transaction creates a separate logical quotation/version, records exact source version provenance in `quotation_version_estimates`, and copies output lines with source-estimate-item provenance. CRM customer identity remains linked rather than copied into another editable master.

Draft quotation version 1 supports header details, customer-facing lines, tenant tax snapshots and narrative blocks.

### Issue and response integrity

Quotation issue snapshots current CRM customer/contact facts and primary addresses, locks the version as `issued`, creates issue/recipient evidence and appends audit history. Later CRM edits do not rewrite issued evidence.

Issued quotation versions are immutable. Responses are recorded only against issued/locked versions. Current response types are `accepted`, `rejected`, `revision_requested` and `withdrawn_by_customer`; a second acceptance is rejected.

## Accepted quotation → project conversion

`src/lib/server/commercial/quotation-project-conversion-service.ts` owns the explicit cross-domain conversion transaction.

Authority is conjunctive:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
```

The selected version must be an exact tenant-owned `issued` and locked quotation version with an `accepted` response for that same version.

The conversion transaction:

1. verifies active tenant membership and both permission decisions;
2. locks the logical quotation, exact version and accepted response;
3. checks the existing `quotation_project_conversions` ledger;
4. returns the already-linked project on a retry;
5. locks source estimates and rejects a source already tied to another project;
6. creates one project in `proposed` state;
7. creates active owning-organisation participation;
8. creates the converting member's first active project scope;
9. writes `quotation_project_conversions` provenance;
10. sets `quotations.project_id` and exact source `estimates.project_id`;
11. appends `commercial.quotation.converted_to_project` and `project.created_from_quotation` audit events.

Project numbering is derived deterministically from the quotation number (`QUO-…` → `PRJ-…`) and must not collide with unrelated project identity.

The conversion deliberately does not infer that a CRM customer is a NuBlox platform organisation. It does not invite the customer, create a project site from a CRM address, activate the project or form a contract.

See `docs/32-estimates-quotations.md`.

## Project workspace and collaboration

Project permissions are:

```text
project.create
project.view
project.manage
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
```

Normal project access requires effective organisation authority plus active participant-organisation scope plus exact-member `project_members` scope. Project contextual roles never grant application permissions.

The accepted-quotation conversion creates only the owning organisation's participation and converting member's initial scope. Customer/external participant creation remains an explicit project invitation workflow.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral. `EMAIL_DELIVERY_MODE=console` is for development and integration tests only. Package 003 quotation issue records delivery evidence; it does not claim production outbound email delivery.

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

The accepted-quotation conversion executable candidate applies **11 production migrations** on MySQL 8.4.11, verifies the **344-table / 749-FK / 429-CHECK** structural contract, produces zero generated Kysely drift and passes **14 integration files / 61 real-MySQL tests**. The documentation-synchronised release head must pass `svelte-check` with **0 errors / 0 warnings** before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, catalogue/tax administration UI, PDF generation, production outbound quotation email delivery, inferred customer project participation, project-site inference, or contract formation.
