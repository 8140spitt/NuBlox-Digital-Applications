# 32 — Estimates, Quotations and Project Conversion

## 1. Purpose

This application boundary activates **Package 003 — Sales, Estimates and Quotations** through customer pricing, issue/acceptance evidence and explicit conversion of an accepted quotation into a NuBlox project.

The implemented chain is:

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
    ↓
Accepted Quotation Version
    ↓
Idempotent project conversion
    ↓
Proposed Project / Job
```

The implementation does **not** create parallel customer, opportunity, estimate, quotation, conversion or project tables. Package 002 remains authoritative for private CRM identity, Package 003 remains authoritative for sales-document/response/conversion provenance, and Package 001 remains authoritative for project identity and participation.

## 2. Implemented application surfaces

```text
/commercial/estimates
/commercial/estimates/[estimatePublicId]
/commercial/quotations
/commercial/quotations/[quotationPublicId]
/commercial/quotations/[quotationPublicId]/convert
```

The estimate portfolio/workspace supports opportunity-derived estimates, item/cost build-up, derived totals, finalisation and quotation creation.

The quotation portfolio/workspace supports draft customer-facing content, tax snapshots, narrative, issue evidence and customer responses.

Accepted quotations expose a dedicated conversion workspace. That workspace shows the exact accepted version, response evidence, source estimates, independent commercial/project authority and any already-created project before a conversion write occurs.

## 3. Identity boundaries

### CRM customer identity

A quotation references Package 002 CRM parties directly:

```text
quotations.customer_party_id
quotations.primary_contact_party_id
```

At issue, customer/contact facts needed to reproduce what was sent are intentionally snapshotted into:

```text
quotation_party_snapshots
quotation_party_snapshot_addresses
```

A CRM party is **not** inferred to be a NuBlox platform organisation. Project conversion therefore does not automatically invite or create a project participant for the customer.

### Estimate and quotation identity

Logical document identity and immutable/versioned evidence remain distinct:

```text
estimates
  └─ estimate_versions

quotations
  └─ quotation_versions
       └─ quotation_responses
```

Request URLs use logical document `public_id` values. Version and child surrogate IDs remain server-side; request transport uses version numbers and document-local line/sort numbers where Package 003 children do not expose public IDs.

### Project-conversion identity

The baseline already provides the conversion ledger:

```text
quotation_responses (accepted)
        ↓
quotation_project_conversions
        ↓
projects
```

`quotation_project_conversions` is the authoritative one-response-to-one-project provenance record. `quotations.project_id` and source `estimates.project_id` are the direct domain links to the created project.

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

Creating an estimate creates version 1 in `draft` state.

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

`markup_percent` remains explicit pricing metadata. The service does not silently recalculate the customer sell rate from cost-component markup.

Base totals exclude optional lines until an explicit customer option-selection model exists.

### Decimal policy

Authoritative calculations do **not** use JavaScript binary floating point. `commercial-decimal.ts` uses scaled `BigInt` arithmetic:

```text
quantity scale        = 6
money/unit-rate scale = 4
percentage scale      = 4
money result scale    = 4
rounding              = half-up where scale reduction is required
```

JavaScript `Number` is presentation-only after authoritative decimal strings have been calculated.

## 6. Estimate version lifecycle

Current application flow:

```text
draft → final
```

The schema also supports `superseded` for later revision workflows. Final/superseded versions reject normal application mutation.

Finalisation requires at least one line and records `finalised_by_member_id`, `finalised_at` and `version_status = final`.

**Not yet implemented:** user-facing estimate version 2+ creation.

## 7. Estimate → quotation boundary

A quotation can currently be created only from a **final estimate version**. The transaction:

1. verifies the same-tenant estimate/final version;
2. resolves the CRM opportunity/customer;
3. creates the logical quotation and draft version 1;
4. records exact source version provenance in `quotation_version_estimates`;
5. copies estimate output lines with `source_estimate_item_id` provenance;
6. appends audit evidence.

Estimate and quotation remain separate internal/customer-facing documents.

## 8. Quotation tax model

Tax configuration remains tenant-owned through `tax_categories` and `tax_category_rates`. Selecting tax for a draft line snapshots:

```text
applied_rate_percent
taxable_amount
tax_amount
```

in `quotation_item_taxes` so historical customer amounts do not depend on later tax-rate changes.

Current totals exclude optional lines:

```text
net total   = Σ included line net
tax total   = Σ included line tax snapshots
gross total = Σ included line gross
```

## 9. Quotation draft and issue lifecycle

Current user-facing version flow:

```text
draft → issued
```

The schema additionally supports `superseded` and `withdrawn` for later revision/withdrawal workflows.

Issue requires at least one line and `commercial.quotation.issue` (or `commercial.manage` fallback). The issue transaction validates the draft, snapshots customer/contact/address facts, locks the version, creates issue/recipient evidence and appends audit evidence.

Issued versions are immutable through normal application writes. Issue evidence does not claim production outbound email delivery.

## 10. Customer responses

Responses are recorded against an exact issued/locked version:

```text
accepted
rejected
revision_requested
withdrawn_by_customer
```

The database generated-key uniqueness guard permits at most one accepted response per logical quotation. Effective quotation state is derived from version state, response evidence and validity rather than maintained as another editable ledger.

## 11. Accepted quotation → project conversion

Conversion is an explicit **cross-domain transaction**, not a side effect of recording acceptance.

The exact selected quotation version must:

```text
belong to the active tenant
AND be version_status = issued
AND have locked_at evidence
AND have an accepted quotation_response for that exact version
AND belong to an active logical quotation
```

Runtime authority is conjunctive:

```text
commercial.quotation.convert
    OR commercial.manage umbrella fallback
AND project.create
```

One permission never substitutes for the other. This keeps commercial acceptance/conversion responsibility separate from authority to create project records.

### Transaction and idempotency

`QuotationProjectConversionService` transactionally:

1. verifies active tenant membership;
2. resolves both permission decisions;
3. locks the tenant-owned logical quotation;
4. locks the exact issued/accepted quotation version/response;
5. checks `quotation_project_conversions` for prior conversion;
6. if already converted, returns the existing project;
7. locks exact source estimates from `quotation_version_estimates` and rejects any already linked to another project;
8. creates one `projects` record in `proposed` state;
9. creates active owning-organisation participation;
10. creates the converting member's initial active `project_members` scope;
11. inserts the conversion ledger row;
12. sets `quotations.project_id`;
13. sets `project_id` on exact source estimates;
14. writes commercial and project audit evidence.

The baseline unique keys on conversion response and conversion project remain final database integrity guards under concurrency.

Project numbers are generated deterministically from the quotation number (`QUO-…` → `PRJ-…`) and must not collide with an unrelated existing project.

### Deliberate conversion non-effects

Conversion does **not**:

- infer a NuBlox platform organisation from the CRM customer;
- invite the customer to the project;
- create a project site from a CRM/billing address;
- activate the project automatically;
- create a contract;
- create invoices or financial postings.

Those are separate workflow decisions and transactions. Controlled contract formation is now implemented as a later Package 004 boundary in [`33-contract-formation.md`](33-contract-formation.md); it remains deliberately separate from the conversion transaction described here.

## 12. Permissions and standard roles

Package 003 permission family is now:

```text
commercial.view
commercial.manage                         # broad umbrella
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
commercial.quotation.convert
```

`commercial.manage` is umbrella fallback for granular commercial mutations, including conversion. Explicit granular member deny remains stronger than umbrella authority.

Current standard defaults remain:

**Owner / Administrator**

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
project.create
```

Their existing `commercial.manage` umbrella means no duplicate standard grant of `commercial.quotation.convert` is required.

**Finance/Commercial**

```text
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial does **not** automatically receive `commercial.manage`, `commercial.quotation.convert` or `project.create`. If an organisation wants that role to perform conversion, the relevant cross-domain authorities must be deliberately delegated.

Manager may have `project.create` but receives no automatic commercial conversion authority. Other standard templates remain unchanged for Package 003. Package 004 contract authority is a separate permission family and is documented in [`33-contract-formation.md`](33-contract-formation.md).

## 13. Tenant isolation

All estimate, quotation, response and conversion queries carry active `organisation_id`. Foreign quotation public IDs are masked as not found. Project creation uses the active organisation as `owning_organisation_id`, and source-estimate/project links use same-tenant composite foreign keys.

The conversion does not turn tenant-private CRM identity into a platform-global identity.

## 14. Audit evidence

Commercial audit coverage includes estimate creation/build-up/finalisation, quotation creation/draft/tax/narrative/issue/responses and project conversion.

Conversion adds:

```text
commercial.quotation.converted_to_project
project.created_from_quotation
```

Both point to the created project context and preserve quotation/response provenance in their change summaries.

## 15. Validation contract

The permanent application CI gate must prove:

```text
Dbmate migration stream applies to MySQL 8.4
application schema = 344 tables / 749 FKs / 429 CHECK constraints
kysely-codegen produces no uncommitted drift
real-MySQL integration suite passes
svelte-check = 0 errors / 0 warnings
```

The conversion integration suite additionally covers:

- commercial conversion authority and `project.create` are independently required;
- exact accepted/issued version requirement;
- one accepted response → one proposed project;
- quotation and source-estimate project linkage;
- owner organisation participation and converting-member scope;
- conversion ledger provenance;
- audit evidence;
- retry idempotency;
- unaccepted-version rejection;
- cross-tenant quotation masking.

## 16. Deliberate exclusions / downstream boundary

Not claimed implemented in Package 003:

- estimate revision/version-2 creation;
- quotation revision/version-2 creation and supersession;
- quotation withdrawal;
- customer optional-line selection/acceptance;
- sales catalogue administration UI;
- tax-category/rate administration UI;
- PDF quotation rendering;
- production outbound quotation email delivery;
- inferred customer project participation;
- project site creation from quotation/CRM addresses.

The downstream boundary is now explicit:

```text
Proposed Project created from accepted quotation
        ↓
Package 004 controlled Contract formation      # implemented separately
        ↓
contract amendments / delivery / invoicing     # later controlled workflows
```

Package 003 remains authoritative for the accepted quotation and project-conversion provenance; Package 004 consumes that provenance without changing the historical sales record.
