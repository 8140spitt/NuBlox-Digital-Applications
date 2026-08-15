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

commercial.manage
    ├─ commercial.estimate.manage
    ├─ commercial.quotation.manage
    ├─ commercial.quotation.issue
    └─ commercial.quotation.response.record
```

`decideWithUmbrella()` resolves the granular permission first and uses the umbrella only when the granular key has no explicit member/role decision. An explicit granular member deny therefore cannot be bypassed by the umbrella.

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service new-organisation bootstrap.

`/start` provides first/additional organisation creation while retaining fail-closed account creation. The bootstrap token is a short-lived HMAC-SHA256 pre-sign-up authorisation envelope in an HttpOnly cookie; durable state reuses the normalised NuBlox domain model.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive current broad project, CRM and commercial umbrella authority plus the implemented granular permissions. Manager retains granular project and CRM party/contact operational permissions but does not automatically receive opportunity/activity or commercial permissions.

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

Finance/Commercial deliberately does not receive `commercial.manage`. Forward permission migrations and `OrganisationBootstrapService` are integration-tested for standard-role parity.

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

Stable CRM permissions are:

```text
crm.view
crm.manage
crm.party.manage
crm.contact.manage
crm.opportunity.manage
crm.activity.manage
```

All CRM repository access is tenant-bounded. CRM identity remains independent from platform organisations, users, organisation memberships, workforce identity and project participation. Cross-tenant public IDs are masked as not found.

Opportunity request URLs use `opportunity.public_id`; stage mutation input uses pipeline public ID plus stage name because Package 002 stage rows have no external public ID. Pipeline stage is sales maturity, while opportunity status is the business outcome.

## Commercial estimates and quotations

`src/lib/server/commercial/commercial-service.ts` and `commercial-repository.ts` activate the Package 003 estimate/quotation structures without creating another sales ledger.

The commercial boundary is:

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

Estimate lines carry explicit sell quantity/rate. Internal cost components retain quantity, unit cost, waste percentage and markup metadata. Sell/cost/margin calculations use `commercial-decimal.ts`, which performs scaled `BigInt` arithmetic rather than JavaScript binary floating point.

Current authoritative scales are:

```text
quantity        6 decimals
money/rate      4 decimals
percentage      4 decimals
money result    4 decimals
rounding        half-up when reducing scale
```

Optional lines are excluded from base document totals until explicit customer option selection is implemented.

Finalisation requires at least one line and changes estimate version 1 from `draft` to `final`; final/superseded versions are immutable through normal application writes.

### Final estimate → quotation

A quotation can currently be created only from a final estimate version. The transaction creates a separate logical quotation/version, records the exact source estimate version in `quotation_version_estimates`, and copies output lines with source-estimate-item provenance. CRM customer identity remains linked rather than copied into another editable master.

Draft quotation version 1 supports header details, customer-facing lines, tenant tax-category snapshots and narrative blocks. Tax calculation snapshots applied rate, taxable amount and tax amount on the quotation line.

### Issue and response integrity

Quotation issue requires `commercial.quotation.issue` or umbrella authority. The issue transaction snapshots current CRM customer/contact facts and their primary addresses, locks the version as `issued`, creates issue/recipient evidence and appends audit history. Later CRM edits do not rewrite the issued document evidence.

Issued quotation versions are immutable through normal application writes. Responses are recorded only against issued/locked versions. The UI derives effective status from version state, response evidence and validity date rather than maintaining a second editable status ledger.

Current response types are `accepted`, `rejected`, `revision_requested` and `withdrawn_by_customer`. A second acceptance is rejected.

Not yet implemented: estimate revision version 2+, quotation revision/supersession/withdrawal UI, customer option selection, catalogue/tax administration UI, PDF generation, production outbound quotation email delivery, accepted-quotation-to-project conversion, or contract formation.

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

The invitation-response path is a deliberate pre-project-scope exception: the invited organisation may accept/decline with organisation-level `project.participation.manage` or `project.manage` fallback before the accepting member has a project-member row. Acceptance creates the first active member scope atomically.

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral. `EMAIL_DELIVERY_MODE=console` is for development and integration tests only. Package 003 quotation issue currently records delivery evidence; it does not claim production outbound email delivery.

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

The latest executable Package 003 candidate applies **10 production migrations** on MySQL 8.4.11, verifies the **344-table / 749-FK / 429-CHECK** structural contract, produces zero generated Kysely drift, passes **13 integration files / 57 real-MySQL tests**, and runs `svelte-check` with **0 errors / 0 warnings**. The documentation-synchronised head must pass the same gate before merge.
