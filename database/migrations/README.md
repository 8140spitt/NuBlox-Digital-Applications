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

`20260815140337_baseline_v1.sql` consolidates validated pre-production domain packages 001–010.

Validated baseline structure:

```text
337 base tables
739 foreign keys
427 CHECK constraints
```

The baseline is intentionally irreversible. Non-production environments rebuild rather than rolling the entire baseline backward. Numbered design/provenance files under `database/schema/` remain frozen source material.

## Forward migration stream

```text
20260815145430_authentication_boundary.sql
20260815151500_account_provisioning.sql
20260815161900_organisation_administration_permissions.sql
20260815203700_project_workspace_permissions.sql
20260815211600_project_participants_team.sql
20260815214500_crm_contacts_permissions.sql
20260815222500_permission_granularity.sql
20260815223800_crm_opportunities_activities.sql
20260815231500_estimates_quotations_permissions.sql
20260816001000_accepted_quotation_project_conversion.sql
20260816005000_contract_formation_permissions.sql
20260816015500_contract_amendment_permissions.sql
20260816113000_accounts_receivable_invoice_permissions.sql
20260817090000_receivable_correction_permissions.sql
20260817103000_payment_allocation_permissions.sql
20260817124500_controlled_collections.sql
20260817144000_collections_automation_policy.sql
20260817150000_credit_control_limits_holds.sql
```

Including Baseline v1, the production stream contains **19 migrations**.

## Package 004F — migration-free reporting activation

Customer statements and aged receivables require no new persistent balance tables. Package 004F derives historical customer positions from invoice issue, credit-note issue, payment allocation, allocation reversal and void facts.

## Package 004G — `20260817124500_controlled_collections.sql`

Adds:

```text
receivable_collection_cases
receivable_collection_actions
receivable_promises_to_pay
receivable_disputes
```

and the first collections permission family. Collections facts do not store current receivable or aging balances.

## Package 004H — `20260817144000_collections_automation_policy.sql`

Adds:

```text
receivable_collection_policies
receivable_collection_policy_stages
receivable_collection_reminders
receivable_collection_reminder_deliveries
```

and:

```text
finance.collections.policy.manage
finance.collections.reminder.generate
finance.collections.reminder.dispatch
```

The package provides versioned dunning policy, explicit reminder generation/dispatch and immutable delivery-attempt evidence without claiming a scheduler or production provider.

## Package 004I — `20260817150000_credit_control_limits_holds.sql`

Package 004I adds normalised credit policy and stop-new-trade evidence:

```text
receivable_credit_policies
receivable_credit_policy_revisions
receivable_credit_holds
receivable_credit_control_overrides
```

Relationships remain tenant-contextual and normalised. No table stores a mutable used-credit/current-balance field.

### Credit-limit policy

A `receivable_credit_policies` identity is unique per:

```text
organisation + customer + currency
```

`receivable_credit_policy_revisions` is append-evidenced. Enabled revisions require a positive limit; disabling appends a new revision with no limit amount rather than overwriting prior history.

### Credit holds

`receivable_credit_holds` is customer-wide and uses a generated active-customer key to enforce one active hold per tenant/customer while retaining released history.

Lifecycle:

```text
active → released
```

Placement and release require actor/time/reason evidence.

### Override evidence

`receivable_credit_control_overrides` records one exceptional decision at a named commitment boundary and snapshots:

```text
customer
workflow + subject
currency
current outstanding receivable
proposed commitment amount
projected exposure amount
applicable credit limit
applicable active hold
reason
authorising member/time
```

The database requires at least a policy or hold reference for an override.

Application policy inserts the override in the **same transaction** as the business commitment, so failed conversion/execution cannot leave orphan authorisation evidence.

### Permission family

The migration adds:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
```

All use `finance.manage` as same-domain fallback.

Default persisted delegation:

```text
Owner / Administrator
    → view
    → policy manage
    → hold manage
    → override

Finance/Commercial
    → view
    → policy manage
    → hold manage
    ✕ override
```

`OrganisationBootstrapService` persists the equivalent split for future organisations and a dedicated integration suite verifies the stored role-permission rows.

### Exposure rule

Current receivable remains derived from authoritative finance facts:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

At a named commitment boundary:

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

A currency-specific enabled limit blocks when:

```text
Projected Exposure > Credit Limit
```

Exact equality is allowed. A customer-wide active hold blocks regardless of amount.

The package does not create a shadow receivable, reserved-headroom or open-order balance table.

### Named enforcement boundaries

```text
Accepted quotation conversion → credit gate
Contract execution            → credit gate
```

Quotation issue and contract issue remain pre-commitment. Invoice issue, credit, payment and collections workflows remain available to bill, reduce or manage existing exposure.

## Current structure

After all **19** production migrations the Package 004I target application structure is:

```text
356 base tables
789 foreign keys
459 CHECK constraints
```

The clean MySQL gate is authoritative for these counts.

## Current migration validation target

```text
19 production migrations applied / 0 pending
356 base tables / 789 foreign keys / 459 CHECK constraints
zero drift across core + collections generated Kysely outputs
26 integration files / 117 real-MySQL tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.

## Migration rules

- New migrations use Dbmate timestamp filenames.
- Released migration contents are immutable.
- All production changes are forward migrations.
- A new product surface does not require a migration when existing normalised structures and authority already support it.
- A new persistent business fact requires a normalised forward migration rather than an application-only shadow store.
- MySQL-specific DDL is explicit rather than inferred from an ORM schema.
- Committed Dbmate SQL remains released migration authority.
- Destructive production changes use expand/migrate/contract sequencing where required.
- Every migration change must pass a clean MySQL 8.4 build.
- Database-derived Kysely types must be regenerated after structural changes.
- Authentication-provider infrastructure and NuBlox domain tables remain explicitly separated.
- Data-only permission/catalogue migrations pass the full application migration/integration gate.
- Existing-tenant migration grants and future-organisation bootstrap grants remain aligned and integration-tested.
