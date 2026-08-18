# 07 — Authentication, Permissions and Multi-tenancy

## 1. Governing security model

NuBlox combines authentication, active tenant membership, organisation RBAC, member overrides, project scope, tenant-record scope and record-state/business policy.

> **Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

Careers/job titles configure professional context and feature relevance. They never grant application authority automatically.

CRM people/businesses remain distinct from NuBlox users, organisation members and platform organisations. Commercial, project, contract and finance workflows may reference or snapshot CRM identity without inferring platform identity.

## 2. Trust chain

```text
Better Auth identity
        ↓
auth_user_links
        ↓
active NuBlox user
        ↓
active organisation membership
        ↓
organisation roles + member overrides
        ↓
project membership scope where required
        ↓
tenant-record + lifecycle/business policy
```

The selected-organisation cookie is a selection hint only. Membership is revalidated before trusted tenant context is constructed.

## 3. Permission precedence

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For a granular operation with a same-domain umbrella:

```text
granular member deny
    > granular member allow / granular role grant
    > same-domain umbrella fallback
    > default deny
```

The umbrella is considered only when the granular key has no explicit member/role decision. An explicit granular deny cannot be bypassed.

Permission umbrellas never cross domains:

```text
commercial.manage ≠ contract authority
contract.manage   ≠ finance authority
finance.manage    ≠ commercial or contract authority
```

## 4. Current finance permission catalogue

```text
finance.view
finance.manage
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
finance.invoice.void
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
finance.collections.view
finance.collections.case.manage
finance.collections.action.record
finance.collections.promise.manage
finance.collections.dispute.manage
finance.collections.policy.manage
finance.collections.reminder.generate
finance.collections.reminder.dispatch
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
finance.tax_relief.view
finance.tax_relief.prepare
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
```

`finance.manage` is the same-domain umbrella for finance granular keys. It never grants commercial or contract authority.

Package 004F statement/aging reads use `finance.view`.

Collections require the relevant collections read/mutation keys or `finance.manage` fallback.

Credit-control workspace/details require `finance.view` plus `finance.credit_control.view` or `finance.manage` fallback.

Bad-debt workspace/details require:

```text
active membership
AND finance.view
AND (finance.bad_debt.view OR finance.manage)
AND same-tenant finance record scope
```

VAT bad-debt-relief workspace/details require:

```text
active membership
AND finance.view
AND (finance.tax_relief.view OR finance.manage)
AND same-tenant write-off / invoice / recovery / VAT evidence scope
```

## 5. Standard organisation roles

Every organisation receives:

```text
Owner
Administrator
Manager
Finance/Commercial
Member/Professional
Field Worker
Read Only
```

The founding member receives Owner only.

### Owner / Administrator

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular operational permissions.

For Package 004K they receive all eight tax-relief keys explicitly.

### Finance/Commercial

Finance/Commercial receives ordinary billing, invoice, credit-note, payment/allocation, collections, credit-control administration and delegated bad-debt operations.

Package 004J defaults remain:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

Package 004K adds only:

```text
finance.tax_relief.view
finance.tax_relief.prepare
```

It deliberately does **not** receive:

```text
finance.manage
finance.invoice.void
finance.credit_control.override
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
```

This keeps operational/source-evidence preparation distinct from stronger loss-recognition and statutory tax-recognition/correction evidence.

### Other roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority. Protected requests require active NuBlox user resolution and active organisation membership.

Forward migration grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations must remain aligned at the persisted role-permission-row level.

Package 004K persists:

```text
Owner/Admin
    → all eight tax-relief keys

Finance/Commercial
    → tax-relief view
    → tax-relief prepare
    ✕ authorise/reverse
    ✕ repayment record/reverse
    ✕ VAT-return posting/reverse
```

A dedicated real-MySQL bootstrap test verifies this split for newly created organisations.

## 7. Domain access principles

Normal CRM, commercial, contract and finance reads require active membership, the relevant read permission and same-tenant record ownership. Mutations additionally require operation-specific granular authority or the same-domain umbrella plus lifecycle/business policy.

Foreign public IDs are tenant-masked where disclosure would leak another organisation's record identity.

Project contextual roles classify context and never grant application authority.

## 8. Accepted quotation and contract credit gates

Accepted quotation conversion requires ordinary commercial/project authority plus the Package 004I credit-control decision. Contract execution requires ordinary contract authority plus the same finance gate where a client party is available.

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

An active hold or projected exposure greater than an enabled currency limit blocks the new commitment unless a separately authorised, reasoned override is recorded in the same business transaction.

Credit-control and invoice mutation use a canonical customer-first lock hierarchy and current/locking receivable reads.

## 9. Finance read and mutation boundary

Normal finance reads require:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND finance record organisation_id = active tenant
```

Finance mutations require the granular finance permission or `finance.manage` fallback plus record/lifecycle/business policy.

Foreign finance public IDs are tenant-masked after the caller passes the relevant permission boundary.

## 10. Authoritative receivable model

NuBlox does not persist a second editable current balance for reporting, collections, credit control, bad-debt or VAT-relief processing.

For one issued invoice:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

Customer/currency receivable is the sum of positive issued-invoice outstanding positions. Voided invoices contribute no exposure. Unallocated cash does not reduce customer receivable until allocated.

`receivable-ledger.ts` is the shared calculation boundary used across invoice position, payment allocation, receivable reporting and credit control.

## 11. Package 004J bad-debt authority

Bad-debt access requires finance read authority plus `finance.bad_debt.view` or `finance.manage` and same-tenant evidence scope.

Case management, recommendation, write-off authorisation/reversal and recovery/reversal each use separate granular keys with same-domain umbrella fallback.

Write-off authorisation records one explicit tax-treatment policy:

```text
no_tax_adjustment
separate_tax_adjustment_required
```

An active write-off changes operational receivable; recommendation and recovery do not. Recovery consumes payment capacity only.

Package 004K adds dependency guards:

- a write-off cannot be reversed while an authorised non-reversed VAT relief claim remains active;
- a recovery cannot be reversed while active VAT repayment evidence remains linked to it.

## 12. Package 004K tax-relief preparation authority

```text
finance.tax_relief.prepare OR finance.manage
AND active write-off marked separate_tax_adjustment_required
AND same-tenant issued source invoice
AND all eligibility attestations confirmed
AND exact source invoice VAT snapshot lines
AND prepared consideration within current write-off/source-tax capacity
```

Preparation does not itself claim statutory relief. It stores source-linked evidence for later stronger authorisation.

Where the issued invoice has a stored due date, that date is authoritative. The controlled service rejects an operator-supplied due date that differs from the issued invoice record.

The operator supplies consideration basis only. VAT relief amount is derived from the immutable source invoice tax snapshot.

## 13. Package 004K tax-relief authorisation authority

```text
finance.tax_relief.authorise OR finance.manage
AND exact prepared claim
AND active issued invoice
AND active separate-tax-adjustment write-off
AND current date within recorded eligibility/deadline window
AND current write-off capacity remains sufficient
AND current exact source-tax capacity remains sufficient
AND recalculated VAT matches persisted source evidence
AND explicit reason
```

Authorisation is a separate one-to-one additive fact. Explicit granular deny overrides `finance.manage` fallback.

Finance/Commercial does not receive this key by default.

## 14. Package 004K claim reversal authority

```text
finance.tax_relief.reverse OR finance.manage
AND authorised active claim
AND no active VAT-return posting for the claim
AND no active VAT repayment evidence
AND explicit reason
```

Reversal inserts `receivable_vat_bad_debt_claim_reversals`. The original preparation/authorisation remain immutable.

## 15. Package 004K recovery-repayment authority

```text
finance.tax_relief.repayment.record OR finance.manage
AND authorised active relief claim
AND exact active Package 004J recovery from the same write-off
AND recovered consideration <= unused recovery amount
AND recovered consideration <= remaining claim consideration
AND explicit reason
```

VAT repayment is service-derived proportionally from authorised claim VAT and claim consideration.

Repayment reversal requires `finance.tax_relief.repayment.reverse` or `finance.manage`; active VAT-return posting evidence must be reversed first.

Finance/Commercial receives neither repayment key by default.

## 16. Package 004K VAT-return posting authority

```text
finance.tax_relief.post OR finance.manage
AND active authorised relief claim or active VAT repayment
AND valid VAT period evidence
AND explicit reason
```

The service derives box and amount:

```text
relief claim     → Box 4, authorised claim VAT
relief repayment → Box 1, proportional repayment VAT
```

For a claim, the recorded VAT period must not predate eligibility or exceed the recorded claim deadline.

For a repayment, the VAT period must contain the actual `receivable_write_off_recoveries.recovered_at` receipt date.

The user cannot choose box or amount.

Posting reversal requires `finance.tax_relief.post.reverse` or `finance.manage` and creates additive reversal evidence.

This is VAT-return posting evidence only; the permission does not imply direct HMRC submission authority because no VAT-return/MTD provider boundary is implemented.

## 17. Package 004K external-condition attestations

Preparation requires explicit confirmation of:

```text
vat_accounted_and_paid
debt_not_sold_or_factored
selling_price_condition_met
relief_scheme_applicable
```

These are operator attestations. NuBlox does not infer or claim independent proof of external tax/legal facts it cannot establish from the tenant database.

## 18. Reporting semantics

Historical customer receivable reporting remains event-correct:

```text
write-off authorised → statement credit
write-off reversed   → statement debit
recovery             → no customer-receivable movement
VAT relief claim     → no customer-receivable movement
VAT relief repayment → no customer-receivable movement
```

VAT-relief evidence is accounting/tax evidence downstream of the operational receivable and does not create a second customer balance.

## 19. Cross-domain separation

```text
commercial.manage cannot authorise finance write-off or VAT relief
contract.manage cannot authorise finance write-off or VAT relief
finance.manage cannot mutate contracts or quotations by itself
finance.tax_relief.* does not imply direct HMRC submission or GL authority
```

Tax-relief authority never grants invoice issue, credit-note, payment, contract or commercial authority outside the relevant permission family.

## 20. Tenant-isolation rules

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- CRM, commercial, contract and finance reads/writes remain tenant-bounded.
- Matching public/surrogate IDs are never proof of access.
- Foreign tenant identities are masked where appropriate.
- Project reads require exact member scope.
- CRM identity is never promoted to platform identity by inference.
- Derived reports and credit utilisation preserve authoritative finance-event semantics rather than caching mutable balances.
- Caches, exports, files and future jobs must preserve tenant boundaries.

## 21. Release testing requirements

The real-MySQL release gate covers, at minimum:

- authentication and active-tenant resolution;
- explicit deny precedence and same-domain umbrella behavior;
- organisation bootstrap/invitation controls and standard-role parity;
- CRM/commercial/project/contract tenant isolation;
- quotation conversion and contract credit-control gating;
- contract formation/execution/amendment integrity;
- invoice/credit/payment/allocation receivable integrity;
- receivable reporting and collections controls;
- dunning policy/reminder evidence;
- credit-control policy/hold/override and concurrency behavior;
- Package 004J write-off/recovery lifecycle and dependency guards;
- Package 004K eight-permission availability;
- Package 004K Owner/Admin vs Finance/Commercial persisted-role parity;
- source-tax-linked claim preparation;
- issued-invoice due-date binding and future-supply-date rejection;
- six-month eligibility-window enforcement;
- source/write-off overclaim prevention;
- stronger tax-relief authorisation separation;
- explicit `finance.tax_relief.post` deny precedence over `finance.manage`;
- Box 4 claim posting evidence;
- proportional recovery VAT repayment;
- Box 1 posting-period binding to actual recovery receipt date;
- claim/posting/repayment/recovery/write-off reversal ordering;
- foreign-tenant VAT-relief identity masking;
- zero generated Kysely drift;
- Svelte/TypeScript diagnostics.

Package 004K release contract:

```text
22 production migrations applied / 0 pending
370 tables / 824 foreign keys / 473 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
32 integration files / 136 real-MySQL tests
tax-relief: 6 tests
tax-relief bootstrap parity: 1 test
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.
