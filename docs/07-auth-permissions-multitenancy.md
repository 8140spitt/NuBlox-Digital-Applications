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

## 4. Current permission catalogue

### Organisation administration

```text
organisation.manage
member.invite
member.manage
```

### Projects

```text
project.create
project.view
project.manage
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
```

### CRM

```text
crm.view
crm.manage
crm.party.manage
crm.contact.manage
crm.opportunity.manage
crm.activity.manage
```

### Commercial sales

```text
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
commercial.quotation.convert
```

### Package 004 contracts

```text
contract.view
contract.manage
contract.create
contract.draft.manage
contract.issue
contract.execute
contract.amendment.create
contract.amendment.draft.manage
contract.amendment.issue
contract.amendment.decide
```

### Package 004 finance

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
```

`finance.manage` is the same-domain umbrella for finance granular keys. It never crosses into commercial or contract authority.

Package 004F statement/aging reads use `finance.view`.

Package 004G+ collections evidence additionally requires `finance.collections.view` or `finance.manage` fallback.

Package 004I credit-control workspace/details require `finance.view` plus `finance.credit_control.view` or `finance.manage` fallback. A commercial/contract actor may receive a masked blocked/clear decision without receiving finance values.

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

Relevant broad authority includes:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

For Package 004I they also receive all four granular credit-control keys explicitly.

### Manager

Manager receives delegated member, project and CRM party/contact authority, including `project.create`, but does not automatically receive commercial, contract or finance authority.

### Finance/Commercial

Default finance/credit responsibilities include ordinary billing, invoice preparation/issue, credit notes, payment/allocation, collections and:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
```

Finance/Commercial deliberately does **not** receive:

```text
finance.manage
finance.invoice.void
finance.credit_control.override
commercial.manage
commercial.quotation.convert
project.create
contract.manage
```

The role may maintain limit policy and place/release stop-trading holds but cannot bypass those controls by default.

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

Package 004I therefore persists this exact split for both existing and future organisations:

```text
Owner/Admin         → view + policy manage + hold manage + override
Finance/Commercial → view + policy manage + hold manage
```

## 7. Organisation administration authority

```text
member.invite
    → invitation lifecycle

member.manage
    → member lifecycle
    → member-to-role assignments

organisation.manage
    → role definitions
    → role-to-permission grants
    → full organisation administration
```

Administrative services enforce delegation ceilings, self-mutation restrictions, manager protection, cross-tenant rejection and final-manager lockout protection.

## 8. Domain access principles

Normal CRM, commercial, contract and finance reads require active membership, the relevant read permission and same-tenant record ownership. Mutations additionally require operation-specific granular authority or the same-domain umbrella plus lifecycle/business policy.

Foreign public IDs are tenant-masked where disclosure would leak another organisation's record identity.

Project contextual roles classify context and never grant application authority.

## 9. Accepted quotation → project conversion

Conversion requires:

```text
(commercial.quotation.convert OR commercial.manage)
AND project.create
AND exact issued + locked quotation version
AND accepted response for that exact version
AND source-estimate/project provenance policy
AND Package 004I credit-control decision
```

`quotation_project_conversions` remains authoritative idempotency/provenance evidence.

### Package 004I credit gate

The service derives:

```text
Current Receivable
= issued invoice gross
− issued credit-note gross
− active payment allocations

Quotation Commitment
= accepted non-optional line gross
+ stored quotation-item tax amounts

Projected Exposure
= Current Receivable + Quotation Commitment
```

Conversion is blocked when:

```text
active customer credit hold
OR
projected exposure > enabled currency credit limit
```

An already-converted accepted response is returned idempotently before a fresh credit gate so retry cannot create duplicate override evidence.

## 10. Contract access and execution

Normal contract reads require active membership, `contract.view` and same-tenant contract ownership. Mutations require the granular contract key or `contract.manage` fallback plus lifecycle policy.

Contract draft management and issue remain available under a credit hold because they are pre-execution preparation/evidence boundaries.

Contract **execution** additionally passes Package 004I credit control when an executed client CRM party is available:

```text
Contract Commitment
= Σ issued contract-version value components

Projected Exposure
= Current Receivable + Contract Commitment
```

Execution is blocked by the same active-hold / projected-limit policy before execution/signatory evidence is inserted and before the contract becomes active.

## 11. Finance read and mutation boundary

Normal finance reads require:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND finance record organisation_id = active tenant
```

Finance mutations require the granular finance permission or `finance.manage` fallback plus record/lifecycle/business policy.

Foreign finance public IDs are tenant-masked after the caller passes the relevant permission boundary.

## 12. Authoritative receivable model

NuBlox does not persist a second editable current balance for reporting, collections or credit control.

For one issued invoice:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Customer/currency receivable is the sum of positive issued invoice outstanding positions. Voided invoices contribute no exposure. Unallocated cash does not reduce customer receivable until allocated.

`receivable-ledger.ts` is shared by invoice-position and credit-control services.

## 13. Credit-control read authority

The full credit-control workspace/details require:

```text
active membership
AND finance.view
AND (finance.credit_control.view OR finance.manage)
AND same-tenant customer scope
```

A user with commercial/project/contract authority but without this finance read boundary may see:

```text
blocked / clear
active-hold reason category
limit-breach reason category
whether that actor may override
```

but current receivable, commitment, projected exposure and limit amounts remain masked.

## 14. Credit-limit policy authority

```text
finance.credit_control.policy.manage OR finance.manage
AND active same-tenant customer
AND valid currency
AND positive enabled limit
AND explicit reason
```

Each set/revise/disable action creates a new `receivable_credit_policy_revisions` row. Past policy is not overwritten.

A policy identity is unique per tenant + customer + currency.

## 15. Credit-hold authority

```text
finance.credit_control.hold.manage OR finance.manage
AND active same-tenant customer/hold
AND explicit reason
```

Hold lifecycle:

```text
active → released
```

One active hold is permitted per customer. Repeated placement while active is idempotent. Release retains the original placement evidence and adds release actor/time/reason.

A hold is customer-wide and blocks the named new-commitment boundaries regardless of currency.

## 16. Credit-control override authority

Exceptional continuation requires:

```text
finance.credit_control.override OR finance.manage
AND an actual active hold or projected limit breach
AND explicit non-empty override reason
```

Permission precedence is critical:

```text
explicit member deny on finance.credit_control.override
    > finance.manage fallback
```

Therefore broad finance authority cannot bypass a deliberate member-level override prohibition.

Override evidence snapshots:

```text
customer
workflow + subject
currency
current receivable
proposed commitment
projected exposure
applicable limit/hold
reason
authorising member/time
```

Override evidence is created **inside the same transaction** as quotation conversion or contract execution. If the business transaction fails, the override rolls back.

## 17. Credit-control concurrency policy

A new commitment must not race an invoice becoming issued.

At enforcement the service serializes on:

```text
customer party
+
all invoice financial_documents for that customer/currency
```

It then re-derives exposure from issued invoices only.

This gives a deterministic order between invoice issue and the new-commitment gate without making invoice issue itself forbidden by the hold.

## 18. Operations deliberately allowed under a hold

A credit hold is stop-**new-trade** policy, not a freeze on receivable administration.

Therefore Package 004I continues to allow the appropriately authorised workflows for:

```text
invoice issue for existing work
credit notes / exceptional correction
payment receipt
payment allocation/reversal
collections actions/reminders
```

These actions bill, correct, settle or manage existing exposure rather than create a new customer commitment.

## 19. Cross-domain separation

```text
commercial.manage cannot set/release/override finance credit control
contract.manage cannot set/release/override finance credit control
finance.manage cannot mutate contracts or quotations by itself
```

The underlying commercial/contract permission remains required for the business action. Credit override authority only removes the additional finance stop; it does not grant project creation, quotation conversion or contract execution authority.

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
- quotation conversion and project provenance;
- contract formation/execution/amendment integrity;
- invoice/credit/payment/allocation receivable integrity;
- receivable reporting and collections controls;
- Package 004H dunning policy/reminder evidence;
- Package 004I four-permission availability;
- Owner/Admin vs Finance/Commercial persisted role parity for existing and future organisations;
- append-only credit-limit revision history;
- idempotent hold placement and controlled release;
- authoritative utilisation with no used-credit balance;
- exact-limit projection allowed;
- below-limit current balance + over-limit proposed commitment blocked;
- quotation conversion hold/limit enforcement and masked finance details;
- contract issue allowed while execution remains gated;
- reasoned override evidence and transactional rollback;
- explicit override deny precedence over `finance.manage`;
- serialization against concurrent draft→issued invoice changes;
- foreign-tenant credit-control masking;
- zero generated Kysely drift;
- Svelte/TypeScript diagnostics.

Package 004I release target:

```text
19 production migrations applied / 0 pending
356 tables / 789 foreign keys / 459 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
26 integration files / 117 real-MySQL tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.
