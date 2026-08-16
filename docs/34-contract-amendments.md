# 34 — Controlled Contract Amendments

## 1. Purpose

This boundary activates the post-execution amendment structures already defined by **Package 004 — Contracts and Finance**.

It extends the implemented contract chain:

```text
Executed Contract Baseline
        ↓
Draft Contract Amendment
        ├── descriptive scope / terms change
        ├── signed value adjustment(s)
        └── key-date change(s)
        ↓
Issue / freeze
        ↓
Agreed | Rejected | Withdrawn
```

The executed baseline remains immutable. Contract changes are new controlled records rather than edits to the executed contract version.

## 2. Application surfaces

Amendments are exposed from:

```text
/contracts/[contractPublicId]
/contracts/[contractPublicId]/amendments/[amendmentPublicId]
```

The contract workspace lists historical amendments, displays the derived executed/current value position, and allows an authorised user to create a draft amendment only when the contract is active and has an executed baseline.

The amendment workspace exposes draft detail, signed value adjustments, key-date changes, issue and decision controls.

## 3. Permission family

The existing Package 004 umbrella remains:

```text
contract.manage
```

The amendment slice adds granular delegation keys:

```text
contract.amendment.create
contract.amendment.draft.manage
contract.amendment.issue
contract.amendment.decide
```

Permission resolution follows the established NuBlox rule:

1. resolve the granular key first;
2. only when the granular decision is default-deny/no explicit decision, evaluate `contract.manage` as the umbrella fallback;
3. an explicit granular member deny cannot be bypassed by the umbrella.

`commercial.manage` does not grant amendment authority.

Owner/Administrator already receive the explicit Package 004 `contract.manage` umbrella through the standard role policy. The granular amendment keys exist for narrower future/custom delegation without changing the standard-role bootstrap contract.

## 4. Eligibility

An amendment may only be created when:

- the actor has active organisation membership;
- the actor can view the contract;
- the actor has amendment-create authority;
- the contract belongs to the active tenant;
- the contract lifecycle is `active`;
- an executed contract version exists.

A draft or merely issued contract is not an amendment baseline.

## 5. Normalised data model

The implementation uses the existing Package 004 structures:

```text
contract_amendments
    ↓
contract_amendment_value_adjustments
    ↓
contract_amendment_key_date_changes
```

No parallel amendment ledger or editable current-contract-value field is introduced.

`contract_amendments` carries stable amendment identity and lifecycle evidence. Value and date changes remain repeating child rows in 3NF.

## 6. Amendment lifecycle

The implemented lifecycle is:

```text
Draft → Issued → Agreed
            ├──→ Rejected
            └──→ Withdrawn
Draft ─────────→ Withdrawn
```

### Draft

While draft and authorised, users may:

- change amendment type, title, description and effective date;
- add/remove signed value adjustments;
- add/remove key-date changes.

### Issue

Issue freezes the amendment and records:

```text
lifecycle_status = issued
issued_by_member_id
issued_at
```

Issued amendments reject ordinary draft mutation.

Before issue, the domain service requires:

- a non-null effective date; and
- substantive change evidence through descriptive narrative and/or value/date changes.

Requiring the effective date before issue prevents an immutable issued amendment from entering a state that cannot subsequently satisfy the agreement invariant.

### Agreement / rejection

Only an issued amendment can be agreed or rejected.

The decision records:

```text
decided_by_member_id
decided_at
lifecycle_status = agreed | rejected
```

Agreement revalidates the amendment effective date, matching the Package 004 database invariant that an agreed amendment must have one.

### Withdrawal

A draft or issued amendment may be withdrawn. Withdrawal preserves the amendment and any prior issue evidence; it does not delete commercial history.

## 7. Signed value adjustments

Amendment value adjustments use `DECIMAL(19,4)` and the same fixed-precision decimal parsing used elsewhere in the commercial domain.

Positive values increase contract value. Negative values reduce contract value. Zero adjustments are rejected.

Examples:

```text
+250.0000  additional instructed scope
-50.0000   released contingency
```

JavaScript binary floating-point arithmetic is not used for authoritative contract value calculations.

## 8. Current contract value

The authoritative conceptual rule remains:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Draft, issued, rejected and withdrawn amendment values do **not** alter current contract value.

The UI derives and presents:

- executed baseline value;
- total agreed adjustment;
- current contract value.

These remain derived values, not independently editable headers.

## 9. Key-date changes

Amendments may carry replacement dates for Package 004 key-date types.

The amendment row records the changed date as a new contractual fact. It does not overwrite the executed baseline `contract_version_key_dates` record.

A later effective-date resolver can derive the current contractual date by applying agreed amendments over the executed baseline in agreement/effective order.

## 10. Audit evidence

The slice writes audit events for:

```text
contract.amendment.created
contract.amendment.draft.updated
contract.amendment.value.added
contract.amendment.value.removed
contract.amendment.key_date.added
contract.amendment.key_date.removed
contract.amendment.issued
contract.amendment.agreed
contract.amendment.rejected
contract.amendment.withdrawn
```

Audit events retain the acting tenant, user/member, correlation ID, contract project context where present, and amendment public identity.

## 11. Tenant and security boundary

Every amendment query is scoped by `organisation_id` and contract identity.

A matching amendment public ID from another tenant is not proof of access and is masked as not found.

Read-only contract access does not imply mutation authority.

## 12. Validation contract

The amendment integration suite proves:

- active executed baseline eligibility;
- pre-execution amendment rejection;
- signed positive and negative value adjustments;
- draft value/date changes do not alter current contract value;
- read-only mutation denial;
- foreign-tenant identity masking;
- immutable issued amendments;
- refusal to issue without an effective date;
- agreement changes derived current contract value;
- rejected/withdrawn amendments remain historical evidence without changing current value.

The repository-level MySQL 8.4 migration/schema/type/integration/Svelte gate remains authoritative before merge.

## 13. Deliberate exclusions / next increments

Not claimed implemented by this slice:

- contract version 2+ replacement/supersession;
- amendment document/PDF rendering;
- amendment recipient/dispatch ledger beyond Package 004 issue fields;
- production outbound amendment email/e-sign workflow;
- customer portal decision capture;
- automatic project lifecycle changes;
- automatic Package 009 variation creation;
- invoice generation from an amendment;
- operational accounts-receivable workflows.

The next Package 004 boundary after controlled amendments is **operational accounts receivable**: billing settings, draft invoice, immutable invoice issue, payment receipt and allocation.
