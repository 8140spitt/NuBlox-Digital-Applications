# 34 — Controlled Contract Amendments

## 1. Purpose

This boundary activates the post-execution amendment structures already defined by **Package 004 — Contracts and Finance**.

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

```text
/contracts/[contractPublicId]
/contracts/[contractPublicId]/amendments/[amendmentPublicId]
```

The contract workspace lists amendment history and derived executed/current value. The amendment workspace exposes draft details, signed value adjustments, key-date changes, issue and decision controls.

## 3. Permission family

```text
contract.manage
    ├─ contract.amendment.create
    ├─ contract.amendment.draft.manage
    ├─ contract.amendment.issue
    └─ contract.amendment.decide
```

The granular key is resolved before `contract.manage`. Explicit granular member deny cannot be bypassed by the umbrella. `commercial.manage` and `finance.manage` do not grant amendment authority.

Existing Owner/Administrator roles receive the granular amendment keys from the Package 004B forward migration. `OrganisationBootstrapService` now persists the same granular rows for future Owner/Administrator roles as well as their `contract.manage` umbrella, preserving migration/bootstrap parity.

## 4. Eligibility

An amendment may be created only when:

- the actor has active organisation membership;
- the actor has `contract.view`;
- the actor has amendment-create authority;
- the contract belongs to the active tenant;
- the logical contract is `active`;
- an executed contract version exists.

A draft or merely issued contract is not an amendment baseline.

## 5. Normalised model

The implementation uses the existing Package 004 structures:

```text
contract_amendments
contract_amendment_value_adjustments
contract_amendment_key_date_changes
```

No parallel amendment ledger or editable current-contract-value field is introduced. Stable amendment identity/lifecycle remains on the parent; repeating value/date changes remain relational child rows.

## 6. Lifecycle

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

Issue records `issued_by_member_id` / `issued_at`, changes the amendment to `issued` and freezes ordinary draft mutation.

Before issue the service requires:

- a non-null effective date; and
- substantive change evidence through narrative and/or value/date changes.

Requiring the effective date before issue prevents an immutable issued amendment from entering a state that cannot satisfy the agreement invariant.

### Agreement / rejection

Only an issued amendment can be agreed or rejected. The decision records `decided_by_member_id`, `decided_at` and the final lifecycle state. Agreement revalidates the effective date.

### Withdrawal

Draft or issued amendments may be withdrawn. Withdrawal preserves the amendment and any prior issue evidence rather than deleting history.

## 7. Signed value adjustments

Amendment values use `DECIMAL(19,4)` and the same fixed-precision decimal boundary used elsewhere in NuBlox commercial calculations.

```text
+250.0000  additional instructed scope
-50.0000   released contingency
```

Positive values increase contract value; negative values decrease it; zero is rejected. JavaScript binary floating-point arithmetic is not authoritative.

## 8. Current contract value

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Draft, issued, rejected and withdrawn amendment values do not change current contract value. The executed baseline, agreed adjustment total and current value are derived rather than independently editable.

Package 004C invoices use this same derived current contract value as invoice-workspace context; invoice issue does not rewrite it.

## 9. Key-date changes

Amendments carry replacement dates as new contractual facts. They do not overwrite executed baseline `contract_version_key_dates` rows.

A future current-date resolver may apply agreed amendments over the baseline by agreed/effective ordering without compromising historical evidence.

## 10. Audit evidence

The slice writes:

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

Audit events retain acting tenant, user/member, correlation ID, project context where present and amendment public identity.

## 11. Tenant boundary

Every amendment query is scoped by `organisation_id` and contract identity. A matching foreign-tenant amendment public ID is not proof of access and is masked as not found.

Read-only contract access does not imply amendment mutation authority.

## 12. Validation contract

The amendment suite proves:

- active executed baseline eligibility;
- pre-execution rejection;
- signed positive/negative adjustments;
- draft changes do not alter current value;
- read-only mutation denial;
- foreign-tenant identity masking;
- immutable issued amendments;
- effective-date-before-issue guard;
- agreement changes current contract value;
- rejected/withdrawn history does not change current value.

## 13. Subsequent Package 004 work

The first operational accounts-receivable slice described in [`35-accounts-receivable-invoices.md`](35-accounts-receivable-invoices.md) is now implemented: billing settings, contract-anchored draft invoices and immutable invoice issue.

Still not claimed by either slice:

- contract version 2+ replacement/supersession;
- amendment PDF/dispatch/e-sign production workflow;
- customer portal amendment decisions;
- automatic Package 009 variation creation;
- automated valuation/application-to-invoice conversion;
- credit notes and controlled invoice reversal/void workflow;
- payment receipt and allocation;
- customer statements/aged receivables;
- general-ledger posting.

The next finance boundary should preserve the same evidence rule: **issued financial documents are immutable facts; corrections and cash application create controlled new records rather than editing history.**
