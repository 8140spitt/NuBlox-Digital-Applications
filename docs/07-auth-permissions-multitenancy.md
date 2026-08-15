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
 │    └─ project memberships
 └─ Organisation Membership B
      ├─ different roles / overrides
      ├─ different private CRM and commercial records
      └─ different project memberships
```

A CRM representation of a real-world person or business is not the same identity as a NuBlox user, organisation member or platform organisation. A commercial document references CRM identity but does not replace it with another editable customer master.

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
    └─ commercial.quotation.response.record
```

For an operation governed by a granular key, NuBlox resolves that granular key first. The umbrella is considered only when the granular key has no explicit member or active-role decision.

```text
granular member deny
    > granular member allow / granular role grant
    > umbrella fallback
    > default deny
```

An explicit granular deny therefore cannot be bypassed by `project.manage`, `crm.manage` or `commercial.manage`.

## 4. Controlled account provisioning

Better Auth is the authentication/session provider; an authentication identity alone is not a trusted NuBlox tenant actor.

Email sign-up remains fail-closed unless exactly one valid NuBlox provisioning intent exists:

1. an organisation invitation; or
2. a self-service organisation-bootstrap intent.

The bootstrap flow uses the existing normalised identity/organisation/member/role model. Pending bootstrap state cannot enter the application because trusted session resolution requires an active NuBlox domain user.

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
- `commercial.manage` — broad commercial sales-management umbrella
- `commercial.estimate.manage`
- `commercial.quotation.manage`
- `commercial.quotation.issue`
- `commercial.quotation.response.record`

Planned domain namespaces still include `document.*`, broader `commercial.*`, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` as those application workflows are activated.

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

Owner and Administrator retain broad project, CRM and commercial umbrellas plus the currently implemented granular keys:

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

Because `crm.manage` and `commercial.manage` are umbrellas, Owner/Administrator may exercise the corresponding granular operations unless an explicit granular member decision overrides the umbrella.

### Manager

Manager receives operationally broad but deliberately granular project/CRM party-contact authority:

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

Manager does **not** receive `project.manage` or `crm.manage`. `crm.opportunity.manage`, `crm.activity.manage` and the commercial permissions are deliberately not auto-granted to Manager; organisations delegate those responsibilities explicitly.

### Finance/Commercial

Finance/Commercial receives the first operational Package 003 commercial set:

```text
project.view
crm.view
commercial.view
commercial.estimate.manage
commercial.quotation.manage
commercial.quotation.issue
commercial.quotation.response.record
```

Finance/Commercial deliberately does **not** receive `commercial.manage`. This prevents future commercial permission families from silently expanding the role through umbrella fallback.

### Other standard roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives Owner only. Existing custom roles holding broad umbrellas remain compatible unless an explicit granular exception overrides them. Forward migrations for existing tenants and `OrganisationBootstrapService` for future tenants are guarded by exact standard-role integration tests.

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

### Party and contact authority

```text
crm.view
    → discover/open tenant-owned CRM records

crm.party.manage
    → create/update/archive party master data
    → maintain person/organisation subtype data
    → maintain business classifications
    → maintain primary email/phone

crm.contact.manage
    → create/link organisation contacts
    → change primary organisation contact
    → end current contact relationships while preserving history

crm.manage
    → umbrella fallback
```

Package 002 party identity is independent from platform identity:

```text
parties
├─ party_persons
└─ party_organisations
```

Business roles on a party classify the real-world relationship; they do not grant NuBlox permissions.

### Opportunity authority

```text
crm.opportunity.manage
    → create opportunities
    → maintain pipeline stage, value, expected close and outcome
    → change primary prospective customer
    → add/remove non-primary opportunity parties

crm.activity.manage
    → add activity timeline entries
    → attach external CRM parties and internal member context

crm.manage
    → umbrella fallback for both
```

Opportunity reads use `crm.view`. Mutations remain tenant-scoped by `organisation_id` in repository queries and composite foreign keys.

A new opportunity requires one active/non-archived CRM party as the primary prospective customer. Additional `opportunity_parties` rows classify contacts, decision makers, consultants, referrers and other participants without duplicating CRM identity.

The database guarantees one primary opportunity-party assignment. The application blocks deletion of the primary assignment until a different primary customer is selected.

### Pipeline and outcome semantics

```text
pipeline stage → sales maturity
opportunity.status → business outcome
```

The default pipeline stages are Lead, Qualified, Proposal and Negotiation. `open`, `won`, `lost` and `cancelled` remain opportunity statuses rather than duplicate pipeline stages.

Existing organisations with no pipeline receive the default Sales pipeline through the forward migration. Future organisations receive the same pipeline through an audited, idempotent first-use transaction when a suitably authorised actor enters opportunity management. The transaction locks the organisation row before checking/creating pipeline state.

Package 002 pipeline stages do not have external public IDs. Request transport therefore uses pipeline `public_id` plus stage name; the service resolves the exact tenant/pipeline/stage row server-side. Internal stage IDs never cross the request boundary.

### CRM activity timeline

Opportunity-linked timeline entries use:

```text
crm_activities
├─ crm_activity_parties   → external CRM party participants
└─ crm_activity_members   → internal organisation-member participants
```

The acting member is stored as the activity owner. Activity type, direction, subject, notes, occurrence time and participant links remain relational. Activity creation appends audit evidence.

Standalone non-opportunity activities and custom pipeline administration are not claimed implemented in this slice.

## 9. Implemented commercial access model

Package 003 commercial records are private tenant-owned sales documents. The normal read boundary is:

```text
active NuBlox user
AND active organisation membership
AND commercial.view
AND commercial record organisation_id = active tenant organisation_id
```

Mutation additionally requires the operation-specific granular permission or `commercial.manage` umbrella fallback plus document/version lifecycle policy.

Direct estimate/quotation public IDs from another tenant are masked as not found.

### Estimate authority

```text
commercial.estimate.manage
    → create estimate from same-tenant CRM opportunity
    → maintain draft estimate lines and cost components
    → remove draft lines
    → finalise a draft estimate version

commercial.manage
    → umbrella fallback
```

Estimate creation requires the CRM opportunity to be same-tenant and not lost/cancelled. The primary CRM opportunity customer remains the source identity; the estimate does not create another customer master.

Estimate version 1 starts `draft`. Final/superseded versions are immutable through normal application writes. Finalisation requires at least one estimate line.

### Quotation draft authority

```text
commercial.quotation.manage
    → create quotation from a final estimate version
    → maintain draft quotation header
    → add/remove draft quotation lines
    → apply/clear draft line tax snapshots
    → add commercial narrative blocks

commercial.manage
    → umbrella fallback
```

Quotation creation retains the exact source estimate version through `quotation_version_estimates` and source estimate-item provenance on copied quotation lines. The customer remains the linked Package 002 CRM party.

### Quotation issue authority

```text
commercial.quotation.issue
    → verify draft/version integrity
    → snapshot customer/contact identity and current primary addresses
    → lock quotation version as issued
    → create issue/recipient evidence

commercial.manage
    → umbrella fallback
```

Issue requires at least one line. Once issued, that quotation version is immutable through normal application writes. Issue-time party/address snapshots intentionally preserve what was sent even if CRM data later changes.

This application boundary records issue evidence. It does not yet claim production outbound quotation email delivery.

### Quotation response authority

```text
commercial.quotation.response.record
    → record accepted/rejected/revision-requested/withdrawn-by-customer evidence

commercial.manage
    → umbrella fallback
```

Responses can be recorded only against an issued/locked quotation version. A second acceptance is rejected. Effective quotation status is derived from version state, response evidence and validity date rather than maintained as another editable status field.

### Tax and calculation integrity

Tenant tax configuration is resolved while a quotation is draft, then `quotation_item_taxes` snapshots applied rate, taxable amount and tax amount. Issued totals therefore do not require a mutable future tax rate for reconstruction.

Authoritative estimate/quotation arithmetic uses scaled `BigInt` decimal calculations, not JavaScript binary floating-point math. Quantity uses scale 6; money/rates and percentages use scale 4; scale reduction uses half-up rounding.

Current base totals exclude optional lines until an explicit customer option-selection model exists.

Not yet implemented: estimate version-2 revision workflow, quotation version-2/supersession/withdrawal workflow, option selection, catalogue/tax administration UI, PDF rendering, production outbound quote delivery, accepted-quotation-to-project conversion or contract formation.

## 10. Implemented project access model

Project authority remains split into creation, viewing, lifecycle management, participant administration, team administration and participation response.

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

A same-organisation employee with `project.view` but no `project_members` row does not inherit project access from colleagues or organisation participation.

Lifecycle mutation additionally requires the active organisation to own the project and the transition to be valid.

## 11. Project participant and team administration

Project collaboration reuses:

```text
projects
  ├─ project_organisations
  │    └─ project_organisation_roles
  └─ project_members
       └─ project_member_roles
```

Only the project owner may manage participant organisations. Each participant manages only its own project members. Invitation response is a deliberate pre-project-scope boundary using organisation-level `project.participation.manage` (or umbrella fallback) against the exact pending invitation. Acceptance atomically establishes participation and the accepting member's first project scope.

Project-role assignments are contextual metadata and never grant application permission.

The service prevents removal of the final active scoped member with effective `project.team.manage` authority until another scoped project-team manager exists.

## 12. Cross-organisation and CRM separation

Private CRM records are not automatically shared because the same external business later becomes a NuBlox project participant. Commercial documents also remain private tenant records unless an explicit future sharing/project-conversion workflow says otherwise.

Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 13. Tenant-isolation rules

- Server derives tenant context from authenticated active membership.
- Tenant-owned repository methods include tenant context; no record is fetched by internal ID alone where tenancy applies.
- CRM party, opportunity, pipeline and activity reads/writes include the active tenant `organisation_id`.
- Estimate, quotation, tax-snapshot, issue, party-snapshot and response reads/writes include the active tenant `organisation_id`.
- A CRM party must never become a platform-global identity by inference.
- Project reads require exact-member scope rather than organisation participation alone.
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

- same-tenant allow and denied-role behavior;
- different-tenant denial and direct-public-ID masking;
- granular member deny overriding umbrella permission;
- umbrella compatibility when no granular decision exists;
- account invitation/bootstrap boundaries;
- migrated/bootstrap standard-role parity;
- CRM party/contact permission separation and subtype invariants;
- CRM opportunity/activity permission separation;
- opportunity cross-tenant party/pipeline rejection;
- opportunity primary-customer uniqueness and participant history;
- opportunity stage/outcome/closed-at behavior;
- activity external-party and internal-member junction integrity;
- default CRM pipeline first-use idempotency and audit evidence;
- commercial read vs estimate/quotation/issue/response authority separation;
- same-tenant opportunity requirement for estimate creation;
- cross-tenant estimate and quotation public-ID masking;
- fixed-point estimate sell/cost/margin arithmetic;
- final estimate version immutability;
- quotation creation only from a final estimate version;
- CRM customer identity reuse rather than copied master data;
- tax rate/amount snapshot arithmetic;
- quotation issue locking and party/address snapshots;
- post-issue mutation rejection;
- response-before-issue rejection and single-acceptance semantics;
- project exact-member scope and participant/team isolation;
- project invitation-response exception and participant leave/removal behavior;
- final scoped project-team-manager protection.

The latest executable Package 003 candidate passes **13 integration files / 57 real-MySQL tests**, all **10 production migrations** on MySQL 8.4.11, the unchanged **344 / 749 / 429** structural assertions, zero generated Kysely drift and `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised head is required to pass the same gate before merge.
