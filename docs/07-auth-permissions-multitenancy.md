# 07 — Authentication, Permissions and Multi-tenancy

## 1. Governing security model

NuBlox combines authentication, active tenant membership, organisation RBAC, member overrides, project scope, tenant-record scope and record-state/business policy.

> **Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

Careers/job titles configure professional context and feature relevance. They never grant application authority automatically.

CRM people/businesses are also distinct from NuBlox users, organisation members and platform organisations. Commercial, project, contract and finance workflows may reference or snapshot CRM identity without inferring platform identity.

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

For granular operations with a same-domain umbrella:

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

`contract.manage` is the same-domain contract/amendment umbrella.

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
```

`finance.manage` is the same-domain finance umbrella. Every activated finance mutation also has a granular key so responsibilities may be delegated without broad finance administration authority.

Package 004F adds **no new permission key**. Statements and aging are read-only derivations of the same finance records already protected by `finance.view`.

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

They also receive contract-amendment, receivable-correction and payment granular keys explicitly. Existing organisations receive forward-migration rows and future organisations receive equivalent bootstrap rows.

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
```

Finance/Commercial deliberately does **not** receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
finance.manage
finance.invoice.void
```

This role can perform ordinary operational AR work including cash receipt/application and immutable cash corrections. Exceptional issued-invoice void remains Owner/Administrator/custom delegation by default.

Because the role already has `finance.view`, it can use Package 004F reporting without a new grant.

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

Forward migration grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations are asserted by integration tests at the persisted role-permission-row level.

Package 004F requires no provisioning change because it reuses `finance.view`.

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

`crm.manage` is umbrella fallback for party/contact/opportunity/activity granular operations.

## 9. Commercial access model

Package 003 reads require active membership + `commercial.view` + same-tenant scope. Mutations additionally require the granular commercial key or `commercial.manage` fallback and valid document/version lifecycle.

Accepted quotation → project conversion is conjunctive:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
AND exact issued + locked quotation version
AND accepted response for that exact version
```

`quotation_project_conversions` is the authoritative idempotency/provenance ledger. Conversion creates the proposed project and initial owner/member scope but does not infer customer platform identity, form a contract or create finance records.

## 10. Package 004 contract access model

Normal contract reads require active membership, `contract.view` and same-tenant contract ownership. Mutations require the operation-specific granular key or `contract.manage` fallback plus lifecycle policy.

Quotation-derived formation additionally requires project visibility, exact active project-member scope and accepted quotation-conversion provenance.

Issued/executed contract versions reject ordinary draft mutation. Controlled amendments require an active contract with executed baseline; only agreed amendments affect the derived current contract value.

## 11. Operational accounts-receivable read boundary

Finance records are tenant-owned and use an independent permission family.

Normal reads require:

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
    → create tenant payment terms
    → choose tenant default payment term
    → maintain customer billing defaults
    → set customer account reference / PO-required policy
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

Creation records customer, optional billing contact, contract, project and currency references but leaves the legal number null while draft.

### Draft management and issue

`finance.invoice.draft.manage OR finance.manage` maintains draft header/lines/tax selection.

`finance.invoice.issue OR finance.manage` requires a valid draft with lines and customer/due-date policy. Issue finalises due date, refreshes tax using the rate effective at actual issue time, snapshots customer/contact/address evidence, allocates the legal invoice number and freezes ordinary mutation.

## 13. Receivable-correction authority

### Credit notes

```text
finance.credit_note.create OR finance.manage
AND same-tenant issued invoice
AND positive remaining creditable value
```

`finance.credit_note.draft.manage OR finance.manage` maintains source-linked credit lines and correction reason.

Every credit line links to an exact invoice line. Positive correction magnitudes are used and original invoice applied-tax evidence is preserved.

`finance.credit_note.issue OR finance.manage` revalidates cumulative credited source quantities under an original-invoice lock, copies historic invoice party/address evidence, allocates the credit-note number and freezes the correction.

### Exceptional invoice void

```text
finance.invoice.void OR finance.manage
AND invoice status = issued
AND explicit void reason
AND no non-void credit-note history
AND no unreversed payment allocation
```

Void is stronger authority because it changes the lifecycle of an already-issued legal document. Finance/Commercial does not receive it by default.

## 14. Payment receipt authority

```text
finance.payment.create OR finance.manage
AND active payment method
AND positive amount
AND valid currency
```

A payment is an immutable receipt fact. Recording it creates no automatic invoice allocation.

The payer CRM party is optional. If the actor selects a payer, `crm.view` is additionally required because the service traverses a separate domain. The selected payer must be active and same-tenant.

A finance-only user may still record an unidentified receipt without CRM traversal.

## 15. Payment allocation authority

```text
finance.payment.allocate OR finance.manage
AND same-tenant payment
AND payment not reversed
AND same-tenant invoice
AND invoice status = issued
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

Allocation locks the payment and target invoice before recomputing both limits. This prevents concurrent allocation attempts from independently consuming the same payment or invoice balance.

No FX conversion is performed. Currency mismatch is rejected.

A payment payer may differ from the invoice customer; the UI surfaces that mismatch but does not treat it as an access grant or automatic rejection because legitimate third-party payments exist.

## 16. Allocation-reversal authority

```text
finance.payment.allocation.reverse OR finance.manage
AND same-tenant payment/allocation
AND payment not reversed
AND allocation has no existing reversal
AND explicit reason
```

The original allocation is immutable. Reversal creates one `payment_allocation_reversals` record with actor, timestamp and reason. The reversed allocation then ceases to reduce payment availability or invoice outstanding.

## 17. Payment-reversal authority

```text
finance.payment.reverse OR finance.manage
AND same-tenant payment
AND no existing payment reversal
AND explicit reason
```

Payment reversal does not edit/delete the receipt.

The transaction must:

1. lock the payment;
2. lock all payment allocations;
3. create allocation-reversal rows for every still-active allocation;
4. create the payment-reversal row;
5. append audit evidence;
6. commit atomically.

This enforces the Package 004 invariant that a reversed payment cannot retain active allocations.

A reversed payment has zero usable balance and cannot be allocated again.

## 18. Derived settlement position

The legal invoice lifecycle remains independent from operational settlement.

For issued invoices the application derives:

```text
open
part_settled
settled
```

from issued credits and active allocations.

This avoids incorrectly describing a fully credited invoice as “paid.” Draft and void document states remain document-lifecycle states, not settlement states.

## 19. Customer-statement and aging access

Package 004F is a read-only finance view, not a new mutation domain.

Access requires:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND same-tenant customer/finance records
```

No `finance.manage` grant is required and no `finance.receivables.view` key is introduced.

An explicit member deny on `finance.view` removes access to the receivables portfolio and statement workspace even if another role grants finance mutation permissions.

### Historical reporting boundary

The statement service derives customer-account movements from authoritative finance-event timestamps:

```text
invoice issue       → debit
credit-note issue   → credit
payment allocation  → credit
allocation reversal → debit
invoice void        → credit
```

A raw/unallocated payment is not treated as a customer receivable credit. It affects the customer account only when allocated to an invoice.

Statement day boundaries use the active tenant's `organisations.default_timezone`.

A historical report uses the state that existed at the selected cutoff. A later allocation reversal therefore does not retroactively remove the allocation from an earlier statement.

Currencies remain separated. Package 004F does not infer FX translation or a reporting currency.

Foreign-tenant customer public IDs are masked as not found.

## 20. Cross-domain separation

```text
commercial.manage cannot issue/credit/void/allocate finance records
contract.manage cannot issue/credit/void/allocate finance records
finance.manage cannot mutate contracts or quotations
```

`crm.view` is needed only for the explicit payer-selection traversal. It does not grant payment mutation authority.

Project roles classify context and never grant application permissions.

## 21. Tenant-isolation rules

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- CRM, commercial, contract, amendment and finance reads/writes are tenant-bounded.
- Matching surrogate/public IDs are never proof of access by themselves.
- Foreign tenant record identities are masked where appropriate.
- Project reads require exact-member project scope.
- Project roles never grant application permissions.
- CRM identity is never promoted to platform identity by inference.
- Customer/document snapshots preserve evidence without creating platform identity.
- Derived reports must preserve event-time and tenant-timezone semantics rather than caching mutable balances as authority.
- Caches, search, exports, files and future scheduled jobs must preserve tenant boundaries.
- Privileged support access must be explicit and auditable.

## 22. Session requirements

Production session policy includes secure HttpOnly cookies, Secure transport, appropriate SameSite behavior, revocation/logout, rotation after privilege/authentication changes, idle/absolute expiry and MFA step-up where risk policy requires it.

## 23. Release testing requirements

The real-MySQL release gate covers, at minimum:

- authentication and active-tenant resolution;
- explicit deny precedence and same-domain umbrella behavior;
- organisation bootstrap/invitation controls and standard-role parity;
- CRM tenant isolation and granular authority;
- sales quotation conversion and project scope;
- contract formation/execution/amendment integrity;
- billing-settings and invoice issue policy;
- invoice immutability and historical tax/customer evidence;
- source-linked credit-note provenance and over-credit prevention;
- credit-note original-tax preservation and issue immutability;
- exceptional invoice-void authority/history guards;
- payment receipt creation and optional payer traversal;
- credit-aware/active-allocation-aware invoice outstanding;
- payment usable-balance derivation;
- payment and invoice over-allocation prevention;
- payment/invoice currency mismatch rejection;
- explicit `finance.payment.allocate` deny overriding `finance.manage`;
- immutable allocation reversal and duplicate-reversal rejection;
- payment reversal automatically reversing active allocations;
- reversed-payment reallocation rejection;
- foreign-tenant payment/invoice masking;
- receivables reporting under `finance.view`;
- explicit `finance.view` deny removing statement/aging access;
- currency-separated current aging;
- historical statement cutoff correctness across later allocation reversals;
- opening/closing balance reconciliation;
- invoice-void event treatment in historical statements;
- tenant-timezone statement periods;
- foreign-tenant customer-account masking;
- generated Kysely drift and Svelte/TypeScript diagnostics.

The executable Package 004F code head proved on MySQL 8.4.11:

```text
16 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
20 integration files / 93 real-MySQL tests passed
finance receivables-reporting suite: 5/5 passed
finance payment-allocation suite: 6/6 passed
organisation bootstrap suite: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.
