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

For Package 004J they receive all seven bad-debt keys explicitly.

### Finance/Commercial

Finance/Commercial receives ordinary billing, invoice, credit-note, payment/allocation, collections, credit-control administration and delegated bad-debt operations.

Package 004J defaults:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

It deliberately does **not** receive:

```text
finance.manage
finance.invoice.void
finance.credit_control.override
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
```

This separates doubtful-debt assessment and later recovery operations from actual loss recognition/reversal.

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

Package 004J persists:

```text
Owner/Admin
    → all seven bad-debt keys

Finance/Commercial
    → view
    → case manage
    → recommend
    → recovery record
    → recovery reverse
    ✕ write-off authorise
    ✕ write-off reverse
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

NuBlox does not persist a second editable current balance for reporting, collections, credit control or bad-debt processing.

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

## 11. Package 004J bad-debt read authority

Full bad-debt workspace access requires:

```text
finance.view
AND (finance.bad_debt.view OR finance.manage)
AND same-tenant case / invoice / payment evidence
```

A caller who lacks the read boundary does not receive case, recommendation, write-off, recovery or payment-capacity details.

## 12. Bad-debt case authority

```text
finance.bad_debt.case.manage OR finance.manage
AND issued same-tenant invoice
AND positive receivable remaining
```

One open bad-debt case is allowed per tenant/invoice. Repeated case creation for the same currently open invoice assessment is idempotent.

Opening a case does **not** alter receivable.

## 13. Write-off recommendation authority

```text
finance.bad_debt.recommend OR finance.manage
AND open same-tenant bad-debt case
AND recommendation amount > 0
AND recommendation amount <= current invoice outstanding
```

Recommendation evidence is immutable and does not change receivable.

The service locks customer then invoice and re-derives current receivable before recording the recommendation.

## 14. Write-off authorisation authority

```text
finance.bad_debt.write_off.authorise OR finance.manage
AND open case
AND exact unused recommendation
AND recommendation <= current invoice outstanding
AND explicit authorisation reason
AND explicit tax-treatment policy
```

Supported Package 004J tax-treatment evidence:

```text
no_tax_adjustment
separate_tax_adjustment_required
```

Authorisation creates an additive `receivable_write_offs` fact. The invoice, credit-note and payment evidence remain unchanged.

An active write-off reduces operational receivable immediately through the shared derivation.

Explicit member deny on `finance.bad_debt.write_off.authorise` overrides `finance.manage` fallback.

## 15. Write-off reversal authority

```text
finance.bad_debt.write_off.reverse OR finance.manage
AND active write-off
AND no active recovery against that write-off
AND explicit reversal reason
```

Reversal inserts additive `receivable_write_off_reversals` evidence. The original write-off is never deleted or edited.

A reversal restores the written-off amount to customer receivable.

## 16. Bad-debt recovery authority

```text
finance.bad_debt.recovery.record OR finance.manage
AND active write-off
AND existing non-reversed payment receipt
AND matching currency
AND recovery <= remaining write-off recovery capacity
AND recovery <= remaining payment capacity
AND explicit reason
```

Available payment is authoritative:

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

Recovery consumes existing cash capacity. It does **not** reopen or settle customer receivable because the debt was already removed by the write-off.

Ordinary payment reversal is blocked while active recovery usage exists.

## 17. Recovery reversal authority

```text
finance.bad_debt.recovery.reverse OR finance.manage
AND active recovery
AND explicit reason
```

Recovery reversal inserts additive evidence and restores payment capacity. It does not change customer receivable.

## 18. Reporting semantics

Historical receivable reporting is event-correct:

```text
write-off authorised → statement credit
write-off reversed   → statement debit
recovery             → no customer-receivable movement
recovery reversed    → no customer-receivable movement
```

Aging subtracts write-offs active at the selected reporting cutoff. A later write-off reversal therefore does not rewrite an earlier historical statement.

## 19. Cross-domain separation

```text
commercial.manage cannot authorise finance write-off
contract.manage cannot authorise finance write-off
finance.manage cannot mutate contracts or quotations by itself
```

Bad-debt authority never grants invoice issue, credit-note, payment, contract or commercial authority outside the relevant finance/business permission family.

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
- Package 004J seven-permission availability;
- Package 004J Owner/Admin vs Finance/Commercial persisted-role parity;
- idempotent bad-debt case opening;
- recommendation amount revalidation;
- partial write-off reducing authoritative receivable;
- stronger write-off authorisation separation;
- recovery reducing available payment without reopening receivable;
- recovery/write-off/payment reversal ordering;
- explicit write-off-authority deny precedence over `finance.manage`;
- foreign-tenant bad-debt case masking;
- zero generated Kysely drift;
- Svelte/TypeScript diagnostics.

Package 004J release contract:

```text
20 production migrations applied / 0 pending
362 tables / 804 foreign keys / 465 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
full real-MySQL integration suite
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.
