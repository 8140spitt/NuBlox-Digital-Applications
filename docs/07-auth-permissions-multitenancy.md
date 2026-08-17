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
```

`finance.manage` is the same-domain finance umbrella. Payment receipt/allocation and their reversal operations remain future explicit capabilities rather than inheriting authority implicitly.

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

They also receive the contract-amendment and receivable-correction granular keys explicitly. Existing organisations receive forward-migration rows and future organisations receive equivalent bootstrap rows.

### Manager

Manager receives delegated member, project and CRM party/contact authority, including `project.create`, but does not automatically receive commercial, contract or finance authority.

### Finance/Commercial

Default grants are:

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

This role can perform ordinary commercial AR preparation, invoice issue and source-linked credit-note correction while the stronger issued-invoice void capability remains Owner/Administrator/custom delegation by default.

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

Normal contract reads require:

```text
active NuBlox user
AND active organisation membership
AND contract.view
AND contract.organisation_id = active tenant
```

Mutations require the operation-specific granular key or `contract.manage` fallback plus same-tenant/lifecycle policy.

### Formation

Quotation-derived formation requires:

```text
contract.create OR contract.manage
AND project.view
AND active owning project participation
AND active project_members scope for the exact member
AND project status = proposed
AND accepted quotation-conversion provenance
```

Formation retains exact project/opportunity/accepted-response provenance and snapshots customer evidence.

### Draft / issue / execution

```text
contract.draft.manage
    → maintain draft title/reference/value/key dates

contract.issue
    → validate draft evidence
    → lock exact version
    → record issue/recipient evidence
    → logical contract -> under_review

contract.execute
    → require issued + locked version
    → record execution/signatory evidence
    → version -> executed
    → logical contract -> active
```

Issued/executed versions reject ordinary draft mutation. Contract execution does not activate the project or create finance postings.

## 11. Controlled contract amendment access model

Creation requires:

```text
contract.amendment.create OR contract.manage
AND contract.view
AND same-tenant contract
AND contract.lifecycle_status = active
AND executed contract-version baseline
```

Draft maintenance requires `contract.amendment.draft.manage OR contract.manage`.

Issue requires `contract.amendment.issue OR contract.manage`, a draft amendment, an effective date and substantive narrative/value/date evidence.

Decision/withdrawal requires `contract.amendment.decide OR contract.manage`.

Only agreed amendments affect derived contract value:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Rejected/withdrawn amendments remain historical evidence.

## 12. Operational accounts-receivable access model

Finance records are tenant-owned and use an independent permission family.

Normal reads require:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND finance record organisation_id = active tenant
```

Mutations require the granular finance permission or `finance.manage` fallback plus lifecycle policy.

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

Invoice creation is contract-anchored:

```text
finance.invoice.create OR finance.manage
AND contract.view
AND same-tenant active contract
AND executed contract-version baseline
AND executed client party exists
```

Creation records customer, optional billing contact, contract, project and currency references but leaves:

```text
document_number = NULL
lifecycle_status = draft
```

### Invoice draft management

```text
finance.invoice.draft.manage OR finance.manage
    → maintain invoice type/payment term/due date/PO reference
    → add/remove fixed-precision invoice lines
    → select provisional tax category
```

### Invoice issue

```text
finance.invoice.issue OR finance.manage
AND status = draft
AND at least one charge line
AND customer PO/reference present when policy requires it
AND valid due-date/payment-term policy
```

Issue atomically finalises due date, refreshes tax using the tenant rate effective at the actual invoice issue time, snapshots customer/contact/address evidence, allocates a tenant invoice number, freezes the document, records issue/recipient evidence and appends audit history.

Issued invoices reject ordinary draft header/line mutation.

## 13. Receivable-correction access model

Package 004D corrects an issued receivable without reopening invoice mutation.

### Credit-note creation

```text
finance.credit_note.create OR finance.manage
AND same-tenant source invoice
AND source invoice lifecycle = issued
AND source invoice has legal number
AND positive remaining creditable value
```

The source is the issued invoice itself. Credit-note creation therefore does not require a fresh `contract.view` traversal.

Draft identity is:

```text
document_kind = credit_note
lifecycle_status = draft
document_number = NULL
```

### Credit-note line provenance

```text
finance.credit_note.draft.manage OR finance.manage
    → add/remove source-linked correction lines
    → maintain correction reason
```

Every credit line links to one exact original invoice line through `credit_note_item_sources`.

The service copies source classification, description and unit rate; the user supplies the partial/full quantity to credit. Positive quantity/value magnitudes are used; `document_kind = credit_note` supplies correction semantics.

### Original tax and customer evidence

A credit note corrects the historic invoice transaction. It therefore uses the original invoice line's persisted `applied_rate_percent`, not the tax rate current on the credit-note date.

At credit-note issue, tax rows are rebuilt from the original invoice tax evidence again.

The issued credit note also copies the original invoice's immutable party/address snapshots rather than today's CRM values.

### Over-credit prevention

Draft composition checks the currently remaining source quantity. Issue is authoritative:

```text
lock original invoice
AND resolve all issued credit quantities per source item
AND add current draft credit quantity
AND reject if cumulative quantity > original invoice quantity
```

This prevents competing credit-note drafts from over-crediting the same source line.

### Credit-note issue

```text
finance.credit_note.issue OR finance.manage
AND credit-note status = draft
AND original invoice still = issued
AND at least one source-linked correction line
AND source quantities remain valid under lock
```

Issue copies/revalidates original evidence, allocates `CN-xxxxxx`, freezes the document and records issue/recipient/audit evidence.

Issued credit notes reject ordinary reason/line mutation.

### Exceptional invoice void

```text
finance.invoice.void OR finance.manage
AND invoice status = issued
AND explicit void reason
AND no non-void credit-note history
AND no unreversed payment allocation
```

Void is a stronger correction reserved for an invalid issued document such as a duplicate. Finance/Commercial does not receive `finance.invoice.void` by default.

A successful void preserves the legal number, lines, tax, party snapshots and issue evidence while recording:

```text
lifecycle_status = void
voided_by_member_id
voided_at
void_reason
```

The allocation guard is active before payment-allocation UI exists so later cash application cannot invalidate the correction invariant.

### Cross-domain separation

```text
commercial.manage cannot issue/credit/void finance documents
contract.manage cannot issue/credit/void finance documents
finance.manage cannot mutate contracts or quotations
```

Foreign invoice and credit-note public IDs are tenant-masked as not found after the caller passes the relevant finance authority boundary.

## 14. Project access and collaboration

Normal project access requires:

```text
active user
AND active organisation membership
AND effective project permission
AND active project_organisations participation
AND active project_members row for the exact member
```

Project contextual roles classify context and never grant application permissions.

Accepted-quotation conversion establishes the creator's first project scope atomically. Contract formation occurs after project creation and therefore requires exact project-member scope.

## 15. Tenant-isolation rules

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- CRM, commercial, contract, amendment and finance reads/writes are tenant-bounded.
- Matching surrogate/public IDs are never proof of access by themselves.
- Foreign tenant record identities are masked where appropriate.
- Project reads require exact-member project scope.
- Project roles never grant application permissions.
- CRM identity is never promoted to platform identity by inference.
- Customer snapshots preserve evidence without creating platform identity.
- Caches, search, exports, files and future scheduled jobs must preserve tenant boundaries.
- Privileged support access must be explicit and auditable.

## 16. Session requirements

Production session policy includes secure HttpOnly cookies, Secure transport, appropriate SameSite behavior, revocation/logout, rotation after privilege/authentication changes, idle/absolute expiry and MFA step-up where risk policy requires it.

## 17. Release testing requirements

The real-MySQL release gate covers, at minimum:

- authentication and active-tenant resolution;
- explicit deny precedence and same-domain umbrella behavior;
- organisation bootstrap/invitation controls and standard-role parity;
- CRM tenant isolation and granular authority;
- estimate/quotation issue/response integrity;
- accepted-quotation conversion and project scope creation;
- contract formation provenance/idempotency;
- immutable contract issue/execution evidence;
- amendment baseline eligibility, signed values and effective-date issue guard;
- amendment agreement/rejection/withdrawal semantics;
- finance billing-settings authority;
- executed-contract invoice eligibility;
- legally unnumbered invoice drafts;
- fixed-precision invoice line/tax arithmetic;
- customer PO/reference issue enforcement;
- invoice issue-date tax refresh;
- due-date calculation;
- customer/contact/address invoice snapshots;
- invoice-number progression;
- immutable issued invoices;
- source-linked credit-note provenance;
- partial credit quantities and over-credit prevention;
- original invoice tax-rate preservation on credit notes;
- original invoice customer/address evidence copied to credit notes;
- credit-note issue-only numbering and immutability;
- Finance/Commercial inability to void invoices by default;
- credit-history and active-allocation invoice-void guards;
- foreign-tenant invoice/credit-note masking;
- generated Kysely drift and Svelte/TypeScript diagnostics.

The executable Package 004D head proved:

```text
15 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
18 integration files / 82 real-MySQL tests passed
finance credit-note suite: 5/5 passed
finance invoice suite: 5/5 passed
organisation bootstrap suite: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.
