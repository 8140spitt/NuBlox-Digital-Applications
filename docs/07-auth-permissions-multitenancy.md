# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox combines authentication, tenant membership, RBAC, capability entitlements, project scope, tenant-record scope and contextual business policy.

A career is **not** a security role. Job titles may inform role design but never confer authority automatically.

## 2. Identity model

```text
User
 ├─ Organisation Membership A
 │    ├─ organisation roles / member overrides
 │    ├─ private CRM and commercial records owned by Organisation A
 │    └─ explicit project memberships
 └─ Organisation Membership B
      ├─ different roles / overrides
      ├─ different private CRM and commercial records
      └─ different project memberships
```

A CRM representation of a real-world person or business is not the same identity as a NuBlox user, organisation member or platform organisation. Commercial documents reference CRM identity; accepted-quotation conversion does not infer platform identity from that CRM record.

## 3. Effective authorisation

Conceptually:

```text
authenticated user
AND active organisation membership
AND effective organisation permission
AND feature/capability entitlement where applicable
AND tenant/project/record scope
AND record-state/business policy
```

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

### Granular permissions and umbrella compatibility

Current umbrella families are:

```text
project.manage
    ├─ project.lifecycle.manage
    ├─ project.participant.manage
    ├─ project.team.manage
    └─ project.participation.manage

crm.manage
    ├─ crm.party.manage
    ├─ crm.contact.manage
    ├─ crm.opportunity.manage
    └─ crm.activity.manage

commercial.manage
    ├─ commercial.estimate.manage
    ├─ commercial.quotation.manage
    ├─ commercial.quotation.issue
    ├─ commercial.quotation.response.record
    └─ commercial.quotation.convert
```

For a granular operation NuBlox resolves the granular key first. The umbrella is considered only when that granular key has no explicit member or active-role decision.

```text
granular member deny
    > granular member allow / granular role grant
    > umbrella fallback
    > default deny
```

An explicit granular deny therefore cannot be bypassed by `project.manage`, `crm.manage` or `commercial.manage`.

## 4. Controlled account provisioning

Better Auth is the authentication/session provider; an authentication identity alone is not a trusted NuBlox tenant actor.

Email sign-up remains fail-closed unless exactly one valid provisioning intent exists:

1. an organisation invitation; or
2. a self-service organisation-bootstrap intent.

The bootstrap flow uses the existing normalised identity/organisation/member/role model. Trusted session resolution requires an active NuBlox domain user and active organisation membership.

## 5. Implemented permission catalogue

### Organisation and member administration

- `organisation.manage`
- `member.invite`
- `member.manage`

### Projects

- `project.create`
- `project.view`
- `project.manage` — broad project-management umbrella
- `project.lifecycle.manage`
- `project.participant.manage`
- `project.team.manage`
- `project.participation.manage`

### CRM

- `crm.view`
- `crm.manage` — broad CRM-management umbrella
- `crm.party.manage`
- `crm.contact.manage`
- `crm.opportunity.manage`
- `crm.activity.manage`

### Commercial sales documents

- `commercial.view`
- `commercial.manage` — broad commercial-management umbrella
- `commercial.estimate.manage`
- `commercial.quotation.manage`
- `commercial.quotation.issue`
- `commercial.quotation.response.record`
- `commercial.quotation.convert`

Planned namespaces still include `document.*`, later commercial/contract/finance permissions, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` as their workflows are activated.

Permission keys are stable platform-policy identifiers. Careers and CRM/project classification roles do not grant application authority.

## 6. Organisation administration authority

```text
member.invite
    → invitation lifecycle

member.manage
    → member lifecycle
    → member-to-role assignments

organisation.manage
    → organisation-role definitions
    → role-to-permission grants
    → full organisation-administration authority
```

Administrative mutations enforce delegation ceilings, manager protection, self-mutation restrictions, cross-tenant rejection and final-`organisation.manage` lockout prevention.

## 7. Standard organisation roles

Every newly bootstrapped organisation receives Owner, Administrator, Manager, Finance/Commercial, Member/Professional, Field Worker and Read Only templates.

### Owner / Administrator

Owner and Administrator retain broad project, CRM and commercial umbrellas plus the established granular keys:

```text
organisation.manage
member.invite
member.manage
project.create
project.view
project.manage
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
crm.view
crm.manage
crm.party.manage
crm.contact.manage
commercial.view
commercial.manage
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

`commercial.quotation.convert` does not need a duplicate standard grant for Owner/Administrator: their existing `commercial.manage` umbrella satisfies the commercial side of conversion and their existing `project.create` grant satisfies the project side, unless a granular member override intentionally denies conversion.

### Manager

Manager receives granular project and CRM party/contact authority:

```text
member.invite
member.manage
project.create
project.view
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
crm.view
crm.party.manage
crm.contact.manage
```

Manager does **not** receive `project.manage`, `crm.manage`, opportunity/activity management or commercial permissions automatically. Although Manager normally has `project.create`, that alone can never authorise quotation conversion.

### Finance/Commercial

Finance/Commercial receives:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial deliberately does **not** receive `commercial.manage`, `commercial.quotation.convert` or `project.create`. If an organisation wants this role to convert accepted quotations, both cross-domain authorities must be deliberately delegated.

### Other standard roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives Owner only. Forward migrations and `OrganisationBootstrapService` standard-role defaults are guarded by integration tests.

## 8. Implemented CRM access model

The CRM boundary is tenant-private:

```text
active NuBlox user
AND active organisation membership
AND effective CRM permission
AND CRM record organisation_id = active tenant organisation_id
AND record-state policy
```

Direct public IDs from another tenant are masked as not found where discovery would disclose another tenant's record.

### Party/contact authority

`crm.party.manage` controls tenant party master data and primary contact methods. `crm.contact.manage` controls person↔organisation contact relationships. `crm.manage` is umbrella fallback.

Package 002 party identity remains independent from platform identity:

```text
parties
├─ party_persons
└─ party_organisations
```

Business roles classify real-world context and do not grant permissions.

### Opportunity/activity authority

`crm.opportunity.manage` controls opportunity lifecycle/stage/value/participants; `crm.activity.manage` controls opportunity-linked activity timeline creation. `crm.manage` is umbrella fallback.

Pipeline stage represents sales maturity; `opportunities.status` represents `open`, `won`, `lost` or `cancelled` business outcome. Future tenants receive audited/idempotent first-use default pipeline provisioning where no pipeline exists.

Activity participants remain relational through `crm_activity_parties` and `crm_activity_members`.

## 9. Implemented commercial access model

Package 003 records are private tenant-owned sales documents. The normal read boundary is:

```text
active NuBlox user
AND active organisation membership
AND commercial.view
AND commercial record organisation_id = active tenant organisation_id
```

Mutation additionally requires the operation-specific permission or `commercial.manage` umbrella fallback plus document/version lifecycle policy.

Direct estimate/quotation public IDs from another tenant are masked as not found.

### Estimate authority

```text
commercial.estimate.manage
    → create estimate from same-tenant CRM opportunity
    → maintain draft estimate lines/cost components
    → finalise draft estimate version

commercial.manage
    → umbrella fallback
```

Estimate version 1 starts `draft`. Final/superseded versions are immutable through normal application writes.

### Quotation draft authority

```text
commercial.quotation.manage
    → create quotation from final estimate version
    → maintain draft header/lines/tax/narrative

commercial.manage
    → umbrella fallback
```

Exact source estimate/version/item provenance is retained. CRM customer identity remains linked rather than copied to another editable customer master.

### Quotation issue authority

```text
commercial.quotation.issue
    → validate draft/version
    → snapshot customer/contact/address facts
    → lock issued version
    → create issue/recipient evidence

commercial.manage
    → umbrella fallback
```

Issued versions are immutable through normal application writes. The issue boundary records evidence but does not claim production outbound quotation email delivery.

### Quotation response authority

```text
commercial.quotation.response.record
    → record accepted/rejected/revision-requested/withdrawn-by-customer evidence

commercial.manage
    → umbrella fallback
```

Responses require an issued/locked version. The database uniqueness guard allows at most one accepted response per logical quotation.

### Accepted quotation conversion authority

Conversion is intentionally conjunctive across commercial and project policy:

```text
commercial.quotation.convert
    OR commercial.manage umbrella fallback
AND project.create
```

Neither permission family can substitute for the other.

The exact selected quotation version must be tenant-owned, `issued`, locked and have an `accepted` response for that same version. The logical quotation must remain active.

`QuotationProjectConversionService` locks the source evidence and uses `quotation_project_conversions` as the authoritative idempotency/provenance ledger. A retry returns the same project rather than creating another. Exact source estimates cannot already belong to another project.

The transaction creates one `proposed` project, active owner-organisation participation and the converting member's initial project scope, then links the quotation/source estimates and writes audit evidence.

A CRM customer is not inferred to be a NuBlox project participant. Customer invitation, project site creation, project activation and contract formation remain separate workflows.

### Tax/calculation integrity

Quotation tax selection snapshots applied rate, taxable amount and tax amount. Authoritative commercial arithmetic uses scaled `BigInt`, not JavaScript binary floating point. Quantity scale is 6; money/rate/percentage scales are 4; scale reduction is half-up.

Base totals exclude optional lines until an explicit customer option-selection model exists.

## 10. Implemented project access model

Project authority remains split:

```text
project.create
project.view
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
project.manage  # umbrella fallback
```

Normal project access requires:

```text
active NuBlox user
AND active organisation membership
AND effective project permission
AND active project_organisations participation
AND active project_members membership for the exact member
```

A same-organisation employee with `project.view` but no `project_members` row does not inherit project access from colleagues.

Quotation conversion is a project-creation boundary and therefore does not require pre-existing project member scope for a project that does not yet exist. The transaction establishes the creator's first project scope atomically, matching ordinary project creation semantics.

## 11. Project participant and team administration

Project collaboration reuses:

```text
projects
  ├─ project_organisations
  │    └─ project_organisation_roles
  └─ project_members
       └─ project_member_roles
```

Only the project owner may manage participant organisations. Each participant manages only its own project members. Invitation response is a deliberate pre-project-scope boundary. Acceptance establishes participation and accepting-member scope atomically.

Project-role assignments are contextual metadata and never grant permissions. Final active scoped project-team-manager protections remain enforced.

## 12. Cross-organisation and CRM separation

Private CRM records are not automatically shared because the same external business later becomes a NuBlox project participant.

Accepted-quotation conversion makes this explicit: it creates only the active tenant's owning project participation. The CRM customer remains a private CRM party until an explicit, tenant-controlled project invitation/linkage is made.

Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 13. Tenant-isolation rules

- Server derives tenant context from authenticated active membership.
- Tenant-owned repository methods include tenant context.
- CRM reads/writes include active `organisation_id`.
- Estimate, quotation, tax, issue, snapshot, response and conversion operations include active `organisation_id`.
- Foreign estimate/quotation public IDs are masked as not found.
- `quotation_project_conversions` uses same-tenant response/project foreign keys.
- A CRM party must never become platform-global identity by inference.
- Normal project reads require exact-member scope.
- Cross-organisation project-team administration is denied.
- Search, caches, exports, files and background jobs must preserve tenancy boundaries.
- Platform support access requires a privileged auditable workflow.

## 14. Session requirements

- secure HttpOnly cookies where cookie sessions are used;
- Secure in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up where high-risk policy requires it.

## 15. Permission, scope and provisioning testing

Automated release gates cover at least:

- same-tenant allow/deny and cross-tenant masking;
- granular deny overriding umbrella fallback;
- account invitation/bootstrap boundaries and standard-role parity;
- CRM party/contact/opportunity/activity authority separation;
- pipeline first-use idempotency;
- commercial read vs estimate/quotation/issue/response authority separation;
- same-tenant opportunity requirement and CRM customer reuse;
- fixed-point estimate/quotation arithmetic;
- final estimate and issued quotation immutability;
- tax/party/address issue-time snapshots;
- response-before-issue rejection and single-acceptance semantics;
- commercial conversion authority and `project.create` independently required;
- exact accepted/issued version requirement;
- quotation conversion ledger provenance and retry idempotency;
- quotation/source-estimate project linkage;
- owner-side project participation and creator scope;
- no inferred customer project participation;
- project exact-member scope and participant/team isolation;
- final scoped project-team-manager protection.

The accepted-quotation conversion executable candidate passes **14 integration files / 61 real-MySQL tests**, all **11 production migrations** on MySQL 8.4.11, the unchanged **344 / 749 / 429** structural assertions and zero generated Kysely drift. The documentation-synchronised release head must pass `svelte-check` with **0 errors / 0 warnings** before merge.
