# NuBlox SvelteKit App

This app is structured as a modular monolith following `docs/05-system-architecture.md`.

## Architectural principles

- Single deployable SvelteKit app with explicit domain boundaries.
- Business rules belong in server-side domain/application modules, not Svelte components.
- Route handlers are request boundaries for authentication, tenant context, validation, policy checks and service orchestration.
- Correlation IDs are attached to requests for observability.
- SQL belongs behind domain repositories/services; routes/components do not query the database directly.
- MySQL SQL migrations are the schema source of truth; generated Kysely types are derivative.
- Tenant-owned records use explicit verified tenant context rather than surrogate ID alone.
- Authentication identity does not imply organisation, CRM, commercial, contract or project access.

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

`decideWithUmbrella()` resolves the granular permission first and uses the same-domain umbrella only when the granular key has no explicit member/role decision. An explicit granular member deny cannot be bypassed by its umbrella. Permission umbrellas do not cross domain boundaries; `commercial.manage` does not grant contract or amendment authority.

## Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one NuBlox provisioning intent must validate: an existing-organisation invitation or a self-service new-organisation bootstrap.

`/start` provides first/additional organisation creation while retaining fail-closed account creation. Durable state reuses the normalised NuBlox identity/organisation/member/role model.

## Standard organisation roles

New organisations receive Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only.

Owner / Administrator receive current broad project, CRM, commercial and contract umbrella authority plus established granular permissions. Their existing `commercial.manage` + `project.create` authority satisfies accepted-quotation project conversion. Their independent Package 004 `contract.manage` authority supplies broad contract formation and amendment authority unless a granular member exception denies a specific action.

Manager retains granular project and CRM party/contact operational permissions, including `project.create`, but receives no automatic commercial conversion or contract authority.

Finance/Commercial receives:

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

Finance/Commercial deliberately does not receive `commercial.manage`, `commercial.quotation.convert`, `project.create` or `contract.manage`. Conversion, contract mutation and amendment mutation are deliberate delegations.

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
- `/contracts` — tenant contract portfolio plus accepted-quotation/project formation queues;
- `/contracts/new?project=[projectPublicId]` — controlled accepted-quotation/project contract formation;
- `/contracts/[contractPublicId]` — contract version, party, value, key-date, issue, execution and amendment history workspace;
- `/contracts/[contractPublicId]/amendments/[amendmentPublicId]` — controlled amendment draft, value/date changes, issue and decision workspace;
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

Estimate/quotation money uses scaled `BigInt` arithmetic rather than JavaScript binary floating point:

```text
quantity        6 decimals
money/rate      4 decimals
percentage      4 decimals
money result    4 decimals
rounding        half-up when reducing scale
```

Quotation issue snapshots CRM customer/contact/address facts, locks the exact version and creates issue/recipient evidence. Responses are recorded only against issued/locked versions.

## Accepted quotation → project conversion

`src/lib/server/commercial/quotation-project-conversion-service.ts` owns the explicit cross-domain conversion transaction.

Authority is conjunctive:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
```

The selected version must be the exact tenant-owned issued and locked quotation version with an accepted response for that same version. `quotation_project_conversions` is the authoritative idempotency/provenance ledger.

The conversion creates a `proposed` project, owning-organisation participation and converting-member scope. It does not infer the CRM customer as a NuBlox participant, create a project site, activate the project, form a contract or create finance records.

See `docs/32-estimates-quotations.md`.

## Controlled contract formation

`src/lib/server/contracts/contract-formation-service.ts`, `contract-lifecycle-service.ts` and `contract-service.ts` activate the formation/execution half of Package 004 without creating a second contract ledger.

The contract boundary is:

```text
active NuBlox user
AND active organisation membership
AND contract.view for reads
AND granular contract permission OR contract.manage umbrella for mutations
AND project.view + exact active project-member scope where quotation-derived formation requires it
AND record.organisation_id = active organisation
AND contract/version lifecycle policy
```

Formation retains exact accepted quotation/project provenance in the existing Package 004 columns. Version 1 snapshots customer evidence, derives its initial `base_scope` from accepted non-optional quotation net lines, and supports controlled value/key-date maintenance before issue.

Issue makes version 1 immutable and records recipient evidence. Execution records one execution event and signatory evidence and changes the logical contract to `active`. Project lifecycle remains independent.

See `docs/33-contract-formation.md`.

## Controlled contract amendments

`src/lib/server/contracts/contract-amendment-service.ts` activates the normalised Package 004 post-execution amendment model:

```text
Active + executed Contract
        ↓
Draft Amendment
        ├─ narrative / scope / terms change
        ├─ signed value adjustments
        └─ key-date changes
        ↓
Issue / freeze
        ↓
Agreed | Rejected | Withdrawn
```

Creation requires an active logical contract and an executed contract-version baseline. The service uses existing `contract_amendments`, `contract_amendment_value_adjustments` and `contract_amendment_key_date_changes` tables; it does not create a parallel variation ledger.

Draft amendments may be edited by authorised users. Value adjustments are signed `DECIMAL(19,4)` facts: positive amounts increase value, negative amounts decrease it, zero is rejected. Key-date changes create new amendment facts rather than overwriting executed baseline dates.

Before issue, an amendment must have an effective date and substantive change evidence. Issue freezes ordinary mutation. Only an issued amendment can be agreed or rejected; draft or issued amendments can be withdrawn while remaining preserved as historical evidence.

Current contract value is derived, never independently editable:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Draft, issued, rejected and withdrawn adjustments do not affect current contract value. All amendment mutations/lifecycle transitions are audited and tenant-scoped; foreign-tenant amendment identity is masked.

See `docs/34-contract-amendments.md`.

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

## Transactional email boundary

`src/lib/server/email/email-delivery.ts` keeps outbound transactional email provider-neutral. `EMAIL_DELIVERY_MODE=console` is for development and integration tests only. Package 003 quotation issue and Package 004 contract issue record delivery evidence; neither claims production outbound email delivery.

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

The Package 004 amendment release candidate applies **13 production migrations** on MySQL 8.4.11, verifies the **344-table / 749-FK / 429-CHECK** structural contract, produces zero generated Kysely drift, passes **16 integration files / 72 real-MySQL tests**, and passes `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised PR head must prove these exact results before merge.

Not yet implemented: estimate/quotation revision workflows, quotation withdrawal, customer option selection, catalogue/tax administration UI, PDF generation, production outbound quotation/contract/amendment delivery, inferred customer project participation, project-site inference, contract version 2+, automatic project activation, operational invoices, credit notes, payments or allocations.
