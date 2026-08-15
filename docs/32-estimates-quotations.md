# 32 — Estimates and Quotations

## 1. Purpose

This increment activates the existing **Package 003 — Sales, Estimates and Quotations** relational model as the first NuBlox customer-pricing workflow.

The implemented commercial chain is:

```text
CRM Opportunity
    ↓
Estimate
    ↓
Estimate Version
    ↓
Internal cost build-up + sell rates
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Quotation Version
    ↓
Issue lock + customer/contact snapshot
    ↓
Customer response
```

The increment deliberately does **not** create parallel customer, opportunity, estimate, quotation, tax or issue tables. Package 002 remains authoritative for private CRM identity and Package 003 remains authoritative for sales-document identity and version history.

## 2. Implemented application surfaces

```text
/commercial/estimates
/commercial/estimates/[estimatePublicId]
/commercial/quotations
/commercial/quotations/[quotationPublicId]
```

The estimate portfolio creates internal estimates from active/won CRM opportunities and shows the latest version totals.

The estimate workspace exposes:

- estimate/version identity;
- estimate output lines;
- quantity, unit and sell unit rate;
- optional-line classification;
- internal cost components;
- quantity, unit cost, waste percentage and markup metadata for each cost component;
- derived sell, cost and margin totals;
- draft finalisation;
- creation of a customer quotation from a final estimate version.

The quotation workspace exposes:

- customer and CRM opportunity context;
- quotation/version identity;
- title, customer reference and validity date;
- customer-facing lines copied from the source final estimate and/or added directly to the quotation draft;
- tenant tax-category selection and issue-time line tax snapshots;
- commercial narrative blocks for scope, assumptions, exclusions, clarifications, terms and notes;
- issue lock and recipient evidence;
- issue history;
- customer response history.

## 3. Identity boundaries

### CRM customer identity

A quotation references the Package 002 CRM party directly:

```text
quotations.customer_party_id
quotations.primary_contact_party_id
```

The application does not copy a customer into another editable customer master.

At quotation issue, customer/contact identity is additionally written to immutable issue-time snapshot structures:

```text
quotation_party_snapshots
quotation_party_snapshot_addresses
```

This is intentional historical duplication: later edits to the CRM party or address must not rewrite what the customer was actually sent.

### Estimate and quotation identity

Logical document identity and version identity remain distinct:

```text
estimates
  └─ estimate_versions

quotations
  └─ quotation_versions
```

Request URLs use logical document `public_id` values. Package 003 child/version tables use internal relational IDs, so request transport resolves versions by version number and line-level operations by document-local line/sort numbers rather than exposing child surrogate IDs.

## 4. Opportunity → estimate boundary

A new estimate requires:

```text
active NuBlox user
AND active organisation membership
AND commercial.estimate.manage
    OR commercial.manage umbrella fallback
AND same-tenant CRM opportunity
AND opportunity status is not lost/cancelled
AND one primary opportunity customer exists
```

The estimate stores the opportunity relationship but remains a separate commercial document.

Creating an estimate creates **version 1** in `draft` state.

## 5. Estimate calculation model

Estimate output lines use:

```text
quantity × sell_unit_rate = sell amount
```

Internal cost components use:

```text
quantity × unit_cost = base cost
base cost + waste percentage = cost contribution
```

`markup_percent` remains explicit pricing metadata on the internal component. This first increment does not silently recalculate the customer-facing sell rate from cost-component markup; sell rate remains an explicit commercial decision on the estimate item.

Base estimate totals exclude optional lines until Package 003 gains an explicit option-selection/acceptance model.

### Decimal policy

Authoritative calculations do **not** use JavaScript binary floating-point arithmetic.

`commercial-decimal.ts` uses scaled `BigInt` arithmetic:

```text
quantity scale       = 6
money/unit-rate scale = 4
percentage scale      = 4
money result scale    = 4
rounding              = half-up where scale reduction is required
```

JavaScript `Number` may be used only in presentation formatting after the authoritative decimal string has already been calculated.

## 6. Estimate version lifecycle

Current Package 003 application states are:

```text
draft → final
```

The database also supports `superseded` for later revision workflows.

A draft can be edited. Final/superseded estimate versions are immutable through the application service.

Finalisation requires at least one estimate line and records:

```text
finalised_by_member_id
finalised_at
version_status = final
```

The service also supersedes any earlier final version if later revision support creates a replacement final version.

**Not yet implemented:** user-facing creation of estimate version 2+.

## 7. Estimate → quotation boundary

A quotation can currently be created only from a **final estimate version**.

The transaction:

1. verifies the same-tenant estimate and final version;
2. resolves the estimate's CRM opportunity and primary CRM customer;
3. creates the logical quotation;
4. creates quotation version 1 in `draft` state;
5. records the exact source estimate version in `quotation_version_estimates`;
6. copies estimate output lines to quotation items while retaining `source_estimate_item_id` provenance;
7. appends audit evidence.

The estimate remains internal pricing evidence. The quotation is a separate customer-facing commercial document.

## 8. Quotation tax model

Tax category/rate configuration remains tenant-owned:

```text
tax_categories
tax_category_rates
```

When a tax category is selected for a draft quotation line, the service resolves the effective tenant rate and snapshots:

```text
applied_rate_percent
taxable_amount
tax_amount
```

into `quotation_item_taxes`.

The quotation therefore does not depend on a future mutable tax rate to reconstruct previously calculated customer amounts.

Current document totals exclude optional lines.

```text
net total   = Σ included line net
 tax total  = Σ included line tax snapshots
gross total = Σ included line gross
```

## 9. Quotation draft and issue lifecycle

Current user-facing version flow is:

```text
draft → issued
```

The schema additionally supports `superseded` and `withdrawn` for later quotation-revision/withdrawal workflows.

While `draft`, authorised users may change:

- title;
- customer reference;
- valid-until date;
- quotation lines;
- line tax treatment;
- narrative blocks.

Issue requires at least one line and `commercial.quotation.issue` or umbrella authority.

The issue transaction:

1. locks the quotation/version context;
2. verifies version is still `draft`;
3. snapshots the CRM customer;
4. snapshots the primary contact where one exists;
5. snapshots each party's current primary address where available;
6. changes the version to `issued` and records `locked_by_member_id` / `locked_at`;
7. creates `quotation_issue_events` evidence;
8. creates recipient evidence in `quotation_issue_recipients`;
9. appends audit evidence including calculated totals.

After issue, the version is immutable through normal application writes.

This increment records the issue channel/evidence. It does **not** claim production email delivery from the quotation service itself; transactional delivery remains a separate provider boundary.

## 10. Customer responses

Responses are recorded in `quotation_responses` against an exact issued version and, when available, its latest issue event.

Supported response types:

```text
accepted
rejected
revision_requested
withdrawn_by_customer
```

Acceptance is permitted only against an issued/locked version. The application rejects a second accepted response and the database remains the final uniqueness/integrity guard.

The UI derives effective quotation status from immutable version state, response evidence and validity date:

```text
draft
issued
accepted
rejected
revision_requested
expired
superseded
withdrawn
```

Effective status is a read interpretation, not a second editable status ledger.

## 11. Permissions

Package 003 application permissions are:

```text
commercial.view
commercial.manage                         # broad umbrella
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

`commercial.manage` is an umbrella fallback for granular commercial mutation operations. An explicit granular member deny remains stronger than umbrella authority through the existing `PermissionService.decideWithUmbrella()` policy.

### Standard roles

Owner / Administrator:

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial:

```text
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial deliberately does **not** receive the broad `commercial.manage` umbrella.

Manager and the other standard templates do not automatically receive commercial authority in this increment.

The forward migration updates existing organisations and `OrganisationBootstrapService` provides the same role matrix to future organisations.

## 12. Tenant isolation

Every estimate/quotation repository operation includes the active `organisation_id`.

Direct public IDs from another tenant are masked as not found. Opportunity/customer resolution also remains tenant-bounded before an estimate or quotation can be created.

Issue-time party/address snapshots and tax snapshots preserve tenant-safe foreign-key context.

## 13. Audit evidence

The current service appends audit events for:

- estimate creation;
- estimate line creation/removal;
- estimate cost-component creation;
- estimate finalisation;
- quotation creation from estimate;
- quotation draft changes;
- quotation line creation/removal;
- quotation tax changes;
- quotation narrative creation;
- quotation issue;
- customer response recording.

Audit events reference the logical estimate/quotation public ID at the subject boundary.

## 14. Validation contract

The permanent application CI gate must continue to prove:

```text
Dbmate migration stream applies to MySQL 8.4
application schema = 344 tables / 749 FKs / 429 CHECK constraints
kysely-codegen produces no uncommitted drift
real-MySQL integration suite passes
svelte-check = 0 errors / 0 warnings
```

The Package 003 integration suite specifically covers:

- commercial read vs mutation permission separation;
- same-tenant opportunity requirement;
- cross-tenant estimate/quotation masking;
- fixed-point estimate totals;
- cost-component persistence;
- final estimate immutability;
- quotation creation only from final estimate versions;
- CRM customer identity reuse;
- tax rate/amount snapshot arithmetic;
- issue locking;
- issue-time party/address snapshotting;
- post-issue mutation rejection;
- response-before-issue rejection;
- single accepted response semantics;
- accepted effective status.

## 15. Deliberate exclusions / next Package 003 increments

The following are **not** claimed implemented by this first Package 003 application slice:

- estimate revision/version-2 creation workflow;
- quotation revision/version-2 creation and supersession workflow;
- quotation withdrawal workflow;
- customer option selection/acceptance for optional lines;
- sales catalogue administration UI;
- tax-category/rate administration UI;
- PDF quotation rendering;
- production outbound quotation email delivery;
- automatic accepted-quotation → project/job conversion;
- contract formation.

The next commercial transaction should preserve the existing separation:

```text
Accepted Quotation Version
        ↓
explicit idempotent conversion transaction
        ↓
Project / Job
        ↓
later Contract workflow
```
