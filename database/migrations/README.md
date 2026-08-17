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

Activates Package 003 sales-document permissions:

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

### `20260816001000_accepted_quotation_project_conversion.sql`

Adds `commercial.quotation.convert`. Runtime conversion requires:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
```

`quotation_project_conversions` remains the authoritative conversion idempotency/provenance ledger.

### `20260816005000_contract_formation_permissions.sql`

Activates controlled Package 004 contract formation/execution:

```text
contract.view
contract.manage
contract.create
contract.draft.manage
contract.issue
contract.execute
```

`contract.manage` is the Package 004 contract umbrella. Package 004 authority is independent from `commercial.manage`.

### `20260816015500_contract_amendment_permissions.sql`

Adds controlled post-execution amendment delegation:

```text
contract.amendment.create
contract.amendment.draft.manage
contract.amendment.issue
contract.amendment.decide
```

`contract.manage` remains same-domain umbrella fallback. Existing Owner/Administrator roles and future bootstrapped Owner/Administrator roles persist equivalent granular rows.

No amendment business tables are added because Baseline v1 already contains `contract_amendments`, `contract_amendment_value_adjustments` and `contract_amendment_key_date_changes`.

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

`finance.manage` is the independent same-domain finance umbrella and does not cross into commercial or contract authority.

Existing/future standard defaults are:

```text
Owner / Administrator
    finance.view
    finance.manage
    finance.billing.manage
    finance.invoice.create
    finance.invoice.draft.manage
    finance.invoice.issue

Finance/Commercial
    finance.view
    finance.billing.manage
    finance.invoice.create
    finance.invoice.draft.manage
    finance.invoice.issue
    # no finance.manage
```

The migration is permission/reference-only. Baseline v1 already contains the normalised billing/invoice tables.

### `20260817090000_receivable_correction_permissions.sql`

Activates Package 004D controlled receivable corrections:

```text
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.invoice.void
```

All four use `finance.manage` as same-domain fallback.

Standard defaults are deliberately asymmetric:

```text
Owner / Administrator
    finance.credit_note.create
    finance.credit_note.draft.manage
    finance.credit_note.issue
    finance.invoice.void
    + existing finance.manage

Finance/Commercial
    finance.credit_note.create
    finance.credit_note.draft.manage
    finance.credit_note.issue
    # no finance.invoice.void
    # no finance.manage
```

This keeps normal credit-note correction within the Finance/Commercial role while treating void of an already-issued legal invoice as stronger authority.

The migration adds **no new business tables**. Package 004 already contains:

```text
financial_documents
credit_notes
financial_document_items
financial_document_item_taxes
credit_note_item_sources
financial_document_party_snapshots
financial_document_party_snapshot_addresses
financial_document_issue_events
financial_document_issue_recipients
payments
payment_allocations
payment_allocation_reversals
```

The activated application boundary enforces:

- same-tenant issued-invoice source eligibility;
- legally unnumbered credit-note drafts;
- exact original invoice-item provenance for every credit line;
- positive credit quantities/values with credit semantics supplied by `document_kind`;
- partial/full source quantities;
- original invoice applied tax-rate preservation rather than current-rate recomputation;
- original invoice party/address snapshot copying;
- issue-time source-quantity revalidation under the original-invoice lock;
- tenant `CN-xxxxxx` allocation only at issue;
- immutable issued credit notes through ordinary draft APIs;
- exceptional invoice void with explicit evidence;
- invoice-void rejection when credit-note history or unreversed payment-allocation history exists.

Package 004D does not activate payment receipt/allocation application services or general-ledger posting.

## Current structure

After all **15** production migrations the application structure remains:

- **344 base tables**
- **749 foreign keys**
- **429 `CHECK` constraints**

## Current migration validation

The executable Package 004D head passed the complete MySQL 8.4.11 gate:

```text
15 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
18 integration files / 82 real-MySQL tests passed
finance/credit-notes.integration.test.ts: 5/5 passed
finance/invoices.integration.test.ts: 5/5 passed
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
