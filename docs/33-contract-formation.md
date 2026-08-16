# 33 — Controlled Contract Formation

## 1. Purpose

This application boundary activates the **contract-formation half of Package 004 — Contracts and Finance** without activating invoicing, payments or later Package 004 finance workflows.

It continues the implemented sales/project chain:

```text
CRM Opportunity
    ↓
Estimate
    ↓
Final Estimate Version
    ↓
Quotation
    ↓
Issued + accepted Quotation Version
    ↓
Proposed Project
    ↓
Controlled Contract Formation
    ↓
Draft Contract Version 1
    ↓
Issue + immutable issue evidence
    ↓
Execution + signatory evidence
    ↓
Active Contract
    ↓
Controlled Contract Amendments (see docs/34-contract-amendments.md)
```

Project lifecycle remains independent. Executing a contract does **not** automatically move a project from `proposed` to `active`.

## 2. Application surfaces

```text
/contracts
/contracts/new?project=[projectPublicId]
/contracts/[contractPublicId]
```

`/contracts` shows tenant contract records, accepted quotations still awaiting controlled project conversion, and proposed projects created from accepted quotations that are eligible for controlled contract formation.

`/contracts/new` exposes the exact accepted-quotation/project provenance before creation and creates one draft contract/version from that source.

`/contracts/[contractPublicId]` exposes version parties, baseline value components, key dates, issue evidence and execution evidence. Draft mutation is disabled after issue. Once executed, it also exposes the controlled amendment history and amendment creation entry point defined in `docs/34-contract-amendments.md`.

## 3. Permission family

Package 004 contract permissions are:

```text
contract.view
contract.manage                  # broad Package 004 umbrella
contract.create
contract.draft.manage
contract.issue
contract.execute
contract.amendment.create
contract.amendment.draft.manage
contract.amendment.issue
contract.amendment.decide
```

`contract.manage` is the umbrella fallback for granular Package 004 contract mutations. Contract authority is deliberately independent from the Package 003 `commercial.*` family; an existing custom role with `commercial.manage` does not silently acquire contract creation, issue, execution or amendment rights.

Standard-role defaults remain:

- Owner / Administrator receive `contract.view`, `contract.manage` and the first-slice formation granular keys through organisation bootstrap;
- `contract.manage` also supplies broad amendment authority through the established umbrella semantics;
- Finance/Commercial receives `contract.view` only;
- Manager / Member/Professional / Field Worker / Read Only receive no automatic contract authority.

Granular amendment keys are available for narrower custom delegation. Within the contract family, granular member decisions are resolved before the `contract.manage` umbrella, so an explicit granular deny cannot be bypassed by the umbrella.

Contract formation from a project additionally requires `project.view` and exact active project-member scope because the source project is the controlled formation context.

## 4. Source provenance and idempotency

A quotation-derived contract retains:

```text
contracts.project_id
contracts.opportunity_id
contracts.source_quotation_response_id
```

The source response must be the exact accepted response that produced the project through `quotation_project_conversions`. The referenced quotation version must still be `issued` and locked.

Formation locks the source project row before checking for an existing project + accepted-response contract. That serialises this application path without introducing a database uniqueness rule that would incorrectly prohibit future legitimate multiple-contract projects.

A retry for the same project and accepted response returns the already-created contract.

## 5. Customer identity and snapshots

The customer remains the tenant-owned Package 002 CRM party referenced by the accepted quotation.

Version 1 creates a `client` row in `contract_version_parties`. Its display identity comes from the immutable quotation customer snapshot where available, falling back to the live CRM display name only when the historical snapshot is unavailable.

Quotation customer snapshot addresses are copied into `contract_version_party_addresses` so later CRM edits cannot rewrite the formed contract evidence.

The tenant NuBlox organisation is **not** silently duplicated into CRM as a synthetic self-party. `contracts.organisation_id` remains the authoritative tenant/contract owner. A future explicit legal-entity/self-party design can add the internal contracting party without corrupting CRM identity.

## 6. Initial contract value

Formation creates one `base_scope` value component from the accepted quotation's non-optional net lines:

```text
accepted included quotation line net
= quantity × unit_rate

initial contract base scope
= Σ accepted included quotation line net
```

The calculation reuses Package 003 scaled-`BigInt` decimal arithmetic. Authoritative money remains four decimal places and does not use JavaScript binary floating point.

This initial value is contract baseline evidence, not an invoice or accounting posting.

## 7. Draft lifecycle

The first application slice creates:

```text
contracts.lifecycle_status = draft
contract_versions.version_number = 1
contract_versions.version_status = draft
```

While draft and authorised, users may:

- edit version title/customer reference;
- add/remove contract value components;
- add/remove key dates.

The accepted customer party and source provenance are not editable through the first slice.

## 8. Issue lifecycle

Issue requires contract issue authority, a draft version, at least one contract party and at least one contract value component.

Issue atomically:

1. locks version 1;
2. records `locked_by_member_id` and `locked_at`;
3. changes version status to `issued`;
4. changes logical contract lifecycle to `under_review`;
5. creates `contract_issue_events` evidence;
6. creates recipient evidence;
7. appends an audit event.

No production outbound email or e-sign provider is claimed. Delivery channels are evidence of the selected issue mechanism only.

Issued versions reject ordinary draft mutation.

## 9. Execution lifecycle

Execution requires contract execution authority, exact version status `issued`, lock evidence, logical contract lifecycle `under_review`, and no prior execution event.

Execution records one `contract_execution_events` row and signatory evidence, changes the exact version to `executed`, and changes the logical contract to `active`.

The execution timestamp must include an explicit timezone before it crosses the server boundary. The UI converts the user's browser-local date/time to an ISO UTC instant.

Execution does not:

- activate the project;
- create a project participant;
- create an invoice;
- create a payment/ledger entry;
- infer another platform organisation from the CRM customer.

Post-execution change is handled by controlled amendment records rather than editing the executed version.

## 10. Audit actions

Formation/execution records:

```text
contract.created_from_accepted_quotation
contract.draft.updated
contract.value_component.added
contract.value_component.removed
contract.key_date.added
contract.key_date.removed
contract.issued
contract.executed
```

Amendment audit actions are specified separately in `docs/34-contract-amendments.md`.

## 11. Validation contract

The permanent CI gate must continue to prove:

```text
Dbmate production migration stream applies to MySQL 8.4
application schema = 344 tables / 749 FKs / 429 CHECK constraints
kysely-codegen produces no uncommitted drift
real-MySQL integration suite passes
svelte-check = 0 errors / 0 warnings
```

The Package 004 formation suite additionally covers:

- exact accepted-response/project provenance;
- initial base-scope value from accepted quotation lines;
- copied customer/address evidence;
- retry idempotency;
- contract permission separation;
- immutable issued versions;
- execution/signatory evidence;
- independent project lifecycle;
- cross-tenant masking.

## 12. Deliberate exclusions / next increments

Not claimed implemented here:

- contract version 2+ revision/supersession;
- contract withdrawal;
- multiple contract parties beyond the accepted quotation customer;
- document/PDF rendering;
- production contract email/e-sign delivery;
- automatic project activation;
- invoices, credit notes, payments or allocations.

Controlled post-execution amendments are now implemented in `docs/34-contract-amendments.md`.

The next Package 004 boundary after amendments is **operational accounts receivable**: billing settings, draft invoice, immutable invoice issue, payment receipt and allocation.
