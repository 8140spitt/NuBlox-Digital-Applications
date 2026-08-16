# 07 — Authentication, Permissions and Multi-tenancy

## 1. Governing security model

NuBlox combines authentication, active tenant membership, organisation RBAC, member overrides, project scope, tenant-record scope and record-state/business policy.

> **Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

A career/job title describes professional context and product relevance. It never grants application authority automatically.

A CRM person/business is also not the same identity as a NuBlox user, organisation member or platform organisation. Commercial/project/contract workflows may reference or snapshot CRM identity without inferring platform identity.

## 2. Trust chain

```text
Better Auth identity
        ↓
auth_user_links
        ↓
active NuBlox users row
        ↓
active organisation membership
        ↓
organisation roles + member overrides
        ↓
project membership scope where required
        ↓
tenant-record + lifecycle/business policy
```

A selected-organisation cookie is a selection hint only. The server revalidates membership before constructing trusted tenant context.

## 3. Effective permission precedence

Within a permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For granular operations with an umbrella:

```text
granular member deny
    > granular member allow / granular role grant
    > same-domain umbrella fallback
    > default deny
```

The umbrella is considered only when the granular key has no explicit member/role decision. An explicit granular deny therefore cannot be bypassed by the umbrella.

Permission umbrellas never cross domains. In particular, `commercial.manage` does **not** grant Package 004 contract or amendment authority.

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

`contract.manage` is the broad Package 004 mutation umbrella, including controlled amendment operations. Granular amendment keys support narrower custom delegation and explicit member exceptions.

Future workflows will activate additional namespaces such as finance/invoice, procurement, document, inspection, asset, maintenance and audit permissions as their application boundaries are implemented.

## 5. Standard organisation roles

Every bootstrapped organisation receives:

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

Owner and Administrator receive broad project, CRM, commercial and contract umbrellas plus the currently established granular operational permissions.

Relevant broad authority includes:

```text
project.manage
crm.manage
commercial.manage
contract.manage
```

They also receive `project.create` and `contract.view`. Their `commercial.manage + project.create` authority permits accepted-quotation project conversion unless a granular member exception denies it. Their separate Package 004 `contract.manage` authority permits broad contract formation/execution/amendment operations unless a granular contract exception denies a specific action.

The Package 004 amendment permission migration does not duplicate Owner/Administrator role grants because the pre-existing `contract.manage` umbrella already expresses that broad authority.

### Manager

Manager receives delegated member, project and CRM party/contact authority, including `project.create`, but does not automatically receive broad commercial or Package 004 contract authority.

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
```

Finance/Commercial deliberately does not receive:

```text
commercial.manage
commercial.quotation.convert
project.create
contract.manage
```

Therefore accepted-quotation conversion and Package 004 contract/amendment mutations require deliberate delegation where an organisation wants this role to perform them.

### Other roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives Owner only.

## 6. Controlled account provisioning

Better Auth sign-up remains fail-closed. Exactly one provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority. Protected requests require active NuBlox user resolution and active organisation membership.

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

`crm.manage` is the umbrella fallback for party/contact/opportunity/activity granular operations.

## 9. Commercial access model

Package 003 reads require active membership + `commercial.view` + same-tenant record scope. Mutations additionally require the granular commercial key or `commercial.manage` fallback and valid document/version lifecycle.

### Accepted quotation → project conversion

Conversion is intentionally conjunctive:

```text
commercial.quotation.convert OR commercial.manage
AND project.create
AND exact issued + locked quotation version
AND accepted response for that exact version
```

`quotation_project_conversions` is the authoritative idempotency/provenance ledger. The transaction creates exactly one proposed project, owning-organisation participation and converting-member scope, then links the quotation/source estimate provenance.

Conversion does not infer the CRM customer as a NuBlox platform organisation or project participant, create a site, activate the project, form a contract or create finance records.

## 10. Package 004 contract access model

Normal contract reads require:

```text
active NuBlox user
AND active organisation membership
AND contract.view
AND contract.organisation_id = active tenant
```

Mutations require the operation-specific granular permission or `contract.manage` umbrella fallback plus same-tenant and lifecycle policy.

### Contract formation

Quotation-derived formation requires:

```text
contract.create OR contract.manage
AND project.view
AND active owning project participation
AND active project_members scope for the exact member
AND project status = proposed
AND accepted quotation-conversion provenance
```

The formation transaction retains exact project/opportunity/accepted-response provenance and snapshots customer evidence. It is idempotent for the exact accepted-response/project source.

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

Issued/executed contract versions reject ordinary draft mutation. Contract execution does not activate the project or create finance postings.

## 11. Controlled contract amendment access model

Amendments are post-execution Package 004 records. Creation requires:

```text
contract.amendment.create OR contract.manage
AND contract.view
AND same-tenant contract
AND contract.lifecycle_status = active
AND executed contract-version baseline exists
```

Draft maintenance requires `contract.amendment.draft.manage OR contract.manage`.

Issue requires `contract.amendment.issue OR contract.manage` and:

```text
amendment status = draft
AND effective_on is present
AND substantive narrative and/or value/date change evidence exists
```

Issue freezes ordinary mutation and records issue evidence.

Decision/withdrawal requires `contract.amendment.decide OR contract.manage`:

```text
issued → agreed
issued → rejected
draft  → withdrawn
issued → withdrawn
```

Agreement revalidates the effective date. Rejected/withdrawn amendments remain historical evidence.

Authoritative contract value is derived:

```text
Current Contract Value
= Executed Baseline Value Components
+ Sum(Agreed Amendment Value Adjustments)
```

Draft, issued, rejected and withdrawn adjustments do not change current value. Signed adjustment amounts use fixed-precision decimal arithmetic; zero is rejected.

Foreign amendment public IDs are tenant-masked as not found. Every amendment mutation/lifecycle transition generates audit evidence.

## 12. Project access and collaboration

Normal project access requires:

```text
active user
AND active organisation membership
AND effective project permission
AND active project_organisations participation
AND active project_members row for the exact member
```

Project contextual roles classify context and never grant application permissions.

Accepted-quotation conversion is a project-creation boundary, so it establishes the creator's first project scope atomically. Contract formation happens after the project exists and therefore requires exact project member scope.

Participant organisations and project-team administration remain explicitly scoped; same-organisation employment does not imply access to every project.

## 13. Tenant isolation rules

- Server derives tenant context from authenticated active membership.
- Tenant-owned queries include verified `organisation_id` context.
- CRM, commercial, contract and amendment reads/writes are tenant-bounded.
- Matching surrogate/public IDs are never proof of access by themselves.
- Cross-tenant CRM/commercial/contract/amendment identities are masked where appropriate.
- Normal project reads require exact-member project scope.
- Project-role assignments never grant application permissions.
- CRM identity is never promoted to platform identity by inference.
- Caches, search, exports, files and background jobs must preserve tenant boundaries.
- Privileged support access must be explicit and auditable.

## 14. Session requirements

Production session policy includes secure HttpOnly cookies, Secure transport, appropriate SameSite behaviour, revocation/logout, rotation after privilege/authentication changes, idle/absolute expiry and MFA step-up where risk policy requires it.

## 15. Release testing requirements

The real-MySQL integration/release gate covers, at minimum:

- authentication and active-tenant resolution;
- explicit deny precedence and umbrella compatibility;
- organisation bootstrap/invitation controls;
- CRM tenant isolation and granular authority;
- estimate/quotation issue/response integrity;
- accepted-quotation conversion and project scope creation;
- contract formation provenance and idempotency;
- immutable issued contract versions and execution evidence;
- amendment active/executed-baseline eligibility;
- signed amendment values and derived current contract value;
- amendment effective-date-before-issue;
- immutable issued amendments;
- agreement/rejection/withdrawal semantics;
- foreign-tenant amendment masking;
- Svelte/TypeScript compilation and generated Kysely drift.

The current Package 004 amendment release target is **13 migrations**, **344 / 749 / 429** schema counts, **16 integration files / 72 real-MySQL tests**, and `svelte-check` **0 errors / 0 warnings** on the final documentation-synchronised head.
