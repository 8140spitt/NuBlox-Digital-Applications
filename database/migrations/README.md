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
20260817180500_default_uk_tax_categories.sql
20260817190000_bad_debt_writeoff_recovery.sql
20260818080000_vat_bad_debt_relief.sql
```

Including Baseline v1, the production stream contains **22 migrations**.

## Package 004F — migration-free reporting activation

Customer statements and aged receivables require no new persistent balance tables. Package 004F derives historical customer positions from immutable finance-event evidence.

## Packages 004G–004I

- `20260817124500_controlled_collections.sql` adds collection cases/actions/promises/disputes.
- `20260817144000_collections_automation_policy.sql` adds versioned dunning policy/reminder/delivery evidence.
- `20260817150000_credit_control_limits_holds.sql` adds versioned credit limits, customer holds and projected-exposure override evidence.

None of those packages creates a mutable receivable balance.

## Invoice-tax configuration — `20260817180500_default_uk_tax_categories.sql`

This is a **data-only** migration. It seeds a starter UK tax catalogue for existing organisations while preserving matching tenant-owned categories and any existing rate history:

```text
VAT_STANDARD   taxable        20%
VAT_REDUCED    taxable         5%
VAT_ZERO       zero            0%
VAT_EXEMPT     exempt          no percentage rate required
OUTSIDE_SCOPE  outside_scope   no percentage rate required
```

The migration adds no business tables and therefore does not change the structural schema counts. Application-level tax management and effective-dated rates are documented in `docs/42-invoice-tax-settings.md`.

Construction domestic reverse-charge invoice treatment is not represented by this catalogue and remains a separate application/accounting boundary.

## Package 004J — `20260817190000_bad_debt_writeoff_recovery.sql`

Package 004J adds six additive evidence tables:

```text
receivable_bad_debt_cases
receivable_bad_debt_recommendations
receivable_write_offs
receivable_write_off_reversals
receivable_write_off_recoveries
receivable_write_off_recovery_reversals
```

Bad-debt assessment, recommendations, write-offs, write-off reversal and later payment-linked recovery remain operational accounts-receivable facts. The original invoice, credit-note and payment facts are immutable.

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

The write-off records one of:

```text
no_tax_adjustment
separate_tax_adjustment_required
```

Package 004J itself does not post VAT/tax or general-ledger entries. See `docs/43-controlled-bad-debt-writeoff-recovery.md`.

## Package 004K — `20260818080000_vat_bad_debt_relief.sql`

Package 004K adds eight additive VAT bad-debt-relief evidence tables:

```text
receivable_vat_bad_debt_claims
receivable_vat_bad_debt_claim_lines
receivable_vat_bad_debt_claim_authorisations
receivable_vat_bad_debt_claim_reversals
receivable_vat_bad_debt_repayments
receivable_vat_bad_debt_repayment_reversals
receivable_vat_return_postings
receivable_vat_return_posting_reversals
```

It also adds composite context keys on existing 004J write-off/recovery tables so tenant/provenance foreign keys remain explicit.

### Claim preparation and authorisation

A candidate must be an active Package 004J write-off marked `separate_tax_adjustment_required`.

Preparation stores exact invoice/write-off provenance, eligibility dates/attestations and source invoice tax-snapshot lines. VAT amounts are calculated from `financial_document_item_taxes`; the operator does not type a VAT rate or relief amount.

Authorisation is a separate additive fact and revalidates the active write-off, current capacity, eligibility window and immutable source-tax evidence.

### Recovery repayment

Later repayment evidence references an exact authorised VAT relief claim and exact active Package 004J recovery from the same write-off.

```text
VAT Repayment
= Authorised Claim VAT
  × Recovered Consideration
  ÷ Authorised Claim Consideration
```

The repayment is additive and separately reversible.

### VAT-return posting evidence

```text
relief_claim     → VAT Return Box 4
relief_repayment → VAT Return Box 1
```

Box and amount are service-derived. Posting stores the VAT-period reference/start/end, optional external reference, reason/member/time and has additive reversal evidence.

For recovery repayment the VAT period must contain the actual `recovered_at` receipt date.

This is evidence that an amount was included in a VAT return; the migration does not implement a VAT-return submission engine or general ledger.

### Permission family

```text
finance.tax_relief.view
finance.tax_relief.prepare
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
```

All granular keys use `finance.manage` only as same-domain fallback.

Default persisted delegation:

```text
Owner / Administrator
    → all eight keys

Finance/Commercial
    → view
    → prepare
    ✕ authorise/reverse
    ✕ repayment record/reverse
    ✕ VAT-return posting/reverse
```

`OrganisationBootstrapService` persists the equivalent split for future organisations and integration coverage verifies those stored grants.

Detailed application/regulatory evidence rules are documented in `docs/44-controlled-vat-bad-debt-relief.md`.

## Current structure

After all **22** production migrations the Package 004K target application structure is:

```text
370 base tables
824 foreign keys
473 CHECK constraints
```

The clean MySQL gate is authoritative for these counts.

## Current migration validation target

```text
22 production migrations applied / 0 pending
370 base tables / 824 foreign keys / 473 CHECK constraints
zero drift across core + collections generated Kysely outputs
32 integration files / 136 real-MySQL tests
tax-relief: 6 tests
tax-relief bootstrap parity: 1 test
tax-settings: 4 tests
bad-debt core: 6 tests
bad-debt concurrency: 1 test
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
