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

The selected-organisation cookie is only a selection hint. Membership is revalidated before trusted tenant context is constructed.

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

### Package 004 operational finance

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
```

`finance.manage` is the same-domain umbrella for finance granular keys. It never crosses into commercial or contract authority.

Package 004F adds no separate receivables-reporting key; statements and aging use `finance.view`.

Package 004G adds a separate collections read key because collection-case evidence contains operational contact/commitment/dispute information beyond the underlying receivable report. Collections reads therefore require `finance.view` **and** `finance.collections.view` (or `finance.manage` as same-domain fallback for the collections key).

Package 004H adds three independently delegable automation keys: policy management, reminder generation and reminder dispatch. Their explicit separation prevents authority to perform routine collections operations from automatically becoming authority to redefine escalation thresholds/templates or trigger an external delivery side effect.

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

They also receive all released 004G collections and 004H automation granular keys explicitly. Existing organisations receive forward-migration rows and future organisations receive equivalent bootstrap rows.

### Manager

Manager receives delegated member, project and CRM party/contact authority, including `project.create`, but does not automatically receive commercial, contract or finance authority.

### Finance/Commercial

Default grants include:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
contract.view
finance.view
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
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
finance.collections.reminder.generate
finance.collections.reminder.dispatch
```

Finance/Commercial deliberately does **not** receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
finance.manage
finance.invoice.void
finance.collections.policy.manage
```

This role can perform ordinary AR/collections work and generate/dispatch controlled reminders, but cannot redefine collections policy by default. Exceptional invoice void and policy authoring remain Owner/Administrator/custom delegation boundaries.

### Other roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives Owner only.

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority. Protected requests require active NuBlox user resolution and active organisation membership.

Forward migration grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations must remain aligned at the persisted role-permission-row level. Package 004G keeps the five collections grants in parity; Package 004H additionally keeps Owner/Administrator policy+generation+dispatch and Finance/Commercial generation+dispatch in parity.

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

## 8. CRM access model

The CRM is tenant-private:

```text
active user
AND active organisation membership
AND effective CRM permission
AND record.organisation_id = active tenant
AND record-state policy
```

CRM parties remain separate from platform organisations/users/members/project participation. Foreign public IDs are masked as not found where disclosure would leak tenant information.

## 9. Commercial access model

Package 003 reads require active membership + `commercial.view` + same-tenant scope. Mutations additionally require the granular commercial key or `commercial.manage` fallback and valid document/version lifecycle.

Accepted quotation → project conversion is conjunctive:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
AND exact issued + locked quotation version
AND accepted response for that exact version
```

`quotation_project_conversions` remains authoritative idempotency/provenance evidence.

## 10. Package 004 contract access model

Normal contract reads require active membership, `contract.view` and same-tenant contract ownership. Mutations require the operation-specific granular key or `contract.manage` fallback plus lifecycle policy.

Quotation-derived formation additionally requires project visibility, exact active project-member scope and accepted quotation-conversion provenance.

Issued/executed contract versions reject ordinary draft mutation. Controlled amendments require an active contract with executed baseline; only agreed amendments affect the derived current contract value.

## 11. Operational finance read boundary

Normal finance-record reads require:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND finance record organisation_id = active tenant
```

Mutations require the granular finance permission or `finance.manage` fallback plus record/lifecycle policy.

Foreign finance public IDs are tenant-masked as not found after the caller passes the relevant finance permission boundary.

## 12. Billing and invoice authority

### Billing settings

```text
finance.billing.manage OR finance.manage
```

Customer billing settings are mutable preparation policy. They do not rewrite issued financial-document evidence.

### Invoice creation

```text
finance.invoice.create OR finance.manage
AND contract.view
AND same-tenant active contract
AND executed contract-version baseline
AND executed client party exists
```

### Draft management and issue

`finance.invoice.draft.manage OR finance.manage` maintains draft header/lines/tax selection.

`finance.invoice.issue OR finance.manage` requires valid draft/customer/due-date policy. Issue finalises due date, refreshes issue-date tax, snapshots customer/contact/address evidence, allocates the legal invoice number and freezes ordinary mutation.

## 13. Receivable-correction authority

### Credit notes

```text
finance.credit_note.create OR finance.manage
AND same-tenant issued invoice
AND positive remaining creditable value
```

Draft management and issue use their own granular keys with `finance.manage` fallback. Credit issue preserves source-line provenance and original applied-tax evidence and prevents cumulative over-crediting.

### Exceptional invoice void

```text
finance.invoice.void OR finance.manage
AND invoice status = issued
AND explicit void reason
AND no non-void credit-note history
AND no unreversed payment allocation
```

Void is stronger authority because it changes an already-issued legal document lifecycle. Finance/Commercial does not receive it by default.

## 14. Payment receipt and allocation authority

Payment receipt:

```text
finance.payment.create OR finance.manage
AND active payment method
AND positive amount
AND valid currency
```

Allocation:

```text
finance.payment.allocate OR finance.manage
AND same-tenant non-reversed payment
AND same-tenant issued invoice
AND payment currency = invoice currency
AND allocation > 0
AND allocation <= usable payment
AND allocation <= invoice outstanding
```

Authoritative balances are derived:

```text
Usable Payment
= Payment Amount
− Active Allocations

Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Allocation locks the payment and target invoice before recomputing both limits.

Allocation reversal and payment reversal each use dedicated granular keys under `finance.manage` and append correction evidence rather than rewriting/deleting original facts.

## 15. Customer-statement and aging access

Package 004F is a read-only finance view.

Access requires:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND same-tenant customer/finance records
```

The statement service derives customer-account movements from authoritative finance-event timestamps:

```text
invoice issue       → debit
credit-note issue   → credit
payment allocation  → credit
allocation reversal → debit
invoice void        → credit
```

A raw/unallocated payment is not treated as a customer receivable credit. Historical reports use the event state that existed at the selected cutoff. Statement day boundaries use the active tenant timezone. Currencies remain separated until an explicit FX/reporting-currency policy exists.

## 16. Collections read authority

Collection-case evidence is protected by a conjunctive read boundary:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND (finance.collections.view OR finance.manage)
AND same-tenant customer/case scope
```

`finance.view` alone is insufficient for collection-case actions, promises or disputes.

An explicit member deny on `finance.collections.view` cannot be bypassed by the `finance.manage` umbrella because the granular key is resolved first.

## 17. Collection-case authority

Opening, pausing, resuming and closing cases requires:

```text
finance.collections.case.manage OR finance.manage
```

Opening additionally requires a currently overdue positive receivable derived from Package 004F.

The service serialises the same-tenant customer and issued invoice documents before the final overdue revalidation and insertion. If an `open` or `paused` case already exists, case start is idempotent and returns that case.

Lifecycle:

```text
open ↔ paused → closed
```

Closing requires an explicit reason and is blocked while any promise or dispute remains open. Closed cases reject further ordinary mutation.

## 18. Collection-action authority

```text
finance.collections.action.record OR finance.manage
AND active same-tenant collection case
```

Normal user-recordable evidence types are:

```text
reminder
phone_call
note
```

Package 004G's manual evidence action does not itself prove outbound delivery. Package 004H successful reminder dispatch appends `reminder` action evidence only after the delivery boundary succeeds.

## 19. Promise-to-pay authority

```text
finance.collections.promise.manage OR finance.manage
AND active same-tenant collection case
AND promised amount > 0
AND valid currency
AND due date
```

If an invoice is linked:

```text
invoice organisation = active tenant
AND invoice customer = case customer
AND promise currency = invoice currency
```

Promise lifecycle:

```text
open → kept
open → broken
open → cancelled
```

A promise is operational evidence only. It does not create a payment, allocation or settlement.

## 20. Receivable-dispute authority

```text
finance.collections.dispute.manage OR finance.manage
AND active same-tenant collection case
AND reason
```

A disputed amount is optional; when supplied it must be positive and paired with a currency. An invoice link must belong to the same tenant and case customer, and a supplied currency must match the invoice currency.

Dispute lifecycle:

```text
open → resolved
open → withdrawn
```

A dispute does not alter invoice lifecycle, tax, outstanding balance or settlement state. Financial correction still requires the normal credit-note/void/payment workflow.

## 21. Collections policy authority

Policy authoring requires:

```text
finance.collections.policy.manage OR finance.manage
```

Policy versions use:

```text
draft → active → retired
```

Draft stages may be edited by an authorised policy manager. Activated versions are immutable through ordinary APIs. Activation requires at least one stage, contiguous stage sequence beginning at 1 and strictly increasing positive days-overdue triggers.

A new policy version does not rewrite a generated reminder from an earlier version.

## 22. Reminder generation and dispatch authority

### Generation

```text
finance.collections.reminder.generate OR finance.manage
AND collections read boundary
AND crm.view
AND open same-tenant collection case
AND active policy stage currently due
AND no configured suppression
AND resolvable same-tenant recipient email
```

`crm.view` is required because generation explicitly traverses CRM party/contact identity to select a recipient. It does not grant finance mutation authority by itself.

Generation creates an immutable pending reminder snapshot and sends nothing. Generation is idempotent for the same collection case + policy stage.

### Dispatch

```text
finance.collections.reminder.dispatch OR finance.manage
AND collections read boundary
AND same-tenant pending reminder
AND collection case still open
AND receivable still overdue
AND stage still due
AND no configured suppression
```

Dispatch revalidates the live receivable/suppression state before the external side effect. A failed delivery attempt is immutable evidence and leaves the reminder pending for retry; success marks the reminder sent and appends collection-action evidence.

An explicit member deny on `finance.collections.reminder.dispatch` overrides the `finance.manage` fallback.

Package 004H does not claim a background scheduler. Generation and dispatch remain explicit operations in the current boundary.

## 23. Cross-domain separation

```text
commercial.manage cannot issue/credit/void/allocate/collect finance records
contract.manage cannot issue/credit/void/allocate/collect finance records
finance.manage cannot mutate contracts or quotations
```

`crm.view` is required only for explicit CRM traversal such as payer/collections-recipient resolution. It never grants finance mutation authority. Project roles classify context and never grant application permissions.

## 24. Tenant-isolation rules

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- CRM, commercial, contract, amendment and finance reads/writes are tenant-bounded.
- Matching surrogate/public IDs are never proof of access by themselves.
- Foreign tenant record identities are masked where appropriate.
- Collections invoice links are additionally constrained to the collection-case customer.
- Reminder policy, generated reminder and delivery-attempt facts are organisation-scoped.
- Reminder recipient resolution uses same-tenant CRM party/contact relationships.
- Project reads require exact-member project scope.
- Project roles never grant application permissions.
- CRM identity is never promoted to platform identity by inference.
- Customer/document/reminder snapshots preserve evidence without creating platform identity.
- Derived reports preserve event-time and tenant-timezone semantics rather than caching mutable balances as authority.
- Collections/policy/reminder facts cannot become a shadow receivable ledger.
- Caches, search, exports, files and future scheduled jobs must preserve tenant boundaries.
- Privileged support access must be explicit and auditable.

## 25. Session requirements

Production session policy includes secure HttpOnly cookies, Secure transport, appropriate SameSite behavior, revocation/logout, rotation after privilege/authentication changes, idle/absolute expiry and MFA step-up where risk policy requires it.

## 26. Release testing requirements

The real-MySQL release gate covers, at minimum:

- authentication and active-tenant resolution;
- explicit deny precedence and same-domain umbrella behavior;
- organisation bootstrap/invitation controls and standard-role parity;
- CRM tenant isolation and granular authority;
- quotation conversion and project scope;
- contract formation/execution/amendment integrity;
- billing/invoice issue policy;
- credit-note provenance, original-tax preservation and over-credit prevention;
- exceptional invoice-void guards;
- payment receipt, allocation, reversal and over-allocation prevention;
- currency mismatch rejection;
- receivables reporting under `finance.view`;
- currency-separated aging and historical statement cutoff correctness;
- tenant-timezone statement periods and foreign-customer masking;
- collections read requiring both finance and collections read authority;
- only currently overdue accounts entering collections eligibility;
- idempotent/serialised active-case opening;
- immutable collection action evidence;
- same-customer invoice scoping for promises/disputes;
- promises/disputes leaving the receivable ledger unchanged;
- case closure blockers and closed-case immutability;
- collections automation role delegation and bootstrap parity;
- immutable active policy versions and sequential/increasing stage validation;
- reminder generation idempotency and immutable recipient/template snapshots;
- reminder generation creating no ledger/contact-delivery side effect;
- explicit reminder-dispatch deny overriding `finance.manage`;
- immutable failed-attempt evidence and controlled retry;
- stable message idempotency key across retries;
- current-promise/dispute suppression;
- overdue promise review;
- paused/closed case dispatch rejection;
- live receivable revalidation before dispatch;
- foreign-tenant collection/reminder masking;
- zero generated drift across both Kysely outputs;
- Svelte/TypeScript diagnostics.

The Package 004H executable code gate has proved:

```text
18 production migrations applied / 0 pending
352 tables / 778 foreign keys / 450 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts
22 integration files / 108 real-MySQL tests passed
finance collections automation suite: 8/8 passed
finance collections suite: 7/7 passed
finance receivables-reporting suite: 5/5 passed
finance payment-allocation suite: 6/6 passed
organisation bootstrap suite: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.
