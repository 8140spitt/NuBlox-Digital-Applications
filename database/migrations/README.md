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
Adds controlled organisation invitations and intended invitation roles. Structure becomes the current **344 / 749 / 429**.

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

The migration is permission-only because Baseline v1 already contains the credit-note/source, issue, payment and reversal structures.

### `20260817103000_payment_allocation_permissions.sql`

Activates Package 004E payment receipt and controlled cash application:

```text
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
```

All four use `finance.manage` as same-domain fallback.

Existing standard-role grants are:

```text
Owner / Administrator
    finance.payment.create
    finance.payment.allocate
    finance.payment.allocation.reverse
    finance.payment.reverse
    + existing finance.manage

Finance/Commercial
    finance.payment.create
    finance.payment.allocate
    finance.payment.allocation.reverse
    finance.payment.reverse
    # deliberately no finance.manage
```

Payment reversal is an immutable cash correction, not an issued-legal-document void, so it belongs within the ordinary delegated Finance/Commercial workflow.

The migration adds **no business tables**. Baseline v1 already contains:

```text
payment_methods
payments
payment_allocations
payment_allocation_reversals
payment_reversals
```

The activated application boundary enforces:

- immutable positive payment receipt facts;
- optional same-tenant CRM payer selection;
- no automatic allocation at receipt creation;
- same-tenant issued-invoice allocation only;
- exact payment/invoice currency match until an FX workflow exists;
- fixed-precision positive allocation amounts;
- payment availability = receipt amount less active allocations;
- invoice outstanding = issued gross less issued credit gross less active allocations;
- payment and invoice row locks before authoritative allocation revalidation;
- no allocation above payment availability;
- no allocation above invoice outstanding;
- immutable allocation reversal evidence rather than allocation edits/deletes;
- payment reversal that first creates reversal rows for every still-active allocation in the same transaction;
- zero usable value and no further allocation after payment reversal;
- derived invoice settlement state independently from legal invoice lifecycle.

## Current structure

After all **16** production migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The executable Package 004E head passed the complete MySQL 8.4.11 gate:

```text
16 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
19 integration files / 88 real-MySQL tests passed
finance/payment-allocation.integration.test.ts: 6/6 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same gate before merge.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All production changes are forward migrations.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed Dbmate SQL remains released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass a clean MySQL 8.4 build.
- Database-derived Kysely types must be regenerated after structural changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations must pass the full application migration and integration gate.
- Existing-tenant migration grants and future-organisation bootstrap grants must remain aligned and integration-tested.
