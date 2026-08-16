# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox combines authentication, tenant membership, RBAC, capability entitlements, project scope, tenant-record scope and contextual business policy.

A career is **not** a security role. Job titles may inform role design but never confer authority automatically.

## 2. Identity model

```text
User
 ├─ Organisation Membership A
 │    ├─ organisation roles / member overrides
 │    ├─ private CRM, commercial and contract records owned by Organisation A
 │    └─ explicit project memberships
 └─ Organisation Membership B
      ├─ different roles / overrides
      ├─ different private CRM, commercial and contract records
      └─ different project memberships
```

A CRM representation of a real-world person or business is not the same identity as a NuBlox user, organisation member or platform organisation. Commercial and contract records may reference/snapshot CRM identity; accepted-quotation conversion and contract formation do not infer platform identity from that CRM record.

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

contract.manage
    ├─ contract.create
    ├─ contract.draft.manage
    ├─ contract.issue
    └─ contract.execute
```

For a granular operation NuBlox resolves the granular key first. The same-domain umbrella is considered only when that granular key has no explicit member or active-role decision.

```text
granular member deny
    > granular member allow / granular role grant
    > same-domain umbrella fallback
    > default deny
```

An explicit granular deny therefore cannot be bypassed by its umbrella. Umbrellas do not cross domain families: `commercial.manage` does not grant Package 004 contract authority.

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

### Contracts

- `contract.view`
- `contract.manage` — broad Package 004 contract-management umbrella
- `contract.create`
- `contract.draft.manage`
- `contract.issue`
- `contract.execute`

Planned namespaces still include `document.*`, later finance permissions, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` as their workflows are activated.

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

Owner and Administrator retain broad project, CRM, commercial and contract umbrellas plus the established granular keys:

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
contract.view
contract.manage
contract.create
contract.draft.manage
contract.issue
contract.execute
```

`commercial.quotation.convert` does not need a duplicate standard grant for Owner/Administrator: their existing `commercial.manage` umbrella satisfies the commercial side of conversion and their existing `project.create` grant satisfies the project side, unless a granular member override intentionally denies conversion.

Package 004 authority is explicit rather than inherited from `commercial.manage`. Owner/Administrator receive `contract.manage` plus the first-slice granular keys so contract authority remains a distinct domain boundary.

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

Manager does **not** receive `project.manage`, `crm.manage`, opportunity/activity management, commercial permissions or contract permissions automatically. Although Manager normally has `project.create`, that alone can never authorise quotation conversion or contract formation.

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
contract.view
```

Finance/Commercial deliberately does **not** receive `commercial.manage`, `commercial.quotation.convert`, `project.create`, `contract.manage`, `contract.create`, `contract.draft.manage`, `contract.issue` or `contract.execute`. If an organisation wants this role to convert accepted quotations or mutate contracts, those authorities must be deliberately delegated.

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

A CRM customer is not inferred to be a NuBlox project participant. Customer invitation, project site creation and project activation remain separate workflows. Contract formation is also a separate Package 004 permission and transaction boundary.

### Tax/calculation integrity

Quotation tax selection snapshots applied rate, taxable amount and tax amount. Authoritative commercial arithmetic uses scaled `BigInt`, not JavaScript binary floating point. Quantity scale is 6; money/rate/percentage scales are 4; scale reduction is half-up.

Base totals exclude optional lines until an explicit customer option-selection model exists.

## 10. Implemented contract access model

Package 004 contract records are tenant-owned and use their own permission family. The normal read boundary is:

```text
active NuBlox user
AND active organisation membership
AND contract.view
AND contract organisation_id = active tenant organisation_id
```

Mutation requires the operation-specific Package 004 permission or `contract.manage` umbrella fallback plus contract/version lifecycle policy. `commercial.manage` is not a contract umbrella.

### Formation authority

Controlled accepted-quotation contract formation requires:

```text
contract.create OR contract.manage umbrella fallback
AND project.view
AND active project_organisations participation
AND active project_members scope for the exact member
AND project owned by active tenant
AND project status = proposed
AND exact source quotation response = accepted
AND exact source quotation version = issued + locked
```

Formation resolves the exact `quotation_project_conversions` provenance that created the project, locks the source project and is idempotent for the same project + accepted response. It retains `contracts.project_id`, `contracts.opportunity_id` and `contracts.source_quotation_response_id`.

The accepted CRM customer is copied into version-specific contract-party evidence, using immutable quotation customer/address snapshots where available. This does not infer a NuBlox platform organisation from the CRM party.

### Draft, issue and execution authority

```text
contract.draft.manage
    → edit draft version title/customer reference
    → add/remove draft value components
    → add/remove draft key dates

contract.issue
    → validate draft evidence
    → lock exact version
    → create issue/recipient evidence
    → move logical contract to under_review

contract.execute
    → require issued + locked exact version
    → create one execution event + signatory evidence
    → move version to executed
    → move logical contract to active

contract.manage
    → same-domain umbrella fallback for all four mutations
```

Issued/executed versions reject ordinary draft mutation. Contract execution does not activate the project, create a project participant, issue an invoice or post payment/ledger facts.

## 11. Implemented project access model

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

Contract formation occurs after the project exists, so it does require exact-member project scope in addition to Package 004 authority.

## 12. Project participant and team administration

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

## 13. Cross-organisation and CRM separation

Private CRM records are not automatically shared because the same external business later becomes a NuBlox project participant or contract party.

Accepted-quotation conversion creates only the active tenant's owning project participation. Contract formation can snapshot the CRM customer into contract evidence, but the CRM customer remains a private CRM party until an explicit, tenant-controlled platform/project linkage is made.

Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 14. Tenant-isolation rules

- Server derives tenant context from authenticated active membership.
- Tenant-owned repository methods include tenant context.
- CRM reads/writes include active `organisation_id`.
- Estimate, quotation, tax, issue, snapshot, response and conversion operations include active `organisation_id`.
- Contract formation, version, value, key-date, issue and execution operations include active `organisation_id`.
- Foreign estimate/quotation/contract public IDs are masked as not found.
- `quotation_project_conversions` uses same-tenant response/project foreign keys.
- Contract provenance retains same-tenant project/quotation-response relationships.
- A CRM party must never become platform-global identity by inference.
- Normal project reads require exact-member scope.
- Contract formation from an existing project requires exact-member project scope.
- Cross-organisation project-team administration is denied.
- Search, caches, exports, files and background jobs must preserve tenancy boundaries.
- Platform support access requires a privileged auditable workflow.

## 15. Session requirements

- secure HttpOnly cookies where cookie sessions are used;
- Secure in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up where high-risk policy requires it.

## 16. Permission, scope and provisioning testing

Automated release gates cover at least:

- same-tenant allow/deny and cross-tenant masking;
- granular deny overriding same-domain umbrella fallback;
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
- Package 004 contract permission separation from commercial authority;
- exact accepted-response/project contract provenance and retry idempotency;
- customer/address contract snapshot evidence;
- issued contract-version immutability;
- execution/signatory evidence without automatic project activation;
- project exact-member scope and participant/team isolation;
- final scoped project-team-manager protection.

The first executable controlled-contract candidate passed **15 integration files / 66 real-MySQL tests**, all **12 production migrations** on MySQL 8.4.11, the unchanged **344 / 749 / 429** structural assertions, zero generated Kysely drift and `svelte-check` with **0 errors / 0 warnings**. The documentation-synchronised release head must pass the same gate before merge.
