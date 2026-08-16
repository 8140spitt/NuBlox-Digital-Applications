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

Permission umbrellas never cross domains. In particular:

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
```

`finance.manage` is the same-domain finance umbrella. The first activated finance operations are billing settings and invoice preparation/issue only. Credit notes, payments, allocations and ledger operations require future explicit permissions rather than inheriting authority implicitly.

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

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus the released granular operational permissions.

Relevant broad authority includes:

```text
project.manage
crm.manage
commercial.manage
contract.manage
finance.manage
```

They also receive the Package 004 amendment granular keys explicitly. Existing organisations receive those rows from forward migration and future organisations receive matching rows from bootstrap, preserving persistent grant parity as well as effective authority.

Their `commercial.manage + project.create` authority permits accepted-quotation project conversion unless a granular member exception denies conversion.

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
```

Finance/Commercial deliberately does **not** receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
finance.manage
```

This role can perform the currently activated operational AR tasks while future finance capabilities remain deliberate grants.

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

### Accepted quotation → project conversion

Conversion is conjunctive:

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

Issue requires `contract.amendment.issue OR contract.manage` and:

```text
status = draft
effective_on present
substantive narrative and/or value/date evidence present
```

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

The first invoice slice is deliberately contract-anchored:

```text
finance.invoice.create OR finance.manage
AND contract.view
AND same-tenant contract
AND contract.lifecycle_status = active
AND executed contract-version baseline
AND executed client party exists
```

`contract.view` is required because the contract is the cross-domain source context. Finance authority cannot substitute for contract visibility.

Creation records customer, optional billing contact, contract, project and currency references but leaves:

```text
document_number = NULL
lifecycle_status = draft
```

Draft creation therefore does not consume a legal invoice number.

### Draft management

```text
finance.invoice.draft.manage OR finance.manage
    → maintain invoice type/payment term/due date/PO reference
    → add/remove fixed-precision invoice lines
    → select provisional tax category
```

Draft invoice calculations reuse the scaled-`BigInt` commercial decimal module.

### Invoice issue

```text
finance.invoice.issue OR finance.manage
AND status = draft
AND at least one charge line
AND customer PO/reference present when policy requires it
AND valid due-date/payment-term policy
```

Issue atomically:

1. finalises due date from the actual issue date;
2. re-resolves the effective tenant tax rate and refreshes tax facts;
3. snapshots customer identity;
4. snapshots billing contact where present;
5. copies billing-address evidence;
6. serialises tenant invoice-number allocation;
7. changes the document to `issued`;
8. records issue/recipient evidence;
9. appends audit history.

Issued invoices reject ordinary draft header/line mutation.

The issue channel is evidence of the selected delivery mechanism only. No production outbound email/API/portal delivery is claimed.

### Cross-domain separation

```text
commercial.manage cannot issue invoices
contract.manage cannot issue invoices
finance.manage cannot mutate contracts or quotations
```

The first finance slice also does not create payment, allocation or general-ledger records when an invoice is issued.

Foreign invoice public IDs are tenant-masked as not found after the caller passes the finance read boundary.

## 13. Project access and collaboration

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

## 14. Tenant-isolation rules

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

## 15. Session requirements

Production session policy includes secure HttpOnly cookies, Secure transport, appropriate SameSite behavior, revocation/logout, rotation after privilege/authentication changes, idle/absolute expiry and MFA step-up where risk policy requires it.

## 16. Release testing requirements

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
- legally unnumbered drafts;
- fixed-precision invoice line/tax arithmetic;
- customer PO/reference issue enforcement;
- issue-date tax refresh;
- due-date calculation;
- customer/contact/address invoice snapshots;
- invoice number progression;
- immutable issued invoices;
- explicit `finance.invoice.issue` deny overriding `finance.manage`;
- foreign-tenant invoice masking;
- generated Kysely drift and Svelte/TypeScript diagnostics.

The first executable Package 004C AR head proved:

```text
14 production migrations applied / 0 pending
344 tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
17 integration files / 77 real-MySQL tests passed
finance invoice suite: 5/5 passed
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove the same complete gate before merge.
