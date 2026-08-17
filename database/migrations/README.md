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

`20260815140337_baseline_v1.sql` consolidates validated pre-production domain packages 001–010 in their documented order.

Validated Baseline v1 structure:

- **337 domain/base tables**
- **739 foreign keys**
- **427 `CHECK` constraints**

The baseline is intentionally irreversible. Non-production environments rebuild rather than rolling the entire baseline backward. Numbered design/provenance files under `database/schema/` remain frozen source material.

## Forward migrations

### `20260815145430_authentication_boundary.sql`
Adds Better Auth infrastructure and explicit `auth_user_links`. Structure becomes **342 / 743 / 427**.

### `20260815151500_account_provisioning.sql`
Adds controlled organisation invitations and intended invitation roles. Structure becomes **344 / 749 / 429**.

### `20260815161900_organisation_administration_permissions.sql`
Seeds `organisation.manage`, `member.invite` and `member.manage`.

### `20260815203700_project_workspace_permissions.sql`
Seeds `project.create`, `project.view` and `project.manage`.

### `20260815211600_project_participants_team.sql`
Adds declined project-participation semantics and contextual `project_role_types`. Project roles classify context; they do not grant application permissions.

### `20260815214500_crm_contacts_permissions.sql`
Seeds original `crm.view` and `crm.manage` identifiers.

### `20260815222500_permission_granularity.sql`
Adds granular project and CRM party/contact permissions under the existing same-domain umbrellas.

### `20260815223800_crm_opportunities_activities.sql`
Adds `crm.opportunity.manage`, `crm.activity.manage` and non-destructive default Sales pipeline provisioning.

### `20260815231500_estimates_quotations_permissions.sql`
Activates Package 003 sales-document permissions under `commercial.manage`.

### `20260816001000_accepted_quotation_project_conversion.sql`
Adds `commercial.quotation.convert`; conversion also requires `project.create`.

### `20260816005000_contract_formation_permissions.sql`
Activates Package 004 contract formation/execution under the independent `contract.manage` umbrella.

### `20260816015500_contract_amendment_permissions.sql`
Adds granular controlled-amendment delegation. Existing and future Owner/Administrator roles persist equivalent granular rows.

### `20260816113000_accounts_receivable_invoice_permissions.sql`
Activates Package 004C billing settings and controlled invoice preparation/issue:

```text
finance.view
finance.manage
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
```

`finance.manage` is the independent same-domain finance umbrella and never crosses into commercial or contract authority.

### `20260817090000_receivable_correction_permissions.sql`

Activates Package 004D controlled receivable corrections:

```text
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.invoice.void
```

All four use `finance.manage` as fallback. Finance/Commercial receives the three ordinary credit-note permissions but not `finance.invoice.void` or `finance.manage`; Owner/Administrator receive all four.

### `20260817103000_payment_allocation_permissions.sql`

Activates Package 004E payment receipt and controlled cash application:

```text
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
```

All four use `finance.manage` as same-domain fallback. Payment receipt/allocation/reversal uses the normalised structures already present in Baseline v1.

## Package 004F — migration-free reporting activation

Customer statements and aged receivables require **no new production migration**.

Package 004F derives historical customer positions from existing invoice issue, credit-note issue, payment allocation, allocation reversal and void facts. It introduces no statement-line or aging-balance tables and does not duplicate receivable balances.

## `20260817124500_controlled_collections.sql` — Package 004G

Package 004G is a genuine forward-schema increment because the frozen Package 004 baseline contains no collections-case, promise-to-pay, receivable-dispute or dunning-evidence structures.

The migration adds:

```text
receivable_collection_cases
receivable_collection_actions
receivable_promises_to_pay
receivable_disputes
```

The relationships remain tenant-contextual and normalised:

```text
Customer Party
    ↓
Collection Case
    ├── immutable Collection Actions
    ├── Promises to Pay
    └── Receivable Disputes
```

Promises and disputes may optionally reference an invoice, but application policy requires that invoice to belong to the same tenant and collection-case customer.

No collection table stores current overdue, outstanding, settlement or aging balances. Those remain derived through Package 004F from immutable finance facts.

The migration also adds:

```text
finance.collections.view
finance.collections.case.manage
finance.collections.action.record
finance.collections.promise.manage
finance.collections.dispute.manage
```

Mutation permissions use `finance.manage` as same-domain umbrella fallback. Collections reads require `finance.view` plus `finance.collections.view` (or the `finance.manage` fallback for the collections-read key).

Existing Owner, Administrator and Finance/Commercial roles receive all five collections keys. `OrganisationBootstrapService` persists equivalent grants for future organisations.

The first collections boundary deliberately does **not** create automatic reminder schedules/delivery, legal escalation, credit-limit/hold policy, late-fee/interest calculation, bad-debt/write-off or general-ledger posting.

## Current structure

After all **17** production migrations the validated target application structure is:

- **348 base tables**
- **767 foreign keys**
- **439 `CHECK` constraints**

The Package 004G executable MySQL gate is authoritative for these counts.

## Current migration validation

The executable Package 004G branch has already proved the migration, structural and generated-type stages on MySQL 8.4.11:

```text
17 production migrations applied / 0 pending
348 base tables / 767 foreign keys / 439 CHECK constraints
zero drift across core + collections generated Kysely outputs
```

The permanent 004G integration suite and the final documentation-synchronised PR head must pass the complete real-MySQL and Svelte gate before merge.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All production changes are forward migrations.
- A new product surface does not require a migration when existing normalised structures and existing authority correctly support it.
- A new persistent business fact requires a normalised forward migration rather than an application-only shadow store.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed Dbmate SQL remains released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass a clean MySQL 8.4 build.
- Database-derived Kysely types must be regenerated after structural changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations must pass the full application migration and integration gate.
- Existing-tenant migration grants and future-organisation bootstrap grants must remain aligned and integration-tested.
