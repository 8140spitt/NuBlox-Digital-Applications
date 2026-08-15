# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox combines authentication, tenant membership, RBAC, capability entitlements, project scope, tenant-record scope and contextual business policy.

A career is **not** a security role. Job titles may inform role design but never confer authority automatically.

## 2. Identity model

```text
User
 ├─ Organisation Membership A
 │    ├─ organisation roles / member overrides
 │    ├─ private CRM records owned by Organisation A
 │    └─ project memberships
 └─ Organisation Membership B
      ├─ different roles / overrides
      ├─ different private CRM records
      └─ different project memberships
```

A CRM representation of a real-world person or business is not the same identity as a NuBlox user, organisation member or platform organisation.

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
```

For an operation governed by a granular key, NuBlox resolves that granular key first. The umbrella is considered only when the granular key has no explicit member or active-role decision.

```text
granular member deny
    > granular member allow / granular role grant
    > umbrella fallback
    > default deny
```

An explicit granular deny therefore cannot be bypassed by `project.manage` or `crm.manage`.

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

Planned domain namespaces include `document.*`, `commercial.*`, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` as those application workflows are activated.

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

Owner and Administrator retain the broad project and CRM management umbrellas plus the granular project and party/contact permissions already seeded by bootstrap:

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
```

Because `crm.manage` is an umbrella, Owner/Administrator may perform opportunity/activity management unless a granular member decision overrides it.

### Manager

Manager receives operationally broad but deliberately granular authority:

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

Manager does **not** receive `project.manage` or `crm.manage`. Newly introduced `crm.opportunity.manage` and `crm.activity.manage` are deliberately not auto-granted to Manager: organisations delegate them explicitly to the roles/members responsible for sales/opportunity work.

### Other standard roles

```text
Finance/Commercial  → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives Owner only. Existing custom roles holding broad umbrellas remain compatible unless an explicit granular exception overrides them.

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

## 9. Implemented project access model

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

## 10. Project participant and team administration

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

## 11. Cross-organisation and CRM separation

Private CRM records are not automatically shared because the same external business later becomes a NuBlox project participant. Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 12. Tenant-isolation rules

- Server derives tenant context from authenticated active membership.
- Tenant-owned repository methods include tenant context; no record is fetched by internal ID alone where tenancy applies.
- CRM party, opportunity, pipeline and activity reads/writes include the active tenant `organisation_id`.
- A CRM party must never become a platform-global identity by inference.
- Project reads require exact-member scope rather than organisation participation alone.
- Cross-organisation project-team administration is denied.
- Search, caches, exports, files and background jobs must preserve tenancy boundaries.
- Platform support access requires a privileged auditable workflow.

## 13. Session requirements

- secure HttpOnly cookies where cookie sessions are used;
- Secure in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up where high-risk policy requires it.

## 14. Permission, scope and provisioning testing

Automated release gates cover at least:

- same-tenant allow and denied-role behavior;
- different-tenant denial and direct-public-ID masking;
- granular member deny overriding umbrella permission;
- umbrella compatibility when no granular decision exists;
- account invitation/bootstrap boundaries;
- CRM party/contact permission separation and subtype invariants;
- CRM opportunity/activity permission separation;
- opportunity cross-tenant party/pipeline rejection;
- opportunity primary-customer uniqueness and participant history;
- opportunity stage/outcome/closed-at behavior;
- activity external-party and internal-member junction integrity;
- default CRM pipeline first-use idempotency and audit evidence;
- project exact-member scope and participant/team isolation;
- project invitation-response exception and participant leave/removal behavior;
- final scoped project-team-manager protection.

The CRM opportunities/activity executable close-out passes **12 integration files / 50 real-MySQL tests**, all **9 production migrations** on MySQL 8.4.11, the unchanged **344 / 749 / 429** structural assertions, zero generated Kysely drift and `svelte-check` with **0 errors / 0 warnings**. The final documentation-synchronised head is required to pass the same gate before merge.

Tenant isolation, controlled provisioning, explicit delegation and exact-member project scope remain release gates.
